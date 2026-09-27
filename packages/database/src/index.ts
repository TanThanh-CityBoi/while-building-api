/**
 * @while-building/database — generic PostgreSQL / TypeORM setup: connection
 * settings (DATABASE_*) and data-source conventions.
 *
 * Entities, repositories, mappers and migrations are business persistence and
 * stay in the app that owns them (e.g. apps/api/src/modules/<module>/infrastructure).
 */
export {
  readDatabaseEnv,
  validateDatabaseEnv,
  type DatabaseEnvironment,
} from './database-env.js';
export {
  buildPostgresOptions,
  type PersistenceSchema,
} from './postgres-options.js';
