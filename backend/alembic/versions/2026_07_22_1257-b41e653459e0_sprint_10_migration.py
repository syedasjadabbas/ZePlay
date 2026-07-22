"""sprint_10_migration

Revision ID: b41e653459e0
Revises: 043a828cda93
Create Date: 2026-07-22 12:57:50

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b41e653459e0'
down_revision: Union[str, None] = '043a828cda93'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create audit_logs table
    op.create_table('audit_logs',
        sa.Column('log_id', sa.UUID(), nullable=False),
        sa.Column('action', sa.String(), nullable=False),
        sa.Column('details', sa.Text(), nullable=True),
        sa.Column('metadata_json', sa.Text(), nullable=True),
        sa.Column('performed_by', sa.UUID(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['performed_by'], ['users.user_id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('log_id')
    )
    op.create_index(op.f('ix_audit_logs_action'), 'audit_logs', ['action'], unique=False)
    op.create_index(op.f('ix_audit_logs_created_at'), 'audit_logs', ['created_at'], unique=False)
    op.create_index(op.f('ix_audit_logs_log_id'), 'audit_logs', ['log_id'], unique=False)
    op.create_index(op.f('ix_audit_logs_performed_by'), 'audit_logs', ['performed_by'], unique=False)

    # Add is_active column to users table
    op.add_column('users', sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('1')))


def downgrade() -> None:
    op.drop_column('users', 'is_active')
    op.drop_index(op.f('ix_audit_logs_performed_by'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_log_id'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_created_at'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_action'), table_name='audit_logs')
    op.drop_table('audit_logs')
