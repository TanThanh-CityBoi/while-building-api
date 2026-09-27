import 'reflect-metadata';
import { validateDatabaseEnv } from '@while-building/database';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from './typeorm.config.js';

// Entry point for the TypeORM CLI (`pnpm db:migrate`, …), which runs outside
// Nest, so it reads .env itself. Real environment variables win over the file.
try {
  process.loadEnvFile();
} catch {
  // No .env file: rely on the environment as-is.
}

export default new DataSource(
  buildDataSourceOptions(validateDatabaseEnv(process.env)),
);
