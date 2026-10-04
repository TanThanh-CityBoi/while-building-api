import { ArticleStatus } from '../../src/modules/content/domain/article-status.js';
import { ContentStatus } from '../../src/modules/content/domain/content-status.js';
import type { ArticleProps } from '../../src/modules/content/domain/entities/article.js';
import {
  ArticleContent,
  type ContentBlock,
} from '../../src/modules/content/domain/value-objects/article-content.js';
import { ArticleSlug } from '../../src/modules/content/domain/value-objects/article-slug.js';
import { FakeAuthorDirectory } from './fake-author-directory.js';
import type { ProjectProps } from '../../src/modules/content/domain/entities/project.js';
import { ProjectStage } from '../../src/modules/content/domain/project-stage.js';
import { InMemoryArticleRepository } from './in-memory-article.repository.js';
import { InMemoryProjectRepository } from './in-memory-project.repository.js';

export const AUTHOR = { id: 'user-ada', name: 'Ada Lovelace' };

/** A paragraph block with the given text. */
export function paragraph(text: string): ContentBlock {
  return {
    type: 'paragraph',
    content: [{ type: 'text', text, styles: {} }],
  };
}

export function articleProps(
  overrides: Partial<Omit<ArticleProps, 'slug'>> & { slug?: string } = {},
): ArticleProps {
  const slug = overrides.slug ?? 'an-article';
  return {
    id: `a-${slug}`,
    title: 'An Article',
    excerpt: 'About something.',
    content: ArticleContent.create([paragraph('Something worth reading.')]),
    coverImage: null,
    category: 'Backend',
    status: ArticleStatus.PUBLISHED,
    authorId: AUTHOR.id,
    publishedAt: new Date('2026-09-01T00:00:00Z'),
    createdAt: new Date('2026-08-30T00:00:00Z'),
    updatedAt: new Date('2026-09-01T00:00:00Z'),
    ...overrides,
    slug: ArticleSlug.create(slug),
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

/** Published and draft articles and projects, and their author. */
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
      status: ArticleStatus.DRAFT,
      publishedAt: null,
    }),
  );
  articles.add(
    articleProps({
      slug: 'old-post',
      title: 'An Unpublished Post',
      status: ArticleStatus.DRAFT,
      publishedAt: null,
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
  const authors = new FakeAuthorDirectory([AUTHOR]);
  return { articles, projects, authors };
}
