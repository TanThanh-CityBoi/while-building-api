import type { ContentStatus } from '../content-status.js';
import type { Article } from '../entities/article.js';

export interface ArticleListCriteria {
  /** 1-based. */
  page: number;
  pageSize: number;
  /** Case-insensitive match on title, description or category. */
  search?: string;
  /** Case-insensitive exact category. */
  category?: string;
  status?: ContentStatus;
}

export interface ArticleListPage {
  /** Newest first (by publication date, then creation date). */
  articles: Article[];
  total: number;
}

/** Persistence port for articles (an abstract class so it doubles as the DI token). */
export abstract class ArticleRepository {
  abstract list(criteria: ArticleListCriteria): Promise<ArticleListPage>;

  abstract findBySlug(slug: string): Promise<Article | null>;
}
