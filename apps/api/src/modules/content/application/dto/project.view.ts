import type { Project, ProjectLink } from '../../domain/entities/project.js';
import type { ProjectStage } from '../../domain/project-stage.js';

/**
 * What the public may see of a project. Never includes the publishing
 * status: only published projects are ever exposed.
 */
export interface ProjectView {
  id: string;
  slug: string;
  name: string;
  description: string;
  technologies: string[];
  stage: ProjectStage | null;
  featured: boolean;
  links: ProjectLink[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectListView {
  projects: ProjectView[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function toProjectView(project: Project): ProjectView {
  return {
    id: project.id,
    slug: project.slug,
    name: project.name,
    description: project.description,
    technologies: [...project.technologies],
    stage: project.stage,
    featured: project.featured,
    links: project.links.map((link) => ({ ...link })),
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}
