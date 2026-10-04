import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Express } from 'express';
import type { EnvironmentVariables } from './config/env.validation.js';
import { AppErrorFilter } from './shared/http/app-error.filter.js';

/**
 * App-level setup shared by main.ts and the e2e tests, so tests exercise the
 * same HTTP behaviour as the running server.
 */
export function configureApp(app: INestApplication): void {
  const config =
    app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);

  const express = app.getHttpAdapter().getInstance() as Express;
  express.disable('x-powered-by');
  const trustProxy = config.get('TRUST_PROXY', { infer: true });
  if (trustProxy !== undefined) {
    // Needed behind a reverse proxy for correct client IPs (rate limiting).
    express.set('trust proxy', trustProxy);
  }

  // Article content (a JSON block document) can outgrow the default 100 KB.
  (app as NestExpressApplication).useBodyParser('json', { limit: '1mb' });

  // The refresh token arrives as an httpOnly cookie.
  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      // Strip unknown properties, reject requests that contain them, and
      // convert payloads into DTO instances (applying @Transform/@Type).
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Domain/application errors (AppError) become HTTP errors; everything else
  // uses Nest's defaults, which never expose stack traces.
  app.useGlobalFilters(new AppErrorFilter());

  app.enableCors({
    // Only the configured origins; credentials (cookies) are allowed for them.
    origin: config.get('CORS_ORIGIN', { infer: true }),
    credentials: true,
  });

  // Close DB connections cleanly on SIGTERM (e.g. container shutdown).
  app.enableShutdownHooks();
}
