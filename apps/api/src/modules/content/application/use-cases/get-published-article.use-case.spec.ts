import { beforeEach, describe, expect, it } from 'vitest';
import { contentFixture } from '../../../../../test/fakes/content.fixture.js';
import { ArticleNotFoundError } from '../errors/content.errors.js';
import { GetPublishedArticleUseCase } from './get-published-article.use-case.js';

describe('GetPublishedArticleUseCase', () => {
  let getArticle: GetPublishedArticleUseCase;

  beforeEach(() => {
    getArticle = new GetPublishedArticleUseCase(contentFixture().articles);
  });

  it('returns a published article with its body', async () => {
    const article = await getArticle.execute('k3s-homelab');
    expect(article).toMatchObject({
      slug: 'k3s-homelab',
      title: 'My k3s Homelab',
      body: '# An Article',
    });
    expect(article).not.toHaveProperty('status');
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
