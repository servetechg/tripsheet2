import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

interface FallbackEntry {
  value: number;
  expiresAt?: number;
}

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private useFallback = false;
  private readonly fallback = new Map<string, FallbackEntry>();

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const url = this.config.get<string>('REDIS_URL');
    if (!url) {
      this.useFallback = true;
      this.logger.warn('REDIS_URL not set; using in-memory fallback');
      return;
    }

    try {
      this.client = new Redis(url, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null,
      });
      await this.client.connect();
      this.client.on('error', (err) => {
        this.logger.warn(`Redis error: ${err.message}; using in-memory fallback`);
        this.useFallback = true;
      });
    } catch (err) {
      this.useFallback = true;
      this.logger.warn(
        `Redis connection failed: ${(err as Error).message}; using in-memory fallback`,
      );
      if (this.client) {
        this.client.disconnect();
        this.client = null;
      }
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }
  }

  async ping(): Promise<boolean> {
    if (this.useFallback || !this.client) {
      return false;
    }
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  async incr(key: string): Promise<number> {
    if (this.useFallback || !this.client) {
      return this.fallbackIncr(key);
    }
    try {
      return await this.client.incr(key);
    } catch (err) {
      this.logger.warn(
        `Redis incr failed: ${(err as Error).message}; using in-memory fallback`,
      );
      this.useFallback = true;
      return this.fallbackIncr(key);
    }
  }

  async expire(key: string, seconds: number): Promise<void> {
    if (this.useFallback || !this.client) {
      this.fallbackExpire(key, seconds);
      return;
    }
    try {
      await this.client.expire(key, seconds);
    } catch (err) {
      this.logger.warn(
        `Redis expire failed: ${(err as Error).message}; using in-memory fallback`,
      );
      this.useFallback = true;
      this.fallbackExpire(key, seconds);
    }
  }

  isUsingFallback(): boolean {
    return this.useFallback || !this.client;
  }

  private fallbackIncr(key: string): number {
    this.pruneFallback();
    const entry = this.fallback.get(key);
    if (!entry) {
      this.fallback.set(key, { value: 1 });
      return 1;
    }
    entry.value += 1;
    return entry.value;
  }

  private fallbackExpire(key: string, seconds: number): void {
    const entry = this.fallback.get(key);
    if (entry) {
      entry.expiresAt = Date.now() + seconds * 1000;
    } else {
      this.fallback.set(key, { value: 0, expiresAt: Date.now() + seconds * 1000 });
    }
  }

  private pruneFallback(): void {
    const now = Date.now();
    for (const [key, entry] of this.fallback.entries()) {
      if (entry.expiresAt !== undefined && entry.expiresAt <= now) {
        this.fallback.delete(key);
      }
    }
  }
}
