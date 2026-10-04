import type { Client } from '@modelcontextprotocol/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FakeContentApi } from '../../../test/fakes/fake-content-api.js';
import { connectInMemory } from '../../../test/utils/in-memory-client.js';
import { ContentApiUnavailableError } from '../../content-api/content-api.js';

interface TextBlock {
  type: string;
  text?: string;
}

const textOf = (result: { content?: unknown }) =>
  ((result.content ?? []) as TextBlock[]).map((block) => block.text).join('');

describe('MCP content tools', () => {
  let content: FakeContentApi;
  let client: Client;
  let close: () => Promise<void>;

  beforeEach(async () => {
    content = new FakeContentApi();
    ({ client, close } = await connectInMemory(content));
  });

  afterEach(async () => {
    await close();
  });

  it('lists exactly the four read-only tools with strict input schemas', async () => {
    const { tools } = await client.listTools();

    expect(tools.map((tool) => tool.name).sort()).toEqual([
      'get_article',
      'get_project',
      'search_articles',
      'search_projects',
    ]);
    for (const tool of tools) {
      expect(tool.annotations).toMatchObject({
        readOnlyHint: true,
        openWorldHint: false,
      });
      expect(tool.inputSchema).toMatchObject({
        type: 'object',
        additionalProperties: false,
      });
      expect(tool.outputSchema).toMatchObject({ type: 'object' });
      expect(tool.description).toBeTruthy();
    }
    const getArticle = tools.find((tool) => tool.name === 'get_article');
    expect(getArticle?.inputSchema.required).toEqual(['slug']);
  });

  it('search_articles returns whitelisted summaries with resource URIs', async () => {
    const result = await client.callTool({
      name: 'search_articles',
      arguments: { query: 'k3s', limit: 3 },
    });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({
      articles: [
        {
          slug: 'k3s-homelab',
          title: 'My k3s Homelab',
          description: 'About k3s-homelab.',
          category: 'Kubernetes',
          author: 'Ada Lovelace',
          publishedAt: '2026-09-01T00:00:00.000Z',
          readingTimeMinutes: 5,
          uri: 'article://k3s-homelab',
        },
      ],
      total: 1,
    });
    expect(JSON.parse(textOf(result))).toEqual(result.structuredContent);
    expect(content.calls).toEqual([
      'listArticles {"search":"k3s","pageSize":3}',
    ]);
  });

  it('applies the default limit', async () => {
    await client.callTool({ name: 'search_articles', arguments: {} });
    expect(content.calls).toEqual(['listArticles {"pageSize":5}']);
  });

  it('returns an empty list, not an error, when nothing matches', async () => {
    const result = await client.callTool({
      name: 'search_articles',
      arguments: { query: 'nothing like this' },
    });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({ articles: [], total: 0 });
  });

  it('get_article returns the content as Markdown but no internal fields', async () => {
    const result = await client.callTool({
      name: 'get_article',
      arguments: { slug: 'k3s-homelab' },
    });
    const { article } = result.structuredContent as {
      article: Record<string, unknown>;
    };
    expect(article).toMatchObject({
      slug: 'k3s-homelab',
      body: '## Setup\n\nRunning k3s on a Mini PC.',
      uri: 'article://k3s-homelab',
    });
    for (const internal of [
      'id',
      'createdAt',
      'updatedAt',
      'status',
      'content',
      'coverImage',
    ]) {
      expect(article).not.toHaveProperty(internal);
    }
  });

  it('search_projects and get_project return whitelisted projects', async () => {
    const search = await client.callTool({
      name: 'search_projects',
      arguments: { technology: 'mcp', featured: true },
    });
    expect(search.structuredContent).toMatchObject({
      projects: [{ slug: 'mcp-playground', uri: 'project://mcp-playground' }],
      total: 1,
    });
    expect(content.calls[0]).toBe(
      'listProjects {"technology":"mcp","featured":true,"pageSize":5}',
    );

    const get = await client.callTool({
      name: 'get_project',
      arguments: { slug: 'mcp-playground' },
    });
    expect(get.structuredContent).toEqual({
      project: {
        slug: 'mcp-playground',
        name: 'MCP Playground',
        description: 'An experiment with MCP.',
        technologies: ['TypeScript', 'MCP'],
        stage: 'experimental',
        featured: true,
        links: [{ label: 'GitHub', href: 'https://github.com/example/mcp' }],
        uri: 'project://mcp-playground',
      },
    });
  });

  it.each([
    [
      'get_article',
      { slug: 'unknown-post' },
      'No published article with slug "unknown-post".',
    ],
    [
      'get_project',
      { slug: 'unknown' },
      'No published project with slug "unknown".',
    ],
  ])(
    '%s reports a missing slug as a tool error',
    async (name, args, message) => {
      const result = await client.callTool({ name, arguments: args });
      expect(result.isError).toBe(true);
      expect(textOf(result)).toBe(message);
    },
  );

  it.each([
    ['search_articles', { limit: 999 }],
    ['search_articles', { query: '' }],
    ['search_articles', { unexpected: true }],
    ['get_article', {}],
    ['get_article', { slug: 'Not A Slug' }],
    ['search_projects', { featured: 'yes' }],
  ])(
    '%s rejects invalid input %j without calling the API',
    async (name, args) => {
      const result = await client.callTool({ name, arguments: args });
      expect(result.isError).toBe(true);
      expect(textOf(result)).toMatch(/validation/i);
      expect(content.calls).toEqual([]);
    },
  );

  it('answers generically when the API is unavailable, without leaking details', async () => {
    content.failWith = new ContentApiUnavailableError(
      'GET /articles answered 502 from http://10.0.0.5:3000',
    );
    const result = await client.callTool({
      name: 'search_articles',
      arguments: {},
    });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe(
      'While Building content is temporarily unavailable. Try again later.',
    );
  });

  it('rejects unknown tools at the protocol level', async () => {
    await expect(
      client.callTool({ name: 'delete_article', arguments: {} }),
    ).rejects.toThrow();
  });
});
