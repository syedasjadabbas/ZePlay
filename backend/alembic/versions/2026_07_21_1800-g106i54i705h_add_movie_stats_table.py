"""add_movie_stats_table

Revision ID: g106i54i705h
Revises: f105h43h604g
Create Date: 2026-07-21 18:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'g106i54i705h'
down_revision = 'f105h43h604g'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table(
        'movie_stats',
        sa.Column('stats_id', sa.UUID(), nullable=False),
        sa.Column('movie_id', sa.UUID(), nullable=False),
        sa.Column('view_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('watch_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('popularity_score', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('last_viewed_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['movie_id'], ['movies.movie_id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('stats_id'),
        sa.UniqueConstraint('movie_id')
    )
    op.create_index(op.f('ix_movie_stats_stats_id'), 'movie_stats', ['stats_id'], unique=False)
    op.create_index(op.f('ix_movie_stats_movie_id'), 'movie_stats', ['movie_id'], unique=True)

def downgrade() -> None:
    op.drop_index(op.f('ix_movie_stats_movie_id'), table_name='movie_stats')
    op.drop_index(op.f('ix_movie_stats_stats_id'), table_name='movie_stats')
    op.drop_table('movie_stats')
