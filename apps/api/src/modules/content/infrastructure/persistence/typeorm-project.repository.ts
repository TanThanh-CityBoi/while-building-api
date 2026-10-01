import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { escapeLike } from '../../../../shared/persistence/escape-like.js';
import type { Project } from '../../domain/entities/project.js';
import {
  ProjectRepository,
  type ProjectListCriteria,
  type ProjectListPage,
} from '../../domain/repositories/project.repository.js';
import { ProjectMapper } from '../mappers/project.mapper.js';
import { ProjectOrmEntity } from './project.orm-entity.js';

@Injectable()
export class TypeOrmProjectRepository extends ProjectRepository {
  constructor(
    @InjectRepository(ProjectOrmEntity)
    private readonly records: Repository<ProjectOrmEntity>,
  ) {
    super();
  }

  async list(criteria: ProjectListCriteria): Promise<ProjectListPage> {
    const { page, pageSize, search, technology, featured, status } = criteria;
    const query = this.records.createQueryBuilder('project');

    if (status) query.andWhere('project.status = :status', { status });
    if (featured !== undefined) {
      query.andWhere('project.featured = :featured', { featured });
    }
    if (technology) {
      query.andWhere(
        `EXISTS (SELECT 1 FROM unnest("project"."technologies") AS "technology" WHERE lower("technology") = lower(:technology))`,
        { technology },
      );
    }
    if (search) {
      query.andWhere(
        `(project.name ILIKE :search OR project.description ILIKE :search OR array_to_string("project"."technologies", ' ') ILIKE :search)`,
        { search: `%${escapeLike(search)}%` },
      );
    }

    const [records, total] = await query
      .orderBy('project.featured', 'DESC')
      .addOrderBy('project.updatedAt', 'DESC')
      .addOrderBy('project.id', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return {
      projects: records.map((record) => ProjectMapper.toDomain(record)),
      total,
    };
  }

  async findBySlug(slug: string): Promise<Project | null> {
    const record = await this.records.findOneBy({ slug });
    return record ? ProjectMapper.toDomain(record) : null;
  }
}
