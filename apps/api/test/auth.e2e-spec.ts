import type { Server } from 'node:http';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ALL_PERMISSIONS } from '../src/modules/auth/domain/authorization/role-permissions.js';
import type { UserOrmEntity } from '../src/modules/users/infrastructure/persistence/user.orm-entity.js';
import { TEST_ENV } from './setup/test-env.js';
import {
  bodyOf,
  createTestApp,
  createUser,
  DEFAULT_PASSWORD,
  expectNoSecrets,
  refreshCookie,
  refreshTokenFrom,
  resetDatabase,
  Role,
  setRefreshCookie,
  signIn,
  UserStatus,
  type TestApp,
} from './utils/test-app.js';

interface LoginBody {
  accessToken: string;
  expiresIn: number;
  user: Record<string, unknown>;
}
interface TokenBody {
  accessToken: string;
  expiresIn: number;
}
interface ErrorBody {
  statusCode: number;
  message: string | string[];
}

describe('Auth (e2e)', () => {
  let app: TestApp;
  let http: Server;
  let admin: UserOrmEntity;

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
  });

  const sessionRow = (id: string) =>
    app
      .get(DataSource)
      .query<Array<{ revoked_at: Date | null }>>(
        'SELECT revoked_at FROM auth_sessions WHERE id = $1',
        [id],
      );

  describe('POST /auth/login', () => {
    it('returns an access token and the safe user, and sets the refresh cookie', async () => {
      const response = await request(http)
        .post('/auth/login')
        .send({ email: 'admin@example.test', password: DEFAULT_PASSWORD })
        .expect(200);

      const body = bodyOf<LoginBody>(response);
      expect(typeof body.accessToken).toBe('string');
      expect(body.expiresIn).toBe(900);
      expect(body.user).toEqual({
        id: admin.id,
        email: 'admin@example.test',
        name: 'Ada Admin',
        role: 'ADMIN',
        permissions: [...ALL_PERMISSIONS],
      });

      const cookie = setRefreshCookie(response) ?? '';
      expect(cookie).toMatch(/^wb_refresh=[^;]+;/);
      expect(cookie).toContain('Path=/auth');
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Lax');
      expect(cookie).toContain('Max-Age=604800');

      // Neither the password, its hash nor the refresh token appear in the body.
      expectNoSecrets(response, refreshTokenFrom(response) ?? 'missing-token');

      const [{ last_login_at }] = await app
        .get(DataSource)
        .query<Array<{ last_login_at: Date | null }>>(
          'SELECT last_login_at FROM users WHERE id = $1',
          [admin.id],
        );
      expect(last_login_at).toBeInstanceOf(Date);
    });

    it('normalizes the email before looking it up', async () => {
      await request(http)
        .post('/auth/login')
        .send({ email: '  ADMIN@Example.TEST ', password: DEFAULT_PASSWORD })
        .expect(200);
    });

    it('gives the same 401 for a wrong password and an unknown email', async () => {
      const wrongPassword = await request(http)
        .post('/auth/login')
        .send({ email: 'admin@example.test', password: 'not-the-password' })
        .expect(401);
      const unknownEmail = await request(http)
        .post('/auth/login')
        .send({ email: 'nobody@example.test', password: DEFAULT_PASSWORD })
        .expect(401);

      expect(bodyOf<ErrorBody>(wrongPassword).message).toBe(
        'Invalid email or password.',
      );
      expect(bodyOf<ErrorBody>(unknownEmail)).toEqual(
        bodyOf<ErrorBody>(wrongPassword),
      );
      expect(setRefreshCookie(wrongPassword)).toBeUndefined();
    });

    it('validates the payload', async () => {
      const response = await request(http)
        .post('/auth/login')
        .send({ email: 'not-an-email', password: '', role: 'ROOT' })
        .expect(400);

      expect(bodyOf<ErrorBody>(response).message).toEqual(
        expect.arrayContaining([
          'property role should not exist',
          'email must be a valid email address',
          'password should not be empty',
        ]) as unknown,
      );
    });

    it('refuses disabled accounts', async () => {
      await createUser(app, {
        email: 'disabled@example.test',
        role: Role.EDITOR,
        status: UserStatus.DISABLED,
      });

      const response = await request(http)
        .post('/auth/login')
        .send({ email: 'disabled@example.test', password: DEFAULT_PASSWORD })
        .expect(403);
      expect(bodyOf<ErrorBody>(response).message).toBe(
        'This account is disabled.',
      );
    });

    it('rate-limits repeated attempts against one account', async () => {
      const attempt = () =>
        request(http)
          .post('/auth/login')
          .send({ email: 'target@example.test', password: 'guess' });

      for (let i = 0; i < 5; i++) {
        await attempt().expect(401);
      }
      const blocked = await attempt().expect(429);
      expect(bodyOf<ErrorBody>(blocked).message).toMatch(
        /Too many sign-in attempts/,
      );
    });
  });

  describe('GET /auth/me', () => {
    it('requires authentication', async () => {
      await request(http).get('/auth/me').expect(401);
      await request(http)
        .get('/auth/me')
        .set('Authorization', 'Bearer not-a-token')
        .expect(401);
    });

    it('does not accept a refresh token as an access token', async () => {
      const { refreshToken } = await signIn(app, 'admin@example.test');
      await request(http)
        .get('/auth/me')
        .set('Authorization', `Bearer ${refreshToken}`)
        .expect(401);
    });

    it('returns the current user with permissions and nothing sensitive', async () => {
      const { bearer } = await signIn(app, 'admin@example.test');
      const response = await request(http)
        .get('/auth/me')
        .set('Authorization', bearer)
        .expect(200);

      expect(response.body).toEqual({
        data: {
          id: admin.id,
          email: 'admin@example.test',
          name: 'Ada Admin',
          role: 'ADMIN',
          permissions: [...ALL_PERMISSIONS],
        },
      });
      expectNoSecrets(response);
    });

    it('reflects role changes immediately', async () => {
      const { bearer } = await signIn(app, 'admin@example.test');
      await app
        .get(DataSource)
        .query(`UPDATE users SET role = 'AUTHOR' WHERE id = $1`, [admin.id]);

      const response = await request(http)
        .get('/auth/me')
        .set('Authorization', bearer)
        .expect(200);
      expect(
        bodyOf<{ data: { permissions: string[] } }>(response).data.permissions,
      ).toEqual(['CONTENT_READ', 'CONTENT_CREATE', 'CONTENT_UPDATE']);
    });
  });

  describe('POST /auth/refresh', () => {
    it('issues a new access token and rotates the refresh cookie', async () => {
      const session = await signIn(app, 'admin@example.test');

      const response = await request(http)
        .post('/auth/refresh')
        .set('Cookie', session.cookie)
        .expect(200);

      const body = bodyOf<TokenBody>(response);
      expect(Object.keys(body).sort()).toEqual(['accessToken', 'expiresIn']);
      const rotated = refreshTokenFrom(response);
      expect(rotated).toBeDefined();
      expect(rotated).not.toBe(session.refreshToken);
      expectNoSecrets(response, rotated ?? '');

      await request(http)
        .get('/auth/me')
        .set('Authorization', `Bearer ${body.accessToken}`)
        .expect(200);
      // The rotated token keeps working.
      await request(http)
        .post('/auth/refresh')
        .set('Cookie', refreshCookie(rotated ?? ''))
        .expect(200);
    });

    it('rejects a missing, malformed or tampered token', async () => {
      const { refreshToken } = await signIn(app, 'admin@example.test');
      const tampered = `${refreshToken.slice(0, -2)}${refreshToken.endsWith('A') ? 'BB' : 'AA'}`;

      await request(http).post('/auth/refresh').expect(401);
      await request(http)
        .post('/auth/refresh')
        .set('Cookie', refreshCookie('garbage'))
        .expect(401);
      const response = await request(http)
        .post('/auth/refresh')
        .set('Cookie', refreshCookie(tampered))
        .expect(401);
      // A rejected refresh clears the cookie.
      expect(setRefreshCookie(response)).toMatch(/^wb_refresh=;/);
    });

    it('rejects an expired refresh token', async () => {
      const { refreshToken } = await signIn(app, 'admin@example.test');
      const payload = app
        .get(JwtService)
        .decode<{ sub: string; sid: string }>(refreshToken);
      const expired = await app
        .get(JwtService)
        .signAsync(
          { sub: payload.sub, sid: payload.sid, typ: 'refresh' },
          { secret: TEST_ENV.JWT_REFRESH_SECRET, expiresIn: -60 },
        );

      await request(http)
        .post('/auth/refresh')
        .set('Cookie', refreshCookie(expired))
        .expect(401);
    });

    it('rejects a session that has expired in the database', async () => {
      const session = await signIn(app, 'admin@example.test');
      await app
        .get(DataSource)
        .query(
          `UPDATE auth_sessions SET expires_at = now() - interval '1 minute'`,
        );

      await request(http)
        .post('/auth/refresh')
        .set('Cookie', session.cookie)
        .expect(401);
    });

    it('rejects and ends the session of a disabled user', async () => {
      const session = await signIn(app, 'admin@example.test');
      await app
        .get(DataSource)
        .query(`UPDATE users SET status = 'DISABLED' WHERE id = $1`, [
          admin.id,
        ]);

      await request(http)
        .post('/auth/refresh')
        .set('Cookie', session.cookie)
        .expect(401);
      await request(http)
        .get('/auth/me')
        .set('Authorization', session.bearer)
        .expect(401);
    });

    it('accepts the previous token briefly after a rotation, without rotating again', async () => {
      const session = await signIn(app, 'admin@example.test');
      await request(http)
        .post('/auth/refresh')
        .set('Cookie', session.cookie)
        .expect(200);

      // e.g. a second tab that sent the old cookie a moment later
      const late = await request(http)
        .post('/auth/refresh')
        .set('Cookie', session.cookie)
        .expect(200);
      expect(typeof bodyOf<TokenBody>(late).accessToken).toBe('string');
      expect(setRefreshCookie(late)).toBeUndefined();
    });

    it('treats reuse of a superseded token as theft and revokes the session', async () => {
      const session = await signIn(app, 'admin@example.test');
      const refreshed = await request(http)
        .post('/auth/refresh')
        .set('Cookie', session.cookie)
        .expect(200);
      const current = refreshTokenFrom(refreshed) ?? '';
      // Move the rotation outside the grace window.
      await app
        .get(DataSource)
        .query(
          `UPDATE auth_sessions SET rotated_at = now() - interval '1 hour'`,
        );

      await request(http)
        .post('/auth/refresh')
        .set('Cookie', session.cookie)
        .expect(401);
      // The whole session is gone, including the legitimate latest token.
      await request(http)
        .post('/auth/refresh')
        .set('Cookie', refreshCookie(current))
        .expect(401);
    });

    it('rotates only once when the same token is refreshed concurrently', async () => {
      const session = await signIn(app, 'admin@example.test');
      const responses = await Promise.all(
        [1, 2, 3].map(() =>
          request(http).post('/auth/refresh').set('Cookie', session.cookie),
        ),
      );

      expect(responses.map((r) => r.status)).toEqual([200, 200, 200]);
      expect(
        responses.filter((r) => setRefreshCookie(r) !== undefined),
      ).toHaveLength(1);
    });
  });

  describe('POST /auth/logout', () => {
    it('ends the session and clears the cookie', async () => {
      const session = await signIn(app, 'admin@example.test');
      const payload = app
        .get(JwtService)
        .decode<{ sid: string }>(session.refreshToken);

      const response = await request(http)
        .post('/auth/logout')
        .set('Cookie', session.cookie)
        .expect(204);
      expect(setRefreshCookie(response)).toMatch(
        /^wb_refresh=;.*Expires=Thu, 01 Jan 1970/,
      );

      const [row] = await sessionRow(payload.sid);
      expect(row?.revoked_at).toBeInstanceOf(Date);
      await request(http)
        .post('/auth/refresh')
        .set('Cookie', session.cookie)
        .expect(401);
      // Access tokens of the ended session stop working right away.
      await request(http)
        .get('/auth/me')
        .set('Authorization', session.bearer)
        .expect(401);
    });

    it('is safe to call repeatedly and without a session', async () => {
      const session = await signIn(app, 'admin@example.test');
      await request(http)
        .post('/auth/logout')
        .set('Cookie', session.cookie)
        .expect(204);
      await request(http)
        .post('/auth/logout')
        .set('Cookie', session.cookie)
        .expect(204);
      await request(http).post('/auth/logout').expect(204);
      await request(http)
        .post('/auth/logout')
        .set('Cookie', refreshCookie('garbage'))
        .expect(204);
    });
  });
});
