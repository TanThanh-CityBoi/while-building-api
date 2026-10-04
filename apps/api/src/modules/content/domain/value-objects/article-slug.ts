import { InvalidArticleSlugError } from '../errors/article.errors.js';
import { SLUG_MAX_LENGTH, SLUG_PATTERN } from '../slug.js';

/** An article's public, URL-safe identifier, e.g. `running-postgresql-on-my-homelab`. */
export class ArticleSlug {
  private constructor(readonly value: string) {}

  static create(raw: string): ArticleSlug {
    const value = raw.trim();
    if (value.length > SLUG_MAX_LENGTH || !SLUG_PATTERN.test(value)) {
      throw new InvalidArticleSlugError();
    }
    return new ArticleSlug(value);
  }

  /**
   * Derives a slug from a title: accents are dropped (Vietnamese included) and
   * everything that isn't a letter or digit becomes a hyphen.
   * "Chạy PostgreSQL trên Homelab" → `chay-postgresql-tren-homelab`.
   */
  static fromTitle(title: string): ArticleSlug {
    const value = slugify(title);
    if (value.length === 0) {
      throw new InvalidArticleSlugError(
        'slug could not be derived from the title; provide one',
      );
    }
    return new ArticleSlug(value);
  }

  /** Rehydrates a slug that was validated before it was stored. */
  static restore(value: string): ArticleSlug {
    return new ArticleSlug(value);
  }

  equals(other: ArticleSlug): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}

function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/^-+|-+$/g, '');
}
