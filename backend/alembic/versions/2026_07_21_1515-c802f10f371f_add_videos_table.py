"""add_videos_table

Revision ID: c802f10f371f
Revises: b701f09f260e
Create Date: 2026-07-21 15:15:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'c802f10f371f'
down_revision: Union[str, None] = 'b701f09f260e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'videos',
        sa.Column('video_id', sa.UUID(), nullable=False),
        sa.Column('movie_id', sa.UUID(), nullable=True),
        sa.Column('filename', sa.String(), nullable=False),
        sa.Column('original_filename', sa.String(), nullable=False),
        sa.Column('storage_path', sa.String(), nullable=False),
        sa.Column('file_size_bytes', sa.BigInteger(), nullable=False),
        sa.Column('mime_type', sa.String(), nullable=False),
        sa.Column('duration_seconds', sa.Float(), nullable=True),
        sa.Column('width', sa.Integer(), nullable=True),
        sa.Column('height', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(), nullable=False, server_default='READY'),
        sa.Column('format', sa.String(), nullable=False, server_default='mp4'),
        sa.Column('master_playlist_url', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['movie_id'], ['movies.movie_id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('video_id'),
        sa.UniqueConstraint('filename')
    )
    op.create_index(op.f('ix_videos_video_id'), 'videos', ['video_id'], unique=False)
    op.create_index(op.f('ix_videos_movie_id'), 'videos', ['movie_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_videos_movie_id'), table_name='videos')
    op.drop_index(op.f('ix_videos_video_id'), table_name='videos')
    op.drop_table('videos')
