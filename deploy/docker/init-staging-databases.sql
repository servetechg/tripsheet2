-- Staging databases (same Postgres instance as production; separate data).
-- Run once against the infra postgres container:
--   docker compose -f deploy/compose.infra.yml --env-file /opt/tripsheet/secrets/infra.env \
--     exec -T postgres psql -U tripsheet -d postgres < deploy/docker/init-staging-databases.sql

CREATE DATABASE auth_db_staging;
CREATE DATABASE company_db_staging;
CREATE DATABASE driver_db_staging;
CREATE DATABASE fleet_db_staging;
CREATE DATABASE manifest_db_staging;
CREATE DATABASE tripsheet_db_staging;
CREATE DATABASE accounting_db_staging;
CREATE DATABASE notification_db_staging;

GRANT ALL PRIVILEGES ON DATABASE auth_db_staging TO tripsheet;
GRANT ALL PRIVILEGES ON DATABASE company_db_staging TO tripsheet;
GRANT ALL PRIVILEGES ON DATABASE driver_db_staging TO tripsheet;
GRANT ALL PRIVILEGES ON DATABASE fleet_db_staging TO tripsheet;
GRANT ALL PRIVILEGES ON DATABASE manifest_db_staging TO tripsheet;
GRANT ALL PRIVILEGES ON DATABASE tripsheet_db_staging TO tripsheet;
GRANT ALL PRIVILEGES ON DATABASE accounting_db_staging TO tripsheet;
GRANT ALL PRIVILEGES ON DATABASE notification_db_staging TO tripsheet;
