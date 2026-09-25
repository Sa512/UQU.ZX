#!/usr/bin/env bash
# يشغّل اختبارات قاعدة البيانات على Postgres محلي (يحاكي Supabase).
# الاستخدام: PGHOST=... PGPORT=... PGUSER=postgres ./scripts/test-db.sh
set -euo pipefail
cd "$(dirname "$0")/.."
psql -qc "drop database if exists mz_test;" -c "create database mz_test;" >/dev/null
psql -d mz_test -v ON_ERROR_STOP=1 -q -f supabase/tests/harness.sql $(ls supabase/migrations/*.sql | sed 's/^/-f /') -f supabase/tests/cloud_test.sql -f supabase/tests/sections_test.sql -f supabase/tests/privacy_test.sql | grep -E "PASSED|ERROR"
