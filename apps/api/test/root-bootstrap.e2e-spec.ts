import type { Server } from 'node:http';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { BootstrapRootUserUseCase } from '../src/modules/users/application/use-cases/bootstrap-root-user.use-case.js';
import { TEST_ENV } from './setup/test-env.js';
import {
  createTestApp,
  createUser,
  resetDatabase,
  Role,
  type TestApp,
} from './utils/test-app.js';

interface Row {
  id: string;
  email: string;
  role: string;
  status: string;
  password_hash: string;
}

describe('ROOT bootstrap (pnpm db:seed)', () => {
  let app: TestApp;
  let http: Server;

  const bootstrap = () =>
    app.get(BootstrapRootUserUseCase).execute(
      {
        email: TEST_ENV.ROOT_EMAIL,
        password: TEST_ENV.ROOT_PASSWORD,
        name: TEST_ENV.ROOT_NAME,
      },
      { isProduction: false },
    );

  const rows = () =>
    app
      .get(DataSource)
      .query<Row[]>(
        'SELECT id, email, role, status, password_hash FROM users ORDER BY created_at',
      );

  beforeAll(async () => {
    app = await createTestApp();
    http = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase(app);
  });

  it('creates an active ROOT from ROOT_* with a hashed password, who can sign in', async () => {
    await expect(bootstrap()).resolves.toEqual({
      status: 'created',
      email: TEST_ENV.ROOT_EMAIL,
    });

    const [root] = await rows();
    expect(root).toMatchObject({
      email: TEST_ENV.ROOT_EMAIL,
      role: 'ROOT',
      status: 'ACTIVE',
    });
    expect(root.password_hash).toMatch(/^\$argon2id\$/);
    expect(root.password_hash).not.toContain(TEST_ENV.ROOT_PASSWORD);

    await request(http)
      .post('/auth/login')
      .send({ email: TEST_ENV.ROOT_EMAIL, password: TEST_ENV.ROOT_PASSWORD })
      .expect(200);
  });

  it('does nothing when a ROOT already exists (no duplicate, password untouched)', async () => {
    await bootstrap();
    const [before] = await rows();

    await expect(bootstrap()).resolves.toEqual({ status: 'already-exists' });

    const after = await rows();
    expect(after).toHaveLength(1);
    expect(after[0]).toEqual(before);
  });

  it('never promotes an existing user whose email matches ROOT_EMAIL', async () => {
    await createUser(app, { email: TEST_ENV.ROOT_EMAIL, role: Role.EDITOR });

    await expect(bootstrap()).rejects.toThrow(
      /ROOT_EMAIL is already used by another account/,
    );
    const [user] = await rows();
    expect(user.role).toBe('EDITOR');
  });

  it('allows only one ROOT at the database level', async () => {
    await bootstrap();
    await expect(
      createUser(app, { email: 'second-root@example.test', role: Role.ROOT }),
    ).rejects.toThrow(/users_single_root_idx/);
  });
});
