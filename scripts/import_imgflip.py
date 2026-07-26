"""
One-off import script: pulls the top 100 meme templates from the Imgflip API,
uploads each image to Cloudinary, and stores the resulting metadata in Postgres.

Not part of the FastAPI app — run manually (see bottom of repo instructions).
Safe to re-run: existing rows (matched by imgflip's stable template id) are
updated in place rather than duplicated, and Cloudinary uploads are skipped
for templates already imported.

`imgflip_templates` is this script's own dedup cache — it is NOT read by the
app. Every run also syncs any cached rows missing from the app's real
`templates` table (matched by `image_public_id`), which is what
`GET /templates` actually serves. Requires TEMPLATE_UPLOADER_EMAIL (an
existing user to attribute the templates to; they're global, community_id
NULL). Pass --sync-only to skip the Imgflip fetch/Cloudinary upload and just
resync the existing cache into `templates`.
"""

import argparse
import asyncio
import logging
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

import asyncpg
import cloudinary
import cloudinary.uploader
import httpx
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / "backend" / ".env")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("import_imgflip")

IMGFLIP_GET_MEMES_URL = "https://api.imgflip.com/get_memes"
TEMPLATE_LIMIT = 100
CLOUDINARY_FOLDER = "imgflip_templates"
HTTP_TIMEOUT = 30.0
MAX_CONCURRENT_UPLOADS = 5

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS imgflip_templates (
    id SERIAL PRIMARY KEY,
    imgflip_id VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    cloudinary_url VARCHAR(1024) NOT NULL,
    public_id VARCHAR(255) NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    box_count INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
"""

UPSERT_SQL = """
INSERT INTO imgflip_templates (imgflip_id, name, cloudinary_url, public_id, width, height, box_count)
VALUES ($1, $2, $3, $4, $5, $6, $7)
ON CONFLICT (imgflip_id) DO UPDATE SET
    name = EXCLUDED.name,
    cloudinary_url = EXCLUDED.cloudinary_url,
    public_id = EXCLUDED.public_id,
    width = EXCLUDED.width,
    height = EXCLUDED.height,
    box_count = EXCLUDED.box_count;
"""


def require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        logger.error("Missing required environment variable: %s", name)
        sys.exit(1)
    return value


def to_asyncpg_dsn(database_url: str) -> str:
    """Strips the SQLAlchemy '+asyncpg' driver suffix so asyncpg.connect() accepts the DSN."""
    return database_url.replace("postgresql+asyncpg://", "postgresql://", 1)


async def fetch_templates(client: httpx.AsyncClient) -> list[dict]:
    response = await client.get(IMGFLIP_GET_MEMES_URL, timeout=HTTP_TIMEOUT)
    response.raise_for_status()
    payload = response.json()
    if not payload.get("success"):
        raise RuntimeError(f"Imgflip API returned an error: {payload}")
    return payload["data"]["memes"][:TEMPLATE_LIMIT]


async def download_image(client: httpx.AsyncClient, url: str) -> bytes:
    response = await client.get(url, timeout=HTTP_TIMEOUT)
    response.raise_for_status()
    return response.content


async def upload_to_cloudinary(image_bytes: bytes, public_id: str) -> dict:
    return await asyncio.to_thread(
        cloudinary.uploader.upload,
        image_bytes,
        folder=CLOUDINARY_FOLDER,
        public_id=public_id,
        resource_type="image",
        overwrite=True,
    )


async def import_one(
    template: dict,
    http_client: httpx.AsyncClient,
    db_pool: asyncpg.Pool,
    semaphore: asyncio.Semaphore,
) -> None:
    imgflip_id = template["id"]
    name = template["name"]

    async with semaphore:
        try:
            image_bytes = await download_image(http_client, template["url"])
        except (httpx.HTTPError, httpx.TimeoutException) as exc:
            logger.error("Failed to download template %s (%s): %s", imgflip_id, name, exc)
            return

        try:
            result = await upload_to_cloudinary(image_bytes, imgflip_id)
        except Exception as exc:
            logger.error("Failed to upload template %s (%s) to Cloudinary: %s", imgflip_id, name, exc)
            return

    try:
        async with db_pool.acquire() as conn:
            await conn.execute(
                UPSERT_SQL,
                imgflip_id,
                name,
                result["secure_url"],
                result["public_id"],
                template["width"],
                template["height"],
                template["box_count"],
            )
    except asyncpg.PostgresError as exc:
        logger.error("Failed to save template %s (%s) to database: %s", imgflip_id, name, exc)
        return

    logger.info("Imported template %s (%s)", imgflip_id, name)


async def sync_to_templates(db_pool: asyncpg.Pool, uploader_id: uuid.UUID) -> int:
    """Copies any `imgflip_templates` cache rows missing from the real `templates`
    table (matched by `image_public_id`, since Cloudinary public ids are unique
    per asset) — no re-download/re-upload needed, the Cloudinary asset already
    exists from a prior run."""
    async with db_pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT name, cloudinary_url, public_id
            FROM imgflip_templates t
            WHERE NOT EXISTS (
                SELECT 1 FROM templates tpl WHERE tpl.image_public_id = t.public_id
            )
            """
        )
        now = datetime.now(timezone.utc)
        for row in rows:
            await conn.execute(
                """
                INSERT INTO templates
                    (id, uploader_id, community_id, name, image_url, image_public_id, created_at, updated_at)
                VALUES ($1, $2, NULL, $3, $4, $5, $6, $6)
                """,
                uuid.uuid4(),
                uploader_id,
                row["name"][:100],
                row["cloudinary_url"],
                row["public_id"],
                now,
            )
    return len(rows)


