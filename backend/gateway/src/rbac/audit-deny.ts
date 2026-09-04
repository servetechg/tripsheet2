import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const log = new Logger('RbacAudit');

/** Best-effort audit row for RBAC denials (2.10 #3). Never blocks the 403. */
export async function auditRbacDeny(
  config: ConfigService,
  input: {
    companyId?: string;
    actorId?: string;
    actorName?: string;
    permission: string;
    path: string;
    method: string;
    role?: string;
    ip?: string;
    userAgent?: string;
  },
) {
  const base =
    config.get<string>('COMPANY_SERVICE_URL') || 'http://localhost:3002';
  try {
    await fetch(`${base.replace(/\/$/, '')}/audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId: input.companyId || null,
        actorId: input.actorId || null,
        actorName: input.actorName || '',
        action: 'rbac.deny',
        entityType: 'dispatch',
        entityId: input.path,
        ip: input.ip || '',
        userAgent: input.userAgent || '',
        meta: {
          permission: input.permission,
          path: input.path,
          method: input.method,
          role: input.role,
        },
      }),
    });
  } catch (e) {
    log.warn(`rbac.deny audit failed: ${String(e)}`);
  }
}
