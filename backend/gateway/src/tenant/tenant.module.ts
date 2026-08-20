import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { TenantRuntimeModule } from '@tripsheet/tenant-runtime';
import { TenantResolverMiddleware } from './tenant-resolver.middleware';
import { PermissionGateMiddleware } from '../rbac/permission-gate.middleware';
import { SessionVersionCache } from '../auth/session-cache';

@Module({
  imports: [TenantRuntimeModule.forRoot({ enforceScope: false })],
  providers: [
    TenantResolverMiddleware,
    PermissionGateMiddleware,
    SessionVersionCache,
  ],
  exports: [TenantResolverMiddleware],
})
export class TenantModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantResolverMiddleware, PermissionGateMiddleware)
      .forRoutes('{*path}');
  }
}
