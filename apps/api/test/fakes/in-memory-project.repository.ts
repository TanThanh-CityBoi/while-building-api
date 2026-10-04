import {
  Project,
  type ProjectProps,
} from '../../src/modules/content/domain/entities/project.js';
import {
  ProjectRepository,
  type ProjectListCriteria,
  type ProjectListPage,
} from '../../src/modules/content/domain/repositories/project.repository.js';

/** ProjectRepository for unit tests, with the same filtering and order as the real one. */
export class InMemoryProjectRepository extends ProjectRepository {
  private readonly rows = new Map<string, ProjectProps>();

  /** Test helper: store a project directly. */
  add(props: ProjectProps): void {
    this.rows.set(props.slug, { ...props });
  }

  list(criteria: ProjectListCriteria): Promise<ProjectListPage> {
    const search = criteria.search?.toLowerCase();
    const technology = criteria.technology?.toLowerCase();
    const matching = [...this.rows.values()]
      .filter((row) => !criteria.status || row.status === criteria.status)
      .filter(
        (row) =>
          criteria.featured === undefined || row.featured === criteria.featured,
      )
      .filter(
        (row) =>
          !technology ||
          row.technologies.some((t) => t.toLowerCase() === technology),
      )
      .filter(
        (row) =>
          !search ||
          [row.name, row.description, ...row.technologies].some((text) =>
            text.toLowerCase().includes(search),
          ),
      )
      .sort(
        (a, b) =>
          Number(b.featured) - Number(a.featured) ||
          b.updatedAt.getTime() - a.updatedAt.getTime(),
      );
    const start = (criteria.page - 1) * criteria.pageSize;
    return Promise.resolve({
      projects: matching
        .slice(start, start + criteria.pageSize)
        .map((row) => Project.restore(row)),
      total: matching.length,
    });
  }

  findBySlug(slug: string): Promise<Project | null> {
    const row = this.rows.get(slug);
    return Promise.resolve(row ? Project.restore(row) : null);
  }
}