async def resolve_uploader(db_pool: asyncpg.Pool, email: str) -> uuid.UUID:
    async with db_pool.acquire() as conn:
        user = await conn.fetchrow("SELECT id FROM users WHERE email = $1", email)
    if user is None:
        logger.error(
            "No user found with email %s — set TEMPLATE_UPLOADER_EMAIL to an existing user's email", email
        )
        sys.exit(1)
    return user["id"]


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--sync-only",
        action="store_true",
        help="Skip the Imgflip fetch/Cloudinary upload; just resync the existing cache into `templates`.",
    )
    args = parser.parse_args()

    cloudinary.config(
        cloud_name=require_env("CLOUDINARY_CLOUD_NAME"),
        api_key=require_env("CLOUDINARY_API_KEY"),
        api_secret=require_env("CLOUDINARY_API_SECRET"),
        secure=True,
    )
    database_url = to_asyncpg_dsn(require_env("DATABASE_URL"))
    uploader_email = require_env("TEMPLATE_UPLOADER_EMAIL")

    db_pool = await asyncpg.create_pool(database_url, min_size=1, max_size=MAX_CONCURRENT_UPLOADS)
    try:
        async with db_pool.acquire() as conn:
            await conn.execute(CREATE_TABLE_SQL)

        uploader_id = await resolve_uploader(db_pool, uploader_email)

        if not args.sync_only:
            async with httpx.AsyncClient() as http_client:
                try:
                    templates = await fetch_templates(http_client)
                except (httpx.HTTPError, httpx.TimeoutException, RuntimeError) as exc:
                    logger.error("Failed to fetch templates from Imgflip: %s", exc)
                    sys.exit(1)

                logger.info("Fetched %d templates from Imgflip, starting import...", len(templates))

                semaphore = asyncio.Semaphore(MAX_CONCURRENT_UPLOADS)
                await asyncio.gather(
                    *(import_one(t, http_client, db_pool, semaphore) for t in templates)
                )

        synced = await sync_to_templates(db_pool, uploader_id)
        logger.info("Synced %d new row(s) into the app's `templates` table.", synced)
    finally:
        await db_pool.close()

    logger.info("Done.")


if __name__ == "__main__":
    asyncio.run(main())
