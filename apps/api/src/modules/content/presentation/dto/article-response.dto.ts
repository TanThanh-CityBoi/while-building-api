import { PaginationMetaDto } from '../../../../shared/http/pagination-meta.dto.js';

/** A published article in a list (no body). */
export class ArticleSummaryDto {
  id!: string;
  slug!: string;
  title!: string;
  description!: string;
  category!: string;
  publishedAt!: Date | null;
  readingTimeMinutes!: number;
  createdAt!: Date;
  updatedAt!: Date;
}

/** A published article, with its Markdown body. */
export class ArticleDto extends ArticleSummaryDto {
  body!: string | null;
}

export class ArticleResponseDto {
  data!: ArticleDto;
}

export class ArticleListResponseDto {
  data!: ArticleSummaryDto[];
  meta!: PaginationMetaDto;
}
