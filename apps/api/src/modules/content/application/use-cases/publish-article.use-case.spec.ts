import { beforeEach, describe, expect, it } from 'vitest';
import {
  AUTHOR,
  articleProps,
} from '../../../../../test/fakes/content.fixture.js';
import { FakeAuthorDirectory } from '../../../../../test/fakes/fake-author-directory.js';
import { InMemoryArticleRepository } from '../../../../../test/fakes/in-memory-article.repository.js';
import { ArticleStatus } from '../../domain/article-status.js';
import {
  ArticleNotPublishableError,
  ArticleStatusConflictError,
} from '../../domain/errors/article.errors.js';
import { ArticleContent } from '../../domain/value-objects/article-content.js';
import { ArticleNotFoundError } from '../errors/content.errors.js';
import { PublishArticleUseCase } from './publish-article.use-case.js';
import { UnpublishArticleUseCase } from './unpublish-article.use-case.js';

describe('PublishArticleUseCase / UnpublishArticleUseCase', () => {
  let articles: InMemoryArticleRepository;
  let publish: PublishArticleUseCase;
  let unpublish: UnpublishArticleUseCase;

  beforeEach(() => {
    articles = new InMemoryArticleRepository();
    articles.add(
      articleProps({
        slug: 'draft',
        status: ArticleStatus.DRAFT,
        publishedAt: null,
      }),
    );
    articles.add(
      articleProps({
        slug: 'empty',
        status: ArticleStatus.DRAFT,
        publishedAt: null,
        content: ArticleContent.empty(),
      }),
    );
    const authors = new FakeAuthorDirectory([AUTHOR]);
    publish = new PublishArticleUseCase(articles, authors);
    unpublish = new UnpublishArticleUseCase(articles, authors);
  });

  it('publishes a draft and stores it', async () => {
    const article = await publish.execute('a-draft');
    expect(article.status).toBe(ArticleStatus.PUBLISHED);
    expect(article.publishedAt).toBeInstanceOf(Date);
    expect(articles.stored('a-draft')?.isPublished).toBe(true);
  });

  it('refuses to publish an article without content', async () => {
    await expect(publish.execute('a-empty')).rejects.toThrow(
      ArticleNotPublishableError,
    );
    expect(articles.stored('a-empty')?.isPublished).toBe(false);
  });

  it('unpublishes back to a draft', async () => {
    await publish.execute('a-draft');
    const article = await unpublish.execute('a-draft');
    expect(article).toMatchObject({
      status: ArticleStatus.DRAFT,
      publishedAt: null,
    });
    expect(articles.stored('a-draft')?.isPublished).toBe(false);
  });

  it('rejects invalid transitions and unknown articles', async () => {
    await expect(unpublish.execute('a-draft')).rejects.toThrow(
      ArticleStatusConflictError,
    );
    await publish.execute('a-draft');
    await expect(publish.execute('a-draft')).rejects.toThrow(
      ArticleStatusConflictError,
    );
    await expect(publish.execute('nope')).rejects.toThrow(ArticleNotFoundError);
  });
});
