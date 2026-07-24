"""replace likes and period voting with upvote/downvote

Replaces the like-only `reactions`/`container_reactions` tables and the old per-period
`votes` table with a single Reddit-style upvote/downvote mechanic per content type:
`meme_votes` (new) and a redesigned `container_votes` (`value` +1/-1 instead of a
period-scoped one-shot vote row). Competitions now rank by net vote score within a
period window instead of raw vote count — see services/competitions.py.

Revision ID: ff18f4b3fc3f
Revises: cc9508a586a7
Create Date: 2026-07-24 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ff18f4b3fc3f'
down_revision: Union[str, Sequence[str], None] = 'cc9508a586a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_table('reactions')
    op.drop_table('container_reactions')
    op.drop_table('votes')

    # container_votes is redesigned in place: drop the old period-scoped shape, recreate
    # with the new upvote/downvote shape (no more period_type/period_key columns).
    op.drop_table('container_votes')

    op.create_table(
        'meme_votes',
        sa.Column('meme_id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('value', sa.SmallInteger(), nullable=False),
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['meme_id'], ['memes.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('meme_id', 'user_id', name='uq_meme_votes_meme_user'),
        sa.CheckConstraint('value IN (-1, 1)', name='ck_meme_votes_value'),
    )
    op.create_index(op.f('ix_meme_votes_meme_id'), 'meme_votes', ['meme_id'], unique=False)
    op.create_index(op.f('ix_meme_votes_user_id'), 'meme_votes', ['user_id'], unique=False)

    op.create_table(
        'container_votes',
        sa.Column('meme_container_id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('value', sa.SmallInteger(), nullable=False),
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['meme_container_id'], ['meme_containers.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint(
            'meme_container_id', 'user_id', name='uq_container_votes_container_user'
        ),
        sa.CheckConstraint('value IN (-1, 1)', name='ck_container_votes_value'),
    )
    op.create_index(
        op.f('ix_container_votes_meme_container_id'), 'container_votes', ['meme_container_id'], unique=False
    )
    op.create_index(op.f('ix_container_votes_user_id'), 'container_votes', ['user_id'], unique=False)

    # `competition_period_type` was only ever used by the two dropped period-vote tables'
    # `period_type` columns — no other table references it, so it's safe to drop now.
    op.execute('DROP TYPE IF EXISTS competition_period_type')


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("CREATE TYPE competition_period_type AS ENUM ('day', 'week', 'month')")

    op.drop_index(op.f('ix_container_votes_user_id'), table_name='container_votes')
    op.drop_index(op.f('ix_container_votes_meme_container_id'), table_name='container_votes')
    op.drop_table('container_votes')

    op.drop_index(op.f('ix_meme_votes_user_id'), table_name='meme_votes')
    op.drop_index(op.f('ix_meme_votes_meme_id'), table_name='meme_votes')
    op.drop_table('meme_votes')

    op.create_table(
        'container_votes',
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('meme_container_id', sa.Uuid(), nullable=False),
        sa.Column(
            'period_type',
            sa.Enum('day', 'week', 'month', name='competition_period_type'),
            nullable=False,
        ),
        sa.Column('period_key', sa.String(length=16), nullable=False),
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['meme_container_id'], ['meme_containers.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint(
            'user_id', 'meme_container_id', 'period_type', 'period_key',
            name='uq_container_votes_user_container_period',
        ),
    )
    op.create_index(
        op.f('ix_container_votes_meme_container_id'), 'container_votes', ['meme_container_id'], unique=False
    )
    op.create_index(op.f('ix_container_votes_period_key'), 'container_votes', ['period_key'], unique=False)
    op.create_index(op.f('ix_container_votes_user_id'), 'container_votes', ['user_id'], unique=False)

    op.create_table(
        'votes',
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('meme_id', sa.Uuid(), nullable=False),
        sa.Column(
            'period_type',
            sa.Enum('day', 'week', 'month', name='competition_period_type', create_type=False),
            nullable=False,
        ),
        sa.Column('period_key', sa.String(length=16), nullable=False),
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['meme_id'], ['memes.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint(
            'user_id', 'meme_id', 'period_type', 'period_key', name='uq_votes_user_meme_period'
        ),
    )
    op.create_index(op.f('ix_votes_meme_id'), 'votes', ['meme_id'], unique=False)
    op.create_index(op.f('ix_votes_period_key'), 'votes', ['period_key'], unique=False)
    op.create_index(op.f('ix_votes_user_id'), 'votes', ['user_id'], unique=False)

    op.create_table(
        'container_reactions',
        sa.Column('meme_container_id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['meme_container_id'], ['meme_containers.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint(
            'meme_container_id', 'user_id', name='uq_container_reactions_container_user'
        ),
    )
    op.create_index(
        op.f('ix_container_reactions_meme_container_id'), 'container_reactions', ['meme_container_id'], unique=False
    )
    op.create_index(op.f('ix_container_reactions_user_id'), 'container_reactions', ['user_id'], unique=False)

    op.create_table(
        'reactions',
        sa.Column('meme_id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['meme_id'], ['memes.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('meme_id', 'user_id', name='uq_reactions_meme_user'),
    )
    op.create_index(op.f('ix_reactions_meme_id'), 'reactions', ['meme_id'], unique=False)
    op.create_index(op.f('ix_reactions_user_id'), 'reactions', ['user_id'], unique=False)
