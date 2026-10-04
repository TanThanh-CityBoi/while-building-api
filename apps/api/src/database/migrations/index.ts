import { CreateUsersAndAuthSessions1790500000000 } from './1790500000000-CreateUsersAndAuthSessions.js';
import { AddSessionVersions1790600000000 } from './1790600000000-AddSessionVersions.js';
import { CreateArticlesAndProjects1790700000000 } from './1790700000000-CreateArticlesAndProjects.js';
import { ArticlePublishing1790800000000 } from './1790800000000-ArticlePublishing.js';

/**
 * Every migration, in order. Registered explicitly (not by glob) so the same
 * list works from compiled `dist/`, the TypeORM CLI and the e2e tests.
 * Add new migrations here.
 */
export const migrations = [
  CreateUsersAndAuthSessions1790500000000,
  AddSessionVersions1790600000000,
  CreateArticlesAndProjects1790700000000,
  ArticlePublishing1790800000000,
];
