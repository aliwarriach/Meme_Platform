"""add google_sub to users

Revision ID: 02d062f18d5a
Revises: 6471115f0fe4
Create Date: 2026-08-19 19:23:39.216902

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '02d062f18d5a'
down_revision: Union[str, Sequence[str], None] = '6471115f0fe4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# NOTE: autogenerate again detected the pre-existing, unrelated `imgflip_templates` drift
# (see d069c6a9dd24's note) and proposed dropping it. Left out of this migration too.


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('users', sa.Column('google_sub', sa.String(length=255), nullable=True))
    op.create_unique_constraint('uq_users_google_sub', 'users', ['google_sub'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('uq_users_google_sub', 'users', type_='unique')
    op.drop_column('users', 'google_sub')
