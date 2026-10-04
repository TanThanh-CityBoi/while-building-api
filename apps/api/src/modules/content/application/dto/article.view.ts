import type { Article } from '../../domain/entities/article.js';
import type { ArticleStatus } from '../../domain/article-status.js';
import type { ContentBlock } from '../../domain/value-objects/article-content.js';
import type { Author, AuthorDirectory } from '../ports/author-directory.js';

interface ArticleBaseView {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  category: string | null;
  coverImage: string | null;
  /** `null` when the author's account no longer exists. */
  author: Author | null;
  publishedAt: Date | null;
  /** Estimated from the content. */
  readingTimeMinutes: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * What the public may see of an article in a list. Never includes the
 * publishing status: only published articles are ever exposed.
 */
export type PublishedArticleSummaryView = ArticleBaseView;

/** A published article, with its content (a block document). */
export interface PublishedArticleView extends PublishedArticleSummaryView {
  content: ContentBlock[];
}

/** An article in the CMS list (drafts included, no content). */
export interface ArticleSummaryView extends ArticleBaseView {
  status: ArticleStatus;
}

/** An article in the CMS, with its content. */
export interface ArticleView extends ArticleSummaryView {
  content: ContentBlock[];
}

export interface ArticleListView<T> {
  articles: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

function toBaseView(article: Article, author: Author | null): ArticleBaseView {
  return {
    id: article.id,
    slug: article.slug.value,
    title: article.title,
    excerpt: article.excerpt,
    category: article.category,
    coverImage: article.coverImage,
    author,
    publishedAt: article.publishedAt,
    readingTimeMinutes: article.content.readingTimeMinutes,
    createdAt: article.createdAt,
    updatedAt: article.updatedAt,
  };
}

export function toPublishedArticleSummaryView(
  article: Article,
  author: Author | null,
): PublishedArticleSummaryView {
  return toBaseView(article, author);
}

export function toPublishedArticleView(
  article: Article,
  author: Author | null,
): PublishedArticleView {
  return {
    ...toBaseView(article, author),
    content: [...article.content.blocks],
  };
}

export function toArticleSummaryView(
  article: Article,
  author: Author | null,
): ArticleSummaryView {
  return { ...toBaseView(article, author), status: article.status };
}

export function toArticleView(
  article: Article,
  author: Author | null,
): ArticleView {
  return {
    ...toArticleSummaryView(article, author),
    content: [...article.content.blocks],
  };
}

/** Maps articles to views with their authors, looked up in one call. */
export async function withAuthors<T>(
  articles: readonly Article[],
  authors: AuthorDirectory,
  toView: (article: Article, author: Author | null) => T,
): Promise<T[]> {
  const ids = [
    ...new Set(
      articles.flatMap((article) =>
        article.authorId ? [article.authorId] : [],
      ),
    ),
  ];
  const found =
    ids.length > 0 ? await authors.findByIds(ids) : new Map<string, Author>();
  return articles.map((article) =>
    toView(article, (article.authorId && found.get(article.authorId)) || null),
  );
}

/** Maps one article to a view with its author. */
export async function withAuthor<T>(
  article: Article,
  authors: AuthorDirectory,
  toView: (article: Article, author: Author | null) => T,
): Promise<T> {
  const { authorId } = article;
  const author = authorId
    ? ((await authors.findByIds([authorId])).get(authorId) ?? null)
    : null;
  return toView(article, author);
}

export function pageOf<T>(
  articles: T[],
  query: { page: number; pageSize: number },
  total: number,
): ArticleListView<T> {
  return {
    articles,
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: Math.ceil(total / query.pageSize),
  };
}
