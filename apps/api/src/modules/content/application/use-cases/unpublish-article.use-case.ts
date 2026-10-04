import { Injectable } from '@nestjs/common';
import { ArticleRepository } from '../../domain/repositories/article.repository.js';
import {
  toArticleView,
  withAuthor,
  type ArticleView,
} from '../dto/article.view.js';
import { AuthorDirectory } from '../ports/author-directory.js';
import { findArticle } from './find-article.js';

/** Takes a published article off the public site; it becomes a draft again. */
@Injectable()
export class UnpublishArticleUseCase {
  constructor(
    private readonly articles: ArticleRepository,
    private readonly authors: AuthorDirectory,
  ) {}

  async execute(id: string): Promise<ArticleView> {
    const article = await findArticle(this.articles, id);
    article.unpublish(new Date());
    await this.articles.save(article);
    return withAuthor(article, this.authors, toArticleView);
  }
}
