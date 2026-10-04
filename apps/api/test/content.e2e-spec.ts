import type { Server } from 'node:http';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ArticleStatus } from '../src/modules/content/domain/article-status.js';
import { ContentStatus } from '../src/modules/content/domain/content-status.js';
import { ProjectStage } from '../src/modules/content/domain/project-stage.js';
import { ArticleOrmEntity } from '../src/modules/content/infrastructure/persistence/article.orm-entity.js';
import { ProjectOrmEntity } from '../src/modules/content/infrastructure/persistence/project.orm-entity.js';
import {
  bodyOf,
  createTestApp,
  resetDatabase,
  type TestApp,
} from './utils/test-app.js';

interface ListBody<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}
interface ArticleBody {
  slug: string;
  title: string;
  excerpt: string | null;
  publishedAt: string | null;
  readingTimeMinutes: number;
  author: { id: string; name: string } | null;
  content?: unknown[];
}
interface ProjectBody {
  slug: string;
  technologies: string[];
  featured: boolean;
}
interface ErrorBody {
  statusCode: number;
  message: string | string[];
}

describe('Content (e2e)', () => {
  let app: TestApp;
  let http: Server;

  beforeAll(async () => {
    app = await createTestApp();
    http = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase(app);
    const dataSource = app.get(DataSource);
    await dataSource.getRepository(ArticleOrmEntity).save([
      article('k3s-homelab', {
        title: 'My k3s Homelab',
        category: 'Kubernetes',
        publishedAt: new Date('2026-09-12T00:00:00Z'),
      }),
      article('nestjs-from-scratch', {
        title: 'NestJS from Scratch',
        category: 'Backend',
        publishedAt: new Date('2026-08-27T00:00:00Z'),
      }),
      article('draft-post', {
        title: 'A Draft about NestJS',
        status: ArticleStatus.DRAFT,
        publishedAt: null,
      }),
      article('old-post', {
        title: 'Unpublished 100% of it',
        status: ArticleStatus.DRAFT,
        publishedAt: null,
      }),
    ]);
    await dataSource.getRepository(ProjectOrmEntity).save([
      project('homelab', {
        technologies: ['k3s', 'Docker'],
        featured: false,
        updatedAt: new Date('2026-09-20T00:00:00Z'),
      }),
      project('mcp-playground', {
        technologies: ['TypeScript', 'NestJS', 'MCP'],
        featured: true,
        updatedAt: new Date('2026-09-02T00:00:00Z'),
      }),
      project('secret-cms', { status: ContentStatus.DRAFT }),
    ]);
  });

  describe('articles', () => {
    it('lists published articles without signing in, newest first, without content', async () => {
      const response = await request(http).get('/articles').expect(200);
      const body = bodyOf<ListBody<ArticleBody>>(response);

      expect(body.data.map((a) => a.slug)).toEqual([
        'k3s-homelab',
        'nestjs-from-scratch',
      ]);
      expect(body.meta).toEqual({
        page: 1,
        pageSize: 10,
        total: 2,
        totalPages: 1,
      });
      expect(body.data[0]).not.toHaveProperty('content');
      expect(body.data[0]).not.toHaveProperty('status');
      expect(body.data[0]).not.toHaveProperty('authorId');
      expect(body.data[0]).toMatchObject({
        excerpt: 'About k3s-homelab.',
        readingTimeMinutes: 1,
        author: null,
      });
    });

    it('searches published articles only, treating wildcards literally', async () => {
      const nest = await request(http)
        .get('/articles?search=nestjs')
        .expect(200);
      expect(
        bodyOf<ListBody<ArticleBody>>(nest).data.map((a) => a.slug),
      ).toEqual(['nestjs-from-scratch']);

      const wildcard = await request(http)
        .get('/articles?search=100%25')
        .expect(200);
      expect(bodyOf<ListBody<ArticleBody>>(wildcard).data).toEqual([]);
    });

    it('filters by category and paginates', async () => {
      const byCategory = await request(http)
        .get('/articles?category=kubernetes')
        .expect(200);
      expect(
        bodyOf<ListBody<ArticleBody>>(byCategory).data.map((a) => a.slug),
      ).toEqual(['k3s-homelab']);

      const page2 = await request(http)
        .get('/articles?page=2&pageSize=1')
        .expect(200);
      const body = bodyOf<ListBody<ArticleBody>>(page2);
      expect(body.data.map((a) => a.slug)).toEqual(['nestjs-from-scratch']);
      expect(body.meta).toMatchObject({ total: 2, totalPages: 2 });
    });

    it('returns a published article with its content', async () => {
      const response = await request(http)
        .get('/articles/k3s-homelab')
        .expect(200);
      expect(bodyOf<{ data: ArticleBody }>(response).data).toMatchObject({
        slug: 'k3s-homelab',
        title: 'My k3s Homelab',
        publishedAt: '2026-09-12T00:00:00.000Z',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'All about k3s-homelab.', styles: {} },
            ],
          },
        ],
      });
    });

    it.each(['draft-post', 'old-post', 'unknown-post'])(
      'answers 404 for %s',
      async (slug) => {
        const response = await request(http)
          .get(`/articles/${slug}`)
          .expect(404);
        expect(bodyOf<ErrorBody>(response).message).toBe('Article not found.');
      },
    );

    it('rejects malformed slugs and unknown query parameters', async () => {
      await request(http).get('/articles/Not_A_Slug').expect(400);
      await request(http).get('/articles?status=DRAFT').expect(400);
      await request(http).get('/articles?pageSize=51').expect(400);
    });
  });

  describe('projects', () => {
    it('lists published projects without signing in, featured first', async () => {
      const response = await request(http).get('/projects').expect(200);
      const body = bodyOf<ListBody<ProjectBody>>(response);
      expect(body.data.map((p) => p.slug)).toEqual([
        'mcp-playground',
        'homelab',
      ]);
      expect(body.meta.total).toBe(2);
      expect(body.data[0]).not.toHaveProperty('status');
    });

    it('filters by technology (case-insensitive), featured and search', async () => {
      const docker = await request(http)
        .get('/projects?technology=docker')
        .expect(200);
      expect(
        bodyOf<ListBody<ProjectBody>>(docker).data.map((p) => p.slug),
      ).toEqual(['homelab']);

      const notFeatured = await request(http)
        .get('/projects?featured=false')
        .expect(200);
      expect(
        bodyOf<ListBody<ProjectBody>>(notFeatured).data.map((p) => p.slug),
      ).toEqual(['homelab']);

      const mcp = await request(http).get('/projects?search=mcp').expect(200);
      expect(
        bodyOf<ListBody<ProjectBody>>(mcp).data.map((p) => p.slug),
      ).toEqual(['mcp-playground']);

      await request(http).get('/projects?featured=yes').expect(400);
    });

    it('returns a published project and hides drafts', async () => {
      const response = await request(http)
        .get('/projects/mcp-playground')
        .expect(200);
      expect(bodyOf<{ data: ProjectBody }>(response).data).toMatchObject({
        slug: 'mcp-playground',
        technologies: ['TypeScript', 'NestJS', 'MCP'],
        featured: true,
      });

      const draft = await request(http).get('/projects/secret-cms').expect(404);
      expect(bodyOf<ErrorBody>(draft).message).toBe('Project not found.');
    });
  });
});

function article(
  slug: string,
  overrides: Partial<ArticleOrmEntity>,
): Partial<ArticleOrmEntity> {
  return {
    slug,
    title: slug,
    excerpt: `About ${slug}.`,
    category: 'Backend',
    status: ArticleStatus.PUBLISHED,
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: `All about ${slug}.`, styles: {} }],
      },
    ],
    publishedAt: new Date('2026-09-01T00:00:00Z'),
    ...overrides,
  };
}

function project(
  slug: string,
  overrides: Partial<ProjectOrmEntity>,
): Partial<ProjectOrmEntity> {
  return {
    slug,
    name: slug,
    description: `About ${slug}.`,
    technologies: ['TypeScript'],
    stage: ProjectStage.ACTIVE,
    featured: false,
    status: ContentStatus.PUBLISHED,
    links: [{ label: 'GitHub' }],
    ...overrides,
  };
}
