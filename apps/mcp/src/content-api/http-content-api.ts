import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../config/env.validation.js';
import { ContentApi, ContentApiUnavailableError } from './content-api.js';
import type {
  ApiArticle,
  ApiArticleSummary,
  ApiProject,
  ArticleQuery,
  Page,
  ProjectQuery,
} from './content-api.types.js';

type QueryValue = string | number | boolean | undefined;

/** ContentApi over the While Building API's public HTTP routes. */
@Injectable()
export class HttpContentApi extends ContentApi {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    super();
    this.baseUrl = config.get('API_URL', { infer: true });
    this.timeoutMs = config.get('API_TIMEOUT', { infer: true }) * 1000;
  }

  async listArticles(
    query: ArticleQuery,
    signal?: AbortSignal,
  ): Promise<Page<ApiArticleSummary>> {
    return this.require(await this.get('/articles', { ...query }, signal));
  }

  getArticle(slug: string, signal?: AbortSignal): Promise<ApiArticle | null> {
    return this.getOne<ApiArticle>(
      `/articles/${encodeURIComponent(slug)}`,
      signal,
    );
  }

  async listProjects(
    query: ProjectQuery,
    signal?: AbortSignal,
  ): Promise<Page<ApiProject>> {
    return this.require(await this.get('/projects', { ...query }, signal));
  }

  getProject(slug: string, signal?: AbortSignal): Promise<ApiProject | null> {
    return this.getOne<ApiProject>(
      `/projects/${encodeURIComponent(slug)}`,
      signal,
    );
  }

  private async getOne<T>(
    path: string,
    signal?: AbortSignal,
  ): Promise<T | null> {
    const body = await this.get<{ data: T }>(path, {}, signal);
    return body?.data ?? null;
  }

  /** GETs JSON; `null` for 404, ContentApiUnavailableError for anything else unexpected. */
  private async get<T>(
    path: string,
    query: Record<string, QueryValue>,
    signal?: AbortSignal,
  ): Promise<T | null> {
    const url = new URL(this.baseUrl + path);
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    const timeout = AbortSignal.timeout(this.timeoutMs);

    let response: Response;
    try {
      response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      throw new ContentApiUnavailableError(
        timeout.aborted
          ? `GET ${path} timed out after ${this.timeoutMs} ms`
          : `GET ${path} failed: could not reach the API`,
        { cause: error },
      );
    }

    if (response.status === 404) return null;
    if (!response.ok) {
      throw new ContentApiUnavailableError(
        `GET ${path} answered ${response.status}`,
      );
    }
    try {
      return (await response.json()) as T;
    } catch (error) {
      throw new ContentApiUnavailableError(
        `GET ${path} returned invalid JSON`,
        {
          cause: error,
        },
      );
    }
  }

  private require<T>(body: T | null): T {
    if (body === null) {
      throw new ContentApiUnavailableError('List route answered 404');
    }
    return body;
  }
}
