"""add is_platform_account flag to users

Revision ID: d069c6a9dd24
Revises: acb0458543db
Create Date: 2026-08-19 14:17:18.855674

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'd069c6a9dd24'
down_revision: Union[str, Sequence[str], None] = 'acb0458543db'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# NOTE: autogenerate also detected a pre-existing, unrelated drift — an `imgflip_templates`
# table present in the database with no corresponding model — and proposed dropping it.
# That's out of scope for this change (SecurityIssues.md M-6) and was deliberately left out
# of this migration; it needs its own reviewed migration, not a side effect of this one.


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('users', sa.Column('is_platform_account', sa.Boolean(), server_default='false', nullable=False))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'is_platform_account')
