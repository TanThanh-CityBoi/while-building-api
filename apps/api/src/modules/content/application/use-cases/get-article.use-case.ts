import { Injectable } from '@nestjs/common';
import { ArticleRepository } from '../../domain/repositories/article.repository.js';
import {
  toArticleView,
  withAuthor,
  type ArticleView,
} from '../dto/article.view.js';
import { AuthorDirectory } from '../ports/author-directory.js';
import { findArticle } from './find-article.js';

/** An article by id in any status, with its content (for the CMS). */
@Injectable()
export class GetArticleUseCase {
  constructor(
    private readonly articles: ArticleRepository,
    private readonly authors: AuthorDirectory,
  ) {}

  async execute(id: string): Promise<ArticleView> {
    const article = await findArticle(this.articles, id);
    return withAuthor(article, this.authors, toArticleView);
  }
}
