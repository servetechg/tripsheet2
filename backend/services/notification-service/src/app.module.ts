import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  TenantRuntimeModule,
  TenantContextMiddleware,
  TenantConnectionMiddleware,
} from '@tripsheet/tenant-runtime';
import { HealthController } from './health/health.controller';
import { MessagingModule } from './messaging/messaging.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TenantRuntimeModule.forRoot({ enforceScope: true }),
    PrismaModule,
    RedisModule,
    NotificationsModule,
    MessagingModule,
  ],
  controllers: [HealthController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantContextMiddleware, TenantConnectionMiddleware)
      .forRoutes('*');
  }
}
