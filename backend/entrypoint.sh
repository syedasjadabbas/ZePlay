#!/bin/bash

# Exit on error
set -e

echo "Verifying PostgreSQL port access..."

DB_HOST="db"
DB_PORT="5432"

# Wait loop checking PostgreSQL connection availability
while ! nc -z $DB_HOST $DB_PORT; do
  echo "Database not ready yet. Waiting..."
  sleep 1
done

echo "Database available! Checking schema status..."

# Run database upgrades
alembic upgrade head

echo "Database schemas up to date! Booting Uvicorn..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
