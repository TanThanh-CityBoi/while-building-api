import { Logger } from '@nestjs/common';
import { ArticleOrmEntity } from '../modules/content/infrastructure/persistence/article.orm-entity.js';
import { ProjectOrmEntity } from '../modules/content/infrastructure/persistence/project.orm-entity.js';
import dataSource from './data-source.js';
import { sampleArticles, sampleProjects } from './sample-content.js';

const logger = new Logger('SeedContent');

/**
 * `pnpm db:seed:content` — inserts the sample articles and projects for local
 * development. Safe to run repeatedly: rows are matched by slug and reset to the
 * sample values; other rows are untouched. Refuses to run in production.
 */
async function seedContent(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Refusing to seed sample content when NODE_ENV=production.',
    );
  }

  await dataSource.initialize();
  try {
    // The ROOT account (if bootstrapped) is the sample author.
    const [root] = await dataSource.query<{ id: string }[]>(
      `SELECT "id" FROM "users" WHERE "role" = 'ROOT' LIMIT 1`,
    );
    await dataSource.getRepository(ArticleOrmEntity).upsert(
      sampleArticles.map((article) => ({
        ...article,
        authorId: root?.id ?? null,
      })),
      ['slug'],
    );
    await dataSource
      .getRepository(ProjectOrmEntity)
      .upsert(sampleProjects, ['slug']);
    logger.log(
      `Seeded ${sampleArticles.length} articles and ${sampleProjects.length} projects.`,
    );
  } finally {
    await dataSource.destroy();
  }
}

try {
  await seedContent();
} catch (error) {
  logger.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
