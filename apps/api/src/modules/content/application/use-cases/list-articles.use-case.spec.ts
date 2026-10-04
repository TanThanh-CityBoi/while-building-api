import { beforeEach, describe, expect, it } from 'vitest';
import {
  AUTHOR,
  articleProps,
} from '../../../../../test/fakes/content.fixture.js';
import { FakeAuthorDirectory } from '../../../../../test/fakes/fake-author-directory.js';
import { InMemoryArticleRepository } from '../../../../../test/fakes/in-memory-article.repository.js';
import { ArticleStatus } from '../../domain/article-status.js';
import { GetArticleUseCase } from './get-article.use-case.js';
import { ListArticlesUseCase } from './list-articles.use-case.js';

describe('ListArticlesUseCase / GetArticleUseCase', () => {
  let authors: FakeAuthorDirectory;
  let articles: InMemoryArticleRepository;

  beforeEach(() => {
    articles = new InMemoryArticleRepository();
    articles.add(
      articleProps({
        slug: 'old',
        updatedAt: new Date('2026-09-01T00:00:00Z'),
      }),
    );
    articles.add(
      articleProps({
        slug: 'fresh-draft',
        title: 'A Fresh Draft',
        status: ArticleStatus.DRAFT,
        publishedAt: null,
        updatedAt: new Date('2026-09-30T00:00:00Z'),
      }),
    );
    articles.add(
      articleProps({
        slug: 'orphan',
        authorId: 'deleted-user',
        updatedAt: new Date('2026-09-15T00:00:00Z'),
      }),
    );
    authors = new FakeAuthorDirectory([AUTHOR]);
  });

  it('lists every status, most recently updated first, with authors in one lookup', async () => {
    const result = await new ListArticlesUseCase(articles, authors).execute({
      page: 1,
      pageSize: 20,
    });

    expect(result.articles.map((a) => [a.slug, a.status])).toEqual([
      ['fresh-draft', ArticleStatus.DRAFT],
      ['orphan', ArticleStatus.PUBLISHED],
      ['old', ArticleStatus.PUBLISHED],
    ]);
    expect(result.articles.map((a) => a.author)).toEqual([
      AUTHOR,
      null,
      AUTHOR,
    ]);
    expect(result.articles[0]).not.toHaveProperty('content');
    expect(authors.lookups).toHaveLength(1);
    expect(result).toMatchObject({ total: 3, totalPages: 1 });
  });

  it('filters by status and search, and sorts on request', async () => {
    const list = new ListArticlesUseCase(articles, authors);
    const drafts = await list.execute({
      page: 1,
      pageSize: 20,
      status: ArticleStatus.DRAFT,
    });
    expect(drafts.articles.map((a) => a.slug)).toEqual(['fresh-draft']);

    const byTitle = await list.execute({
      page: 1,
      pageSize: 20,
      sort: 'title',
      order: 'asc',
      search: 'a',
    });
    expect(byTitle.articles.map((a) => a.title)).toEqual([
      'A Fresh Draft',
      'An Article',
      'An Article',
    ]);
  });

  it('gets a draft by id, with its content', async () => {
    const article = await new GetArticleUseCase(articles, authors).execute(
      'a-fresh-draft',
    );
    expect(article).toMatchObject({
      status: ArticleStatus.DRAFT,
      author: AUTHOR,
      content: [{ type: 'paragraph' }],
    });
  });
});
