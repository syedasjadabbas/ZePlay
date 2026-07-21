"""add_watchlist_table

Revision ID: h107j65j806i
Revises: g106i54i705h
Create Date: 2026-07-21 19:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'h107j65j806i'
down_revision = 'g106i54i705h'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table(
        'watchlist',
        sa.Column('watchlist_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('profile_id', sa.UUID(), nullable=False),
        sa.Column('movie_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.user_id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['profile_id'], ['profiles.profile_id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['movie_id'], ['movies.movie_id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('watchlist_id'),
        sa.UniqueConstraint('profile_id', 'movie_id', name='uq_profile_movie_watchlist')
    )
    op.create_index(op.f('ix_watchlist_watchlist_id'), 'watchlist', ['watchlist_id'], unique=False)
    op.create_index(op.f('ix_watchlist_user_id'), 'watchlist', ['user_id'], unique=False)
    op.create_index(op.f('ix_watchlist_profile_id'), 'watchlist', ['profile_id'], unique=False)
    op.create_index(op.f('ix_watchlist_movie_id'), 'watchlist', ['movie_id'], unique=False)

def downgrade() -> None:
    op.drop_index(op.f('ix_watchlist_movie_id'), table_name='watchlist')
    op.drop_index(op.f('ix_watchlist_profile_id'), table_name='watchlist')
    op.drop_index(op.f('ix_watchlist_user_id'), table_name='watchlist')
    op.drop_index(op.f('ix_watchlist_watchlist_id'), table_name='watchlist')
    op.drop_table('watchlist')
