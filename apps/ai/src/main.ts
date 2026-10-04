import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import type { EnvironmentVariables } from './config/env.validation.js';
import { configureApp } from './configure-app.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  configureApp(app);

  const config =
    app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);
  const port = config.get('PORT', { infer: true });
  await app.listen(port);
  Logger.log(
    `While Building AI app listening on port ${port} (providers: ${config
      .get('AI_PROVIDERS', { infer: true })
      .join(
        ', ',
      )}; default: ${config.get('AI_DEFAULT_PROVIDER', { infer: true })})`,
    'Bootstrap',
  );
}

await bootstrap();
