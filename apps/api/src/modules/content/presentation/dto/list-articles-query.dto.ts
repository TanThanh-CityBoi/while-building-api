import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { trimString } from '../../../../shared/validation/transformers.js';

export class ListArticlesQueryDto {
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
  @Max(50)
  pageSize: number = 10;

  /** Matches title, excerpt, slug or category (case-insensitive). */
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(100)
  search?: string;

  /** Exact category, case-insensitive, e.g. `DevOps`. */
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(50)
  category?: string;
}
