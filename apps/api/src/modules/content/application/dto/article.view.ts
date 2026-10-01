import type { Article } from '../../domain/entities/article.js';

/**
 * What the public may see of an article in a list. Never includes the
 * publishing status: only published articles are ever exposed.
 */
export interface ArticleSummaryView {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  publishedAt: Date | null;
  readingTimeMinutes: number;
  createdAt: Date;
  updatedAt: Date;
}

/** A single article, with its body. */
export interface ArticleView extends ArticleSummaryView {
  body: string | null;
}

export interface ArticleListView {
  articles: ArticleSummaryView[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function toArticleSummaryView(article: Article): ArticleSummaryView {
  return {
    id: article.id,
    slug: article.slug,
    title: article.title,
    description: article.description,
    category: article.category,
    publishedAt: article.publishedAt,
    readingTimeMinutes: article.readingTimeMinutes,
    createdAt: article.createdAt,
    updatedAt: article.updatedAt,
  };
}

export function toArticleView(article: Article): ArticleView {
  return { ...toArticleSummaryView(article), body: article.body };
}
