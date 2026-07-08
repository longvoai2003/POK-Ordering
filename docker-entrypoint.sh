#!/bin/sh
set -e

echo "Waiting for Postgres..."
until pg_isready -h postgres -U "${POSTGRES_USER:-pureorganic}" -d "${POSTGRES_DB:-pureorganic}" 2>/dev/null; do
  sleep 2
done
echo "Postgres is ready."

echo "Running migrations..."
for f in /app/migrations/*.sql; do
  echo "  Applying $(basename "$f")..."
  PGPASSWORD="${POSTGRES_PASSWORD:-pureorganic}" psql \
    -h postgres \
    -U "${POSTGRES_USER:-pureorganic}" \
    -d "${POSTGRES_DB:-pureorganic}" \
    -f "$f"
done
echo "Migrations complete."

exec "$@"
