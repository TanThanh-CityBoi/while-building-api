import { PartialType } from '@nestjs/swagger';
import { CreateArticleDto } from './create-article.dto.js';

/**
 * Every field is optional; only the fields present are changed. Changing the
 * title keeps the slug: send `slug` to change the article's URL.
 */
export class UpdateArticleDto extends PartialType(CreateArticleDto) {}
