import path from 'path';
import { preloadServiceEnvFromDir } from '../../shared/env-config/preload-env.mjs';

preloadServiceEnvFromDir(path.join(__dirname, '..'));

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { json, urlencoded } from 'express';
import { RedisIoAdapter } from './in-app/redis-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const config = app.get(ConfigService);
  const redisUrl = config.get<string>('REDIS_URL');
  if (redisUrl) {
    const redisIoAdapter = new RedisIoAdapter(app, redisUrl);
    await redisIoAdapter.connectToRedis();
    app.useWebSocketAdapter(redisIoAdapter);
  }

  // Large JSON for invite onboarding (multiple base64 docs) and document APIs
  app.use(json({ limit: '25mb' }));
  app.use(urlencoded({ extended: true, limit: '25mb' }));

  const corsOrigin = config.get<string>('CORS_ORIGIN', 'http://localhost:5173');
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });

  const port = config.get<number>('PORT', 3000);
  await app.listen(port);
  console.log(`Gateway listening on http://localhost:${port}`);
}

bootstrap();
