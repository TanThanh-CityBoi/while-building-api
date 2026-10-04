import { ContentApi } from '../../src/content-api/content-api.js';
import type {
  ApiArticle,
  ApiArticleSummary,
  ApiProject,
  ArticleQuery,
  Page,
  ProjectQuery,
} from '../../src/content-api/content-api.types.js';

/** ContentApi for tests: a couple of published items, simple filtering, call log. */
export class FakeContentApi extends ContentApi {
  readonly calls: string[] = [];
  /** When set, every call rejects with it (simulates the API being down). */
  failWith: Error | null = null;

  articles: ApiArticle[] = [
    article('k3s-homelab', {
      title: 'My k3s Homelab',
      category: 'Kubernetes',
      content: [
        { type: 'heading', props: { level: 2 }, content: [text('Setup')] },
        { type: 'paragraph', content: [text('Running k3s on a Mini PC.')] },
      ],
    }),
    article('nestjs-from-scratch', {
      title: 'NestJS from Scratch',
      category: 'Backend',
      content: [{ type: 'paragraph', content: [text('Modules first.')] }],
    }),
  ];
  projects: ApiProject[] = [
    {
      id: 'p-1',
      slug: 'mcp-playground',
      name: 'MCP Playground',
      description: 'An experiment with MCP.',
      technologies: ['TypeScript', 'MCP'],
      stage: 'experimental',
      featured: true,
      links: [{ label: 'GitHub', href: 'https://github.com/example/mcp' }],
      createdAt: '2026-08-15T10:00:00.000Z',
      updatedAt: '2026-09-02T10:00:00.000Z',
    },
  ];

  listArticles(query: ArticleQuery): Promise<Page<ApiArticleSummary>> {
    this.calls.push(`listArticles ${JSON.stringify(query)}`);
    return this.respond(() => {
      const search = query.search?.toLowerCase();
      const data = this.articles
        .filter((a) => !search || a.title.toLowerCase().includes(search))
        .filter(
          (a) =>
            !query.category ||
            a.category?.toLowerCase() === query.category.toLowerCase(),
        )
        .slice(0, query.pageSize ?? 10)
        .map(toSummary);
      return page(data);
    });
  }

  getArticle(slug: string): Promise<ApiArticle | null> {
    this.calls.push(`getArticle ${slug}`);
    return this.respond(
      () => this.articles.find((a) => a.slug === slug) ?? null,
    );
  }

  listProjects(query: ProjectQuery): Promise<Page<ApiProject>> {
    this.calls.push(`listProjects ${JSON.stringify(query)}`);
    return this.respond(() =>
      page(this.projects.slice(0, query.pageSize ?? 10)),
    );
  }

  getProject(slug: string): Promise<ApiProject | null> {
    this.calls.push(`getProject ${slug}`);
    return this.respond(
      () => this.projects.find((p) => p.slug === slug) ?? null,
    );
  }

  private respond<T>(result: () => T): Promise<T> {
    return this.failWith
      ? Promise.reject(this.failWith)
      : Promise.resolve(result());
  }
}

function article(slug: string, overrides: Partial<ApiArticle>): ApiArticle {
  return {
    id: `a-${slug}`,
    slug,
    title: slug,
    excerpt: `About ${slug}.`,
    category: 'Backend',
    coverImage: null,
    author: { id: 'u-1', name: 'Ada Lovelace' },
    publishedAt: '2026-09-01T00:00:00.000Z',
    readingTimeMinutes: 5,
    content: [],
    createdAt: '2026-08-30T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

function toSummary(article: ApiArticle): ApiArticleSummary {
  const summary: Partial<ApiArticle> = { ...article };
  delete summary.content;
  return summary as ApiArticleSummary;
}

function text(value: string) {
  return { type: 'text', text: value, styles: {} };
}

function page<T>(data: T[]): Page<T> {
  return {
    data,
    meta: { page: 1, pageSize: 10, total: data.length, totalPages: 1 },
  };
}
