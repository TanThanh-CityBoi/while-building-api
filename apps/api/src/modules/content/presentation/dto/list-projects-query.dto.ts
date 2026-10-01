import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  parseBooleanString,
  trimString,
} from '../../../../shared/validation/transformers.js';

export class ListProjectsQueryDto {
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

  /** Matches name, description or a technology (case-insensitive). */
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(100)
  search?: string;

  /** Exact technology, case-insensitive, e.g. `NestJS`. */
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(50)
  technology?: string;

  /** `true` or `false`. */
  @IsOptional()
  @Transform(parseBooleanString)
  @IsBoolean()
  featured?: boolean;
}
