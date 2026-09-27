import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import type { EnvironmentVariables } from '../config/env.validation.js';
import {
  BootstrapRootUserUseCase,
  isPlaceholderPassword,
} from '../modules/users/application/use-cases/bootstrap-root-user.use-case.js';

const logger = new Logger('Seed');

/**
 * `pnpm db:seed` — creates the ROOT user from ROOT_EMAIL / ROOT_PASSWORD /
 * ROOT_NAME if no ROOT exists. Safe to run repeatedly; never logs the password.
 */
async function seed(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });
  try {
    const config =
      app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);
    const password = config.get('ROOT_PASSWORD', { infer: true });

    const result = await app.get(BootstrapRootUserUseCase).execute(
      {
        email: config.get('ROOT_EMAIL', { infer: true }),
        password,
        name: config.get('ROOT_NAME', { infer: true }),
      },
      {
        isProduction: config.get('NODE_ENV', { infer: true }) === 'production',
      },
    );

    if (result.status === 'already-exists') {
      logger.log('A ROOT user already exists; nothing to do.');
      return;
    }
    if (password && isPlaceholderPassword(password)) {
      logger.warn(
        'ROOT_PASSWORD looks like a placeholder. Change it before this account is used anywhere real.',
      );
    }
    logger.log(`Created the ROOT user (${result.email}).`);
  } finally {
    await app.close();
  }
}

try {
  await seed();
} catch (error) {
  logger.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
