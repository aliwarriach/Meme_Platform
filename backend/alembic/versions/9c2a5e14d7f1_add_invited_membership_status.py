"""add invited membership status

Revision ID: 9c2a5e14d7f1
Revises: 7fb3a048c62c
Create Date: 2026-08-27 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '9c2a5e14d7f1'
down_revision: Union[str, Sequence[str], None] = '7fb3a048c62c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Alembic autogenerate doesn't detect Postgres enum value additions — written by hand.
    # Safe to run inside this migration's own transaction (transaction_per_migration=True,
    # see alembic/env.py) since nothing in this same migration *uses* the new value yet.
    op.execute("ALTER TYPE membership_status ADD VALUE IF NOT EXISTS 'invited'")


def downgrade() -> None:
    """Downgrade schema."""
    # Postgres has no `ALTER TYPE ... DROP VALUE` — removing an enum value requires rebuilding
    # the type (rename old, create new, migrate the column, drop old), which is only worth doing
    # if a downgrade past this point is ever actually needed. Left as a no-op; any 'invited' rows
    # would need to be reassigned/deleted by hand before attempting a real rollback.
    pass
