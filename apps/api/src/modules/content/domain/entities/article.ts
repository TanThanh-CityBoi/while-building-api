import { ArticleStatus } from '../article-status.js';
import {
  ArticleNotPublishableError,
  ArticleStatusConflictError,
  InvalidArticleError,
} from '../errors/article.errors.js';
import { ArticleContent } from '../value-objects/article-content.js';
import type { ArticleSlug } from '../value-objects/article-slug.js';

export const ARTICLE_TITLE_MAX_LENGTH = 200;
export const ARTICLE_EXCERPT_MAX_LENGTH = 500;
export const ARTICLE_CATEGORY_MAX_LENGTH = 50;
export const ARTICLE_COVER_IMAGE_MAX_LENGTH = 2048;

export interface ArticleProps {
  id: string;
  title: string;
  /** Unique, URL-safe identifier used by the public site. */
  slug: ArticleSlug;
  /** Short summary for lists and link previews. */
  excerpt: string | null;
  content: ArticleContent;
  /** Absolute http(s) URL of the cover image. */
  coverImage: string | null;
  /** Free-text label, e.g. `DevOps`. */
  category: string | null;
  status: ArticleStatus;
  /** The user who created it; `null` once that account is deleted. */
  authorId: string | null;
  /** When it was (last) published; `null` while it's a draft. */
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** The fields a writer edits. Optional ones may be cleared with `null`. */
export interface ArticleFields {
  title: string;
  slug: ArticleSlug;
  excerpt?: string | null;
  content?: ArticleContent;
  coverImage?: string | null;
  category?: string | null;
}

/**
 * A piece of writing. Owns the publishing rules: it starts as a draft, only a
 * written article (title, slug and content) can be published, and a published
 * article must stay that way while it's being edited.
 */
export class Article {
  private constructor(private readonly props: ArticleProps) {}

  /** A new draft by `authorId`. */
  static create(
    input: { id: string; authorId: string } & ArticleFields,
    now: Date,
  ): Article {
    return new Article({
      id: input.id,
      title: validTitle(input.title),
      slug: input.slug,
      excerpt: optionalText(
        input.excerpt,
        'excerpt',
        ARTICLE_EXCERPT_MAX_LENGTH,
      ),
      content: input.content ?? ArticleContent.empty(),
      coverImage: validCoverImage(input.coverImage),
      category: optionalText(
        input.category,
        'category',
        ARTICLE_CATEGORY_MAX_LENGTH,
      ),
      status: ArticleStatus.DRAFT,
      authorId: input.authorId,
      publishedAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  /** Rehydrates a stored article (no rules re-applied). */
  static restore(props: ArticleProps): Article {
    return new Article({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
  get title(): string {
    return this.props.title;
  }
  get slug(): ArticleSlug {
    return this.props.slug;
  }
  get excerpt(): string | null {
    return this.props.excerpt;
  }
  get content(): ArticleContent {
    return this.props.content;
  }
  get coverImage(): string | null {
    return this.props.coverImage;
  }
  get category(): string | null {
    return this.props.category;
  }
  get status(): ArticleStatus {
    return this.props.status;
  }
  get authorId(): string | null {
    return this.props.authorId;
  }
  get publishedAt(): Date | null {
    return this.props.publishedAt;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  /** Only published articles are visible to the public. */
  get isPublished(): boolean {
    return this.props.status === ArticleStatus.PUBLISHED;
  }

  /**
   * Changes the given fields. Changing the title never changes the slug. A
   * published article can't lose its content: that would publish an empty page.
   */
  edit(changes: Partial<ArticleFields>, now: Date): void {
    const next: ArticleProps = { ...this.props };
    if (changes.title !== undefined) next.title = validTitle(changes.title);
    if (changes.slug !== undefined) next.slug = changes.slug;
    if (changes.excerpt !== undefined) {
      next.excerpt = optionalText(
        changes.excerpt,
        'excerpt',
        ARTICLE_EXCERPT_MAX_LENGTH,
      );
    }
    if (changes.content !== undefined) next.content = changes.content;
    if (changes.coverImage !== undefined) {
      next.coverImage = validCoverImage(changes.coverImage);
    }
    if (changes.category !== undefined) {
      next.category = optionalText(
        changes.category,
        'category',
        ARTICLE_CATEGORY_MAX_LENGTH,
      );
    }
    if (next.status === ArticleStatus.PUBLISHED) assertPublishable(next);

    Object.assign(this.props, next, { updatedAt: now });
  }

  /** Makes the article public. */
  publish(now: Date): void {
    if (this.isPublished) {
      throw new ArticleStatusConflictError('The article is already published.');
    }
    assertPublishable(this.props);
    this.props.status = ArticleStatus.PUBLISHED;
    this.props.publishedAt = now;
    this.props.updatedAt = now;
  }

  /** Takes the article off the public site; it becomes a draft again. */
  unpublish(now: Date): void {
    if (!this.isPublished) {
      throw new ArticleStatusConflictError('The article is not published.');
    }
    this.props.status = ArticleStatus.DRAFT;
    this.props.publishedAt = null;
    this.props.updatedAt = now;
  }
}

function assertPublishable(props: ArticleProps): void {
  if (props.title.length === 0 || props.content.isEmpty) {
    throw new ArticleNotPublishableError();
  }
}

function validTitle(title: string): string {
  const trimmed = title.trim();
  if (trimmed.length === 0 || trimmed.length > ARTICLE_TITLE_MAX_LENGTH) {
    throw new InvalidArticleError(
      `title must be between 1 and ${ARTICLE_TITLE_MAX_LENGTH} characters`,
    );
  }
  return trimmed;
}

/** Trimmed text, or `null` when empty. */
function optionalText(
  value: string | null | undefined,
  field: string,
  maxLength: number,
): string | null {
  const trimmed = value?.trim() ?? '';
  if (trimmed.length > maxLength) {
    throw new InvalidArticleError(
      `${field} must be at most ${maxLength} characters`,
    );
  }
  return trimmed.length === 0 ? null : trimmed;
}

function validCoverImage(value: string | null | undefined): string | null {
  const url = optionalText(value, 'coverImage', ARTICLE_COVER_IMAGE_MAX_LENGTH);
  if (url !== null && !/^https?:\/\/\S+$/i.test(url)) {
    throw new InvalidArticleError('coverImage must be an http(s) URL');
  }
  return url;
}
