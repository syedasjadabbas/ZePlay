import os
import sys
import sqlite3
import uuid
import psycopg2
from urllib.parse import urlparse
from datetime import datetime

# Connection resolution from environment or defaults
SQLITE_DB_PATH = os.getenv("SQLITE_DB_PATH", os.path.join(os.path.dirname(__file__), "local_zeplay.db"))

def get_postgres_dsn():
    url = os.getenv("POSTGRES_URL") or os.getenv("DATABASE_URL")
    if url and url.startswith("postgresql"):
        # Convert asyncpg scheme to standard psycopg2 URL
        url = url.replace("postgresql+asyncpg://", "postgresql://")
        return url
    return os.getenv("POSTGRES_DSN", "host=localhost dbname=zeplay user=postgres password=postgres port=5432")

def clean_uuid(val):
    if val is None:
        return None
    if isinstance(val, bool):
        return val
    if isinstance(val, uuid.UUID):
        return str(val)
    if isinstance(val, int):
        try:
            return str(uuid.UUID(int=val))
        except ValueError:
            return str(val)
    val_str = str(val)
    clean_val = val_str.replace("-", "").replace(" ", "")
    if len(clean_val) == 32:
        try:
            return str(uuid.UUID(hex=clean_val))
        except ValueError:
            pass
    try:
        return str(uuid.UUID(int=int(val_str)))
    except ValueError:
        try:
            return str(uuid.UUID(val_str))
        except ValueError:
            return val_str

def clean_bool(val):
    if val is None:
        return None
    if isinstance(val, bool):
        return val
    if isinstance(val, int):
        return val != 0
    if isinstance(val, str):
        return val.lower() in ("true", "1", "t", "y", "yes")
    return bool(val)

def clean_datetime(val):
    if val is None:
        return None
    if isinstance(val, datetime):
        return val
    if isinstance(val, str):
        try:
            if val.endswith("Z"):
                val = val[:-1] + "+00:00"
            return datetime.fromisoformat(val)
        except ValueError:
            try:
                return datetime.strptime(val, "%Y-%m-%d %H:%M:%S.%f")
            except ValueError:
                try:
                    return datetime.strptime(val, "%Y-%m-%d %H:%M:%S")
                except ValueError:
                    return val
    return val

def migrate():
    if not os.path.exists(SQLITE_DB_PATH):
        print(f"Source SQLite database not found at {SQLITE_DB_PATH}. Migration skipped.")
        return

    print(f"Connecting to source SQLite at {SQLITE_DB_PATH}...")
    sqlite_conn = sqlite3.connect(SQLITE_DB_PATH)
    sqlite_conn.row_factory = sqlite3.Row
    sqlite_cursor = sqlite_conn.cursor()

    dsn = get_postgres_dsn()
    print("Connecting to target PostgreSQL...")
    pg_conn = psycopg2.connect(dsn)
    pg_conn.set_client_encoding('utf8')
    pg_cursor = pg_conn.cursor()

    # Tables to migrate in correct foreign key dependency order
    table_names = [
        "subscription_plans",
        "users",
        "user_subscriptions",
        "profiles",
        "genres",
        "movies",
        "movie_genres",
        "videos",
        "watch_history",
        "movie_stats",
        "watchlist",
        "email_verification_tokens",
        "password_reset_tokens",
        "ratings",
        "audit_logs"
    ]

    try:
        # Disable constraints for atomic bulk load
        print("Disabling PostgreSQL constraints (replica mode)...")
        pg_cursor.execute("SET session_replication_role = 'replica';")
        
        # Clear existing tables first
        print("Truncating target PostgreSQL tables...")
        for table_name in reversed(table_names):
            pg_cursor.execute(f"TRUNCATE TABLE {table_name} CASCADE;")
        pg_conn.commit()
        print("Truncation complete.")

        total_migrated = 0
        for table_name in table_names:
            # Check table existence in SQLite
            sqlite_cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table_name,))
            if not sqlite_cursor.fetchone():
                continue

            # Fetch SQLite columns
            sqlite_cursor.execute(f"PRAGMA table_info({table_name})")
            sqlite_cols = [row["name"] for row in sqlite_cursor.fetchall()]
            
            # Fetch PostgreSQL columns
            pg_cursor.execute(f"SELECT * FROM {table_name} LIMIT 0")
            pg_cols = [desc[0] for desc in pg_cursor.description]
            
            # Find common columns to migrate
            common_cols = [col for col in sqlite_cols if col in pg_cols]

            # Fetch SQLite rows
            sqlite_cursor.execute(f"SELECT * FROM {table_name}")
            rows = sqlite_cursor.fetchall()
            
            if not rows:
                print(f"Table '{table_name}': 0 records.")
                continue

            col_list_str = ", ".join(common_cols)
            placeholders = ", ".join(["%s"] * len(common_cols))
            insert_query = f"INSERT INTO {table_name} ({col_list_str}) VALUES ({placeholders})"

            insert_count = 0
            for row in rows:
                cleaned_values = []
                for col in common_cols:
                    val = row[col]
                    col_lower = col.lower()
                    if col_lower == "id" or col_lower.endswith("_id") or col_lower == "performed_by":
                        val = clean_uuid(val)
                    elif col_lower.startswith("is_") or col_lower.startswith("supports_") or col_lower == "auto_renew":
                        val = clean_bool(val)
                    elif col_lower.endswith("_at") or col_lower.endswith("_date") or col_lower == "expires_at" or col_lower == "last_watched":
                        val = clean_datetime(val)
                    
                    cleaned_values.append(val)
                
                pg_cursor.execute(insert_query, cleaned_values)
                insert_count += 1
            
            pg_conn.commit()
            total_migrated += insert_count
            print(f"Table '{table_name}': {insert_count} records migrated.")

        print(f"SUCCESS: Data migration completed! Total records: {total_migrated}")

    except Exception as e:
        pg_conn.rollback()
        print(f"ERROR: Data migration failed: {e}")
        raise
    finally:
        try:
            pg_cursor.execute("SET session_replication_role = 'origin';")
            pg_conn.commit()
        except Exception:
            pass
        sqlite_conn.close()
        pg_conn.close()

if __name__ == "__main__":
    migrate()
