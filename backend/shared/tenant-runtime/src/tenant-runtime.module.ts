import { Global, Module, DynamicModule, Provider } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TenantConnectionCache } from './connection-cache';
import { TenantScopeInterceptor } from './tenant-scope.interceptor';
import { TenantContextMiddleware } from './tenant-context.middleware';
import { TenantConnectionMiddleware } from './tenant-connection.middleware';

const CORE_PROVIDERS: Provider[] = [
  TenantConnectionCache,
  TenantContextMiddleware,
  TenantConnectionMiddleware,
];

@Global()
@Module({
  imports: [ConfigModule],
  providers: CORE_PROVIDERS,
  exports: CORE_PROVIDERS,
})
export class TenantRuntimeModule {
  static forRoot(opts?: { enforceScope?: boolean }): DynamicModule {
    const providers: Provider[] = [...CORE_PROVIDERS];
    if (opts?.enforceScope !== false) {
      providers.push({
        provide: APP_INTERCEPTOR,
        useClass: TenantScopeInterceptor,
      });
    }
    return {
      module: TenantRuntimeModule,
      global: true,
      imports: [ConfigModule],
      providers,
      exports: CORE_PROVIDERS,
    };
  }
}
