import { Injectable } from '@nestjs/common';
import { ArticleRepository } from '../../domain/repositories/article.repository.js';
import {
  toPublishedArticleView,
  withAuthor,
  type PublishedArticleView,
} from '../dto/article.view.js';
import { ArticleNotFoundError } from '../errors/content.errors.js';
import { AuthorDirectory } from '../ports/author-directory.js';

/** A published article by slug; drafts are "not found". */
@Injectable()
export class GetPublishedArticleUseCase {
  constructor(
    private readonly articles: ArticleRepository,
    private readonly authors: AuthorDirectory,
  ) {}

  async execute(slug: string): Promise<PublishedArticleView> {
    const article = await this.articles.findBySlug(slug);
    if (!article?.isPublished) throw new ArticleNotFoundError();
    return withAuthor(article, this.authors, toPublishedArticleView);
  }
}
