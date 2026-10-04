import { ContentStatus } from '../content-status.js';

export interface ArticleProps {
  id: string;
  /** Unique, URL-safe identifier used by the public site. */
  slug: string;
  title: string;
  description: string;
  category: string;
  status: ContentStatus;
  /** Article body (Markdown); `null` until written. */
  body: string | null;
  readingTimeMinutes: number;
  /** `null` until first published. */
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A piece of writing. Read-only for now: articles are created and edited
 * outside this API until the CMS gets content management.
 */
export class Article {
  private constructor(private readonly props: ArticleProps) {}

  /** Rehydrates a stored article (no rules re-applied). */
  static restore(props: ArticleProps): Article {
    return new Article({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
  get slug(): string {
    return this.props.slug;
  }
  get title(): string {
    return this.props.title;
  }
  get description(): string {
    return this.props.description;
  }
  get category(): string {
    return this.props.category;
  }
  get status(): ContentStatus {
    return this.props.status;
  }
  get body(): string | null {
    return this.props.body;
  }
  get readingTimeMinutes(): number {
    return this.props.readingTimeMinutes;
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
    return this.props.status === ContentStatus.PUBLISHED;
  }
}
