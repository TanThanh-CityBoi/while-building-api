import { beforeEach, describe, expect, it } from 'vitest';
import { articleProps } from '../../../../../test/fakes/content.fixture.js';
import { InMemoryArticleRepository } from '../../../../../test/fakes/in-memory-article.repository.js';
import { ArticleNotFoundError } from '../errors/content.errors.js';
import { DeleteArticleUseCase } from './delete-article.use-case.js';

describe('DeleteArticleUseCase', () => {
  let articles: InMemoryArticleRepository;
  let deleteArticle: DeleteArticleUseCase;

  beforeEach(() => {
    articles = new InMemoryArticleRepository();
    articles.add(articleProps({ slug: 'gone' }));
    deleteArticle = new DeleteArticleUseCase(articles);
  });

  it('deletes an article, published or not', async () => {
    await deleteArticle.execute('a-gone');
    expect(articles.stored('a-gone')).toBeUndefined();
  });

  it('reports an unknown article', async () => {
    await expect(deleteArticle.execute('nope')).rejects.toThrow(
      ArticleNotFoundError,
    );
  });
});
