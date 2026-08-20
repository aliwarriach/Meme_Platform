"""add soft-delete and avatar_public_id columns

Revision ID: 59703660c698
Revises: d34ba3d4f7db
Create Date: 2026-08-19 18:03:33.877977

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '59703660c698'
down_revision: Union[str, Sequence[str], None] = 'd34ba3d4f7db'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# NOTE: autogenerate again detected the pre-existing, unrelated `imgflip_templates` drift
# (see d069c6a9dd24's note) and proposed dropping it. Left out of this migration too.


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('comments', sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('memes', sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('users', sa.Column('avatar_public_id', sa.String(length=255), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'avatar_public_id')
    op.drop_column('memes', 'deleted_at')
    op.drop_column('comments', 'deleted_at')
