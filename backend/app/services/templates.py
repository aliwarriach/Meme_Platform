import uuid

from fastapi import UploadFile
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import Select

from app.core.exceptions import InvalidImageSourceError
from app.core.pagination import decode_cursor, encode_cursor
from app.models.template import Template
from app.models.user import User
from app.schemas.templates import TemplateOut, TemplatePage
from app.services.communities import require_active_membership
from app.services.media import confirm_pending_upload, validate_and_upload_image


async def create_template(
    db: AsyncSession,
    current_user: User,
    name: str,
    image: UploadFile | None,
    community_id: uuid.UUID | None = None,
    image_public_id: str | None = None,
) -> TemplateOut:
    """`image` (legacy multipart upload) and `image_public_id` (Roadmap_Scaling.md A4's
    direct-to-Cloudinary flow — confirm the `public_id` from
    `POST /media/upload-signature`) are mutually exclusive; exactly one is required."""
    if community_id is not None:
        await require_active_membership(db, community_id, current_user.id)

    if image_public_id is not None:
        if image is not None:
            raise InvalidImageSourceError("Provide either an image file or image_public_id, not both")
        image_url, image_public_id = await confirm_pending_upload(current_user.id, image_public_id)
    elif image is not None:
        image_url, image_public_id = await validate_and_upload_image(image, folder="templates")
    else:
        raise InvalidImageSourceError("An image file or image_public_id is required")

    template = Template(
        uploader_id=current_user.id,
        community_id=community_id,
        name=name,
        image_url=image_url,
        image_public_id=image_public_id,
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return TemplateOut.model_validate(template)


async def _paginate_templates(
    db: AsyncSession, base_stmt: Select, cursor: str | None, limit: int
) -> TemplatePage:
    stmt = base_stmt.order_by(Template.created_at.desc(), Template.id.desc()).limit(limit + 1)

    if cursor:
        cursor_created_at, cursor_id = decode_cursor(cursor)
        stmt = stmt.where(
            or_(
                Template.created_at < cursor_created_at,
                and_(Template.created_at == cursor_created_at, Template.id < cursor_id),
            )
        )

    result = await db.execute(stmt)
    templates = list(result.scalars().all())

    has_more = len(templates) > limit
    templates = templates[:limit]

    items = [TemplateOut.model_validate(t) for t in templates]
    next_cursor = (
        encode_cursor(templates[-1].created_at, templates[-1].id) if has_more and templates else None
    )

    return TemplatePage(items=items, next_cursor=next_cursor)


async def list_templates(db: AsyncSession, cursor: str | None, limit: int) -> TemplatePage:
    base_stmt = select(Template).where(Template.community_id.is_(None))
    return await _paginate_templates(db, base_stmt, cursor, limit)


async def list_community_templates(
    db: AsyncSession,
    current_user: User,
    community_id: uuid.UUID,
    cursor: str | None,
    limit: int,
) -> TemplatePage:
    await require_active_membership(db, community_id, current_user.id)
    base_stmt = select(Template).where(Template.community_id == community_id)
    return await _paginate_templates(db, base_stmt, cursor, limit)
