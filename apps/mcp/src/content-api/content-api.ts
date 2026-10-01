import type {
  ApiArticle,
  ApiArticleSummary,
  ApiProject,
  ArticleQuery,
  Page,
  ProjectQuery,
} from './content-api.types.js';

/** The API could not be reached or answered unexpectedly. Its message is safe to log, not to show. */
export class ContentApiUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ContentApiUnavailableError';
  }
}

/**
 * Read access to While Building's published content (an abstract class so it
 * doubles as the DI token). The API owns every rule — visibility, search,
 * ordering — this port only fetches.
 */
export abstract class ContentApi {
  abstract listArticles(
    query: ArticleQuery,
    signal?: AbortSignal,
  ): Promise<Page<ApiArticleSummary>>;

  /** `null` when there is no published article with that slug. */
  abstract getArticle(
    slug: string,
    signal?: AbortSignal,
  ): Promise<ApiArticle | null>;

  abstract listProjects(
    query: ProjectQuery,
    signal?: AbortSignal,
  ): Promise<Page<ApiProject>>;

  /** `null` when there is no published project with that slug. */
  abstract getProject(
    slug: string,
    signal?: AbortSignal,
  ): Promise<ApiProject | null>;
}
