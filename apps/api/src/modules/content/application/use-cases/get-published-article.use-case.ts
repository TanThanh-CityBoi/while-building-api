import { Injectable } from '@nestjs/common';
import { ArticleRepository } from '../../domain/repositories/article.repository.js';
import { toArticleView, type ArticleView } from '../dto/article.view.js';
import { ArticleNotFoundError } from '../errors/content.errors.js';

/** A published article by slug; drafts and archived articles are "not found". */
@Injectable()
export class GetPublishedArticleUseCase {
  constructor(private readonly articles: ArticleRepository) {}

  async execute(slug: string): Promise<ArticleView> {
    const article = await this.articles.findBySlug(slug);
    if (!article?.isPublished) throw new ArticleNotFoundError();
    return toArticleView(article);
  }
}
