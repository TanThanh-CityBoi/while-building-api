import { AppError } from '@while-building/shared';

/** A field of an article breaks its rules (length, format…). */
export class InvalidArticleError extends AppError {
  readonly kind = 'invalid';
}

export class InvalidArticleSlugError extends AppError {
  readonly kind = 'invalid';
  constructor(message = 'slug must be lower-case words separated by hyphens') {
    super(message);
  }
}

export class InvalidArticleContentError extends AppError {
  readonly kind = 'invalid';
  constructor() {
    super('content must be a list of blocks');
  }
}

/** Publishing (or keeping published) needs a written article. */
export class ArticleNotPublishableError extends AppError {
  readonly kind = 'invalid';
  constructor() {
    super('A published article needs a title, a slug and some content.');
  }
}

/** Publishing a published article, or unpublishing a draft. */
export class ArticleStatusConflictError extends AppError {
  readonly kind = 'conflict';
}

/** Slugs are unique across all articles, drafts included. */
export class ArticleSlugTakenError extends AppError {
  readonly kind = 'conflict';
  constructor() {
    super('An article with this slug already exists.');
  }
}
