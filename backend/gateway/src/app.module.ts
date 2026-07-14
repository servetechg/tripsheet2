import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { HealthController } from './health/health.controller';
import { ProxyModule } from './proxy/proxy.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    HttpModule.register({ timeout: 10000, maxRedirects: 3 }),
    ProxyModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
