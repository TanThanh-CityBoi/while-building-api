import { Article } from '../../domain/entities/article.js';
import type { ArticleOrmEntity } from '../persistence/article.orm-entity.js';

export const ArticleMapper = {
  toDomain(record: ArticleOrmEntity): Article {
    return Article.restore({
      id: record.id,
      slug: record.slug,
      title: record.title,
      description: record.description,
      category: record.category,
      status: record.status,
      body: record.body,
      readingTimeMinutes: record.readingTimeMinutes,
      publishedAt: record.publishedAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  },
};
