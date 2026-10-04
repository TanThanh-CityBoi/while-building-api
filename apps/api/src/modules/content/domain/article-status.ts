/**
 * An article's publishing state. Only PUBLISHED articles are public;
 * unpublishing returns an article to DRAFT.
 */
export enum ArticleStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
}
