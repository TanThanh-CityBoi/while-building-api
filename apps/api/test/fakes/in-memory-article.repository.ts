import {
  Article,
  type ArticleProps,
} from '../../src/modules/content/domain/entities/article.js';
import {
  ArticleRepository,
  type ArticleListCriteria,
  type ArticleListPage,
} from '../../src/modules/content/domain/repositories/article.repository.js';

/** ArticleRepository for unit tests, with the same filtering and order as the real one. */
export class InMemoryArticleRepository extends ArticleRepository {
  private readonly rows = new Map<string, ArticleProps>();

  /** Test helper: store an article directly. */
  add(props: ArticleProps): void {
    this.rows.set(props.slug, { ...props });
  }

  list(criteria: ArticleListCriteria): Promise<ArticleListPage> {
    const search = criteria.search?.toLowerCase();
    const category = criteria.category?.toLowerCase();
    const matching = [...this.rows.values()]
      .filter((row) => !criteria.status || row.status === criteria.status)
      .filter((row) => !category || row.category.toLowerCase() === category)
      .filter(
        (row) =>
          !search ||
          [row.title, row.description, row.category].some((text) =>
            text.toLowerCase().includes(search),
          ),
      )
      .sort(
        (a, b) =>
          (b.publishedAt?.getTime() ?? -Infinity) -
            (a.publishedAt?.getTime() ?? -Infinity) ||
          b.createdAt.getTime() - a.createdAt.getTime(),
      );
    const start = (criteria.page - 1) * criteria.pageSize;
    return Promise.resolve({
      articles: matching
        .slice(start, start + criteria.pageSize)
        .map((row) => Article.restore(row)),
      total: matching.length,
    });
  }

  findBySlug(slug: string): Promise<Article | null> {
    const row = this.rows.get(slug);
    return Promise.resolve(row ? Article.restore(row) : null);
  }
}
