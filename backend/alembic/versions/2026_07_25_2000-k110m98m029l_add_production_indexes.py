"""Add production performance indexes

Revision ID: k110m98m029l
Revises: c7b8fdcd7dc7
Create Date: 2026-07-25 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'k110m98m029l'
down_revision: Union[str, None] = 'c7b8fdcd7dc7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Safely create performance indexes if they don't exist
    bind = op.get_bind()
    insp = sa.inspect(bind)

    existing_movies_indexes = [idx['name'] for idx in insp.get_indexes('movies')]
    if 'ix_movies_release_year' not in existing_movies_indexes:
        op.create_index('ix_movies_release_year', 'movies', ['release_year'], unique=False)

    existing_videos_indexes = [idx['name'] for idx in insp.get_indexes('videos')]
    if 'ix_videos_status' not in existing_videos_indexes:
        op.create_index('ix_videos_status', 'videos', ['status'], unique=False)

    existing_subs_indexes = [idx['name'] for idx in insp.get_indexes('user_subscriptions')]
    if 'ix_user_subscriptions_status' not in existing_subs_indexes:
        op.create_index('ix_user_subscriptions_status', 'user_subscriptions', ['status'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_user_subscriptions_status', table_name='user_subscriptions')
    op.drop_index('ix_videos_status', table_name='videos')
    op.drop_index('ix_movies_release_year', table_name='movies')
