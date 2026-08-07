"""create notifications and push tokens

Phase 21. The in-app notification centre (`notifications`) and registered Expo push
tokens (`push_tokens`). New chat messages deliberately don't write a `notifications` row
(see the model docstring) — only challenge-lifecycle events do, since those have no other
in-app surface the way conversations already do.

Revision ID: acb0458543db
Revises: 89147fd6d359
Create Date: 2026-08-06

"""
from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'acb0458543db'
down_revision: Union[str, Sequence[str], None] = '89147fd6d359'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'notifications',
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column(
            'type',
            sa.Enum(
                'challenge_invite',
                'challenge_invite_accepted',
                'challenge_invite_declined',
                'challenge_starting',
                'challenge_ending_soon',
                'challenge_side_overtaken',
                'challenge_results',
                name='notification_type',
            ),
            nullable=False,
        ),
        sa.Column('title', sa.String(length=150), nullable=False),
        sa.Column('body', sa.String(length=280), nullable=False),
        sa.Column('data', sa.JSON(), nullable=False),
        sa.Column('read_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_notifications_user_id'), 'notifications', ['user_id'], unique=False
    )
    op.create_index(
        'ix_notifications_user_created', 'notifications', ['user_id', 'created_at', 'id'], unique=False
    )

    op.create_table(
        'push_tokens',
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('token', sa.String(length=255), nullable=False),
        sa.Column('platform', sa.String(length=16), nullable=False),
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_push_tokens_user_id'), 'push_tokens', ['user_id'], unique=False)
    op.create_index(op.f('ix_push_tokens_token'), 'push_tokens', ['token'], unique=True)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_push_tokens_token'), table_name='push_tokens')
    op.drop_index(op.f('ix_push_tokens_user_id'), table_name='push_tokens')
    op.drop_table('push_tokens')

    op.drop_index('ix_notifications_user_created', table_name='notifications')
    op.drop_index(op.f('ix_notifications_user_id'), table_name='notifications')
    op.drop_table('notifications')

    op.execute('DROP TYPE notification_type')
