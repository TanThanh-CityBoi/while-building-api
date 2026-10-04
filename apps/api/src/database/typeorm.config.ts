import {
  buildPostgresOptions,
  type DatabaseEnvironment,
} from '@while-building/database';
import type { DataSourceOptions } from 'typeorm';
import { RefreshSessionOrmEntity } from '../modules/auth/infrastructure/persistence/refresh-session.orm-entity.js';
import { ArticleOrmEntity } from '../modules/content/infrastructure/persistence/article.orm-entity.js';
import { ProjectOrmEntity } from '../modules/content/infrastructure/persistence/project.orm-entity.js';
import { UserOrmEntity } from '../modules/users/infrastructure/persistence/user.orm-entity.js';
import { migrations } from './migrations/index.js';

/** Persistence models (not domain entities) of every module. */
export const entities = [
  UserOrmEntity,
  RefreshSessionOrmEntity,
  ArticleOrmEntity,
  ProjectOrmEntity,
];

/**
 * The API's one TypeORM configuration, shared by the Nest app (DatabaseModule)
 * and the migration CLI (data-source.ts): the workspace's PostgreSQL
 * conventions plus this app's entities and migrations.
 */
export function buildDataSourceOptions(
  env: DatabaseEnvironment,
): DataSourceOptions {
  return buildPostgresOptions(env, { entities, migrations });
}
