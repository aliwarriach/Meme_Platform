"""add avatar_preset to users

Revision ID: 30b411e3db06
Revises: 02d062f18d5a
Create Date: 2026-08-26 15:19:49.182844

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '30b411e3db06'
down_revision: Union[str, Sequence[str], None] = '02d062f18d5a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Note: autogenerate also proposed `drop_table('imgflip_templates')` here — pre-existing
    # drift unrelated to this change (that table has no current model). Left alone rather
    # than silently dropped as a side effect of an avatar column migration.
    op.add_column('users', sa.Column('avatar_preset', sa.String(length=32), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'avatar_preset')
