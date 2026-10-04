import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiNotFoundResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../auth/presentation/decorators/public.decorator.js';
import { GetPublishedArticleUseCase } from '../../application/use-cases/get-published-article.use-case.js';
import { ListPublishedArticlesUseCase } from '../../application/use-cases/list-published-articles.use-case.js';
import {
  PublishedArticleListResponseDto,
  PublishedArticleResponseDto,
} from '../dto/article-response.dto.js';
import { ListArticlesQueryDto } from '../dto/list-articles-query.dto.js';
import { SlugParamsDto } from '../dto/slug-params.dto.js';

// The public site reads published articles without signing in.
@Public()
@ApiTags('articles')
@Controller('articles')
export class ArticlesController {
  constructor(
    private readonly listArticles: ListPublishedArticlesUseCase,
    private readonly getArticle: GetPublishedArticleUseCase,
  ) {}

  /** Lists published articles, newest first. */
  @Get()
  async list(
    @Query() query: ListArticlesQueryDto,
  ): Promise<PublishedArticleListResponseDto> {
    const { articles, ...meta } = await this.listArticles.execute(query);
    return { data: articles, meta };
  }

  /** A published article, with its content. */
  @Get(':slug')
  @ApiNotFoundResponse({ description: 'No such published article.' })
  async get(
    @Param() { slug }: SlugParamsDto,
  ): Promise<PublishedArticleResponseDto> {
    return { data: await this.getArticle.execute(slug) };
  }
}
