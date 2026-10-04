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
  ArticleSlugTakenError,
  InvalidArticleContentError,
  InvalidArticleSlugError,
} from '../../domain/errors/article.errors.js';
import { CreateArticleUseCase } from './create-article.use-case.js';

describe('CreateArticleUseCase', () => {
  let articles: InMemoryArticleRepository;
  let createArticle: CreateArticleUseCase;

  beforeEach(() => {
    articles = new InMemoryArticleRepository();
    createArticle = new CreateArticleUseCase(
      articles,
      new FakeAuthorDirectory([AUTHOR]),
    );
  });

  it('creates a draft by the signed-in user, deriving the slug from the title', async () => {
    const article = await createArticle.execute({
      authorId: AUTHOR.id,
      title: 'Chạy PostgreSQL trên Homelab',
      content: [paragraph('First lines.')],
    });

    expect(article).toMatchObject({
      title: 'Chạy PostgreSQL trên Homelab',
      slug: 'chay-postgresql-tren-homelab',
      status: ArticleStatus.DRAFT,
      author: AUTHOR,
      publishedAt: null,
      content: [paragraph('First lines.')],
    });
    expect(articles.stored(article.id)?.authorId).toBe(AUTHOR.id);
  });

  it('uses the given slug', async () => {
    const article = await createArticle.execute({
      authorId: AUTHOR.id,
      title: 'Anything',
      slug: 'custom-slug',
    });
    expect(article.slug).toBe('custom-slug');
    expect(article.content).toEqual([]);
  });

  it('rejects a slug that is already taken, by a draft too', async () => {
    articles.add(articleProps({ slug: 'taken', status: ArticleStatus.DRAFT }));
    await expect(
      createArticle.execute({ authorId: AUTHOR.id, title: 'Taken' }),
    ).rejects.toThrow(ArticleSlugTakenError);
  });

  it('rejects an invalid slug or content', async () => {
    await expect(
      createArticle.execute({
        authorId: AUTHOR.id,
        title: 'T',
        slug: 'Bad Slug',
      }),
    ).rejects.toThrow(InvalidArticleSlugError);
    await expect(
      createArticle.execute({
        authorId: AUTHOR.id,
        title: 'T',
        content: 'text',
      }),
    ).rejects.toThrow(InvalidArticleContentError);
  });
});
