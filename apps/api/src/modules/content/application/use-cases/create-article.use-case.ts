import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Article } from '../../domain/entities/article.js';
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

export interface CreateArticleCommand {
  /** The signed-in user; becomes the author. */
  authorId: string;
  title: string;
  /** Derived from the title when omitted. */
  slug?: string;
  excerpt?: string | null;
  /** A block document; empty when omitted. */
  content?: unknown;
  coverImage?: string | null;
  category?: string | null;
}

/** Creates a draft article. */
@Injectable()
export class CreateArticleUseCase {
  constructor(
    private readonly articles: ArticleRepository,
    private readonly authors: AuthorDirectory,
  ) {}

  async execute(command: CreateArticleCommand): Promise<ArticleView> {
    const slug =
      command.slug === undefined
        ? ArticleSlug.fromTitle(command.title)
        : ArticleSlug.create(command.slug);
    if (await this.articles.existsBySlug(slug)) {
      throw new ArticleSlugTakenError();
    }

    const article = Article.create(
      {
        id: randomUUID(),
        authorId: command.authorId,
        title: command.title,
        slug,
        excerpt: command.excerpt,
        content:
          command.content === undefined
            ? undefined
            : ArticleContent.create(command.content),
        coverImage: command.coverImage,
        category: command.category,
      },
      new Date(),
    );
    await this.articles.create(article);

    return withAuthor(article, this.authors, toArticleView);
  }
}
