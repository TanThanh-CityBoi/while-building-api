import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import type { ContentApi } from '../../src/content-api/content-api.js';
import { createMcpServer } from '../../src/mcp/mcp-server.factory.js';

/** A real MCP client connected in-process to the app's MCP server. */
export async function connectInMemory(
  content: ContentApi,
): Promise<{ client: Client; close: () => Promise<void> }> {
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const server = createMcpServer(content);
  const client = new Client({ name: 'test', version: '1.0.0' });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return {
    client,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}
