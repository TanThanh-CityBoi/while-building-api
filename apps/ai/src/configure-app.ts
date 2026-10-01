import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Express } from 'express';
import type { EnvironmentVariables } from './config/env.validation.js';

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
    // Needed behind a reverse proxy for correct client IPs.
    express.set('trust proxy', trustProxy);
  }

  app.useGlobalPipes(
    new ValidationPipe({
      // Strip unknown properties, reject requests that contain them, and
      // convert payloads into DTO instances.
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    // Only the configured origins. The CMS sends a bearer token, never cookies.
    origin: config.get('CORS_ORIGIN', { infer: true }),
    credentials: false,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Authorization', 'Content-Type'],
  });

  // Close cleanly on SIGTERM (e.g. container shutdown).
  app.enableShutdownHooks();
}
