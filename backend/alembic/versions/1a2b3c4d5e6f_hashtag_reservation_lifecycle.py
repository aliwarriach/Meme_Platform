"""hashtag reservation lifecycle + anti-squatting

Roadmap_Search.md S1. Replaces the permanent unique index on `challenges.hashtag_id`
(`ix_challenges_hashtag_id`, created as a plain unique `op.create_index` — an index, not a
`UniqueConstraint`, so it's dropped with `op.drop_index`) with a partial unique index that
only holds while the challenge is `setup`/`active` — once `evaluated`, the tag is free for
the next challenge to reserve.

Revision ID: 1a2b3c4d5e6f
Revises: 9c2a5e14d7f1
Create Date: 2026-08-27

"""
from collections.abc import Sequence
from typing import Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '1a2b3c4d5e6f'
down_revision: Union[str, Sequence[str], None] = '9c2a5e14d7f1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_index('ix_challenges_hashtag_id', table_name='challenges')
    # Non-unique index still wanted for FK lookups.
    op.create_index('ix_challenges_hashtag_id', 'challenges', ['hashtag_id'], unique=False)
    op.execute(
        "CREATE UNIQUE INDEX uq_challenge_live_hashtag ON challenges (hashtag_id) "
        "WHERE hashtag_id IS NOT NULL AND status <> 'evaluated'"
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("DROP INDEX IF EXISTS uq_challenge_live_hashtag")
    op.drop_index('ix_challenges_hashtag_id', table_name='challenges')
    op.create_index('ix_challenges_hashtag_id', 'challenges', ['hashtag_id'], unique=True)
