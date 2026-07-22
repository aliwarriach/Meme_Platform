import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.badge import Badge
from app.schemas.badges import BadgeOut


async def list_user_badges(db: AsyncSession, user_id: uuid.UUID) -> list[BadgeOut]:
    result = await db.execute(
        select(Badge).where(Badge.user_id == user_id).order_by(Badge.created_at.desc())
    )
    return [BadgeOut.model_validate(b) for b in result.scalars().all()]
