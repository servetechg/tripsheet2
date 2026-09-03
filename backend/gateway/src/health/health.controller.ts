import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

const SERVICE_KEYS = [
  ['auth', 'AUTH_SERVICE_URL'],
  ['company', 'COMPANY_SERVICE_URL'],
  ['driver', 'DRIVER_SERVICE_URL'],
  ['fleet', 'FLEET_SERVICE_URL'],
  ['manifest', 'MANIFEST_SERVICE_URL'],
  ['tripsheet', 'TRIPSHEET_SERVICE_URL'],
  ['accounting', 'ACCOUNTING_SERVICE_URL'],
  ['notification', 'NOTIFICATION_SERVICE_URL'],
] as const;

@Controller('health')
export class HealthController {
  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  check() {
    return { status: 'ok', service: 'gateway' };
  }

  /** Aggregate upstream health — used by frontend startup banner. */
  @Get('services')
  async services() {
    const checks = await Promise.all(
      SERVICE_KEYS.map(async ([name, key]) => {
        const base = this.config.get<string>(key);
        if (!base) {
          return { name, ok: false, error: 'missing config' };
        }
        const url = `${base.replace(/\/$/, '')}/health`;
        try {
          const res = await firstValueFrom(
            this.http.get(url, { timeout: 2500, validateStatus: () => true }),
          );
          return { name, ok: res.status >= 200 && res.status < 300, status: res.status };
        } catch (e) {
          return { name, ok: false, error: String(e) };
        }
      }),
    );
    const down = checks.filter((c) => !c.ok).map((c) => c.name);
    return {
      status: down.length ? 'degraded' : 'ok',
      services: checks,
      down,
    };
  }
}
