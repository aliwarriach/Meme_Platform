"""add token_version to users

Revision ID: 95e49a19db9a
Revises: d3e5f7a9c1b2
Create Date: 2026-08-03 01:45:38.759161

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '95e49a19db9a'
down_revision: Union[str, Sequence[str], None] = 'd3e5f7a9c1b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('users', sa.Column('token_version', sa.Integer(), server_default='0', nullable=False))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'token_version')
