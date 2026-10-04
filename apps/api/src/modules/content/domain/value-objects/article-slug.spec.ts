import { describe, expect, it } from 'vitest';
import { InvalidArticleSlugError } from '../errors/article.errors.js';
import { ArticleSlug } from './article-slug.js';

describe('ArticleSlug', () => {
  it.each([
    ['Running PostgreSQL on my Homelab', 'running-postgresql-on-my-homelab'],
    ['Chạy PostgreSQL trên Homelab', 'chay-postgresql-tren-homelab'],
    ['Đường đi của dữ liệu', 'duong-di-cua-du-lieu'],
    ['  k3s: 3 nodes -- 1 cluster!  ', 'k3s-3-nodes-1-cluster'],
  ])('derives %j → %s', (title, expected) => {
    expect(ArticleSlug.fromTitle(title).value).toBe(expected);
  });

  it('keeps derived slugs within the limit, without a trailing hyphen', () => {
    const slug = ArticleSlug.fromTitle(`${'a'.repeat(199)} b`).value;
    expect(slug).toBe('a'.repeat(199));
  });

  it('refuses a title with nothing to derive from', () => {
    expect(() => ArticleSlug.fromTitle('!!!')).toThrow(InvalidArticleSlugError);
  });

  it.each(['Upper-Case', 'two--hyphens', '-leading', 'with space', ''])(
    'rejects %j',
    (raw) => {
      expect(() => ArticleSlug.create(raw)).toThrow(InvalidArticleSlugError);
    },
  );

  it('accepts and compares valid slugs', () => {
    const slug = ArticleSlug.create('my-first-k3s-cluster');
    expect(slug.equals(ArticleSlug.restore('my-first-k3s-cluster'))).toBe(true);
  });
});
