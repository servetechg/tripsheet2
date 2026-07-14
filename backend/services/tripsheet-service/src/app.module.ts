import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { TripSheetsModule } from './trip-sheets/trip-sheets.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    TripSheetsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
