"""add community value to post_audience_type enum

Revision ID: 9b1d4e6a2f53
Revises: 74485aecff71
Create Date: 2026-07-21 19:40:00.000000

Split from the column/constraint migration (c47a1b2e9f60) on purpose: Postgres
forbids using a brand-new enum value in the same transaction it was added
(`UnsafeNewEnumValueUsageError`), and this repo's alembic env.py runs the whole
`upgrade head` invocation in a single transaction. Apply this revision on its own
first (`alembic upgrade 9b1d4e6a2f53`), then run `alembic upgrade head`.
"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '9b1d4e6a2f53'
down_revision: Union[str, Sequence[str], None] = '74485aecff71'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("ALTER TYPE post_audience_type ADD VALUE IF NOT EXISTS 'community'")


def downgrade() -> None:
    """Downgrade schema."""
    # Postgres has no DROP VALUE for enums — leaving 'community' as an unused value
    # on downgrade is harmless (the column/constraint migration removes its usages).
    pass
