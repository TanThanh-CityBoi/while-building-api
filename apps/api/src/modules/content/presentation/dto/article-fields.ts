// Request limits shared by the article DTOs. Lengths come from the domain, which
// enforces them again; these give clients field-level 400s.
export {
  ARTICLE_CATEGORY_MAX_LENGTH,
  ARTICLE_COVER_IMAGE_MAX_LENGTH,
  ARTICLE_EXCERPT_MAX_LENGTH,
  ARTICLE_TITLE_MAX_LENGTH,
} from '../../domain/entities/article.js';
export { SLUG_MAX_LENGTH, SLUG_PATTERN } from '../../domain/slug.js';

export const SLUG_MESSAGE =
  'slug must be lower-case words separated by hyphens';
export const STATUS_MESSAGE = 'status must be one of: DRAFT, PUBLISHED';
/** Generous for a long article; the request body is capped at 1 MB anyway. */
export const ARTICLE_CONTENT_MAX_BLOCKS = 5000;
