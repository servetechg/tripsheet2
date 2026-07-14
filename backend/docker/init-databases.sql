-- Create one database per microservice
CREATE DATABASE auth_db;
CREATE DATABASE company_db;
CREATE DATABASE driver_db;
CREATE DATABASE fleet_db;
CREATE DATABASE manifest_db;
CREATE DATABASE tripsheet_db;

GRANT ALL PRIVILEGES ON DATABASE auth_db TO tripsheet;
GRANT ALL PRIVILEGES ON DATABASE company_db TO tripsheet;
GRANT ALL PRIVILEGES ON DATABASE driver_db TO tripsheet;
GRANT ALL PRIVILEGES ON DATABASE fleet_db TO tripsheet;
GRANT ALL PRIVILEGES ON DATABASE manifest_db TO tripsheet;
GRANT ALL PRIVILEGES ON DATABASE tripsheet_db TO tripsheet;
