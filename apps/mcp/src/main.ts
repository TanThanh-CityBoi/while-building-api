import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import type { EnvironmentVariables } from './config/env.validation.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  // Close cleanly on SIGTERM (e.g. container shutdown).
  app.enableShutdownHooks();

  const config =
    app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);
  const port = config.get('PORT', { infer: true });
  const host = config.get('MCP_HOST', { infer: true });
  await app.listen(port, host);
  Logger.log(
    `While Building MCP server listening on http://${host}:${port}/mcp`,
    'Bootstrap',
  );
}

await bootstrap();
