/**
 * Ordered ETL catalog: shared microservice DB → fq_tenant_* schema.table
 * Parents before children (FK-safe).
 */
export type EtlTable = {
  /** Logical domain / tenant schema name */
  schema: string;
  /** Shared postgres database name */
  sharedDb: string;
  /** Prisma / Postgres table name (quoted PascalCase) */
  table: string;
  /** Filter column — usually companyId */
  companyColumn?: string;
};

export const ETL_TABLES: EtlTable[] = [
  // driver (parents first)
  { schema: 'driver', sharedDb: 'driver_db', table: 'Driver' },
  { schema: 'driver', sharedDb: 'driver_db', table: 'DriverDocument' },
  { schema: 'driver', sharedDb: 'driver_db', table: 'Contract' },
  { schema: 'driver', sharedDb: 'driver_db', table: 'Invite' },
  // fleet
  { schema: 'fleet', sharedDb: 'fleet_db', table: 'Asset' },
  { schema: 'fleet', sharedDb: 'fleet_db', table: 'Load' },
  { schema: 'fleet', sharedDb: 'fleet_db', table: 'MaintenanceRecord' },
  { schema: 'fleet', sharedDb: 'fleet_db', table: 'DvirInspection' },
  // manifest
  { schema: 'manifest', sharedDb: 'manifest_db', table: 'CarrierProfile' },
  { schema: 'manifest', sharedDb: 'manifest_db', table: 'Manifest' },
  // tripsheet
  { schema: 'tripsheet', sharedDb: 'tripsheet_db', table: 'TripSheet' },
  // accounting
  { schema: 'accounting', sharedDb: 'accounting_db', table: 'LedgerAccount' },
  { schema: 'accounting', sharedDb: 'accounting_db', table: 'Settlement' },
  { schema: 'accounting', sharedDb: 'accounting_db', table: 'Invoice' },
  { schema: 'accounting', sharedDb: 'accounting_db', table: 'Bill' },
  { schema: 'accounting', sharedDb: 'accounting_db', table: 'Payment' },
  // notification
  { schema: 'notification', sharedDb: 'notification_db', table: 'Message' },
  { schema: 'notification', sharedDb: 'notification_db', table: 'Comment' },
  { schema: 'notification', sharedDb: 'notification_db', table: 'NotificationLog' },
];

/** Reverse order for archive deletes (children before parents). */
export const ETL_TABLES_DELETE_ORDER = [...ETL_TABLES].reverse();
