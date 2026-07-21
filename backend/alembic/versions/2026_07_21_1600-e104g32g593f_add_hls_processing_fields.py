"""add_hls_processing_fields

Revision ID: e104g32g593f
Revises: d903f21f482e
Create Date: 2026-07-21 16:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'e104g32g593f'
down_revision: Union[str, None] = 'd903f21f482e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add hls_path and error_message columns to videos table
    op.add_column(
        'videos',
        sa.Column('hls_path', sa.String(), nullable=True)
    )
    op.add_column(
        'videos',
        sa.Column('error_message', sa.String(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('videos', 'error_message')
    op.drop_column('videos', 'hls_path')
