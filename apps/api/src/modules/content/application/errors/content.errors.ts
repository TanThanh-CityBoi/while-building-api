import { AppError } from '@while-building/shared';

/** Also used for unpublished articles, so drafts are never revealed. */
export class ArticleNotFoundError extends AppError {
  readonly kind = 'not_found';
  constructor() {
    super('Article not found.');
  }
}

/** Also used for unpublished projects, so drafts are never revealed. */
export class ProjectNotFoundError extends AppError {
  readonly kind = 'not_found';
  constructor() {
    super('Project not found.');
  }
}
