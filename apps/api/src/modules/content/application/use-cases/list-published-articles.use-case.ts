import { Injectable } from '@nestjs/common';
import { ContentStatus } from '../../domain/content-status.js';
import { ArticleRepository } from '../../domain/repositories/article.repository.js';
import {
  toArticleSummaryView,
  type ArticleListView,
} from '../dto/article.view.js';

export interface ListPublishedArticlesQuery {
  page: number;
  pageSize: number;
  search?: string;
  category?: string;
}

/** Lists published articles for the public, newest first. */
@Injectable()
export class ListPublishedArticlesUseCase {
  constructor(private readonly articles: ArticleRepository) {}

  async execute(query: ListPublishedArticlesQuery): Promise<ArticleListView> {
    const { articles, total } = await this.articles.list({
      ...query,
      status: ContentStatus.PUBLISHED,
    });
    return {
      articles: articles.map(toArticleSummaryView),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }
}
