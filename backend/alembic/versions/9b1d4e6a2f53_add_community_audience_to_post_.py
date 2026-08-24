"""add community value to post_audience_type enum

Revision ID: 9b1d4e6a2f53
Revises: 74485aecff71
Create Date: 2026-07-21 19:40:00.000000

Split from the column/constraint migration (c47a1b2e9f60) on purpose: Postgres
forbids using a brand-new enum value in the same transaction it was added
(`UnsafeNewEnumValueUsageError`). This still has to be a separate revision from
c47a1b2e9f60 (which uses the new value) for that reason, but a plain
`alembic upgrade head` from empty is safe end-to-end now — `alembic/env.py` sets
`transaction_per_migration=True` (Roadmap_Scaling.md A6/A7), so each revision
commits on its own before the next one starts. The old manual two-step
(`alembic upgrade 9b1d4e6a2f53` then `alembic upgrade head`) is no longer needed.
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
