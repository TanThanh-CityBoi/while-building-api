import { Injectable } from '@nestjs/common';
import type { ArticleFields } from '../../domain/entities/article.js';
import { ArticleSlugTakenError } from '../../domain/errors/article.errors.js';
import { ArticleRepository } from '../../domain/repositories/article.repository.js';
import { ArticleContent } from '../../domain/value-objects/article-content.js';
import { ArticleSlug } from '../../domain/value-objects/article-slug.js';
import {
  toArticleView,
  withAuthor,
  type ArticleView,
} from '../dto/article.view.js';
import { AuthorDirectory } from '../ports/author-directory.js';
import { findArticle } from './find-article.js';

export interface UpdateArticleCommand {
  id: string;
  title?: string;
  /** Only changes when given: renaming an article keeps its URL. */
  slug?: string;
  excerpt?: string | null;
  content?: unknown;
  coverImage?: string | null;
  category?: string | null;
}

/**
 * Changes the given fields. Saving a published article updates the public
 * version immediately (there are no revisions yet).
 */
@Injectable()
export class UpdateArticleUseCase {
  constructor(
    private readonly articles: ArticleRepository,
    private readonly authors: AuthorDirectory,
  ) {}

  async execute(command: UpdateArticleCommand): Promise<ArticleView> {
    const article = await findArticle(this.articles, command.id);
    const changes: Partial<ArticleFields> = {
      title: command.title,
      excerpt: command.excerpt,
      coverImage: command.coverImage,
      category: command.category,
    };

    if (command.slug !== undefined) {
      const slug = ArticleSlug.create(command.slug);
      if (!slug.equals(article.slug)) {
        if (await this.articles.existsBySlug(slug, article.id)) {
          throw new ArticleSlugTakenError();
        }
        changes.slug = slug;
      }
    }
    if (command.content !== undefined) {
      changes.content = ArticleContent.create(command.content);
    }

    article.edit(changes, new Date());
    await this.articles.save(article);

    return withAuthor(article, this.authors, toArticleView);
  }
}
