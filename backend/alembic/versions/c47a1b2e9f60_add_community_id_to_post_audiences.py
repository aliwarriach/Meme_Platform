"""add community_id + constraints to post_audiences

Revision ID: c47a1b2e9f60
Revises: 9b1d4e6a2f53
Create Date: 2026-07-21 19:41:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c47a1b2e9f60'
down_revision: Union[str, Sequence[str], None] = '9b1d4e6a2f53'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('post_audiences', sa.Column('community_id', sa.Uuid(), nullable=True))
    op.create_index(
        op.f('ix_post_audiences_community_id'), 'post_audiences', ['community_id'], unique=False
    )
    op.create_foreign_key(
        None, 'post_audiences', 'communities', ['community_id'], ['id'], ondelete='CASCADE'
    )

    op.drop_constraint('uq_post_audience_meme_type', 'post_audiences', type_='unique')
    op.create_index(
        'uq_post_audience_public_friends',
        'post_audiences',
        ['meme_id', 'audience_type'],
        unique=True,
        postgresql_where=sa.text("audience_type != 'community'"),
    )
    op.create_index(
        'uq_post_audience_community',
        'post_audiences',
        ['meme_id', 'community_id'],
        unique=True,
        postgresql_where=sa.text("audience_type = 'community'"),
    )
    op.create_check_constraint(
        'ck_post_audience_community_id_presence',
        'post_audiences',
        "(audience_type = 'community') = (community_id IS NOT NULL)",
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('ck_post_audience_community_id_presence', 'post_audiences', type_='check')
    op.drop_index('uq_post_audience_community', table_name='post_audiences')
    op.drop_index('uq_post_audience_public_friends', table_name='post_audiences')
    op.create_unique_constraint(
        'uq_post_audience_meme_type', 'post_audiences', ['meme_id', 'audience_type']
    )

    op.drop_constraint(None, 'post_audiences', type_='foreignkey')
    op.drop_index(op.f('ix_post_audiences_community_id'), table_name='post_audiences')
    op.drop_column('post_audiences', 'community_id')
