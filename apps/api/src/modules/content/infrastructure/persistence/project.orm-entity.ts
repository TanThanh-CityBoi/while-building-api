import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { ContentStatus } from '../../domain/content-status.js';
import type { ProjectLink } from '../../domain/entities/project.js';
import { ProjectStage } from '../../domain/project-stage.js';

/** Database record for a project (table `projects`). Not the domain model: see ProjectMapper. */
@Entity({ name: 'projects' })
@Index('projects_slug_key', ['slug'], { unique: true })
@Index('projects_status_idx', ['status'])
export class ProjectOrmEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'projects_pkey' })
  id!: string;

  @Column({ type: 'varchar', length: 200 })
  slug!: string;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'varchar', length: 500 })
  description!: string;

  @Column({ type: 'text', array: true, default: () => `'{}'` })
  technologies!: string[];

  @Column({
    type: 'enum',
    enum: ProjectStage,
    enumName: 'project_stage',
    nullable: true,
  })
  stage!: ProjectStage | null;

  @Column({ type: 'boolean', default: false })
  featured!: boolean;

  @Column({
    type: 'enum',
    enum: ContentStatus,
    enumName: 'content_status',
    default: ContentStatus.DRAFT,
  })
  status!: ContentStatus;

  @Column({ type: 'jsonb', default: () => `'[]'` })
  links!: ProjectLink[];

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;
}
