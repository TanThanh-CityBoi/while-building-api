import { Injectable } from '@nestjs/common';
import type { ArticleStatus } from '../../domain/article-status.js';
import {
  ArticleRepository,
  type ArticleSortField,
} from '../../domain/repositories/article.repository.js';
import {
  pageOf,
  toArticleSummaryView,
  withAuthors,
  type ArticleListView,
  type ArticleSummaryView,
} from '../dto/article.view.js';
import { AuthorDirectory } from '../ports/author-directory.js';

export interface ListArticlesQuery {
  page: number;
  pageSize: number;
  search?: string;
  status?: ArticleStatus;
  /** Default: most recently updated first. */
  sort?: ArticleSortField;
  order?: 'asc' | 'desc';
}

/** Lists articles in every status for the CMS. */
@Injectable()
export class ListArticlesUseCase {
  constructor(
    private readonly articles: ArticleRepository,
    private readonly authors: AuthorDirectory,
  ) {}

  async execute(
    query: ListArticlesQuery,
  ): Promise<ArticleListView<ArticleSummaryView>> {
    const { sort = 'updatedAt', order = 'desc', ...filters } = query;
    const { articles, total } = await this.articles.list({
      ...filters,
      sort: { field: sort, direction: order },
    });
    const views = await withAuthors(
      articles,
      this.authors,
      toArticleSummaryView,
    );
    return pageOf(views, query, total);
  }
}
