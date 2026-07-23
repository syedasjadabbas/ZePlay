import uuid
from migrate_sqlite_to_postgres import clean_uuid, clean_bool, clean_datetime

def test_clean_uuid_int():
    # Test integer input (e.g. 1 from SQLite PK)
    res = clean_uuid(1)
    assert res == "00000000-0000-0000-0000-000000000001"

def test_clean_uuid_bool():
    # Test bool input (bool is a subclass of int in Python)
    assert clean_uuid(True) is True
    assert clean_uuid(False) is False

def test_clean_uuid_uuid_object():
    u = uuid.uuid4()
    assert clean_uuid(u) == str(u)

def test_clean_uuid_str():
    u_str = "00000000-0000-0000-0000-000000000001"
    assert clean_uuid(u_str) == u_str

def test_clean_uuid_none():
    assert clean_uuid(None) is None

def test_clean_uuid_invalid_int():
    # Large int that exceeds 128-bit UUID range
    large_int = (1 << 129)
    assert clean_uuid(large_int) == str(large_int)
