# Create Phase 3 databases on an already-running tripsheet-postgres container
$ErrorActionPreference = 'Stop'
$sql = @"
SELECT 'CREATE DATABASE accounting_db' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'accounting_db')\gexec
SELECT 'CREATE DATABASE notification_db' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'notification_db')\gexec
GRANT ALL PRIVILEGES ON DATABASE accounting_db TO tripsheet;
GRANT ALL PRIVILEGES ON DATABASE notification_db TO tripsheet;
"@
$sql | docker exec -i tripsheet-postgres psql -U tripsheet -d postgres
Write-Host "Phase 3 databases ready (accounting_db, notification_db)."
