"""add_profile_pin

Revision ID: 043a828cda93
Revises: j109l87l018k
Create Date: 2026-07-22 12:48:21.216437

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '043a828cda93'
down_revision: Union[str, None] = 'j109l87l018k'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('profiles', sa.Column('pin', sa.String(length=4), nullable=True))


def downgrade() -> None:
    op.drop_column('profiles', 'pin')
