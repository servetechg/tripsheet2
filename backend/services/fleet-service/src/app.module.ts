import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AssetsModule } from './assets/assets.module';
import { HealthController } from './health/health.controller';
import { LoadsModule } from './loads/loads.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AssetsModule,
    LoadsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
