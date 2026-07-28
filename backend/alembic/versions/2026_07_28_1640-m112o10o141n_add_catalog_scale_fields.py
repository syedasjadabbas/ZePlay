"""Add catalog scale fields: is_generated flag, created_at index, pg_trgm for title search

Revision ID: m112o10o141n
Revises: l111n09n030m
Create Date: 2026-07-28 16:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'm112o10o141n'
down_revision: Union[str, None] = 'l111n09n030m'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name
    insp = sa.inspect(bind)

    # 1. Add is_generated column to movies if missing
    columns = [col['name'] for col in insp.get_columns('movies')]
    if 'is_generated' not in columns:
        op.add_column(
            'movies',
            sa.Column(
                'is_generated',
                sa.Boolean(),
                nullable=False,
                server_default='0'  # SQLite uses 0/1; PostgreSQL also accepts 0
            )
        )

    # 2. Index on is_generated (fast cleanup queries)
    existing_movie_indexes = [idx['name'] for idx in insp.get_indexes('movies')]

    if 'ix_movies_is_generated' not in existing_movie_indexes:
        op.create_index('ix_movies_is_generated', 'movies', ['is_generated'], unique=False)

    # 3. Index on movies.created_at (for recently-added ordering)
    if 'ix_movies_created_at' not in existing_movie_indexes:
        op.create_index('ix_movies_created_at', 'movies', ['created_at'], unique=False)

    # 4. PostgreSQL-only: enable pg_trgm and create GiST trigram index on title
    if dialect == 'postgresql':
        # Enable extension (idempotent)
        op.execute('CREATE EXTENSION IF NOT EXISTS pg_trgm')

        # Trigram GiST index on title — allows fast ILIKE '%q%' at scale
        if 'ix_movies_title_trgm' not in existing_movie_indexes:
            op.execute(
                'CREATE INDEX IF NOT EXISTS ix_movies_title_trgm '
                'ON movies USING gist (title gist_trgm_ops)'
            )

        # Index on movie_stats.popularity_score for trending sort
        try:
            existing_stats_indexes = [idx['name'] for idx in insp.get_indexes('movie_stats')]
            if 'ix_movie_stats_popularity_score' not in existing_stats_indexes:
                op.create_index('ix_movie_stats_popularity_score', 'movie_stats', ['popularity_score'], unique=False)
            if 'ix_movie_stats_view_count' not in existing_stats_indexes:
                op.create_index('ix_movie_stats_view_count', 'movie_stats', ['view_count'], unique=False)
        except Exception:
            pass  # movie_stats may not exist in all envs


def downgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name
    insp = sa.inspect(bind)

    existing_movie_indexes = [idx['name'] for idx in insp.get_indexes('movies')]

    if dialect == 'postgresql':
        try:
            op.execute('DROP INDEX IF EXISTS ix_movies_title_trgm')
        except Exception:
            pass
        try:
            op.drop_index('ix_movie_stats_popularity_score', table_name='movie_stats')
        except Exception:
            pass
        try:
            op.drop_index('ix_movie_stats_view_count', table_name='movie_stats')
        except Exception:
            pass

    if 'ix_movies_created_at' in existing_movie_indexes:
        op.drop_index('ix_movies_created_at', table_name='movies')

    if 'ix_movies_is_generated' in existing_movie_indexes:
        op.drop_index('ix_movies_is_generated', table_name='movies')

    op.drop_column('movies', 'is_generated')
