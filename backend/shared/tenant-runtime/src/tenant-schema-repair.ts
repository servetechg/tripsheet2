import { Logger } from '@nestjs/common';

const logger = new Logger('TenantSchemaRepair');

export function isTenantSchemaDriftError(cause: unknown): boolean {
  const msg = String((cause as Error)?.message || cause || '');
  return /does not exist|Unknown table|column .* does not exist|P2021|P2022/i.test(
    msg,
  );
}

/** Idempotent org SQL via company-service (includes accounting/notification parity). */
export async function repairTenantOrgSchemas(
  companyId: string,
  opts?: { companyServiceUrl?: string; internalApiKey?: string },
): Promise<boolean> {
  if (!companyId) return false;
  const base = (
    opts?.companyServiceUrl ||
    process.env.COMPANY_SERVICE_URL ||
    'http://localhost:3002'
  ).replace(/\/$/, '');
  const key =
    opts?.internalApiKey ||
    process.env.INTERNAL_API_KEY ||
    'tripsheet-internal-dev';
  try {
    const res = await fetch(
      `${base}/internal/tenants/${encodeURIComponent(companyId)}/ensure-driver-schema`,
      {
        method: 'POST',
        headers: { 'x-internal-api-key': key },
      },
    );
    if (!res.ok) {
      logger.warn(
        `ensure-driver-schema HTTP ${res.status} for ${companyId}: ${(await res.text()).slice(0, 200)}`,
      );
      return false;
    }
    return true;
  } catch (e) {
    logger.warn(`ensure-driver-schema failed for ${companyId}: ${String(e)}`);
    return false;
  }
}
