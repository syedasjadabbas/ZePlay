import sqlite3
import sys

# Add backend to path for passlib
sys.path.insert(0, '.')
from app.core.security import get_password_hash, verify_password

conn = sqlite3.connect('local_zeplay.db')
cur = conn.cursor()

# Check current password hash
cur.execute("SELECT email, password_hash FROM users WHERE email='asjadabbaszaidi@gmail.com'")
row = cur.fetchone()
print(f"Email: {row[0]}")
print(f"Stored hash: {row[1][:40]}...")

# Test common passwords
test_passwords = ['Admin@123', 'admin@123', 'Admin123', 'admin123', 'password', 'Password@123']
for pwd in test_passwords:
    match = verify_password(pwd, row[1])
    print(f"  '{pwd}' -> {'MATCH' if match else 'no match'}")

# Reset to Admin@123
new_hash = get_password_hash('Admin@123')
cur.execute("UPDATE users SET password_hash=? WHERE email='asjadabbaszaidi@gmail.com'", (new_hash,))
conn.commit()
print("\nPassword reset to Admin@123 for asjadabbaszaidi@gmail.com")

conn.close()
