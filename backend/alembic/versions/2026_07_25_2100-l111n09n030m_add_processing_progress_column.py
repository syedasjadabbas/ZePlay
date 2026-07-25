"""Add processing_progress column to videos table

Revision ID: l111n09n030m
Revises: k110m98m029l
Create Date: 2026-07-25 21:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'l111n09n030m'
down_revision: Union[str, None] = 'k110m98m029l'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    columns = [col['name'] for col in insp.get_columns('videos')]
    if 'processing_progress' not in columns:
        op.add_column(
            'videos',
            sa.Column('processing_progress', sa.Float(), nullable=False, server_default='0.0')
        )


def downgrade() -> None:
    op.drop_column('videos', 'processing_progress')
