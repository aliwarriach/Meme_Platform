"""add editor_document to memes

Revision ID: fba995690df0
Revises: 1a2b3c4d5e6f
Create Date: 2026-08-30 01:00:55.819799

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'fba995690df0'
down_revision: Union[str, Sequence[str], None] = '1a2b3c4d5e6f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Autogenerate also proposed dropping `imgflip_templates` — that's the one-off import
# script's own staging table (scripts/import_imgflip.py, see .claude/memory/meme-creator.md's
# Gotchas), created outside Alembic and not backed by an ORM model. Pre-existing drift
# between the live DB and the model metadata, unrelated to this change — deliberately
# left out of both directions below.


def upgrade() -> None:
    op.add_column('memes', sa.Column('editor_document', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('memes', 'editor_document')
