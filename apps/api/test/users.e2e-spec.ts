import type { Server } from 'node:http';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { UserOrmEntity } from '../src/modules/users/infrastructure/persistence/user.orm-entity.js';
import {
  bodyOf,
  createTestApp,
  createUser,
  DEFAULT_PASSWORD,
  expectNoSecrets,
  resetDatabase,
  Role,
  signIn,
  UserStatus,
  type Session,
  type TestApp,
} from './utils/test-app.js';

interface UserBody {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}
interface ListBody {
  data: UserBody[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}
interface ErrorBody {
  statusCode: number;
  message: string | string[];
}

const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

describe('Users (e2e)', () => {
  let app: TestApp;
  let http: Server;
  let root: UserOrmEntity;
  let admin: UserOrmEntity;
  let editor: UserOrmEntity;
  let author: UserOrmEntity;
  let asAdmin: Session;

  beforeAll(async () => {
    app = await createTestApp();
    http = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase(app);
    root = await createUser(app, {
      email: 'root@example.test',
      name: 'Root',
      role: Role.ROOT,
    });
    admin = await createUser(app, {
      email: 'admin@example.test',
      name: 'Ada Admin',
      role: Role.ADMIN,
    });
    editor = await createUser(app, {
      email: 'editor@example.test',
      name: 'Eddie Editor',
      role: Role.EDITOR,
    });
    author = await createUser(app, {
      email: 'author@example.test',
      name: 'Grace Author',
      role: Role.AUTHOR,
    });
    asAdmin = await signIn(app, admin.email);
  });

  const api = (session?: Session) => ({
    get: (url: string) => withAuth(request(http).get(url), session),
    post: (url: string) => withAuth(request(http).post(url), session),
    patch: (url: string) => withAuth(request(http).patch(url), session),
    delete: (url: string) => withAuth(request(http).delete(url), session),
  });
  const withAuth = (test: request.Test, session?: Session) =>
    session ? test.set('Authorization', session.bearer) : test;

  const rootStillIntact = async () => {
    const [row] = await app
      .get(DataSource)
      .query<Array<{ role: string; status: string }>>(
        'SELECT role, status FROM users WHERE id = $1',
        [root.id],
      );
    expect(row).toEqual({ role: 'ROOT', status: 'ACTIVE' });
  };

  describe('authorization', () => {
    it('requires authentication on every endpoint', async () => {
      await api().get('/users').expect(401);
      await api().get(`/users/${editor.id}`).expect(401);
      await api().post('/users').send({}).expect(401);
      await api().patch(`/users/${editor.id}`).send({ name: 'x' }).expect(401);
      await api()
        .patch(`/users/${editor.id}/status`)
        .send({ status: 'DISABLED' })
        .expect(401);
      await api().delete(`/users/${editor.id}`).expect(401);
    });

    it.each([
      ['EDITOR', 'editor@example.test'],
      ['AUTHOR', 'author@example.test'],
    ])('returns 403 to an %s (no user permissions)', async (_role, email) => {
      const session = await signIn(app, email);
      const forbidden = await api(session).get('/users').expect(403);
      expect(bodyOf<ErrorBody>(forbidden).message).toBe(
        'You do not have permission to perform this action.',
      );
      await api(session).get(`/users/${admin.id}`).expect(403);
      await api(session)
        .post('/users')
        .send({
          email: 'x@example.test',
          name: 'X',
          password: DEFAULT_PASSWORD,
          role: 'AUTHOR',
        })
        .expect(403);
      await api(session)
        .patch(`/users/${admin.id}`)
        .send({ name: 'x' })
        .expect(403);
      await api(session)
        .patch(`/users/${admin.id}/status`)
        .send({ status: 'DISABLED' })
        .expect(403);
      await api(session).delete(`/users/${admin.id}`).expect(403);
    });

    it('allows users with the right permission', async () => {
      await api(asAdmin).get('/users').expect(200);
      await api(await signIn(app, root.email))
        .get('/users')
        .expect(200);
    });
  });

  describe('GET /users', () => {
    it('lists users without ROOT, newest first, in the paginated envelope', async () => {
      const response = await api(asAdmin).get('/users').expect(200);
      const body = bodyOf<ListBody>(response);

      expect(body.data.map((u) => u.email)).toEqual([
        'author@example.test',
        'editor@example.test',
        'admin@example.test',
      ]);
      expect(body.meta).toEqual({
        page: 1,
        pageSize: 20,
        total: 3,
        totalPages: 1,
      });
      expect(Object.keys(body.data[0]).sort()).toEqual(
        [
          'createdAt',
          'email',
          'id',
          'lastLoginAt',
          'name',
          'role',
          'status',
          'updatedAt',
        ].sort(),
      );
      expectNoSecrets(response);
    });

    it('paginates', async () => {
      const response = await api(asAdmin)
        .get('/users?page=2&pageSize=2')
        .expect(200);
      const body = bodyOf<ListBody>(response);
      expect(body.data.map((u) => u.email)).toEqual(['admin@example.test']);
      expect(body.meta).toEqual({
        page: 2,
        pageSize: 2,
        total: 3,
        totalPages: 2,
      });
    });

    it('searches name and email case-insensitively, and filters by role and status', async () => {
      const byName = bodyOf<ListBody>(
        await api(asAdmin).get('/users?search=GRACE').expect(200),
      );
      expect(byName.data.map((u) => u.email)).toEqual(['author@example.test']);

      const byEmail = bodyOf<ListBody>(
        await api(asAdmin).get('/users?search=editor@').expect(200),
      );
      expect(byEmail.data.map((u) => u.name)).toEqual(['Eddie Editor']);

      // ROOT never matches, even when searched for directly.
      const rootSearch = bodyOf<ListBody>(
        await api(asAdmin).get('/users?search=root').expect(200),
      );
      expect(rootSearch.meta.total).toBe(0);

      // LIKE wildcards are matched literally.
      const wildcard = bodyOf<ListBody>(
        await api(asAdmin).get('/users?search=%25').expect(200),
      );
      expect(wildcard.meta.total).toBe(0);

      const byRole = bodyOf<ListBody>(
        await api(asAdmin).get('/users?role=EDITOR').expect(200),
      );
      expect(byRole.data.map((u) => u.role)).toEqual(['EDITOR']);

      await createUser(app, {
        email: 'gone@example.test',
        role: Role.AUTHOR,
        status: UserStatus.DISABLED,
      });
      const byStatus = bodyOf<ListBody>(
        await api(asAdmin).get('/users?status=DISABLED').expect(200),
      );
      expect(byStatus.data.map((u) => u.email)).toEqual(['gone@example.test']);
    });

    it('validates query parameters', async () => {
      await api(asAdmin).get('/users?pageSize=500').expect(400);
      await api(asAdmin).get('/users?page=0').expect(400);
      await api(asAdmin).get('/users?role=ROOT').expect(400);
      await api(asAdmin).get('/users?unknown=1').expect(400);
    });
  });

  describe('GET /users/:id', () => {
    it('returns a user', async () => {
      const response = await api(asAdmin)
        .get(`/users/${editor.id}`)
        .expect(200);
      expect(bodyOf<{ data: UserBody }>(response).data).toMatchObject({
        id: editor.id,
        email: 'editor@example.test',
        role: 'EDITOR',
        status: 'ACTIVE',
      });
      expectNoSecrets(response);
    });

    it('does not reveal ROOT (same 404 as an unknown user)', async () => {
      const rootResponse = await api(asAdmin)
        .get(`/users/${root.id}`)
        .expect(404);
      const unknownResponse = await api(asAdmin)
        .get(`/users/${UNKNOWN_ID}`)
        .expect(404);
      expect(rootResponse.body).toEqual(unknownResponse.body);
    });

    it('rejects malformed ids', async () => {
      await api(asAdmin).get('/users/not-a-uuid').expect(400);
    });
  });

  describe('POST /users', () => {
    const newUser = {
      email: '  New.Author@Example.TEST ',
      name: '  Nia Author ',
      password: 'a-strong-password',
      role: 'AUTHOR',
    };

    it('creates an active user with a normalized email, who can then sign in', async () => {
      const response = await api(asAdmin)
        .post('/users')
        .send(newUser)
        .expect(201);
      const { data } = bodyOf<{ data: UserBody }>(response);

      expect(data).toMatchObject({
        email: 'new.author@example.test',
        name: 'Nia Author',
        role: 'AUTHOR',
        status: 'ACTIVE',
        lastLoginAt: null,
      });
      expectNoSecrets(response, 'a-strong-password');

      await request(http)
        .post('/auth/login')
        .send({
          email: 'new.author@example.test',
          password: 'a-strong-password',
        })
        .expect(200);
    });

    it('stores an Argon2id hash, never the password', async () => {
      await api(asAdmin).post('/users').send(newUser).expect(201);
      const [row] = await app
        .get(DataSource)
        .query<Array<{ password_hash: string }>>(
          `SELECT password_hash FROM users WHERE email = 'new.author@example.test'`,
        );
      expect(row.password_hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
      expect(row.password_hash).not.toContain('a-strong-password');
    });

    it('rejects a duplicate email (case-insensitive) with 409', async () => {
      const response = await api(asAdmin)
        .post('/users')
        .send({ ...newUser, email: 'EDITOR@example.test' })
        .expect(409);
      expect(bodyOf<ErrorBody>(response).message).toBe(
        'A user with this email already exists.',
      );
    });

    it('never creates ROOT and rejects invalid roles', async () => {
      const rootAttempt = await api(asAdmin)
        .post('/users')
        .send({ ...newUser, role: 'ROOT' })
        .expect(400);
      expect(bodyOf<ErrorBody>(rootAttempt).message).toEqual([
        'role must be one of: ADMIN, EDITOR, AUTHOR',
      ]);
      await api(asAdmin)
        .post('/users')
        .send({ ...newUser, role: 'SUPERUSER' })
        .expect(400);

      const [{ count }] = await app
        .get(DataSource)
        .query<Array<{ count: string }>>(
          `SELECT count(*) FROM users WHERE role = 'ROOT'`,
        );
      expect(count).toBe('1');
    });

    it('validates the payload and rejects unknown fields', async () => {
      await api(asAdmin)
        .post('/users')
        .send({ ...newUser, email: 'nope' })
        .expect(400);
      await api(asAdmin)
        .post('/users')
        .send({ ...newUser, password: 'short' })
        .expect(400);
      await api(asAdmin)
        .post('/users')
        .send({ ...newUser, name: '   ' })
        .expect(400);
      await api(asAdmin)
        .post('/users')
        .send({ ...newUser, status: 'DISABLED' })
        .expect(400);
      await api(asAdmin)
        .post('/users')
        .send({ ...newUser, passwordHash: 'x' })
        .expect(400);
    });
  });

  describe('PATCH /users/:id', () => {
    it('updates name and role', async () => {
      const response = await api(asAdmin)
        .patch(`/users/${author.id}`)
        .send({ name: 'Grace Editor', role: 'EDITOR' })
        .expect(200);
      expect(bodyOf<{ data: UserBody }>(response).data).toMatchObject({
        name: 'Grace Editor',
        role: 'EDITOR',
      });
    });

    it('never promotes to ROOT and never touches ROOT', async () => {
      await api(asAdmin)
        .patch(`/users/${author.id}`)
        .send({ role: 'ROOT' })
        .expect(400);
      await api(asAdmin)
        .patch(`/users/${root.id}`)
        .send({ name: 'Hacked' })
        .expect(404);
      await api(asAdmin)
        .patch(`/users/${root.id}`)
        .send({ role: 'AUTHOR' })
        .expect(404);
      await rootStillIntact();
    });

    it('rejects an email that belongs to someone else', async () => {
      await api(asAdmin)
        .patch(`/users/${author.id}`)
        .send({ email: 'editor@example.test' })
        .expect(409);
    });

    it("doesn't let an admin change their own role", async () => {
      const response = await api(asAdmin)
        .patch(`/users/${admin.id}`)
        .send({ role: 'AUTHOR' })
        .expect(403);
      expect(bodyOf<ErrorBody>(response).message).toBe(
        "You can't change your own role.",
      );
    });

    it('resets a password: the new one works, the old one and old sessions do not', async () => {
      const authorSession = await signIn(app, author.email);

      const response = await api(asAdmin)
        .patch(`/users/${author.id}`)
        .send({ password: 'brand-new-password' })
        .expect(200);
      expectNoSecrets(response, 'brand-new-password');

      await request(http)
        .get('/auth/me')
        .set('Authorization', authorSession.bearer)
        .expect(401);
      await request(http)
        .post('/auth/refresh')
        .set('Cookie', authorSession.cookie)
        .expect(401);
      await request(http)
        .post('/auth/login')
        .send({ email: author.email, password: DEFAULT_PASSWORD })
        .expect(401);
      await request(http)
        .post('/auth/login')
        .send({ email: author.email, password: 'brand-new-password' })
        .expect(200);
    });
  });

  describe('PATCH /users/:id/status', () => {
    it('disables a user: no sign-in, and existing sessions stop working', async () => {
      const editorSession = await signIn(app, editor.email);

      const response = await api(asAdmin)
        .patch(`/users/${editor.id}/status`)
        .send({ status: 'DISABLED' })
        .expect(200);
      expect(bodyOf<{ data: UserBody }>(response).data.status).toBe('DISABLED');

      await request(http)
        .get('/auth/me')
        .set('Authorization', editorSession.bearer)
        .expect(401);
      await request(http)
        .post('/auth/refresh')
        .set('Cookie', editorSession.cookie)
        .expect(401);
      await request(http)
        .post('/auth/login')
        .send({ email: editor.email, password: DEFAULT_PASSWORD })
        .expect(403);

      // Re-enabling restores access.
      await api(asAdmin)
        .patch(`/users/${editor.id}/status`)
        .send({ status: 'ACTIVE' })
        .expect(200);
      await request(http)
        .post('/auth/login')
        .send({ email: editor.email, password: DEFAULT_PASSWORD })
        .expect(200);
    });

    it('re-enabling does not bring old sessions back', async () => {
      const editorSession = await signIn(app, editor.email);
      await api(asAdmin)
        .patch(`/users/${editor.id}/status`)
        .send({ status: 'DISABLED' })
        .expect(200);
      await api(asAdmin)
        .patch(`/users/${editor.id}/status`)
        .send({ status: 'ACTIVE' })
        .expect(200);

      await request(http)
        .get('/auth/me')
        .set('Authorization', editorSession.bearer)
        .expect(401);
      await request(http)
        .post('/auth/refresh')
        .set('Cookie', editorSession.cookie)
        .expect(401);
    });

    it('cannot disable ROOT or yourself, and validates the status', async () => {
      await api(asAdmin)
        .patch(`/users/${root.id}/status`)
        .send({ status: 'DISABLED' })
        .expect(404);
      await rootStillIntact();

      const self = await api(asAdmin)
        .patch(`/users/${admin.id}/status`)
        .send({ status: 'DISABLED' })
        .expect(403);
      expect(bodyOf<ErrorBody>(self).message).toBe(
        "You can't change your own status.",
      );

      await api(asAdmin)
        .patch(`/users/${editor.id}/status`)
        .send({ status: 'BANNED' })
        .expect(400);
      await api(asAdmin)
        .patch(`/users/${editor.id}/status`)
        .send({})
        .expect(400);
    });
  });

  describe('DELETE /users/:id', () => {
    it('deletes a user and ends their sessions', async () => {
      const authorSession = await signIn(app, author.email);

      await api(asAdmin).delete(`/users/${author.id}`).expect(204);
      await api(asAdmin).get(`/users/${author.id}`).expect(404);
      await request(http)
        .get('/auth/me')
        .set('Authorization', authorSession.bearer)
        .expect(401);
      await request(http)
        .post('/auth/refresh')
        .set('Cookie', authorSession.cookie)
        .expect(401);
    });

    it('cannot delete ROOT or yourself', async () => {
      await api(asAdmin).delete(`/users/${root.id}`).expect(404);
      await rootStillIntact();

      const self = await api(asAdmin).delete(`/users/${admin.id}`).expect(403);
      expect(bodyOf<ErrorBody>(self).message).toBe(
        "You can't delete your own account.",
      );
    });

    it('returns 404 for unknown users', async () => {
      await api(asAdmin).delete(`/users/${UNKNOWN_ID}`).expect(404);
    });
  });

  describe('as ROOT', () => {
    it('ROOT can manage users but still cannot see or change itself here', async () => {
      const asRoot = await signIn(app, root.email);
      const list = bodyOf<ListBody>(
        await api(asRoot).get('/users').expect(200),
      );
      expect(list.data.map((u) => u.role)).not.toContain('ROOT');
      await api(asRoot)
        .patch(`/users/${root.id}/status`)
        .send({ status: 'DISABLED' })
        .expect(404);
      await api(asRoot).delete(`/users/${root.id}`).expect(404);
      await rootStillIntact();
    });
  });
});
