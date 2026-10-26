#!/usr/bin/env bash
# Applies the migrations to a scratch database and runs the RLS tests.
# Needs a local Postgres. Override the connection with PG_ARGS.
set -euo pipefail
cd "$(dirname "$0")/../.."
PSQL="psql ${PG_ARGS:-} -v ON_ERROR_STOP=1 -q"
$PSQL -c "drop database if exists booked_test" -c "create database booked_test"
$PSQL -d booked_test -f supabase/tests/auth_stub.sql
for f in supabase/migrations/*.sql; do $PSQL -d booked_test -f "$f"; done
$PSQL -d booked_test -f supabase/tests/rls_test.sql
