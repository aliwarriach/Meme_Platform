"""add blocks table

Revision ID: 3b8ea06b46a8
Revises: 027492eb1039
Create Date: 2026-08-19 16:05:43.514982

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '3b8ea06b46a8'
down_revision: Union[str, Sequence[str], None] = '027492eb1039'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# NOTE: autogenerate again detected the pre-existing, unrelated `imgflip_templates` drift
# (see d069c6a9dd24's note) and proposed dropping it. Left out of this migration too.


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('blocks',
    sa.Column('blocker_id', sa.Uuid(), nullable=False),
    sa.Column('blocked_id', sa.Uuid(), nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.CheckConstraint('blocker_id <> blocked_id', name='ck_blocks_not_self'),
    sa.ForeignKeyConstraint(['blocked_id'], ['users.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['blocker_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('blocker_id', 'blocked_id', name='uq_blocks_blocker_blocked')
    )
    op.create_index('ix_blocks_blocked_blocker', 'blocks', ['blocked_id', 'blocker_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_blocks_blocked_blocker', table_name='blocks')
    op.drop_table('blocks')
