"""Add composite title_id index and GIN trigram index for 100k catalog scale

Revision ID: n113p11p152o
Revises: m112o10o141n
Create Date: 2026-07-29 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'n113p11p152o'
down_revision: Union[str, None] = 'm112o10o141n'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name
    insp = sa.inspect(bind)

    existing_movie_indexes = [idx['name'] for idx in insp.get_indexes('movies')]

    # 1. Composite B-tree index on movies(title, movie_id) for fast keyset pagination & title ordering
    if 'ix_movies_title_id' not in existing_movie_indexes:
        op.create_index('ix_movies_title_id', 'movies', ['title', 'movie_id'], unique=False)

    # 2. PostgreSQL-only: GIN trigram index on title for fast ILIKE search & combined search+genre queries
    if dialect == 'postgresql':
        op.execute('CREATE EXTENSION IF NOT EXISTS pg_trgm')
        
        # Drop older GIST trigram index if exists to ensure planner chooses GIN index
        try:
            op.execute('DROP INDEX IF EXISTS ix_movies_title_trgm')
        except Exception:
            pass

        if 'ix_movies_title_trgm_gin' not in existing_movie_indexes:
            op.execute(
                'CREATE INDEX IF NOT EXISTS ix_movies_title_trgm_gin '
                'ON movies USING gin (title gin_trgm_ops)'
            )


def downgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name
    insp = sa.inspect(bind)

    existing_movie_indexes = [idx['name'] for idx in insp.get_indexes('movies')]

    if dialect == 'postgresql':
        try:
            op.execute('DROP INDEX IF EXISTS ix_movies_title_trgm_gin')
        except Exception:
            pass

    if 'ix_movies_title_id' in existing_movie_indexes:
        op.drop_index('ix_movies_title_id', table_name='movies')
