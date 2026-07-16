-- Run against an existing Postgres volume that was created before Phase 3.
-- Safe to re-run (IF NOT EXISTS).
SELECT 'CREATE DATABASE accounting_db'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'accounting_db')\gexec
SELECT 'CREATE DATABASE notification_db'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'notification_db')\gexec
GRANT ALL PRIVILEGES ON DATABASE accounting_db TO tripsheet;
GRANT ALL PRIVILEGES ON DATABASE notification_db TO tripsheet;
