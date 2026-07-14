import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

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
