"""add duel challenge type

Phase 21. Adds the `duel` challenge shape (1v1 friend challenge, no community, pulled
forward from Phase 20's deferred §3.4 now that Phase 19 chat/notifications exist to
deliver the invite) plus two dedupe/tracking columns used by the new notification cron
jobs: `leading_side_id` (side-overtaken detection) and `ending_soon_notified_at`
(one-shot "ending in 1h" flag).

Note on the enum: same rule as f4a7b2c9d813 — Postgres forbids *using* a brand-new enum
value in the transaction that adds it, but this migration only adds a column default of
NULL and never writes a 'duel' row, so it's safe in one revision.

Revision ID: 89147fd6d359
Revises: f4a7b2c9d813
Create Date: 2026-08-06

"""
from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = '89147fd6d359'
down_revision: Union[str, Sequence[str], None] = 'f4a7b2c9d813'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("ALTER TYPE challenge_type ADD VALUE IF NOT EXISTS 'duel'")

    op.add_column('challenges', sa.Column('invitee_id', sa.Uuid(), nullable=True))
    op.create_index(
        op.f('ix_challenges_invitee_id'), 'challenges', ['invitee_id'], unique=False
    )
    op.create_foreign_key(
        'fk_challenges_invitee_id_users',
        'challenges',
        'users',
        ['invitee_id'],
        ['id'],
        ondelete='CASCADE',
    )

    op.add_column('challenges', sa.Column('leading_side_id', sa.Uuid(), nullable=True))
    op.create_foreign_key(
        'fk_challenges_leading_side_id_challenge_sides',
        'challenges',
        'challenge_sides',
        ['leading_side_id'],
        ['id'],
        ondelete='SET NULL',
    )

    op.add_column(
        'challenges',
        sa.Column('ending_soon_notified_at', sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('challenges', 'ending_soon_notified_at')

    op.drop_constraint(
        'fk_challenges_leading_side_id_challenge_sides', 'challenges', type_='foreignkey'
    )
    op.drop_column('challenges', 'leading_side_id')

    op.drop_constraint('fk_challenges_invitee_id_users', 'challenges', type_='foreignkey')
    op.drop_index(op.f('ix_challenges_invitee_id'), table_name='challenges')
    op.drop_column('challenges', 'invitee_id')

    # Any duel must go before the enum value could meaningfully be considered unused.
    op.execute("DELETE FROM challenges WHERE challenge_type = 'duel'")
    # Postgres can't drop a single enum value; the type is left with 'duel' unused, which
    # is harmless and reversible only by recreating the type.
