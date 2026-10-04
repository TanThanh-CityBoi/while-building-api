import { describe, expect, it } from 'vitest';
import { paragraph } from '../../../../../test/fakes/content.fixture.js';
import { ArticleStatus } from '../article-status.js';
import {
  ArticleNotPublishableError,
  ArticleStatusConflictError,
  InvalidArticleError,
} from '../errors/article.errors.js';
import { ArticleContent } from '../value-objects/article-content.js';
import { ArticleSlug } from '../value-objects/article-slug.js';
import { Article } from './article.js';

const created = new Date('2026-10-01T09:00:00Z');
const later = new Date('2026-10-02T09:00:00Z');
const written = ArticleContent.create([paragraph('Hello, homelab.')]);

function draft(content = written): Article {
  return Article.create(
    {
      id: 'article-1',
      authorId: 'user-1',
      title: '  Running PostgreSQL on my Homelab ',
      slug: ArticleSlug.create('running-postgresql-on-my-homelab'),
      excerpt: '  ',
      content,
      category: 'DevOps',
    },
    created,
  );
}

describe('Article', () => {
  it('starts as an unpublished draft with trimmed fields', () => {
    const article = draft();
    expect(article).toMatchObject({
      title: 'Running PostgreSQL on my Homelab',
      excerpt: null,
      coverImage: null,
      category: 'DevOps',
      status: ArticleStatus.DRAFT,
      authorId: 'user-1',
      publishedAt: null,
      createdAt: created,
      updatedAt: created,
    });
    expect(article.isPublished).toBe(false);
  });

  it('defaults to empty content', () => {
    const article = Article.create(
      {
        id: 'a',
        authorId: 'u',
        title: 'Notes',
        slug: ArticleSlug.create('notes'),
      },
      created,
    );
    expect(article.content.isEmpty).toBe(true);
  });

  it.each([
    [{ title: ' ' }, 'title must be between 1 and 200 characters'],
    [{ title: 'x'.repeat(201) }, 'title must be between 1 and 200 characters'],
    [{ excerpt: 'x'.repeat(501) }, 'excerpt must be at most 500 characters'],
    [{ category: 'x'.repeat(51) }, 'category must be at most 50 characters'],
    [{ coverImage: 'ftp://x.dev/a.png' }, 'coverImage must be an http(s) URL'],
  ])('rejects invalid fields %j', (changes, message) => {
    expect(() => draft().edit(changes, later)).toThrow(
      new InvalidArticleError(message),
    );
  });

  it('publishes a written draft', () => {
    const article = draft();
    article.publish(later);
    expect(article).toMatchObject({
      status: ArticleStatus.PUBLISHED,
      publishedAt: later,
      updatedAt: later,
    });
    expect(article.isPublished).toBe(true);
  });

  it('refuses to publish an empty article', () => {
    const article = draft(ArticleContent.create([paragraph('   ')]));
    expect(() => article.publish(later)).toThrow(ArticleNotPublishableError);
    expect(article.status).toBe(ArticleStatus.DRAFT);
  });

  it('refuses to publish twice or unpublish a draft', () => {
    const article = draft();
    expect(() => article.unpublish(later)).toThrow(ArticleStatusConflictError);
    article.publish(later);
    expect(() => article.publish(later)).toThrow(ArticleStatusConflictError);
  });

  it('unpublishes back to a draft', () => {
    const article = draft();
    article.publish(later);
    const after = new Date('2026-10-03T09:00:00Z');
    article.unpublish(after);
    expect(article).toMatchObject({
      status: ArticleStatus.DRAFT,
      publishedAt: null,
      updatedAt: after,
    });
  });

  it('keeps the slug when the title changes', () => {
    const article = draft();
    article.edit({ title: 'A New Title' }, later);
    expect(article.title).toBe('A New Title');
    expect(article.slug.value).toBe('running-postgresql-on-my-homelab');
    expect(article.updatedAt).toBe(later);
  });

  it('clears optional fields with null', () => {
    const article = draft();
    article.edit({ category: null, coverImage: 'https://x.dev/c.png' }, later);
    expect(article.category).toBeNull();
    expect(article.coverImage).toBe('https://x.dev/c.png');
  });

  it('keeps a published article publishable while editing', () => {
    const article = draft();
    article.publish(later);
    expect(() =>
      article.edit({ content: ArticleContent.empty() }, later),
    ).toThrow(ArticleNotPublishableError);
    expect(article.content).toBe(written);
  });

  it('leaves the article unchanged when an edit is rejected', () => {
    const article = draft();
    expect(() =>
      article.edit({ title: 'Fine', excerpt: 'x'.repeat(501) }, later),
    ).toThrow(InvalidArticleError);
    expect(article.title).toBe('Running PostgreSQL on my Homelab');
    expect(article.updatedAt).toBe(created);
  });
});
