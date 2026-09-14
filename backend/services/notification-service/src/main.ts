import path from 'path';
import { preloadServiceEnvFromDir } from '../../../shared/env-config/preload-env.mjs';

preloadServiceEnvFromDir(path.join(__dirname, '..'));

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const config = app.get(ConfigService);
  const port = config.get<number>('PORT', 3008);
  const smtpReady = Boolean(
    config.get('SMTP_HOST') &&
      config.get('SMTP_USER') &&
      config.get('SMTP_PASS') &&
      config.get('SMTP_FROM'),
  );
  await app.listen(port);
  console.log(`notification-service listening on http://localhost:${port}`);
  console.log(
    smtpReady
      ? 'SMTP configured — transactional email will be sent'
      : 'SMTP NOT configured — emails are logged as queued only (set SMTP_* in backend/.env)',
  );
}

bootstrap();
