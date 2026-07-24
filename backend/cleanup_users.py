import os
import sqlite3
from dotenv import load_dotenv

def main():
    # Load .env
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    dotenv_path = os.path.join(backend_dir, ".env")
    load_dotenv(dotenv_path)

    database_url = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./local_zeplay.db")
    print(f"DATABASE_URL from env: {database_url}")

    # Identify if it is SQLite
    is_sqlite = "sqlite" in database_url

    if is_sqlite:
        # Resolve SQLite path
        # e.g., sqlite+aiosqlite:///./local_zeplay.db -> ./local_zeplay.db
        db_file = None
        for prefix in ["sqlite+aiosqlite:///", "sqlite:///"]:
            if database_url.startswith(prefix):
                db_file = database_url[len(prefix):]
                break
        
        if not db_file:
            db_file = "local_zeplay.db"

        # Resolve relative to backend folder
        if not os.path.isabs(db_file):
            db_file = os.path.abspath(os.path.join(backend_dir, db_file))

        print(f"Connecting to SQLite database: {db_file}")
        if not os.path.exists(db_file):
            print(f"SQLite file does not exist at {db_file}")
            return

        conn = sqlite3.connect(db_file)
        try:
            # Enable Foreign Key cascades in SQLite
            conn.execute("PRAGMA foreign_keys = ON;")
            
            # Print initial state
            cur = conn.cursor()
            cur.execute("SELECT email FROM users;")
            users_before = cur.fetchall()
            print(f"Users in database before cleanup: {[u[0] for u in users_before]}")

            # Delete users
            cur.execute(
                "DELETE FROM users WHERE email NOT IN (?, ?);",
                ("admin@zeplay.com", "asjadabbaszaidi@gmail.com")
            )
            deleted_count = conn.total_changes
            conn.commit()

            cur.execute("SELECT email FROM users;")
            users_after = cur.fetchall()
            print(f"Deleted changes: {deleted_count}")
            print(f"Users in database after cleanup: {[u[0] for u in users_after]}")
        except Exception as e:
            print(f"Error during SQLite cleanup: {e}")
        finally:
            conn.close()

    # Also clean up PostgreSQL database if psycopg2 is installed and DATABASE_URL indicates PostgreSQL or local Postgres is active
    if "postgresql" in database_url:
        try:
            import psycopg2
            print("PostgreSQL DATABASE_URL found. Cleaning up PostgreSQL...")
            # Convert dialect to psycopg2 if needed
            pg_url = database_url.replace("postgresql+asyncpg://", "postgresql://")
            conn = psycopg2.connect(pg_url)
            try:
                cur = conn.cursor()
                cur.execute("SELECT email FROM users;")
                users_before = cur.fetchall()
                print(f"PG Users before: {[u[0] for u in users_before]}")

                cur.execute(
                    "DELETE FROM users WHERE email NOT IN (%s, %s);",
                    ("admin@zeplay.com", "asjadabbaszaidi@gmail.com")
                )
                conn.commit()
                
                cur.execute("SELECT email FROM users;")
                users_after = cur.fetchall()
                print(f"PG Users after: {[u[0] for u in users_after]}")
            except Exception as pe:
                print(f"Error executing PG deletion: {pe}")
            finally:
                conn.close()
        except ImportError:
            print("psycopg2 not installed, skipping direct PostgreSQL URL cleanup via psycopg2.")
        except Exception as e:
            print(f"Could not clean up PostgreSQL: {e}")
            
    # Also check if local PostgreSQL from migration script can be cleaned up
    try:
        import psycopg2
        print("Checking if local postgres is running...")
        dsn = "host=localhost dbname=zeplay user=postgres password=postgres port=5432"
        conn = psycopg2.connect(dsn)
        try:
            cur = conn.cursor()
            cur.execute("SELECT email FROM users;")
            users_before = cur.fetchall()
            print(f"Local PG Users before: {[u[0] for u in users_before]}")

            cur.execute(
                "DELETE FROM users WHERE email NOT IN (%s, %s);",
                ("admin@zeplay.com", "asjadabbaszaidi@gmail.com")
            )
            conn.commit()
            
            cur.execute("SELECT email FROM users;")
            users_after = cur.fetchall()
            print(f"Local PG Users after: {[u[0] for u in users_after]}")
        except Exception as pe:
            print(f"Local PG query failed (perhaps tables do not exist): {pe}")
        finally:
            conn.close()
    except Exception:
        # Local PG not running or conn failed, ignore
        pass

if __name__ == "__main__":
    main()
