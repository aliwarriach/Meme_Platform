"""add email_verified_at to users

Revision ID: d34ba3d4f7db
Revises: 3b8ea06b46a8
Create Date: 2026-08-19 17:34:13.442445

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'd34ba3d4f7db'
down_revision: Union[str, Sequence[str], None] = '3b8ea06b46a8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# NOTE: autogenerate again detected the pre-existing, unrelated `imgflip_templates` drift
# (see d069c6a9dd24's note) and proposed dropping it. Left out of this migration too.


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('users', sa.Column('email_verified_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'email_verified_at')
