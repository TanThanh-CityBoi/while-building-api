import { validateDatabaseEnv } from '@while-building/database';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from '../../src/database/typeorm.config.js';
import { TEST_ENV } from './test-env.js';

/**
 * Runs once before the e2e suite: creates the test database if needed and
 * applies all migrations. Tests truncate tables, so this refuses to touch any
 * database whose name doesn't end in "_test".
 */
export default async function setup(): Promise<void> {
  try {
    process.loadEnvFile();
  } catch {
    // No .env: use the environment as-is (e.g. CI).
  }
  const env = validateDatabaseEnv({ ...process.env, ...TEST_ENV });
  if (!env.DATABASE_NAME.endsWith('_test')) {
    throw new Error(
      `Refusing to run e2e tests against "${env.DATABASE_NAME}".`,
    );
  }

  // Connect to the maintenance database to create the test database if needed.
  const admin = new DataSource({
    type: 'postgres',
    host: env.DATABASE_HOST,
    port: env.DATABASE_PORT,
    username: env.DATABASE_USER,
    password: env.DATABASE_PASSWORD,
    database: 'postgres',
  });
  await admin.initialize();
  try {
    const existing = await admin.query<unknown[]>(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [env.DATABASE_NAME],
    );
    if (existing.length === 0) {
      await admin.query(`CREATE DATABASE "${env.DATABASE_NAME}"`);
    }
  } finally {
    await admin.destroy();
  }

  const dataSource = new DataSource(buildDataSourceOptions(env));
  await dataSource.initialize();
  try {
    await dataSource.runMigrations();
  } finally {
    await dataSource.destroy();
  }
}
