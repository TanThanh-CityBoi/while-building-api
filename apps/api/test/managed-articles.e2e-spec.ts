import type { Server } from 'node:http';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { UserOrmEntity } from '../src/modules/users/infrastructure/persistence/user.orm-entity.js';
import {
  bodyOf,
  createTestApp,
  createUser,
  resetDatabase,
  Role,
  signIn,
  type Session,
  type TestApp,
} from './utils/test-app.js';

interface ArticleBody {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  category: string | null;
  coverImage: string | null;
  status: 'DRAFT' | 'PUBLISHED';
  author: { id: string; name: string } | null;
  publishedAt: string | null;
  readingTimeMinutes: number;
  content?: unknown[];
  createdAt: string;
  updatedAt: string;
}
interface ListBody {
  data: ArticleBody[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}
interface ErrorBody {
  statusCode: number;
  message: string | string[];
}

const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';
const paragraph = (text: string) => ({
  type: 'paragraph',
  content: [{ type: 'text', text, styles: {} }],
});

describe('Article management (e2e)', () => {
  let app: TestApp;
  let http: Server;
  let admin: UserOrmEntity;
  let asAdmin: Session;
  let asEditor: Session;
  let asAuthor: Session;

  beforeAll(async () => {
    app = await createTestApp();
    http = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase(app);
    admin = await createUser(app, {
      email: 'admin@example.test',
      name: 'Ada Admin',
      role: Role.ADMIN,
    });
    const editor = await createUser(app, {
      email: 'editor@example.test',
      name: 'Eddie Editor',
      role: Role.EDITOR,
    });
    const author = await createUser(app, {
      email: 'author@example.test',
      name: 'Grace Author',
      role: Role.AUTHOR,
    });
    asAdmin = await signIn(app, admin.email);
    asEditor = await signIn(app, editor.email);
    asAuthor = await signIn(app, author.email);
  });

  const api = (session?: Session) => ({
    get: (url: string) => withAuth(request(http).get(url), session),
    post: (url: string) => withAuth(request(http).post(url), session),
    patch: (url: string) => withAuth(request(http).patch(url), session),
    delete: (url: string) => withAuth(request(http).delete(url), session),
  });
  const withAuth = (test: request.Test, session?: Session) =>
    session ? test.set('Authorization', session.bearer) : test;

  const create = async (session: Session, body: object) =>
    bodyOf<{ data: ArticleBody }>(
      await api(session).post('/content/articles').send(body).expect(201),
    ).data;

  describe('authorization', () => {
    it('requires authentication on every endpoint', async () => {
      await api().get('/content/articles').expect(401);
      await api().get(`/content/articles/${UNKNOWN_ID}`).expect(401);
      await api().post('/content/articles').send({ title: 'x' }).expect(401);
      await api()
        .patch(`/content/articles/${UNKNOWN_ID}`)
        .send({ title: 'x' })
        .expect(401);
      await api().post(`/content/articles/${UNKNOWN_ID}/publish`).expect(401);
      await api().post(`/content/articles/${UNKNOWN_ID}/unpublish`).expect(401);
      await api().delete(`/content/articles/${UNKNOWN_ID}`).expect(401);
    });

    it('lets authors write but not publish or delete', async () => {
      const article = await create(asAuthor, {
        title: 'Grace writes',
        content: [paragraph('Hello.')],
      });
      expect(article.author).toMatchObject({ name: 'Grace Author' });

      await api(asAuthor)
        .patch(`/content/articles/${article.id}`)
        .send({ excerpt: 'Short.' })
        .expect(200);
      const publish = await api(asAuthor)
        .post(`/content/articles/${article.id}/publish`)
        .expect(403);
      expect(bodyOf<ErrorBody>(publish).message).toBe(
        'You do not have permission to perform this action.',
      );
      await api(asAuthor).delete(`/content/articles/${article.id}`).expect(403);
    });

    it('lets editors publish but not delete', async () => {
      const article = await create(asEditor, {
        title: 'Eddie writes',
        content: [paragraph('Hello.')],
      });
      await api(asEditor)
        .post(`/content/articles/${article.id}/publish`)
        .expect(200);
      await api(asEditor).delete(`/content/articles/${article.id}`).expect(403);
    });
  });

  describe('writing', () => {
    it('creates a draft with a derived slug, then reads it back', async () => {
      const created = await create(asAdmin, {
        title: 'Chạy PostgreSQL trên Homelab',
        excerpt: 'What I learned.',
        category: 'DevOps',
        coverImage: 'https://images.example.test/pg.png',
        content: [paragraph('A database in my living room.')],
      });

      expect(created).toMatchObject({
        slug: 'chay-postgresql-tren-homelab',
        status: 'DRAFT',
        publishedAt: null,
        readingTimeMinutes: 1,
        author: { id: admin.id, name: 'Ada Admin' },
      });

      const read = await api(asAdmin)
        .get(`/content/articles/${created.id}`)
        .expect(200);
      expect(bodyOf<{ data: ArticleBody }>(read).data.content).toEqual([
        paragraph('A database in my living room.'),
      ]);
    });

    it('updates fields without changing the slug, and clears optional ones', async () => {
      const article = await create(asAdmin, {
        title: 'First Title',
        category: 'Backend',
      });
      const response = await api(asAdmin)
        .patch(`/content/articles/${article.id}`)
        .send({ title: 'Second Title', category: null, excerpt: '' })
        .expect(200);
      expect(bodyOf<{ data: ArticleBody }>(response).data).toMatchObject({
        title: 'Second Title',
        slug: 'first-title',
        category: null,
        excerpt: null,
      });
    });

    it('enforces unique slugs on create and update', async () => {
      await create(asAdmin, { title: 'Taken' });
      const other = await create(asAdmin, { title: 'Other' });

      const onCreate = await api(asAdmin)
        .post('/content/articles')
        .send({ title: 'Taken' })
        .expect(409);
      expect(bodyOf<ErrorBody>(onCreate).message).toBe(
        'An article with this slug already exists.',
      );
      await api(asAdmin)
        .patch(`/content/articles/${other.id}`)
        .send({ slug: 'taken' })
        .expect(409);
    });

    it('validates input', async () => {
      const cases: object[] = [
        {},
        { title: '' },
        { title: 'x'.repeat(201) },
        { title: 'T', slug: 'Not A Slug' },
        { title: 'T', content: 'just text' },
        { title: 'T', content: [{ content: [] }] },
        { title: 'T', coverImage: 'javascript:alert(1)' },
        { title: 'T', status: 'PUBLISHED' },
        { title: '!!!' },
      ];
      for (const body of cases) {
        await api(asAdmin).post('/content/articles').send(body).expect(400);
      }
      await api(asAdmin).get('/content/articles/not-a-uuid').expect(400);
      await api(asAdmin).get('/content/articles?status=ARCHIVED').expect(400);
    });

    it('accepts long articles beyond the default body size', async () => {
      const longText = 'word '.repeat(60_000);
      const article = await create(asAdmin, {
        title: 'A Long Read',
        content: [paragraph(longText)],
      });
      expect(article.readingTimeMinutes).toBe(300);
    });

    it('answers 404 for unknown articles', async () => {
      await api(asAdmin).get(`/content/articles/${UNKNOWN_ID}`).expect(404);
      await api(asAdmin)
        .patch(`/content/articles/${UNKNOWN_ID}`)
        .send({ title: 'x' })
        .expect(404);
      await api(asAdmin).delete(`/content/articles/${UNKNOWN_ID}`).expect(404);
    });
  });

  describe('publishing', () => {
    it('publishes, shows the article publicly, then unpublishes it', async () => {
      const article = await create(asAdmin, {
        title: 'Going Live',
        excerpt: 'Soon public.',
        content: [paragraph('Live text.')],
      });
      await request(http).get('/articles/going-live').expect(404);

      const published = await api(asAdmin)
        .post(`/content/articles/${article.id}/publish`)
        .expect(200);
      expect(bodyOf<{ data: ArticleBody }>(published).data).toMatchObject({
        status: 'PUBLISHED',
        publishedAt: expect.any(String) as string,
      });

      const publicRead = await request(http)
        .get('/articles/going-live')
        .expect(200);
      expect(bodyOf<{ data: ArticleBody }>(publicRead).data).toMatchObject({
        title: 'Going Live',
        author: { id: admin.id, name: 'Ada Admin' },
        content: [paragraph('Live text.')],
      });
      expect(bodyOf<{ data: object }>(publicRead).data).not.toHaveProperty(
        'status',
      );

      await api(asAdmin)
        .post(`/content/articles/${article.id}/publish`)
        .expect(409);
      const unpublished = await api(asAdmin)
        .post(`/content/articles/${article.id}/unpublish`)
        .expect(200);
      expect(bodyOf<{ data: ArticleBody }>(unpublished).data).toMatchObject({
        status: 'DRAFT',
        publishedAt: null,
      });
      await request(http).get('/articles/going-live').expect(404);
      await api(asAdmin)
        .post(`/content/articles/${article.id}/unpublish`)
        .expect(409);
    });

    it('refuses to publish an empty article or empty a published one', async () => {
      const empty = await create(asAdmin, { title: 'Nothing Yet' });
      const refused = await api(asAdmin)
        .post(`/content/articles/${empty.id}/publish`)
        .expect(400);
      expect(bodyOf<ErrorBody>(refused).message).toBe(
        'A published article needs a title, a slug and some content.',
      );

      const live = await create(asAdmin, {
        title: 'Live',
        content: [paragraph('Text.')],
      });
      await api(asAdmin)
        .post(`/content/articles/${live.id}/publish`)
        .expect(200);
      await api(asAdmin)
        .patch(`/content/articles/${live.id}`)
        .send({ content: [] })
        .expect(400);
    });
  });

  describe('listing and deleting', () => {
    it('lists every status, filters, searches and paginates', async () => {
      const first = await create(asAdmin, {
        title: 'Alpha Notes',
        content: [paragraph('A.')],
      });
      await create(asAdmin, { title: 'Beta Draft' });
      await api(asAdmin)
        .post(`/content/articles/${first.id}/publish`)
        .expect(200);

      const all = bodyOf<ListBody>(
        await api(asAdmin).get('/content/articles').expect(200),
      );
      expect(all.data.map((a) => a.title)).toEqual([
        'Alpha Notes',
        'Beta Draft',
      ]);
      expect(all.meta).toEqual({
        page: 1,
        pageSize: 20,
        total: 2,
        totalPages: 1,
      });
      expect(all.data[0]).not.toHaveProperty('content');

      const drafts = bodyOf<ListBody>(
        await api(asAdmin).get('/content/articles?status=DRAFT').expect(200),
      );
      expect(drafts.data.map((a) => a.title)).toEqual(['Beta Draft']);

      const search = bodyOf<ListBody>(
        await api(asAdmin).get('/content/articles?search=alpha').expect(200),
      );
      expect(search.data.map((a) => a.title)).toEqual(['Alpha Notes']);

      const byTitle = bodyOf<ListBody>(
        await api(asAdmin)
          .get('/content/articles?sort=title&order=desc&pageSize=1&page=2')
          .expect(200),
      );
      expect(byTitle.data.map((a) => a.title)).toEqual(['Alpha Notes']);
    });

    it('deletes an article, published or not', async () => {
      const article = await create(asAdmin, {
        title: 'Short Lived',
        content: [paragraph('Bye.')],
      });
      await api(asAdmin)
        .post(`/content/articles/${article.id}/publish`)
        .expect(200);
      await api(asAdmin).delete(`/content/articles/${article.id}`).expect(204);
      await api(asAdmin).get(`/content/articles/${article.id}`).expect(404);
      await request(http).get('/articles/short-lived').expect(404);
    });

    it('keeps articles when their author is deleted', async () => {
      const writer = await createUser(app, {
        email: 'temp@example.test',
        name: 'Temp Writer',
        role: Role.AUTHOR,
      });
      const article = await create(await signIn(app, writer.email), {
        title: 'Orphaned',
      });
      await api(asAdmin).delete(`/users/${writer.id}`).expect(204);

      const read = await api(asAdmin)
        .get(`/content/articles/${article.id}`)
        .expect(200);
      expect(bodyOf<{ data: ArticleBody }>(read).data.author).toBeNull();
    });
  });
});
