import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { testConfig } from '../../test/fakes/test-config.js';
import { AuthApiUnavailableError } from './auth-api.js';
import { HttpAuthApi } from './http-auth-api.js';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('HttpAuthApi', () => {
  let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;
  let auth: HttpAuthApi;

  beforeEach(() => {
    fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);
    auth = new HttpAuthApi(testConfig());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('asks the API who is behind the token', async () => {
    fetchMock.mockResolvedValue(
      json({
        data: {
          id: 'u-1',
          email: 'ada@example.test',
          name: 'Ada',
          role: 'EDITOR',
          permissions: ['CONTENT_READ'],
          extra: 'ignored',
        },
      }),
    );

    await expect(auth.currentUser('token-123')).resolves.toEqual({
      id: 'u-1',
      email: 'ada@example.test',
      name: 'Ada',
      role: 'EDITOR',
      permissions: ['CONTENT_READ'],
    });
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('http://api.test/auth/me');
    expect(new Headers(init?.headers).get('Authorization')).toBe(
      'Bearer token-123',
    );
  });

  it.each([401, 403])('treats %i as "not signed in"', async (status) => {
    fetchMock.mockResolvedValue(json({ statusCode: status }, status));
    await expect(auth.currentUser('t')).resolves.toBeNull();
  });

  it('reports other failures as unavailable', async () => {
    fetchMock.mockResolvedValueOnce(json({}, 500));
    await expect(auth.currentUser('t')).rejects.toBeInstanceOf(
      AuthApiUnavailableError,
    );

    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    await expect(auth.currentUser('t')).rejects.toBeInstanceOf(
      AuthApiUnavailableError,
    );
  });
});
