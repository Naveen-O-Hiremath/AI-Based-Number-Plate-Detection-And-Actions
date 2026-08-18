#!/bin/sh
set -e

DB="/app/server/data/anpr.db"

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
