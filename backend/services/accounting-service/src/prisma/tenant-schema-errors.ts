import { Logger, ServiceUnavailableException } from '@nestjs/common';
import {
  isTenantSchemaDriftError,
  repairTenantOrgSchemas,
} from '@tripsheet/tenant-runtime';

const logger = new Logger('TenantSchema');

export function rethrowTenantSchemaError(
  scope: string,
  companyId: string | undefined,
  cause: unknown,
): never {
  logger.error(`${scope} failed companyId=${companyId || '?'}`, cause);
  const schemaDrift = isTenantSchemaDriftError(cause);
  throw new ServiceUnavailableException(
    schemaDrift
      ? 'Accounting schema was updated — retry in a moment or run schema-migrate-all on staging.'
      : 'Accounting data is temporarily unavailable.',
  );
}

export async function withTenantSchemaRetry<T>(
  companyId: string | undefined,
  scope: string,
  run: () => Promise<T>,
): Promise<T> {
  try {
    return await run();
  } catch (e) {
    if (companyId && isTenantSchemaDriftError(e)) {
      const repaired = await repairTenantOrgSchemas(companyId);
      if (repaired) {
        try {
          return await run();
        } catch (retryErr) {
          rethrowTenantSchemaError(scope, companyId, retryErr);
        }
      }
    }
    rethrowTenantSchemaError(scope, companyId, e);
  }
}
