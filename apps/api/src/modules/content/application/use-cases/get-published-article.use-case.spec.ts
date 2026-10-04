import { beforeEach, describe, expect, it } from 'vitest';
import {
  AUTHOR,
  contentFixture,
} from '../../../../../test/fakes/content.fixture.js';
import { ArticleNotFoundError } from '../errors/content.errors.js';
import { GetPublishedArticleUseCase } from './get-published-article.use-case.js';

describe('GetPublishedArticleUseCase', () => {
  let getArticle: GetPublishedArticleUseCase;

  beforeEach(() => {
    const { articles, authors } = contentFixture();
    getArticle = new GetPublishedArticleUseCase(articles, authors);
  });

  it('returns a published article with its content and author', async () => {
    const article = await getArticle.execute('k3s-homelab');
    expect(article).toMatchObject({
      slug: 'k3s-homelab',
      title: 'My k3s Homelab',
      author: AUTHOR,
      readingTimeMinutes: 1,
      content: [{ type: 'paragraph' }],
    });
    expect(article).not.toHaveProperty('status');
    expect(article).not.toHaveProperty('authorId');
  });

  it.each(['draft-post', 'old-post', 'unknown'])(
    'reports %s as not found',
    async (slug) => {
      await expect(getArticle.execute(slug)).rejects.toThrow(
        ArticleNotFoundError,
      );
    },
  );
});
