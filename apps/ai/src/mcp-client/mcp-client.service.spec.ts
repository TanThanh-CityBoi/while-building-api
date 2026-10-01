import type { Transport } from '@modelcontextprotocol/client';
import { InMemoryTransport, McpServer } from '@modelcontextprotocol/server';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { testConfig } from '../../test/fakes/test-config.js';
import {
  MAX_TOOL_OUTPUT_CHARS,
  McpClientService,
} from './mcp-client.service.js';
import { McpUnavailableError, type McpToolSession } from './mcp-gateway.js';

/** McpClientService wired to an in-process MCP server instead of HTTP. */
class InMemoryMcpClientService extends McpClientService {
  constructor(private readonly server: McpServer) {
    super(testConfig({ AI_TOOL_TIMEOUT: 2 }));
  }

  protected override createTransport(): Transport {
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    void this.server.connect(serverSide);
    return clientSide;
  }
}

function testServer(): McpServer {
  const server = new McpServer({ name: 'test', version: '1.0.0' });
  server.registerTool(
    'echo',
    {
      description: 'Echoes a word.',
      inputSchema: z.object({ word: z.string() }).strict(),
      outputSchema: z.object({ word: z.string() }),
    },
    ({ word }) => ({
      content: [{ type: 'text', text: JSON.stringify({ word }) }],
      structuredContent: { word },
    }),
  );
  server.registerTool(
    'fails',
    { title: 'Always fails', inputSchema: z.object({}) },
    () => ({ isError: true, content: [{ type: 'text', text: 'Not found.' }] }),
  );
  server.registerTool(
    'huge',
    { description: 'Returns a lot.', inputSchema: z.object({}) },
    () => ({
      content: [{ type: 'text', text: 'x'.repeat(MAX_TOOL_OUTPUT_CHARS + 10) }],
    }),
  );
  return server;
}

describe('McpClientService', () => {
  let session: McpToolSession | undefined;
  const signal = new AbortController().signal;

  afterEach(async () => {
    await session?.close();
    session = undefined;
  });

  it('discovers the tools as provider-neutral definitions', async () => {
    session = await new InMemoryMcpClientService(testServer()).connect(signal);

    expect(session.tools.map((tool) => tool.name)).toEqual([
      'echo',
      'fails',
      'huge',
    ]);
    expect(session.tools[0]).toMatchObject({
      name: 'echo',
      description: 'Echoes a word.',
      inputSchema: {
        type: 'object',
        properties: { word: { type: 'string' } },
        required: ['word'],
      },
    });
    // No description: falls back to the title.
    expect(session.tools[1]?.description).toBe('Always fails');
  });

  it('calls tools and returns their text and structured output', async () => {
    session = await new InMemoryMcpClientService(testServer()).connect(signal);

    await expect(
      session.callTool('echo', { word: 'hi' }, signal),
    ).resolves.toEqual({
      text: '{"word":"hi"}',
      isError: false,
      structured: { word: 'hi' },
    });
    await expect(session.callTool('fails', {}, signal)).resolves.toEqual({
      text: 'Not found.',
      isError: true,
      structured: undefined,
    });
  });

  it('turns invalid input and unknown tools into tool errors for the model', async () => {
    session = await new InMemoryMcpClientService(testServer()).connect(signal);

    const invalid = await session.callTool('echo', { word: 42 }, signal);
    expect(invalid.isError).toBe(true);

    const unknown = await session.callTool('delete_everything', {}, signal);
    expect(unknown.isError).toBe(true);
    expect(unknown.text).toContain('The delete_everything tool failed');
  });

  it('truncates oversized output, saying so', async () => {
    session = await new InMemoryMcpClientService(testServer()).connect(signal);
    const { text } = await session.callTool('huge', {}, signal);
    expect(text).toHaveLength(
      MAX_TOOL_OUTPUT_CHARS +
        `\n[Output truncated: ${MAX_TOOL_OUTPUT_CHARS + 10} characters in total.]`
          .length,
    );
    expect(text).toMatch(/\[Output truncated: \d+ characters in total\.\]$/);
  });

  it('reports an unreachable server as McpUnavailableError', async () => {
    // Nothing listens on port 9 (discard) on localhost.
    const service = new McpClientService(
      testConfig({ MCP_URL: 'http://127.0.0.1:9/mcp', AI_TOOL_TIMEOUT: 2 }),
    );
    await expect(service.connect(signal)).rejects.toBeInstanceOf(
      McpUnavailableError,
    );
  });
});
