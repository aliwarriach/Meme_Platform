"""Roadmap_Scaling.md D1 — "Seed a realistic dataset first: a 10-user database makes
every query look fast and proves nothing." Creates a bulk pool of verified users and
memes directly against the database (not through the rate-limited HTTP endpoints —
registering hundreds of users through `/auth/register`'s 5/minute limit would take
hours and would only be testing the rate limiter, not the feed), then mints real JWTs
for each user the same way `core.security.create_access_token` does for a real login.

Run inside a pod that already has the app's settings/DB access wired up (no secrets
ever printed to the caller's terminal):

    kubectl exec deploy/api -- python scripts/seed_load_test_data.py \
        --users 300 --memes-per-user 5 > tokens_and_memes.json

Then `kubectl cp` isn't even needed — capture stdout directly into a local file for
k6's `SharedArray` to load. Idempotent-ish: re-running adds more users/memes rather
than erroring, so it's safe to bump `--users` up before a bigger run without starting
over.
"""

import argparse
import asyncio
import json
import random
import sys
import uuid
from datetime import datetime, timezone

from app.core.security import create_access_token, hash_password
from app.db.session import async_session_factory
from app.models.meme import Meme
from app.models.post_audience import AudienceType, PostAudience
from app.models.user import User

CAPTIONS = [
    "when the deploy finally goes green",
    "me explaining to Karpenter why I need more nodes",
    "nobody: / the HPA at 3am:",
    "that feeling when the cache actually hits",
    "POV: you're the one unindexed query",
    "when pgbouncer saves your entire weekend",
    "the graph before vs after the fix",
    "me watching the load test dashboard",
]


async def main(n_users: int, memes_per_user: int) -> None:
    users_out = []
    # Hashed once, not per user: these are throwaway load-test fixtures minted straight
    # to a JWT (see below) - nothing ever logs in with this password, so there's no
    # reason to pay bcrypt's ~150-300ms cost N times. Real user passwords must never
    # share a hash; this one deliberately does, and only because it is never used as one.
    shared_hash = hash_password("LoadTest123!")
    async with async_session_factory() as db:
        users = []
        for i in range(n_users):
            uname = f"loadtest_{uuid.uuid4().hex[:12]}"
            user = User(
                email=f"{uname}@test.com",
                username=uname,
                hashed_password=shared_hash,
                date_of_birth=datetime(2000, 1, 1, tzinfo=timezone.utc).date(),
                email_verified_at=datetime.now(timezone.utc),
            )
            db.add(user)
            users.append(user)
        await db.flush()

        memes = []
        for user in users:
            for _ in range(memes_per_user):
                public_id = f"loadtest/{uuid.uuid4().hex}"
                meme = Meme(
                    author_id=user.id,
                    image_url=f"https://res.cloudinary.com/demo/image/upload/{public_id}.jpg",
                    image_public_id=public_id,
                    caption=random.choice(CAPTIONS),
                )
                db.add(meme)
                memes.append(meme)
        await db.flush()

        for meme in memes:
            db.add(PostAudience(meme_id=meme.id, audience_type=AudienceType.public))

        await db.commit()

        for user in users:
            token = create_access_token(user.id, user.token_version)
            users_out.append({"user_id": str(user.id), "username": user.username, "token": token})

    print(json.dumps({"users": users_out, "meme_count": len(memes)}), file=sys.stdout)
    print(
        f"seeded {len(users_out)} users, {len(memes)} memes",
        file=sys.stderr,
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--users", type=int, default=300)
    parser.add_argument("--memes-per-user", type=int, default=5)
    args = parser.parse_args()
    asyncio.run(main(args.users, args.memes_per_user))
