import type { ArticleStatus } from '../article-status.js';
import type { Article } from '../entities/article.js';
import type { ArticleSlug } from '../value-objects/article-slug.js';

export type ArticleSortField =
  'publishedAt' | 'updatedAt' | 'createdAt' | 'title';

export interface ArticleListCriteria {
  /** 1-based. */
  page: number;
  pageSize: number;
  /** Case-insensitive match on title, excerpt, slug or category. */
  search?: string;
  /** Case-insensitive exact category. */
  category?: string;
  status?: ArticleStatus;
  /** Default: newest publication first. Ties break on creation date, then id. */
  sort?: { field: ArticleSortField; direction: 'asc' | 'desc' };
}

export interface ArticleListPage {
  articles: Article[];
  total: number;
}

/** Persistence port for articles (an abstract class so it doubles as the DI token). */
export abstract class ArticleRepository {
  abstract list(criteria: ArticleListCriteria): Promise<ArticleListPage>;

  abstract findById(id: string): Promise<Article | null>;

  abstract findBySlug(slug: string): Promise<Article | null>;

  /** Whether another article (not `exceptId`) already uses the slug. */
  abstract existsBySlug(slug: ArticleSlug, exceptId?: string): Promise<boolean>;

  /** Rejects with ArticleSlugTakenError if the slug is taken. */
  abstract create(article: Article): Promise<void>;

  /** Rejects with ArticleSlugTakenError if the new slug is taken. */
  abstract save(article: Article): Promise<void>;

  abstract delete(id: string): Promise<void>;
}
