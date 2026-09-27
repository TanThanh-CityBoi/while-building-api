import type { DataSourceOptions } from 'typeorm';
import type { DatabaseEnvironment } from './database-env.js';

/** What an app brings to its data source: its own persistence models and migrations. */
export interface PersistenceSchema {
  entities: NonNullable<DataSourceOptions['entities']>;
  migrations: NonNullable<DataSourceOptions['migrations']>;
}

/**
 * TypeORM options for PostgreSQL with the workspace's conventions. An app uses
 * the same options for its Nest module and its migration CLI, so both connect
 * the same way.
 */
export function buildPostgresOptions(
  env: DatabaseEnvironment,
  schema: PersistenceSchema,
): DataSourceOptions {
  return {
    type: 'postgres',
    host: env.DATABASE_HOST,
    port: env.DATABASE_PORT,
    username: env.DATABASE_USER,
    password: env.DATABASE_PASSWORD,
    database: env.DATABASE_NAME,
    entities: schema.entities,
    migrations: schema.migrations,
    // Schema changes only ever go through migrations.
    synchronize: false,
    migrationsRun: false,
    // Use the built-in gen_random_uuid() and never run CREATE EXTENSION on connect.
    uuidExtension: 'pgcrypto',
    installExtensions: false,
  };
}
