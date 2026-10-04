import { Project } from '../../domain/entities/project.js';
import type { ProjectOrmEntity } from '../persistence/project.orm-entity.js';

export const ProjectMapper = {
  toDomain(record: ProjectOrmEntity): Project {
    return Project.restore({
      id: record.id,
      slug: record.slug,
      name: record.name,
      description: record.description,
      technologies: record.technologies,
      stage: record.stage,
      featured: record.featured,
      status: record.status,
      links: record.links,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  },
};
