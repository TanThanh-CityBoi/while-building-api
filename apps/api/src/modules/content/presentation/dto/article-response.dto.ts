import { PaginationMetaDto } from '../../../../shared/http/pagination-meta.dto.js';
import { ArticleStatus } from '../../domain/article-status.js';
import type { ContentBlock } from '../../domain/value-objects/article-content.js';

/** Public information about an author. */
export class AuthorDto {
  id!: string;
  name!: string;
}

class ArticleBaseDto {
  id!: string;
  slug!: string;
  title!: string;
  excerpt!: string | null;
  category!: string | null;
  /** Absolute http(s) URL. */
  coverImage!: string | null;
  /** `null` when the author's account no longer exists. */
  author!: AuthorDto | null;
  publishedAt!: Date | null;
  /** Estimated from the content. */
  readingTimeMinutes!: number;
  createdAt!: Date;
  updatedAt!: Date;
}

/** A published article in a list (no content, no status). */
export class PublishedArticleSummaryDto extends ArticleBaseDto {}

/** A published article, with its content. */
export class PublishedArticleDto extends PublishedArticleSummaryDto {
  /** Block document (BlockNote JSON). */
  content!: ContentBlock[];
}

export class PublishedArticleResponseDto {
  data!: PublishedArticleDto;
}

export class PublishedArticleListResponseDto {
  data!: PublishedArticleSummaryDto[];
  meta!: PaginationMetaDto;
}

/** An article in the CMS list, in any status (no content). */
export class ArticleSummaryDto extends ArticleBaseDto {
  status!: ArticleStatus;
}

/** An article in the CMS, with its content. */
export class ArticleDto extends ArticleSummaryDto {
  /** Block document (BlockNote JSON). */
  content!: ContentBlock[];
}

export class ArticleResponseDto {
  data!: ArticleDto;
}

export class ArticleListResponseDto {
  data!: ArticleSummaryDto[];
  meta!: PaginationMetaDto;
}
