import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { trimString } from '../../../../shared/validation/transformers.js';
import type { ContentBlock } from '../../domain/value-objects/article-content.js';
import {
  ARTICLE_CATEGORY_MAX_LENGTH,
  ARTICLE_CONTENT_MAX_BLOCKS,
  ARTICLE_COVER_IMAGE_MAX_LENGTH,
  ARTICLE_EXCERPT_MAX_LENGTH,
  ARTICLE_TITLE_MAX_LENGTH,
  SLUG_MAX_LENGTH,
  SLUG_MESSAGE,
  SLUG_PATTERN,
} from './article-fields.js';

/** A new draft. Only the title is required. */
export class CreateArticleDto {
  @Transform(trimString)
  @IsString()
  @Length(1, ARTICLE_TITLE_MAX_LENGTH)
  title!: string;

  /** Derived from the title when omitted, e.g. `running-postgresql-on-my-homelab`. */
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(SLUG_MAX_LENGTH)
  @Matches(SLUG_PATTERN, { message: SLUG_MESSAGE })
  slug?: string;

  /** Short summary for lists and link previews. Empty or `null` means none. */
  @IsOptional()
  @IsString()
  @MaxLength(ARTICLE_EXCERPT_MAX_LENGTH)
  excerpt?: string | null;

  /** The editor's block document (BlockNote JSON). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(ARTICLE_CONTENT_MAX_BLOCKS)
  @IsObject({ each: true })
  content?: ContentBlock[];

  /** Absolute http(s) URL. Empty or `null` means none. */
  @IsOptional()
  @IsString()
  @MaxLength(ARTICLE_COVER_IMAGE_MAX_LENGTH)
  coverImage?: string | null;

  /** Free-text label, e.g. `DevOps`. Empty or `null` means none. */
  @IsOptional()
  @IsString()
  @MaxLength(ARTICLE_CATEGORY_MAX_LENGTH)
  category?: string | null;
}
