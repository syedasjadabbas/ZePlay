"""initial catalog tables

Revision ID: 0002_catalog
Revises: 0001_initial
Create Date: 2026-07-21 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0002_catalog'
down_revision: Union[str, None] = '0001_initial'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create genres table
    op.create_table(
        'genres',
        sa.Column('genre_id', sa.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.PrimaryKeyConstraint('genre_id')
    )
    op.create_index(op.f('ix_genres_name'), 'genres', ['name'], unique=True)
    op.create_index(op.f('ix_genres_genre_id'), 'genres', ['genre_id'], unique=False)

    # 2. Create movies table
    op.create_table(
        'movies',
        sa.Column('movie_id', sa.UUID(as_uuid=True), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('release_year', sa.Integer(), nullable=False),
        sa.Column('duration_minutes', sa.Integer(), nullable=False),
        sa.Column('thumbnail_url', sa.String(), nullable=False),
        sa.Column('video_url', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('movie_id')
    )
    op.create_index(op.f('ix_movies_title'), 'movies', ['title'], unique=False)
    op.create_index(op.f('ix_movies_movie_id'), 'movies', ['movie_id'], unique=False)

    # 3. Create movie_genres junction table
    op.create_table(
        'movie_genres',
        sa.Column('movie_id', sa.UUID(as_uuid=True), nullable=False),
        sa.Column('genre_id', sa.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(['genre_id'], ['genres.genre_id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['movie_id'], ['movies.movie_id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('movie_id', 'genre_id')
    )


def downgrade() -> None:
    # Drop tables in reverse dependency order
    op.drop_table('movie_genres')
    
    op.drop_index(op.f('ix_movies_movie_id'), table_name='movies')
    op.drop_index(op.f('ix_movies_title'), table_name='movies')
    op.drop_table('movies')
    
    op.drop_index(op.f('ix_genres_genre_id'), table_name='genres')
    op.drop_index(op.f('ix_genres_name'), table_name='genres')
    op.drop_table('genres')
