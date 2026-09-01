import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DriverLifecycleStatus } from '@tripsheet/shared';
import { authStatusForLifecycle } from '@tripsheet/shared';

@Injectable()
export class AuthSyncService {
  private readonly logger = new Logger(AuthSyncService.name);

  constructor(private readonly config: ConfigService) {}

  async syncDriverLifecycle(
    userId: string | null | undefined,
    lifecycleStatus: DriverLifecycleStatus | string,
  ) {
    if (!userId) return;
    const authStatus = authStatusForLifecycle(
      lifecycleStatus as DriverLifecycleStatus,
    );
    const authUrl =
      this.config.get<string>('AUTH_SERVICE_URL') || 'http://localhost:3001';
    const key =
      this.config.get<string>('INTERNAL_API_KEY') || 'tripsheet-internal-dev';
    try {
      const res = await fetch(
        `${authUrl.replace(/\/$/, '')}/internal/users/${encodeURIComponent(userId)}/status`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-api-key': key,
          },
          body: JSON.stringify({ status: authStatus }),
        },
      );
      if (!res.ok) {
        this.logger.warn(
          `auth sync failed for user ${userId}: ${res.status} ${await res.text()}`,
        );
      }
    } catch (e) {
      this.logger.warn(`auth sync error for user ${userId}: ${String(e)}`);
    }
  }
}
