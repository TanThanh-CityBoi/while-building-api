import type { ToolDefinition } from '../../src/llm/llm.types.js';
import {
  McpGateway,
  McpUnavailableError,
  type McpToolSession,
  type ToolOutcome,
} from '../../src/mcp-client/mcp-gateway.js';

type Handler = (input: Record<string, unknown>) => ToolOutcome;

const schema = (
  properties: Record<string, unknown>,
  required: string[] = [],
) => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
});

const ok = (structured: Record<string, unknown>): ToolOutcome => ({
  text: JSON.stringify(structured),
  isError: false,
  structured,
});

/** McpGateway for tests: the four While Building tools over a tiny dataset. */
export class FakeMcpGateway extends McpGateway {
  unavailable = false;
  connects = 0;
  closes = 0;
  readonly calls: Array<{ name: string; input: Record<string, unknown> }> = [];

  readonly tools: ToolDefinition[] = [
    {
      name: 'search_articles',
      description: 'Search published articles.',
      inputSchema: schema({
        query: { type: 'string' },
        limit: { type: 'integer' },
      }),
    },
    {
      name: 'get_article',
      description: 'Get one published article.',
      inputSchema: schema({ slug: { type: 'string' } }, ['slug']),
    },
    {
      name: 'search_projects',
      description: 'Search published projects.',
      inputSchema: schema({ technology: { type: 'string' } }),
    },
    {
      name: 'get_project',
      description: 'Get one published project.',
      inputSchema: schema({ slug: { type: 'string' } }, ['slug']),
    },
  ];

  handlers: Record<string, Handler> = {
    search_articles: ({ query }) =>
      query === 'nothing'
        ? ok({ articles: [], total: 0 })
        : ok({
            articles: [
              {
                slug: 'k3s-homelab',
                title: 'My k3s Homelab',
                uri: 'article://k3s-homelab',
              },
            ],
            total: 1,
          }),
    get_article: ({ slug }) =>
      typeof slug === 'string' && /^[a-z0-9-]+$/.test(slug)
        ? slug === 'k3s-homelab'
          ? ok({
              article: {
                slug,
                title: 'My k3s Homelab',
                body: '# k3s',
                uri: 'article://k3s-homelab',
              },
            })
          : { text: `No published article with slug "${slug}".`, isError: true }
        : { text: 'Input validation error: slug', isError: true },
    search_projects: () =>
      ok({
        projects: [
          {
            slug: 'mcp-playground',
            name: 'MCP Playground',
            uri: 'project://mcp-playground',
          },
        ],
        total: 1,
      }),
    get_project: ({ slug }) =>
      ok({
        project: {
          slug,
          name: 'MCP Playground',
          uri: `project://${String(slug)}`,
        },
      }),
  };

  connect(): Promise<McpToolSession> {
    this.connects += 1;
    if (this.unavailable) {
      return Promise.reject(new McpUnavailableError('connection refused'));
    }
    return Promise.resolve({
      tools: this.tools,
      callTool: (name, input) => {
        this.calls.push({ name, input });
        const handler = this.handlers[name];
        return Promise.resolve(
          handler
            ? handler(input)
            : {
                text: `The ${name} tool failed (unknown tool).`,
                isError: true,
              },
        );
      },
      close: () => {
        this.closes += 1;
        return Promise.resolve();
      },
    });
  }
}
