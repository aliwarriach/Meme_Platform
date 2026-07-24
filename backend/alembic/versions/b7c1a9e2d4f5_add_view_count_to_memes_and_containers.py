"""add view_count to memes and meme_containers

Adds a plain impression counter to both content types — the "reach" spine of the new
scoring atom (services/scoring.py). Not a dedup'd view-event log (no per-view timestamps):
a deliberate low-abuse-cost tradeoff for a new platform, revisited if view-farming shows up.
Backfills existing rows to 0 via server_default.

Revision ID: b7c1a9e2d4f5
Revises: ff18f4b3fc3f
Create Date: 2026-07-24 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7c1a9e2d4f5'
down_revision: Union[str, Sequence[str], None] = 'ff18f4b3fc3f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'memes',
        sa.Column('view_count', sa.Integer(), nullable=False, server_default='0'),
    )
    op.add_column(
        'meme_containers',
        sa.Column('view_count', sa.Integer(), nullable=False, server_default='0'),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('meme_containers', 'view_count')
    op.drop_column('memes', 'view_count')
