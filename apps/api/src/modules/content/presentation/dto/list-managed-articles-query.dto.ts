import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { trimString } from '../../../../shared/validation/transformers.js';
import { ArticleStatus } from '../../domain/article-status.js';
import type { ArticleSortField } from '../../domain/repositories/article.repository.js';
import { STATUS_MESSAGE } from './article-fields.js';

const SORT_FIELDS: readonly ArticleSortField[] = [
  'updatedAt',
  'createdAt',
  'publishedAt',
  'title',
];

/** CMS list: every status, most recently updated first by default. */
export class ListManagedArticlesQueryDto {
  /** 1-based page number. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;

  /** Matches title, excerpt, slug or category (case-insensitive). */
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsEnum(ArticleStatus, { message: STATUS_MESSAGE })
  status?: ArticleStatus;

  @IsOptional()
  @IsIn(SORT_FIELDS, {
    message: `sort must be one of: ${SORT_FIELDS.join(', ')}`,
  })
  sort?: ArticleSortField;

  @IsOptional()
  @IsIn(['asc', 'desc'], { message: 'order must be asc or desc' })
  order?: 'asc' | 'desc';
}
