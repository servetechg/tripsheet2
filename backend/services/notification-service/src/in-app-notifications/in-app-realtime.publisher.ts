import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Emitter } from '@socket.io/redis-emitter';
import Redis from 'ioredis';
import {
  IN_APP_SOCKET_EVENT,
  IN_APP_SOCKET_NAMESPACE,
  type InAppNotificationEvent,
} from '@tripsheet/shared';

@Injectable()
export class InAppRealtimePublisher
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(InAppRealtimePublisher.name);
  private pubClient: Redis | null = null;
  private emitter: Emitter | null = null;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const url = this.config.get<string>('REDIS_URL');
    if (!url) {
      this.logger.warn(
        'REDIS_URL not set — in-app Socket.IO realtime disabled (REST inbox still works)',
      );
      return;
    }
    try {
      this.pubClient = new Redis(url, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
      });
      await this.pubClient.connect();
      this.emitter = new Emitter(this.pubClient, {
        key: 'socket.io',
      });
      this.logger.log('In-app notification Redis emitter ready');
    } catch (e) {
      this.logger.warn(
        `In-app Redis emitter failed: ${(e as Error).message}`,
      );
      this.pubClient?.disconnect();
      this.pubClient = null;
      this.emitter = null;
    }
  }

  async onModuleDestroy() {
    if (this.pubClient) {
      await this.pubClient.quit();
      this.pubClient = null;
    }
    this.emitter = null;
  }

  publishToUser(userId: string, payload: InAppNotificationEvent): void {
    if (!this.emitter || !userId) {
      if (!this.emitter) {
        this.logger.debug(
          'Skipping in-app realtime emit (REDIS_URL / emitter not ready)',
        );
      }
      return;
    }
    try {
      this.emitter
        .of(IN_APP_SOCKET_NAMESPACE)
        .to(this.userRoom(userId))
        .emit(IN_APP_SOCKET_EVENT, payload);
      this.logger.debug(
        `Realtime in-app → room ${this.userRoom(userId)} (${payload.notification.type})`,
      );
    } catch (e) {
      this.logger.warn(
        `Failed to publish in-app notification: ${(e as Error).message}`,
      );
    }
  }

  userRoom(userId: string): string {
    return `user:${userId}`;
  }
}
