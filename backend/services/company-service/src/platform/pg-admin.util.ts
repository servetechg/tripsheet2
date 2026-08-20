import { ConfigService } from '@nestjs/config';

export type PgAdminConn = {
  host: string;
  port: number;
  user: string;
  password: string;
  ssl: boolean;
};

export function parseAdminUrl(config: ConfigService): PgAdminConn {
  const provisionUrl =
    config.get<string>('TENANT_PROVISION_URL') ||
    config.get<string>('DATABASE_URL') ||
    '';
  if (!provisionUrl) {
    throw new Error('TENANT_PROVISION_URL or DATABASE_URL required');
  }
  const u = new URL(provisionUrl);
  return {
    host: config.get<string>('TENANT_DB_HOST') || u.hostname || 'localhost',
    port: Number(config.get<string>('TENANT_DB_PORT') || u.port || 5432),
    user: decodeURIComponent(u.username || 'tripsheet'),
    password: decodeURIComponent(u.password || ''),
    ssl: u.searchParams.get('sslmode') === 'require',
  };
}

export function buildTenantUrl(admin: PgAdminConn, dbName: string): string {
  const user = encodeURIComponent(admin.user);
  const pass = encodeURIComponent(admin.password);
  const ssl = admin.ssl ? '?sslmode=require' : '';
  return `postgresql://${user}:${pass}@${admin.host}:${admin.port}/${dbName}${ssl}`;
}

export function quoteIdent(name: string): string {
  if (!/^[a-zA-Z0-9_]+$/.test(name)) {
    throw new Error(`Invalid identifier: ${name}`);
  }
  return `"${name}"`;
}
