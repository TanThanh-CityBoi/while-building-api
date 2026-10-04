import { beforeEach, describe, expect, it } from 'vitest';
import { contentFixture } from '../../../../../test/fakes/content.fixture.js';
import { ListPublishedArticlesUseCase } from './list-published-articles.use-case.js';

describe('ListPublishedArticlesUseCase', () => {
  let listArticles: ListPublishedArticlesUseCase;

  beforeEach(() => {
    listArticles = new ListPublishedArticlesUseCase(contentFixture().articles);
  });

  it('lists only published articles, newest first, without bodies or status', async () => {
    const result = await listArticles.execute({ page: 1, pageSize: 10 });

    expect(result.articles.map((a) => a.slug)).toEqual([
      'k3s-homelab',
      'nestjs-from-scratch',
    ]);
    expect(result.articles[0]).not.toHaveProperty('body');
    expect(result.articles[0]).not.toHaveProperty('status');
    expect(result).toMatchObject({ page: 1, pageSize: 10, total: 2 });
    expect(result.totalPages).toBe(1);
  });

  it('never matches unpublished articles by search', async () => {
    const result = await listArticles.execute({
      page: 1,
      pageSize: 10,
      search: 'nestjs',
    });
    expect(result.articles.map((a) => a.slug)).toEqual(['nestjs-from-scratch']);
  });

  it('filters by category, ignoring case', async () => {
    const result = await listArticles.execute({
      page: 1,
      pageSize: 10,
      category: 'kubernetes',
    });
    expect(result.articles.map((a) => a.slug)).toEqual(['k3s-homelab']);
  });

  it('paginates', async () => {
    const result = await listArticles.execute({ page: 2, pageSize: 1 });
    expect(result.articles.map((a) => a.slug)).toEqual(['nestjs-from-scratch']);
    expect(result).toMatchObject({ total: 2, totalPages: 2 });
  });
});
