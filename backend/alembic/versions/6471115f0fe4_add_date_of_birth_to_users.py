"""add date_of_birth to users

Revision ID: 6471115f0fe4
Revises: 59703660c698
Create Date: 2026-08-19 18:47:50.318307

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '6471115f0fe4'
down_revision: Union[str, Sequence[str], None] = '59703660c698'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# NOTE: autogenerate again detected the pre-existing, unrelated `imgflip_templates` drift
# (see d069c6a9dd24's note) and proposed dropping it. Left out of this migration too.


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('users', sa.Column('date_of_birth', sa.Date(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'date_of_birth')
