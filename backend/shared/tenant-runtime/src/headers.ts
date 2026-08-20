/** Trusted headers injected by the gateway TenantResolver (never trust the client). */
export const TENANT_HEADERS = {
  userId: 'x-user-id',
  userRole: 'x-user-role',
  userEmail: 'x-user-email',
  /** Comma-separated permission codes from the verified JWT */
  userPermissions: 'x-user-permissions',
  /** Driver-service record id when the actor is a driver */
  driverId: 'x-driver-id',
  companyId: 'x-company-id',
  tenantKey: 'x-tenant-key',
  tenantStatus: 'x-tenant-status',
  /** shared | tenant — whether this request should use fq_tenant_* */
  routingMode: 'x-tenant-routing',
  /** Set only on internal service mesh; gateway may omit URL for security */
  connectionUrl: 'x-tenant-connection-url',
  dbName: 'x-tenant-db-name',
} as const;

export type TenantHeaderName =
  (typeof TENANT_HEADERS)[keyof typeof TENANT_HEADERS];
