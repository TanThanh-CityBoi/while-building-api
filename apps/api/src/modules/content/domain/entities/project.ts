import { ContentStatus } from '../content-status.js';
import type { ProjectStage } from '../project-stage.js';

/** A link that may not exist yet; without `href` it is shown as a placeholder. */
export interface ProjectLink {
  label: string;
  href?: string;
}

export interface ProjectProps {
  id: string;
  /** Unique, URL-safe identifier used by the public site. */
  slug: string;
  name: string;
  description: string;
  technologies: string[];
  stage: ProjectStage | null;
  featured: boolean;
  status: ContentStatus;
  links: ProjectLink[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Something built (or being built). Read-only for now: projects are created
 * and edited outside this API until the CMS gets content management.
 */
export class Project {
  private constructor(private readonly props: ProjectProps) {}

  /** Rehydrates a stored project (no rules re-applied). */
  static restore(props: ProjectProps): Project {
    return new Project({
      ...props,
      technologies: [...props.technologies],
      links: props.links.map((link) => ({ ...link })),
    });
  }

  get id(): string {
    return this.props.id;
  }
  get slug(): string {
    return this.props.slug;
  }
  get name(): string {
    return this.props.name;
  }
  get description(): string {
    return this.props.description;
  }
  get technologies(): readonly string[] {
    return this.props.technologies;
  }
  get stage(): ProjectStage | null {
    return this.props.stage;
  }
  get featured(): boolean {
    return this.props.featured;
  }
  get status(): ContentStatus {
    return this.props.status;
  }
  get links(): readonly ProjectLink[] {
    return this.props.links;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  /** Only published projects are visible to the public. */
  get isPublished(): boolean {
    return this.props.status === ContentStatus.PUBLISHED;
  }
}
