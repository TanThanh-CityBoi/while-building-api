import { McpServer } from '@modelcontextprotocol/server';
import type { ContentApi } from '../content-api/content-api.js';
import { registerContentResources } from './resources/content.resources.js';
import { registerArticleTools } from './tools/articles.tools.js';
import { registerProjectTools } from './tools/projects.tools.js';

export const MCP_SERVER_INFO = {
  name: 'while-building',
  title: 'While Building',
  version: '0.1.0',
} as const;

const INSTRUCTIONS = [
  'Read-only access to While Building — "things I build, things I learn, things I break":',
  'published articles and projects. Nothing here can change data.',
].join(' ');

/**
 * Builds the MCP server for one request (the endpoint is stateless): server
 * info plus every tool and resource, all backed by the API through ContentApi.
 */
export function createMcpServer(content: ContentApi): McpServer {
  const server = new McpServer(MCP_SERVER_INFO, { instructions: INSTRUCTIONS });
  registerArticleTools(server, content);
  registerProjectTools(server, content);
  registerContentResources(server, content);
  return server;
}
