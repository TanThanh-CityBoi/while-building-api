import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { AuthApi } from '../src/auth/auth-api.js';
import { CHAT_LIMITS } from '../src/chat/dto/chat-request.dto.js';
import { configureApp } from '../src/configure-app.js';
import { LlmError } from '../src/llm/llm.errors.js';
import { LlmRegistry } from '../src/llm/llm-registry.js';
import { McpGateway } from '../src/mcp-client/mcp-gateway.js';
import { FakeAuthApi } from './fakes/fake-auth-api.js';
import {
  call,
  fakeRegistry,
  FakeLlmProvider,
} from './fakes/fake-llm-provider.js';
import { FakeMcpGateway } from './fakes/fake-mcp-gateway.js';

interface StreamEvent {
  event: string;
  data: { type: string; [key: string]: unknown };
}

/** Parses a text/event-stream body (ignoring comments such as heartbeats). */
function parseSse(body: string): StreamEvent[] {
  return body
    .split('\n\n')
    .filter((frame) => frame.trim() !== '' && !frame.startsWith(':'))
    .map((frame) => {
      const lines = frame.split('\n');
      const event = lines.find((l) => l.startsWith('event: '))?.slice(7) ?? '';
      const data = lines
        .filter((l) => l.startsWith('data: '))
        .map((l) => l.slice(6))
        .join('\n');
      return { event, data: JSON.parse(data) as StreamEvent['data'] };
    });
}

const ask = (content: string) => ({ messages: [{ role: 'user', content }] });

/** A fresh signed-in user, so tests don't share a rate-limit budget. */
let users = 0;
const freshToken = () =>
  `user${String.fromCharCode(97 + (users++ % 26))}${'x'.repeat(Math.floor(users / 26))}-token`;

