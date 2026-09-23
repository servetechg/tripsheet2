import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { HealthController } from './health/health.controller';
import { ProxyModule } from './proxy/proxy.module';
import { TenantModule } from './tenant/tenant.module';
import { InAppModule } from './in-app/in-app.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
    HttpModule.register({
      timeout: 120000,
      maxRedirects: 3,
      maxBodyLength: 30 * 1024 * 1024,
      maxContentLength: 30 * 1024 * 1024,
    }),
    TenantModule,
    ProxyModule,
    InAppModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
