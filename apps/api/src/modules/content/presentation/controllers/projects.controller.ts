import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiNotFoundResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../auth/presentation/decorators/public.decorator.js';
import { GetPublishedProjectUseCase } from '../../application/use-cases/get-published-project.use-case.js';
import { ListPublishedProjectsUseCase } from '../../application/use-cases/list-published-projects.use-case.js';
import { ListProjectsQueryDto } from '../dto/list-projects-query.dto.js';
import {
  ProjectListResponseDto,
  ProjectResponseDto,
} from '../dto/project-response.dto.js';
import { SlugParamsDto } from '../dto/slug-params.dto.js';

// The public site reads published projects without signing in.
@Public()
@ApiTags('projects')
@Controller('projects')
export class ProjectsController {
  constructor(
    private readonly listProjects: ListPublishedProjectsUseCase,
    private readonly getProject: GetPublishedProjectUseCase,
  ) {}

  /** Lists published projects, featured first, then most recently updated. */
  @Get()
  async list(
    @Query() query: ListProjectsQueryDto,
  ): Promise<ProjectListResponseDto> {
    const { projects, ...meta } = await this.listProjects.execute(query);
    return { data: projects, meta };
  }

  /** A published project. */
  @Get(':slug')
  @ApiNotFoundResponse({ description: 'No such published project.' })
  async get(@Param() { slug }: SlugParamsDto): Promise<ProjectResponseDto> {
    return { data: await this.getProject.execute(slug) };
  }
}
