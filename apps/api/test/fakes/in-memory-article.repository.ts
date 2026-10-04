import {
  Article,
  type ArticleProps,
} from '../../src/modules/content/domain/entities/article.js';
import { ArticleSlugTakenError } from '../../src/modules/content/domain/errors/article.errors.js';
import {
  ArticleRepository,
  type ArticleListCriteria,
  type ArticleListPage,
} from '../../src/modules/content/domain/repositories/article.repository.js';
import type { ArticleSlug } from '../../src/modules/content/domain/value-objects/article-slug.js';

/** ArticleRepository for unit tests, with the same filtering, order and slug rule as the real one. */
export class InMemoryArticleRepository extends ArticleRepository {
  private readonly rows = new Map<string, ArticleProps>();

  /** Test helper: store an article directly. */
  add(props: ArticleProps): void {
    this.rows.set(props.id, { ...props });
  }

  /** Test helper: the stored article, as the next read would return it. */
  stored(id: string): Article | undefined {
    const row = this.rows.get(id);
    return row ? Article.restore(row) : undefined;
  }

  list(criteria: ArticleListCriteria): Promise<ArticleListPage> {
    const search = criteria.search?.toLowerCase();
    const category = criteria.category?.toLowerCase();
    const field = criteria.sort?.field ?? 'publishedAt';
    const sign = criteria.sort?.direction === 'asc' ? 1 : -1;
    const key = (row: ArticleProps): number | string =>
      field === 'title'
        ? row.title
        : (row[field]?.getTime() ?? (sign < 0 ? -Infinity : Infinity));
    const matching = [...this.rows.values()]
      .filter((row) => !criteria.status || row.status === criteria.status)
      .filter((row) => !category || row.category?.toLowerCase() === category)
      .filter(
        (row) =>
          !search ||
          [row.title, row.excerpt, row.slug.value, row.category].some((text) =>
            text?.toLowerCase().includes(search),
          ),
      )
      .sort((a, b) => {
        const [ka, kb] = [key(a), key(b)];
        return (
          (ka < kb ? -sign : ka > kb ? sign : 0) ||
          b.createdAt.getTime() - a.createdAt.getTime()
        );
      });
    const start = (criteria.page - 1) * criteria.pageSize;
    return Promise.resolve({
      articles: matching
        .slice(start, start + criteria.pageSize)
        .map((row) => Article.restore(row)),
      total: matching.length,
    });
  }

  findById(id: string): Promise<Article | null> {
    return Promise.resolve(this.stored(id) ?? null);
  }

  findBySlug(slug: string): Promise<Article | null> {
    const row = [...this.rows.values()].find((r) => r.slug.value === slug);
    return Promise.resolve(row ? Article.restore(row) : null);
  }

  existsBySlug(slug: ArticleSlug, exceptId?: string): Promise<boolean> {
    return Promise.resolve(this.slugTaken(slug, exceptId));
  }

  create(article: Article): Promise<void> {
    if (this.slugTaken(article.slug)) {
      return Promise.reject(new ArticleSlugTakenError());
    }
    this.rows.set(article.id, propsOf(article));
    return Promise.resolve();
  }

  save(article: Article): Promise<void> {
    if (this.slugTaken(article.slug, article.id)) {
      return Promise.reject(new ArticleSlugTakenError());
    }
    this.rows.set(article.id, propsOf(article));
    return Promise.resolve();
  }

  delete(id: string): Promise<void> {
    this.rows.delete(id);
    return Promise.resolve();
  }

  private slugTaken(slug: ArticleSlug, exceptId?: string): boolean {
    return [...this.rows.values()].some(
      (row) => row.slug.equals(slug) && row.id !== exceptId,
    );
  }
}

function propsOf(article: Article): ArticleProps {
  return {
    id: article.id,
    title: article.title,
    slug: article.slug,
    excerpt: article.excerpt,
    content: article.content,
    coverImage: article.coverImage,
    category: article.category,
    status: article.status,
    authorId: article.authorId,
    publishedAt: article.publishedAt,
    createdAt: article.createdAt,
    updatedAt: article.updatedAt,
  };
}
