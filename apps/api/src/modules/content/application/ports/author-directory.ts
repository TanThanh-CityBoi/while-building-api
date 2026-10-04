/** What the content context shows about an article's author. */
export interface Author {
  id: string;
  name: string;
}

/**
 * Looks up authors by user id. Users belong to another bounded context, so
 * content only knows them through this port. An abstract class so it doubles
 * as the DI token.
 */
export abstract class AuthorDirectory {
  /** The authors that still exist, keyed by id. */
  abstract findByIds(ids: readonly string[]): Promise<Map<string, Author>>;
}
