import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { decryptSecret, encryptSecret } from './crypto.util';
import { buildTenantUrl, parseAdminUrl } from './pg-admin.util';

export type TenantConnectionRow = {
  id: string;
  dbName: string;
  connectionCiphertext: string | null;
};

/**
 * Resolve tenant Postgres URL. In local dev, rebuild from dbName when ciphertext
 * was encrypted with an old PLATFORM_SECRETS_KEY / JWT_SECRET and re-persist it.
 */
export async function resolveTenantConnectionUrl(
  prisma: PrismaService,
  row: TenantConnectionRow,
  config: ConfigService,
): Promise<string> {
  if (row.connectionCiphertext) {
    try {
      return decryptSecret(row.connectionCiphertext);
    } catch {
      if (process.env.NODE_ENV === 'production') {
        throw new BadRequestException('Failed to decrypt tenant connection');
      }
    }
  }

  if (!row.dbName) {
    throw new BadRequestException('Tenant database name missing');
  }

  const admin = parseAdminUrl(config);
  const url = buildTenantUrl(admin, row.dbName);

  await prisma.tenantDatabase.update({
    where: { id: row.id },
    data: { connectionCiphertext: encryptSecret(url) },
  });

  return url;
}
