import { Injectable } from '@nestjs/common';
import { ArticleRepository } from '../../domain/repositories/article.repository.js';
import { findArticle } from './find-article.js';

/** Permanently deletes an article, published or not. */
@Injectable()
export class DeleteArticleUseCase {
  constructor(private readonly articles: ArticleRepository) {}

  async execute(id: string): Promise<void> {
    const article = await findArticle(this.articles, id);
    await this.articles.delete(article.id);
  }
}
