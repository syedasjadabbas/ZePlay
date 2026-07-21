"""add_is_admin_to_users

Revision ID: d903f21f482e
Revises: c802f10f371f
Create Date: 2026-07-21 15:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'd903f21f482e'
down_revision: Union[str, None] = 'c802f10f371f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Check/add is_admin column to users table with default False
    op.add_column(
        'users',
        sa.Column('is_admin', sa.Boolean(), server_default=sa.text('0'), nullable=False)
    )


def downgrade() -> None:
    op.drop_column('users', 'is_admin')
