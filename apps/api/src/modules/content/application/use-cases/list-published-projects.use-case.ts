import { Injectable } from '@nestjs/common';
import { ContentStatus } from '../../domain/content-status.js';
import { ProjectRepository } from '../../domain/repositories/project.repository.js';
import { toProjectView, type ProjectListView } from '../dto/project.view.js';

export interface ListPublishedProjectsQuery {
  page: number;
  pageSize: number;
  search?: string;
  technology?: string;
  featured?: boolean;
}

/** Lists published projects for the public, featured first. */
@Injectable()
export class ListPublishedProjectsUseCase {
  constructor(private readonly projects: ProjectRepository) {}

  async execute(query: ListPublishedProjectsQuery): Promise<ProjectListView> {
    const { projects, total } = await this.projects.list({
      ...query,
      status: ContentStatus.PUBLISHED,
    });
    return {
      projects: projects.map(toProjectView),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }
}
