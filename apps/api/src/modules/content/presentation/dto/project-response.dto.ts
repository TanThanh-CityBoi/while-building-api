import { PaginationMetaDto } from '../../../../shared/http/pagination-meta.dto.js';
import { ProjectStage } from '../../domain/project-stage.js';

export class ProjectLinkDto {
  label!: string;
  /** Absent while the link doesn't exist yet. */
  href?: string;
}

/** A published project. */
export class ProjectDto {
  id!: string;
  slug!: string;
  name!: string;
  description!: string;
  technologies!: string[];
  stage!: ProjectStage | null;
  featured!: boolean;
  links!: ProjectLinkDto[];
  createdAt!: Date;
  updatedAt!: Date;
}

export class ProjectResponseDto {
  data!: ProjectDto;
}

export class ProjectListResponseDto {
  data!: ProjectDto[];
  meta!: PaginationMetaDto;
}
