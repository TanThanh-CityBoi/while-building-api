import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../../auth/application/dto/authenticated-user.js';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator.js';
import { Permissions } from '../../../auth/presentation/decorators/permissions.decorator.js';
import { CreateArticleUseCase } from '../../application/use-cases/create-article.use-case.js';
import { DeleteArticleUseCase } from '../../application/use-cases/delete-article.use-case.js';
import { GetArticleUseCase } from '../../application/use-cases/get-article.use-case.js';
import { ListArticlesUseCase } from '../../application/use-cases/list-articles.use-case.js';
import { PublishArticleUseCase } from '../../application/use-cases/publish-article.use-case.js';
import { UnpublishArticleUseCase } from '../../application/use-cases/unpublish-article.use-case.js';
import { UpdateArticleUseCase } from '../../application/use-cases/update-article.use-case.js';
import { ContentPermission } from '../../domain/content-permission.js';
import {
  ArticleListResponseDto,
  ArticleResponseDto,
} from '../dto/article-response.dto.js';
import { CreateArticleDto } from '../dto/create-article.dto.js';
import { ListManagedArticlesQueryDto } from '../dto/list-managed-articles-query.dto.js';
import { UpdateArticleDto } from '../dto/update-article.dto.js';

const ArticleId = () => Param('id', new ParseUUIDPipe());

/** Article management for the CMS: every status, permission-checked. */
@ApiTags('content')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Not signed in.' })
@ApiForbiddenResponse({ description: 'Missing permission.' })
@Controller('content/articles')
export class ManagedArticlesController {
  constructor(
    private readonly listArticles: ListArticlesUseCase,
    private readonly getArticle: GetArticleUseCase,
    private readonly createArticle: CreateArticleUseCase,
    private readonly updateArticle: UpdateArticleUseCase,
    private readonly publishArticle: PublishArticleUseCase,
    private readonly unpublishArticle: UnpublishArticleUseCase,
    private readonly deleteArticle: DeleteArticleUseCase,
  ) {}

  /** Lists articles in every status, most recently updated first. */
  @Get()
  @Permissions(ContentPermission.CONTENT_READ)
  async list(
    @Query() query: ListManagedArticlesQueryDto,
  ): Promise<ArticleListResponseDto> {
    const { articles, ...meta } = await this.listArticles.execute(query);
    return { data: articles, meta };
  }

  @Get(':id')
  @Permissions(ContentPermission.CONTENT_READ)
  @ApiNotFoundResponse({ description: 'No such article.' })
  async get(@ArticleId() id: string): Promise<ArticleResponseDto> {
    return { data: await this.getArticle.execute(id) };
  }

  /** Creates a draft written by the signed-in user. */
  @Post()
  @Permissions(ContentPermission.CONTENT_CREATE)
  @ApiConflictResponse({ description: 'Slug already in use.' })
  async create(
    @Body() dto: CreateArticleDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<ArticleResponseDto> {
    return {
      data: await this.createArticle.execute({ ...dto, authorId: actor.id }),
    };
  }

  /** Saves changes. Saving a published article updates the public page. */
  @Patch(':id')
  @Permissions(ContentPermission.CONTENT_UPDATE)
  @ApiNotFoundResponse({ description: 'No such article.' })
  @ApiConflictResponse({ description: 'Slug already in use.' })
  @ApiBadRequestResponse({
    description: 'Invalid field, or a published article left without content.',
  })
  async update(
    @ArticleId() id: string,
    @Body() dto: UpdateArticleDto,
  ): Promise<ArticleResponseDto> {
    return { data: await this.updateArticle.execute({ ...dto, id }) };
  }

  /** Makes a draft public. */
  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @Permissions(ContentPermission.CONTENT_PUBLISH)
  @ApiNotFoundResponse({ description: 'No such article.' })
  @ApiConflictResponse({ description: 'Already published.' })
  @ApiBadRequestResponse({ description: 'The article has no content.' })
  async publish(@ArticleId() id: string): Promise<ArticleResponseDto> {
    return { data: await this.publishArticle.execute(id) };
  }

  /** Takes a published article off the public site (back to draft). */
  @Post(':id/unpublish')
  @HttpCode(HttpStatus.OK)
  @Permissions(ContentPermission.CONTENT_PUBLISH)
  @ApiNotFoundResponse({ description: 'No such article.' })
  @ApiConflictResponse({ description: 'Not published.' })
  async unpublish(@ArticleId() id: string): Promise<ArticleResponseDto> {
    return { data: await this.unpublishArticle.execute(id) };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions(ContentPermission.CONTENT_DELETE)
  @ApiNotFoundResponse({ description: 'No such article.' })
  remove(@ArticleId() id: string): Promise<void> {
    return this.deleteArticle.execute(id);
  }
}
