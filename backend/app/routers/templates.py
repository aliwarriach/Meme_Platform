import uuid
from typing import Annotated

from fastapi import APIRouter, Form, Query, UploadFile

from app.core.deps import CurrentUser, DbSession
from app.schemas.templates import TemplateOut, TemplatePage
from app.services import templates as templates_service

router = APIRouter(prefix="/templates", tags=["templates"])


@router.post("", response_model=TemplateOut, status_code=201)
async def create_template(
    image: UploadFile,
    current_user: CurrentUser,
    db: DbSession,
    name: Annotated[str, Form(min_length=1, max_length=100)],
    community_id: Annotated[uuid.UUID | None, Form()] = None,
) -> TemplateOut:
    return await templates_service.create_template(db, current_user, name, image, community_id)


@router.get("", response_model=TemplatePage)
async def list_templates(
    current_user: CurrentUser,
    db: DbSession,
    cursor: str | None = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
) -> TemplatePage:
    return await templates_service.list_templates(db, cursor, limit)
