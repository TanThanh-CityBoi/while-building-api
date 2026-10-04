import { Injectable } from '@nestjs/common';
import { ProjectRepository } from '../../domain/repositories/project.repository.js';
import { toProjectView, type ProjectView } from '../dto/project.view.js';
import { ProjectNotFoundError } from '../errors/content.errors.js';

/** A published project by slug; drafts and archived projects are "not found". */
@Injectable()
export class GetPublishedProjectUseCase {
  constructor(private readonly projects: ProjectRepository) {}

  async execute(slug: string): Promise<ProjectView> {
    const project = await this.projects.findBySlug(slug);
    if (!project?.isPublished) throw new ProjectNotFoundError();
    return toProjectView(project);
  }
}
