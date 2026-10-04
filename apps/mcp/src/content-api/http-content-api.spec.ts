import type { ConfigService } from '@nestjs/config';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnvironmentVariables } from '../config/env.validation.js';
import { ContentApiUnavailableError } from './content-api.js';
import { HttpContentApi } from './http-content-api.js';

const config = {
  get: (key: keyof EnvironmentVariables) =>
    ({ API_URL: 'http://api.test', API_TIMEOUT: 5 })[key as string],
} as unknown as ConfigService<EnvironmentVariables, true>;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('HttpContentApi', () => {
  let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;
  let api: HttpContentApi;

  beforeEach(() => {
    fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);
    api = new HttpContentApi(config);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // HttpContentApi always passes a URL object.
  const requestedUrl = (call = 0) =>
    (fetchMock.mock.calls[call]?.[0] as URL).href;

  it('lists articles with only the given query parameters', async () => {
    const page = {
      data: [],
      meta: { page: 1, pageSize: 3, total: 0, totalPages: 0 },
    };
    fetchMock.mockResolvedValue(json(page));

    await expect(
      api.listArticles({
        search: 'k3s & co',
        pageSize: 3,
        category: undefined,
      }),
    ).resolves.toEqual(page);
    expect(requestedUrl()).toBe(
      'http://api.test/articles?search=k3s+%26+co&pageSize=3',
    );
  });

  it('serialises boolean filters for projects', async () => {
    fetchMock.mockResolvedValue(json({ data: [], meta: {} }));
    await api.listProjects({ featured: false, technology: 'NestJS' });
    expect(requestedUrl()).toBe(
      'http://api.test/projects?featured=false&technology=NestJS',
    );
  });

  it('unwraps single items and maps 404 to null', async () => {
    fetchMock.mockResolvedValueOnce(json({ data: { slug: 'a' } }));
    await expect(api.getArticle('a')).resolves.toEqual({ slug: 'a' });

    fetchMock.mockResolvedValueOnce(json({ statusCode: 404 }, 404));
    await expect(api.getProject('missing')).resolves.toBeNull();
    expect(requestedUrl(1)).toBe('http://api.test/projects/missing');
  });

  it('reports server errors, network failures and bad JSON as unavailable', async () => {
    fetchMock.mockResolvedValueOnce(json({}, 502));
    await expect(api.listArticles({})).rejects.toThrow(
      new ContentApiUnavailableError('GET /articles answered 502'),
    );

    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    await expect(api.getArticle('a')).rejects.toBeInstanceOf(
      ContentApiUnavailableError,
    );

    fetchMock.mockResolvedValueOnce(new Response('<html>', { status: 200 }));
    await expect(api.getArticle('a')).rejects.toBeInstanceOf(
      ContentApiUnavailableError,
    );
  });

  it("propagates the caller's cancellation as-is", async () => {
    const controller = new AbortController();
    const abort = new DOMException('aborted', 'AbortError');
    fetchMock.mockImplementation(() => {
      controller.abort(abort);
      return Promise.reject(abort);
    });
    await expect(api.getArticle('a', controller.signal)).rejects.toBe(abort);
  });
});
