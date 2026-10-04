import type { ContentStatus } from '../content-status.js';
import type { Project } from '../entities/project.js';

export interface ProjectListCriteria {
  /** 1-based. */
  page: number;
  pageSize: number;
  /** Case-insensitive match on name, description or a technology. */
  search?: string;
  /** Case-insensitive exact technology, e.g. `nestjs`. */
  technology?: string;
  featured?: boolean;
  status?: ContentStatus;
}

export interface ProjectListPage {
  /** Featured first, then most recently updated. */
  projects: Project[];
  total: number;
}

/** Persistence port for projects (an abstract class so it doubles as the DI token). */
export abstract class ProjectRepository {
  abstract list(criteria: ProjectListCriteria): Promise<ProjectListPage>;

  abstract findBySlug(slug: string): Promise<Project | null>;
}
