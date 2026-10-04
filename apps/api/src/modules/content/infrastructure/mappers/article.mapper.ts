import { Article } from '../../domain/entities/article.js';
import { ArticleContent } from '../../domain/value-objects/article-content.js';
import { ArticleSlug } from '../../domain/value-objects/article-slug.js';
import type { ArticleOrmEntity } from '../persistence/article.orm-entity.js';

/** The stored columns of an article (without the `author` relation). */
export type ArticleRecord = Omit<ArticleOrmEntity, 'author'>;

export const ArticleMapper = {
  toDomain(record: ArticleRecord): Article {
    return Article.restore({
      id: record.id,
      title: record.title,
      slug: ArticleSlug.restore(record.slug),
      excerpt: record.excerpt,
      content: ArticleContent.restore(record.content),
      coverImage: record.coverImage,
      category: record.category,
      status: record.status,
      authorId: record.authorId,
      publishedAt: record.publishedAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  },

  toPersistence(article: Article): ArticleRecord {
    return {
      id: article.id,
      slug: article.slug.value,
      title: article.title,
      excerpt: article.excerpt,
      category: article.category,
      status: article.status,
      content: [...article.content.blocks],
      coverImage: article.coverImage,
      authorId: article.authorId,
      publishedAt: article.publishedAt,
      createdAt: article.createdAt,
      updatedAt: article.updatedAt,
    };
  },
};
