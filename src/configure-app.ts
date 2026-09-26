import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from './config/env.validation.js';

/**
 * App-level setup shared by main.ts and the e2e tests, so tests exercise the
 * same HTTP behaviour as the running server.
 */
export function configureApp(app: INestApplication): void {
  const config =
    app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);

  app.enableCors({ origin: config.get('CORS_ORIGIN', { infer: true }) });

  // Close DB connections cleanly on SIGTERM (e.g. container shutdown).
  app.enableShutdownHooks();
}
