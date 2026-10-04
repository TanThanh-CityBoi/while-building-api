import { beforeEach, describe, expect, it } from 'vitest';
import {
  AUTHOR,
  articleProps,
  paragraph,
} from '../../../../../test/fakes/content.fixture.js';
import { FakeAuthorDirectory } from '../../../../../test/fakes/fake-author-directory.js';
import { InMemoryArticleRepository } from '../../../../../test/fakes/in-memory-article.repository.js';
import { ArticleStatus } from '../../domain/article-status.js';
import {
  ArticleNotPublishableError,
  ArticleSlugTakenError,
} from '../../domain/errors/article.errors.js';
import { ArticleNotFoundError } from '../errors/content.errors.js';
import { UpdateArticleUseCase } from './update-article.use-case.js';

describe('UpdateArticleUseCase', () => {
  let articles: InMemoryArticleRepository;
  let updateArticle: UpdateArticleUseCase;

  beforeEach(() => {
    articles = new InMemoryArticleRepository();
    articles.add(
      articleProps({
        slug: 'mine',
        status: ArticleStatus.DRAFT,
        publishedAt: null,
      }),
    );
    articles.add(articleProps({ slug: 'other' }));
    updateArticle = new UpdateArticleUseCase(
      articles,
      new FakeAuthorDirectory([AUTHOR]),
    );
  });

  it('changes only the given fields and keeps the slug on rename', async () => {
    const article = await updateArticle.execute({
      id: 'a-mine',
      title: 'Renamed',
      excerpt: null,
      content: [paragraph('New body.')],
    });

    expect(article).toMatchObject({
      title: 'Renamed',
      slug: 'mine',
      excerpt: null,
      category: 'Backend',
      content: [paragraph('New body.')],
    });
    expect(articles.stored('a-mine')?.title).toBe('Renamed');
  });

  it('changes the slug when asked, if it is free', async () => {
    const article = await updateArticle.execute({
      id: 'a-mine',
      slug: 'fresh',
    });
    expect(article.slug).toBe('fresh');
    await expect(
      updateArticle.execute({ id: 'a-mine', slug: 'other' }),
    ).rejects.toThrow(ArticleSlugTakenError);
  });

  it('accepts its own slug unchanged', async () => {
    await expect(
      updateArticle.execute({ id: 'a-mine', slug: 'mine', title: 'Same' }),
    ).resolves.toMatchObject({ slug: 'mine' });
  });

  it('refuses to empty a published article', async () => {
    await expect(
      updateArticle.execute({ id: 'a-other', content: [] }),
    ).rejects.toThrow(ArticleNotPublishableError);
  });

  it('reports an unknown article', async () => {
    await expect(
      updateArticle.execute({ id: 'nope', title: 'x' }),
    ).rejects.toThrow(ArticleNotFoundError);
  });
});
