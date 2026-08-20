"""add is_active flag to users

Revision ID: 027492eb1039
Revises: d069c6a9dd24
Create Date: 2026-08-19 16:01:07.612014

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '027492eb1039'
down_revision: Union[str, Sequence[str], None] = 'd069c6a9dd24'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# NOTE: autogenerate again detected the pre-existing, unrelated `imgflip_templates` drift
# (see d069c6a9dd24's note) and proposed dropping it. Left out of this migration too — it
# needs its own reviewed migration, not a side effect of an unrelated column add.


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('users', sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'is_active')
