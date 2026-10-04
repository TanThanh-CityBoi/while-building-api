import { Matches, MaxLength } from 'class-validator';
import { SLUG_MAX_LENGTH, SLUG_PATTERN } from '../../domain/slug.js';

export class SlugParamsDto {
  /** e.g. `building-a-nestjs-api-from-scratch` */
  @MaxLength(SLUG_MAX_LENGTH)
  @Matches(SLUG_PATTERN, {
    message: 'slug must be lower-case words separated by hyphens',
  })
  slug!: string;
}
