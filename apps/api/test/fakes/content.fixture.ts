import { ContentStatus } from '../../src/modules/content/domain/content-status.js';
import type { ArticleProps } from '../../src/modules/content/domain/entities/article.js';
import type { ProjectProps } from '../../src/modules/content/domain/entities/project.js';
import { ProjectStage } from '../../src/modules/content/domain/project-stage.js';
import { InMemoryArticleRepository } from './in-memory-article.repository.js';
import { InMemoryProjectRepository } from './in-memory-project.repository.js';

export function articleProps(overrides: Partial<ArticleProps>): ArticleProps {
  const slug = overrides.slug ?? 'an-article';
  return {
    id: `a-${slug}`,
    slug,
    title: 'An Article',
    description: 'About something.',
    category: 'Backend',
    status: ContentStatus.PUBLISHED,
    body: '# An Article',
    readingTimeMinutes: 5,
    publishedAt: new Date('2026-09-01T00:00:00Z'),
    createdAt: new Date('2026-08-30T00:00:00Z'),
    updatedAt: new Date('2026-09-01T00:00:00Z'),
    ...overrides,
  };
}

export function projectProps(overrides: Partial<ProjectProps>): ProjectProps {
  const slug = overrides.slug ?? 'a-project';
  return {
    id: `p-${slug}`,
    slug,
    name: 'A Project',
    description: 'Something built.',
    technologies: ['TypeScript'],
    stage: ProjectStage.ACTIVE,
    featured: false,
    status: ContentStatus.PUBLISHED,
    links: [{ label: 'GitHub' }],
    createdAt: new Date('2026-08-01T00:00:00Z'),
    updatedAt: new Date('2026-09-01T00:00:00Z'),
    ...overrides,
  };
}

/** Published, draft and archived articles and projects. */
export function contentFixture() {
  const articles = new InMemoryArticleRepository();
  articles.add(
    articleProps({
      slug: 'nestjs-from-scratch',
      title: 'NestJS from Scratch',
      category: 'Backend',
      publishedAt: new Date('2026-08-27T00:00:00Z'),
    }),
  );
  articles.add(
    articleProps({
      slug: 'k3s-homelab',
      title: 'My k3s Homelab',
      category: 'Kubernetes',
      publishedAt: new Date('2026-09-12T00:00:00Z'),
    }),
  );
  articles.add(
    articleProps({
      slug: 'draft-post',
      title: 'A Draft about NestJS',
      status: ContentStatus.DRAFT,
      publishedAt: null,
    }),
  );
  articles.add(
    articleProps({
      slug: 'old-post',
      title: 'An Archived Post',
      status: ContentStatus.ARCHIVED,
    }),
  );

  const projects = new InMemoryProjectRepository();
  projects.add(
    projectProps({
      slug: 'homelab',
      name: 'Homelab',
      technologies: ['k3s', 'Docker'],
      featured: false,
      updatedAt: new Date('2026-09-20T00:00:00Z'),
    }),
  );
  projects.add(
    projectProps({
      slug: 'mcp-playground',
      name: 'MCP Playground',
      technologies: ['TypeScript', 'NestJS', 'MCP'],
      featured: true,
      updatedAt: new Date('2026-09-02T00:00:00Z'),
    }),
  );
  projects.add(
    projectProps({
      slug: 'secret-cms',
      name: 'Secret CMS',
      status: ContentStatus.DRAFT,
    }),
  );
  return { articles, projects };
}
