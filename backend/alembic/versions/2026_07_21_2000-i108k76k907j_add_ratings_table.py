"""add_ratings_table

Revision ID: i108k76k907j
Revises: h107j65j806i
Create Date: 2026-07-21 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'i108k76k907j'
down_revision: Union[str, None] = 'h107j65j806i'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'ratings',
        sa.Column('rating_id', sa.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', sa.UUID(as_uuid=True), nullable=False),
        sa.Column('profile_id', sa.UUID(as_uuid=True), nullable=False),
        sa.Column('movie_id', sa.UUID(as_uuid=True), nullable=False),
        sa.Column('score', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['movie_id'], ['movies.movie_id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['profile_id'], ['profiles.profile_id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.user_id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('rating_id'),
        sa.UniqueConstraint('profile_id', 'movie_id', name='uq_profile_movie_rating')
    )
    op.create_index(op.f('ix_ratings_movie_id'), 'ratings', ['movie_id'], unique=False)
    op.create_index(op.f('ix_ratings_profile_id'), 'ratings', ['profile_id'], unique=False)
    op.create_index(op.f('ix_ratings_rating_id'), 'ratings', ['rating_id'], unique=False)
    op.create_index(op.f('ix_ratings_user_id'), 'ratings', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_ratings_user_id'), table_name='ratings')
    op.drop_index(op.f('ix_ratings_rating_id'), table_name='ratings')
    op.drop_index(op.f('ix_ratings_profile_id'), table_name='ratings')
    op.drop_index(op.f('ix_ratings_movie_id'), table_name='ratings')
    op.drop_table('ratings')
