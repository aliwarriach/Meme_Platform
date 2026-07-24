"""add meme_views and container_views dedup tables

Replaces the plain-counter view tracking (view_count column only) with a per-user dedup
ledger — a user can register at most one view per meme/container, ever, mirroring
MemeVote/ContainerVote's one-row-per-user shape. `memes.view_count`/`meme_containers.view_count`
stay as denormalized counters, now incremented only on the first insert into these tables per
user, so the scoring atom (services/scoring.py) keeps reading a plain column instead of a
COUNT(DISTINCT) aggregation.

Revision ID: d3e5f7a9c1b2
Revises: b7c1a9e2d4f5
Create Date: 2026-07-24 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd3e5f7a9c1b2'
down_revision: Union[str, Sequence[str], None] = 'b7c1a9e2d4f5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'meme_views',
        sa.Column('meme_id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['meme_id'], ['memes.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('meme_id', 'user_id', name='uq_meme_views_meme_user'),
    )
    op.create_index(op.f('ix_meme_views_meme_id'), 'meme_views', ['meme_id'], unique=False)
    op.create_index(op.f('ix_meme_views_user_id'), 'meme_views', ['user_id'], unique=False)

    op.create_table(
        'container_views',
        sa.Column('meme_container_id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['meme_container_id'], ['meme_containers.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint(
            'meme_container_id', 'user_id', name='uq_container_views_container_user'
        ),
    )
    op.create_index(
        op.f('ix_container_views_meme_container_id'), 'container_views', ['meme_container_id'], unique=False
    )
    op.create_index(op.f('ix_container_views_user_id'), 'container_views', ['user_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_container_views_user_id'), table_name='container_views')
    op.drop_index(op.f('ix_container_views_meme_container_id'), table_name='container_views')
    op.drop_table('container_views')

    op.drop_index(op.f('ix_meme_views_user_id'), table_name='meme_views')
    op.drop_index(op.f('ix_meme_views_meme_id'), table_name='meme_views')
    op.drop_table('meme_views')
