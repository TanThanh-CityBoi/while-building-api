import {
  AuthorDirectory,
  type Author,
} from '../../src/modules/content/application/ports/author-directory.js';

/** AuthorDirectory for unit tests: knows the authors it was given. */
export class FakeAuthorDirectory extends AuthorDirectory {
  readonly lookups: string[][] = [];
  private readonly authors: Map<string, Author>;

  constructor(authors: Author[] = []) {
    super();
    this.authors = new Map(authors.map((author) => [author.id, author]));
  }

  findByIds(ids: readonly string[]): Promise<Map<string, Author>> {
    this.lookups.push([...ids]);
    return Promise.resolve(
      new Map(
        ids.flatMap((id) => {
          const author = this.authors.get(id);
          return author ? [[id, author] as const] : [];
        }),
      ),
    );
  }
}
