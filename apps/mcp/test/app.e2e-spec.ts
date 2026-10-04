import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import {
  Client,
  StreamableHTTPClientTransport,
} from '@modelcontextprotocol/client';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { ContentApi } from '../src/content-api/content-api.js';
import { FakeContentApi } from './fakes/fake-content-api.js';

describe('MCP app (e2e)', () => {
  let app: INestApplication<Server>;
  let mcpUrl: URL;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ContentApi)
      .useValue(new FakeContentApi())
      .compile();
    app = moduleRef.createNestApplication();
    // 127.0.0.1, not getUrl()'s [::1]: the Host allow-list is checked.
    await app.listen(0, '127.0.0.1');
    const { port } = app.getHttpServer().address() as AddressInfo;
    mcpUrl = new URL(`http://127.0.0.1:${port}/mcp`);
  });

  afterAll(async () => {
    await app.close();
  });

  it('answers GET /health', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('completes the MCP handshake with a standard client', async () => {
    const client = new Client({ name: 'e2e-test', version: '1.0.0' });
    await client.connect(new StreamableHTTPClientTransport(mcpUrl));
    try {
      expect(client.getServerVersion()).toMatchObject({
        name: 'while-building',
        version: '0.1.0',
      });
      expect(client.getInstructions()).toContain('Read-only');
    } finally {
      await client.close();
    }
  });

  it('is stateless: session operations answer 405', () => {
    return request(app.getHttpServer())
      .get('/mcp')
      .set('Host', `127.0.0.1:${mcpUrl.port}`)
      .set('Accept', 'text/event-stream')
      .expect(405);
  });

  it('rejects unknown Host and Origin headers (DNS rebinding protection)', async () => {
    const initialize = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'x', version: '1' },
      },
    };
    await request(app.getHttpServer())
      .post('/mcp')
      .set('Host', 'evil.example')
      .send(initialize)
      .expect(403);
    await request(app.getHttpServer())
      .post('/mcp')
      .set('Host', `127.0.0.1:${mcpUrl.port}`)
      .set('Origin', 'https://evil.example')
      .send(initialize)
      .expect(403);
  });
});