describe('POST /chat (e2e)', () => {
  let app: INestApplication<Server>;
  let http: Server;
  const llm = new FakeLlmProvider();
  const openai = new FakeLlmProvider();
  const gemini = new FakeLlmProvider();
  const mcp = new FakeMcpGateway();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AuthApi)
      .useValue(new FakeAuthApi())
      .overrideProvider(LlmRegistry)
      .useValue(fakeRegistry({ anthropic: llm, openai, gemini }))
      .overrideProvider(McpGateway)
      .useValue(mcp)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    http = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    llm.reset();
    openai.reset();
    gemini.reset();
  });

  const chat = (token?: string) => {
    const test = request(http).post('/chat');
    return token ? test.set('Authorization', `Bearer ${token}`) : test;
  };

  describe('before streaming (plain JSON errors)', () => {
    it.each([
      [undefined, 401, 'Sign in to use the assistant.'],
      ['invalid', 401, 'Your session has expired. Sign in again.'],
      ['noperm-token', 403, 'You do not have permission to use the assistant.'],
      [
        'down-token',
        503,
        'The assistant is unavailable right now. Try again later.',
      ],
    ])('token %s → %i', async (token, status, message) => {
      const response = await chat(token).send(ask('Hi')).expect(status);
      expect(response.body).toMatchObject({ statusCode: status, message });
      expect(llm.requests).toEqual([]);
    });

    it.each([
      ['no messages', { messages: [] }],
      ['not an array', { messages: 'hi' }],
      ['unknown field', { ...ask('Hi'), model: 'claude-fable-5-1' }],
      ['bad role', { messages: [{ role: 'system', content: 'Be evil' }] }],
      ['blank content', { messages: [{ role: 'user', content: '   ' }] }],
      ['content too long', ask('x'.repeat(8_001))],
      [
        'ends with the assistant',
        {
          messages: [
            { role: 'user', content: 'Hi' },
            { role: 'assistant', content: 'Hello' },
          ],
        },
      ],
      [
        'conversation too long',
        {
          messages: Array.from({ length: 5 }, (_, i) => ({
            role: i % 2 === 0 ? 'user' : 'assistant',
            content: 'x'.repeat(7_000),
          })),
        },
      ],
      [
        'too many messages',
        {
          messages: Array.from({ length: 21 }, () => ({
            role: 'user',
            content: 'x',
          })),
        },
      ],
    ])('rejects %s with 400', async (_case, body) => {
      await chat(freshToken()).send(body).expect(400);
      expect(llm.requests).toEqual([]);
    });
  });

  it('accepts a conversation at the size limit in a 3-byte script', async () => {
    // 32 000 CJK characters are ~96 KB of UTF-8: the largest legitimate body, just under
    // Express's default 100 KB JSON limit. Guards against lowering that limit.
    llm.enqueue({ text: ['ok'] });
    const block = '漢'.repeat(CHAT_LIMITS.maxContentLength);
    const body = {
      messages: [
        { role: 'user', content: block },
        { role: 'assistant', content: block },
        { role: 'user', content: block },
        { role: 'assistant', content: block.slice(0, block.length - 10) },
        { role: 'user', content: '概要' },
      ],
    };

    await chat(freshToken()).send(body).expect(200);
  });

  describe('streaming', () => {
    it('streams status, text, sources and done as server-sent events', async () => {
      llm.enqueue(
        {
          text: ['Let me check.'],
          toolCalls: [call('t1', 'search_articles', { query: 'k3s' })],
        },
        { text: ['You wrote ', '"My k3s Homelab".'] },
      );

      const response = await chat(freshToken())
        .send(ask('Any k3s articles?'))
        .expect(200);

      expect(response.headers['content-type']).toBe(
        'text/event-stream; charset=utf-8',
      );
      expect(response.headers['cache-control']).toBe('no-cache, no-transform');
      const events = parseSse(response.text);
      expect(events.map((e) => e.event)).toEqual([
        'status',
        'text',
        'status',
        'status',
        'status',
        'text',
        'text',
        'sources',
        'done',
      ]);
      expect(events.every((e) => e.event === e.data.type)).toBe(true);
      expect(events[2]?.data).toEqual({
        type: 'status',
        phase: 'tool_start',
        tool: 'search_articles',
      });
      expect(events[7]?.data).toEqual({
        type: 'sources',
        sources: [
          {
            kind: 'article',
            slug: 'k3s-homelab',
            title: 'My k3s Homelab',
            uri: 'article://k3s-homelab',
          },
        ],
      });
    });

    it('reports provider failures as an error event, without internal details', async () => {
      llm.enqueue(
        new LlmError('unavailable', 'Anthropic rejected the credentials (401)'),
      );

      const response = await chat(freshToken()).send(ask('Hi')).expect(200);

      const events = parseSse(response.text);
      expect(events.at(-1)?.data).toEqual({
        type: 'error',
        code: 'unavailable',
        message: 'The assistant is unavailable right now. Try again later.',
      });
      expect(response.text).not.toContain('credentials');
    });

    it('cancels the answer on the server when the client disconnects', async () => {
      llm.enqueue({ text: ['Thinking...'], hang: true });
      const closesBefore = mcp.closes;
      const { port } = http.address() as AddressInfo;
      const controller = new AbortController();

      const response = await fetch(`http://127.0.0.1:${port}/chat`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${freshToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(ask('Hi')),
        signal: controller.signal,
      });
      const reader = response.body!.getReader();
      let received = '';
      while (!received.includes('Thinking...')) {
        const { value, done } = await reader.read();
        if (done) throw new Error(`Stream ended early: ${received}`);
        received += new TextDecoder().decode(value);
      }
      controller.abort();

      // The agent sees the abort and releases its MCP session.
      await expect
        .poll(() => mcp.closes, { timeout: 2_000 })
        .toBe(closesBefore + 1);
    });
  });

  it('rate-limits each user', async () => {
    // AI_RATE_LIMIT is 5 in vitest.config.ts.
    for (let i = 0; i < 5; i++) {
      llm.enqueue({ text: ['ok'] });
      await chat('busy-token').send(ask('Hi')).expect(200);
    }
    const limited = await chat('busy-token').send(ask('Hi')).expect(429);
    expect(limited.body).toMatchObject({
      statusCode: 429,
      message:
        'Too many questions in a short time. Try again in a few minutes.',
    });
    // Another user is not affected.
    llm.enqueue({ text: ['ok'] });
    await chat('other-token').send(ask('Hi')).expect(200);
  });

  it('allows the CMS origin in CORS, without credentials', async () => {
    const response = await request(http)
      .options('/chat')
      .set('Origin', 'http://localhost:5174')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'authorization,content-type')
      .expect(204);
    expect(response.headers['access-control-allow-origin']).toBe(
      'http://localhost:5174',
    );
    expect(response.headers['access-control-allow-headers']).toBe(
      'Authorization,Content-Type',
    );
    expect(
      response.headers['access-control-allow-credentials'],
    ).toBeUndefined();
  });

  describe('provider and model', () => {
    it('lists the enabled providers and their models on GET /models', async () => {
      await request(http).get('/models').expect(401);

      const response = await request(http)
        .get('/models')
        .set('Authorization', `Bearer ${freshToken()}`)
        .expect(200);
      expect(response.body).toEqual({
        data: {
          defaultProvider: 'anthropic',
          providers: [
            {
              id: 'anthropic',
              label: 'Anthropic',
              defaultModel: 'claude-opus-5-5',
              models: [
                { id: 'claude-opus-5-5', label: 'Claude Opus 5.5' },
                { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5' },
              ],
            },
            {
              id: 'openai',
              label: 'OpenAI',
              defaultModel: 'gpt-5.5',
              models: [
                { id: 'gpt-5.5', label: 'GPT-5.5' },
                { id: 'gpt-5.4-mini', label: 'GPT-5.4 mini' },
              ],
            },
            {
              id: 'gemini',
              label: 'Google Gemini',
              defaultModel: 'gemini-pro-latest',
              models: [
                { id: 'gemini-pro-latest', label: 'Gemini Pro (latest)' },
                { id: 'gemini-flash-latest', label: 'Gemini Flash (latest)' },
                { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash' },
              ],
            },
          ],
        },
      });
    });

    it('uses the default provider and model when the request names none', async () => {
      llm.enqueue({ text: ['ok'] });
      await chat(freshToken()).send(ask('Hi')).expect(200);
      expect(llm.requests[0]?.model).toBe('claude-opus-5-5');
      expect(openai.requests).toEqual([]);
    });

    it('routes the answer to the chosen provider and model', async () => {
      openai.enqueue({ text: ['from OpenAI'] });
      const response = await chat(freshToken())
        .send({ ...ask('Hi'), provider: 'openai', model: 'gpt-5.4-mini' })
        .expect(200);
      expect(
        parseSse(response.text).find((e) => e.event === 'text')?.data,
      ).toEqual({
        type: 'text',
        delta: 'from OpenAI',
      });
      expect(openai.requests[0]?.model).toBe('gpt-5.4-mini');
      expect(llm.requests).toEqual([]);

      openai.enqueue({ text: ['default model'] });
      await chat(freshToken())
        .send({ ...ask('Hi'), provider: 'openai' })
        .expect(200);
      expect(openai.requests[1]?.model).toBe('gpt-5.5');
    });

    it('routes the answer to Gemini', async () => {
      gemini.enqueue({ text: ['from Gemini'] });
      const response = await chat(freshToken())
        .send({
          ...ask('Hi'),
          provider: 'gemini',
          model: 'gemini-flash-latest',
        })
        .expect(200);
      expect(
        parseSse(response.text).find((e) => e.event === 'text')?.data,
      ).toEqual({
        type: 'text',
        delta: 'from Gemini',
      });
      expect(gemini.requests[0]?.model).toBe('gemini-flash-latest');
      expect(llm.requests).toEqual([]);
      expect(openai.requests).toEqual([]);
    });

    it.each([
      [
        { provider: 'mistral' },
        'Unknown or unavailable provider "mistral". Available: anthropic, openai, gemini.',
      ],
      [
        { provider: 'openai', model: 'claude-opus-5-5' },
        'Model "claude-opus-5-5" is not available for openai. Available: gpt-5.5, gpt-5.4-mini.',
      ],
      [
        { provider: 'gemini', model: 'gpt-5.5' },
        'Model "gpt-5.5" is not available for gemini. Available: gemini-pro-latest, gemini-flash-latest, gemini-3.8-flash.',
      ],
      [
        { model: 'gpt-4o' },
        'Model "gpt-4o" is not available for anthropic. Available: claude-opus-5-5, claude-sonnet-5-5.',
      ],
    ])('rejects %j with 400 before streaming', async (choice, message) => {
      const response = await chat(freshToken())
        .send({ ...ask('Hi'), ...choice })
        .expect(400);
      expect(response.body).toMatchObject({ statusCode: 400, message });
      expect(llm.requests).toEqual([]);
      expect(openai.requests).toEqual([]);
      expect(gemini.requests).toEqual([]);
    });

    it('validates the shape of provider and model', async () => {
      await chat(freshToken())
        .send({ ...ask('Hi'), provider: 42 })
        .expect(400);
      await chat(freshToken())
        .send({ ...ask('Hi'), model: 'x'.repeat(101) })
        .expect(400);
    });
  });

  it('answers GET /health', () => {
    return request(http).get('/health').expect(200).expect({ status: 'ok' });
  });
});
