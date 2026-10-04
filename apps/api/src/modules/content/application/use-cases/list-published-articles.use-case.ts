import { Injectable } from '@nestjs/common';
import { ArticleStatus } from '../../domain/article-status.js';
import { ArticleRepository } from '../../domain/repositories/article.repository.js';
import {
  pageOf,
  toPublishedArticleSummaryView,
  withAuthors,
  type ArticleListView,
  type PublishedArticleSummaryView,
} from '../dto/article.view.js';
import { AuthorDirectory } from '../ports/author-directory.js';

export interface ListPublishedArticlesQuery {
  page: number;
  pageSize: number;
  search?: string;
  category?: string;
}

/** Lists published articles for the public, newest first. */
@Injectable()
export class ListPublishedArticlesUseCase {
  constructor(
    private readonly articles: ArticleRepository,
    private readonly authors: AuthorDirectory,
  ) {}

  async execute(
    query: ListPublishedArticlesQuery,
  ): Promise<ArticleListView<PublishedArticleSummaryView>> {
    const { articles, total } = await this.articles.list({
      ...query,
      status: ArticleStatus.PUBLISHED,
    });
    const views = await withAuthors(
      articles,
      this.authors,
      toPublishedArticleSummaryView,
    );
    return pageOf(views, query, total);
  }
}
