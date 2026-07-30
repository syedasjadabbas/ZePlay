"""add payment_transactions table

Revision ID: o114q12q163p
Revises: n113p11p152o
Create Date: 2026-07-30 14:30:00.000000

"""
from alembic import op
import sqlalchemy as sm
from app.database import GUID

# revision identifiers, used by Alembic.
revision = 'o114q12q163p'
down_revision = 'n113p11p152o'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'payment_transactions',
        sm.Column('id', GUID(), nullable=False),
        sm.Column('user_id', GUID(), nullable=False),
        sm.Column('plan_name', sm.String(), nullable=False, server_default='premium'),
        sm.Column('amount', sm.Float(), nullable=False, server_default='9.99'),
        sm.Column('currency', sm.String(), nullable=False, server_default='USD'),
        sm.Column('status', sm.String(), nullable=False),
        sm.Column('card_brand', sm.String(), nullable=False, server_default='Visa'),
        sm.Column('last4', sm.String(), nullable=False, server_default='4242'),
        sm.Column('created_at', sm.DateTime(timezone=True), nullable=False),
        sm.ForeignKeyConstraint(['user_id'], ['users.user_id'], ondelete='CASCADE'),
        sm.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_payment_transactions_id', 'payment_transactions', ['id'], unique=False)
    op.create_index('ix_payment_transactions_user_id', 'payment_transactions', ['user_id'], unique=False)


def downgrade():
    op.drop_index('ix_payment_transactions_user_id', table_name='payment_transactions')
    op.drop_index('ix_payment_transactions_id', table_name='payment_transactions')
    op.drop_table('payment_transactions')
