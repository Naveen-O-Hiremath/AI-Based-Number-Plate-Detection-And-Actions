#!/bin/sh
set -e

DB="/app/server/data/surveillance.db"

# Seed only when the database is missing or has no vehicles, so restarts and
# container recreation never wipe live data in the mounted volume.
if [ ! -f "$DB" ]; then
  echo "[entrypoint] No database found — seeding demo data..."
  node /app/server/src/db/seed.js
else
  COUNT=$(node -e "const{DatabaseSync}=require(\"node:sqlite\");try{const d=new DatabaseSync(\"$DB\");process.stdout.write(String(d.prepare(\"SELECT COUNT(*) c FROM vehicles\").get().c))}catch(e){process.stdout.write(\"0\")}" 2>/dev/null || echo 0)
  if [ "$COUNT" = "0" ]; then
    echo "[entrypoint] Database empty — seeding demo data..."
    node /app/server/src/db/seed.js
  else
    echo "[entrypoint] Database ready ($COUNT vehicles)."
  fi
fi

exec "$@"
