"""add icon_preset to communities

Revision ID: 7fb3a048c62c
Revises: 30b411e3db06
Create Date: 2026-08-26 19:02:57.793995

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '7fb3a048c62c'
down_revision: Union[str, Sequence[str], None] = '30b411e3db06'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Note: autogenerate also proposed `drop_table('imgflip_templates')` here — pre-existing
    # drift unrelated to this change (see 30b411e3db06's identical note). Left alone.
    op.add_column('communities', sa.Column('icon_preset', sa.String(length=32), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('communities', 'icon_preset')
