import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { CarrierProfilesModule } from './carrier-profiles/carrier-profiles.module';
import { ManifestsModule } from './manifests/manifests.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    CarrierProfilesModule,
    ManifestsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
