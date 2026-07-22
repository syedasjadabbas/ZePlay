"""add_subscription_tables

Revision ID: j109l87l018k
Revises: i108k76k907j
Create Date: 2026-07-22 11:16:00.000000

"""
from alembic import op
import sqlalchemy as sa
from datetime import datetime, timezone

# revision identifiers, used by Alembic.
revision = 'j109l87l018k'
down_revision = 'i108k76k907j'
branch_labels = None
depends_on = None

# UUIDs for the two seed plans (fixed so they are idempotent)
FREE_PLAN_ID    = "00000000-0000-0000-0000-000000000001"
PREMIUM_PLAN_ID = "00000000-0000-0000-0000-000000000002"


def upgrade() -> None:
    conn = op.get_bind()

    # --- subscription_plans table (idempotent) -----------------------------
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS subscription_plans (
            id TEXT NOT NULL PRIMARY KEY,
            name VARCHAR NOT NULL UNIQUE,
            description VARCHAR,
            max_profiles INTEGER NOT NULL DEFAULT 1,
            supports_4k BOOLEAN NOT NULL DEFAULT 0,
            supports_multi_device BOOLEAN NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """))

    conn.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_subscription_plans_name ON subscription_plans (name)"
    ))

    # --- user_subscriptions table (idempotent) -----------------------------
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS user_subscriptions (
            id TEXT NOT NULL PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
            plan_id TEXT NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
            status VARCHAR NOT NULL DEFAULT 'active',
            start_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            end_date DATETIME,
            auto_renew BOOLEAN NOT NULL DEFAULT 1,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """))

    conn.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_user_subscriptions_id ON user_subscriptions (id)"
    ))
    conn.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_user_subscriptions_user_id ON user_subscriptions (user_id)"
    ))

    # --- Seed default plans (idempotent via INSERT OR IGNORE) ---------------
    now = datetime.now(timezone.utc).isoformat()
    conn.execute(sa.text(f"""
        INSERT OR IGNORE INTO subscription_plans (id, name, description, max_profiles, supports_4k, supports_multi_device, created_at)
        VALUES
          ('{FREE_PLAN_ID}',    'free',    'Standard streaming with 1 profile.', 1, 0, 0, '{now}'),
          ('{PREMIUM_PLAN_ID}', 'premium', 'Premium badge, up to 4 profiles, 4K and multi-device ready.', 4, 1, 1, '{now}')
    """))


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("DROP TABLE IF EXISTS user_subscriptions"))
    conn.execute(sa.text("DROP TABLE IF EXISTS subscription_plans"))
