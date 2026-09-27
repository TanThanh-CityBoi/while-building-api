import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import type { EnvironmentVariables } from '../src/config/env.validation.js';
import { configureApp } from '../src/configure-app.js';

// Boots the real app against the PostgreSQL configured in .env / the
// environment, so the database must be running.
describe('GET /health (e2e)', () => {
  let app: INestApplication<Server>;
  let allowedOrigin: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    [allowedOrigin] = app
      .get<ConfigService<EnvironmentVariables, true>>(ConfigService)
      .get('CORS_ORIGIN', { infer: true });
  });

  afterAll(async () => {
    await app.close();
  });

  it('reports the API and database as healthy', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok', database: 'up' });
  });

  it('allows CORS requests from a configured origin', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .set('Origin', allowedOrigin)
      .expect(200);

    expect(response.get('Access-Control-Allow-Origin')).toBe(allowedOrigin);
  });

  it('does not allow CORS requests from other origins', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .set('Origin', 'https://not-allowed.example.com')
      .expect(200);

    expect(response.get('Access-Control-Allow-Origin')).toBeUndefined();
  });
});
