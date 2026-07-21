"""add_watch_history_table

Revision ID: f105h43h604g
Revises: e104g32g593f
Create Date: 2026-07-21 17:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'f105h43h604g'
down_revision: Union[str, None] = 'e104g32g593f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'watch_history',
        sa.Column('history_id', sa.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('user_id', sa.UUID(as_uuid=True), sa.ForeignKey('users.user_id', ondelete='CASCADE'), nullable=False),
        sa.Column('profile_id', sa.UUID(as_uuid=True), sa.ForeignKey('profiles.profile_id', ondelete='CASCADE'), nullable=False),
        sa.Column('movie_id', sa.UUID(as_uuid=True), sa.ForeignKey('movies.movie_id', ondelete='CASCADE'), nullable=False),
        sa.Column('video_id', sa.UUID(as_uuid=True), sa.ForeignKey('videos.video_id', ondelete='CASCADE'), nullable=True),
        sa.Column('current_position', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('duration', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('percentage_watched', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('last_watched', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint('profile_id', 'movie_id', name='uq_profile_movie_watch_history')
    )
    op.create_index('ix_watch_history_history_id', 'watch_history', ['history_id'], unique=False)
    op.create_index('ix_watch_history_user_id', 'watch_history', ['user_id'], unique=False)
    op.create_index('ix_watch_history_profile_id', 'watch_history', ['profile_id'], unique=False)
    op.create_index('ix_watch_history_movie_id', 'watch_history', ['movie_id'], unique=False)
    op.create_index('ix_watch_history_video_id', 'watch_history', ['video_id'], unique=False)
    op.create_index('ix_watch_history_last_watched', 'watch_history', ['last_watched'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_watch_history_last_watched', table_name='watch_history')
    op.drop_index('ix_watch_history_video_id', table_name='watch_history')
    op.drop_index('ix_watch_history_movie_id', table_name='watch_history')
    op.drop_index('ix_watch_history_profile_id', table_name='watch_history')
    op.drop_index('ix_watch_history_user_id', table_name='watch_history')
    op.drop_index('ix_watch_history_history_id', table_name='watch_history')
    op.drop_table('watch_history')
