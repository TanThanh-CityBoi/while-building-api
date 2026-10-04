import type { Client } from '@modelcontextprotocol/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FakeContentApi } from '../../../test/fakes/fake-content-api.js';
import { connectInMemory } from '../../../test/utils/in-memory-client.js';
import { ContentApiUnavailableError } from '../../content-api/content-api.js';

describe('MCP content resources', () => {
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

  it('advertises the article and project URI templates', async () => {
    const { resourceTemplates } = await client.listResourceTemplates();
    expect(
      resourceTemplates.map(({ name, uriTemplate, mimeType }) => ({
        name,
        uriTemplate,
        mimeType,
      })),
    ).toEqual([
      {
        name: 'article',
        uriTemplate: 'article://{slug}',
        mimeType: 'text/markdown',
      },
      {
        name: 'project',
        uriTemplate: 'project://{slug}',
        mimeType: 'text/markdown',
      },
    ]);
  });

  it('lists the latest published items as concrete resources', async () => {
    const { resources } = await client.listResources();
    expect(resources.map((resource) => resource.uri)).toEqual([
      'article://k3s-homelab',
      'article://nestjs-from-scratch',
      'project://mcp-playground',
    ]);
    expect(resources[0]).toMatchObject({
      name: 'k3s-homelab',
      title: 'My k3s Homelab',
      mimeType: 'text/markdown',
    });
    expect(content.calls).toEqual([
      'listArticles {"pageSize":50}',
      'listProjects {"pageSize":50}',
    ]);
  });

  it('reads an article as Markdown with front matter and its content', async () => {
    const { contents } = await client.readResource({
      uri: 'article://k3s-homelab',
    });
    expect(contents).toHaveLength(1);
    expect(contents[0]).toMatchObject({
      uri: 'article://k3s-homelab',
      mimeType: 'text/markdown',
    });
    expect((contents[0] as { text: string }).text).toBe(
      [
        '---',
        'title: "My k3s Homelab"',
        'description: "About k3s-homelab."',
        'category: "Kubernetes"',
        'author: "Ada Lovelace"',
        'published: 2026-09-01',
        'reading_time_minutes: 5',
        '---',
        '',
        '# My k3s Homelab',
        '',
        '## Setup',
        '',
        'Running k3s on a Mini PC.',
        '',
      ].join('\n'),
    );
  });

  it('falls back to the excerpt when an article has no content', async () => {
    const { contents } = await client.readResource({
      uri: 'article://nestjs-from-scratch',
    });
    expect((contents[0] as { text: string }).text).toContain(
      '# NestJS from Scratch\n\nModules first.',
    );
    content.articles[1] = { ...content.articles[1], content: [] };
    const again = await client.readResource({
      uri: 'article://nestjs-from-scratch',
    });
    expect((again.contents[0] as { text: string }).text).toContain(
      '# NestJS from Scratch\n\nAbout nestjs-from-scratch.',
    );
  });

  it('reads a project as Markdown', async () => {
    const { contents } = await client.readResource({
      uri: 'project://mcp-playground',
    });
    expect((contents[0] as { text: string }).text).toBe(
      [
        '# MCP Playground',
        '',
        'An experiment with MCP.',
        '',
        '- Stage: experimental',
        '- Featured: yes',
        '- Technologies: TypeScript, MCP',
        '- Links: [GitHub](https://github.com/example/mcp)',
        '',
      ].join('\n'),
    );
  });

  it.each([
    'article://unknown-post',
    'article://Not_A_Slug',
    'project://unknown',
    'experiment://anything',
  ])('reports %s as not found', async (uri) => {
    await expect(client.readResource({ uri })).rejects.toMatchObject({
      code: -32602,
      data: { uri },
    });
  });

  it('answers generically when the API is unavailable', async () => {
    content.failWith = new ContentApiUnavailableError(
      'GET /articles/k3s-homelab failed: could not reach the API',
    );
    const read = client.readResource({ uri: 'article://k3s-homelab' });
    await expect(read).rejects.toMatchObject({ code: -32603 });
    await expect(read).rejects.toThrow(
      'While Building content is temporarily unavailable.',
    );
  });
});
