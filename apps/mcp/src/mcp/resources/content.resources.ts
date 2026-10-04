import { Logger } from '@nestjs/common';
import {
  ProtocolError,
  ProtocolErrorCode,
  ResourceNotFoundError,
  ResourceTemplate,
  type McpServer,
  type Variables,
} from '@modelcontextprotocol/server';
import type { ContentApi } from '../../content-api/content-api.js';
import { articleUri, projectUri, SLUG_PATTERN } from '../content.mappers.js';
import { articleMarkdown, projectMarkdown } from './content-markdown.js';

const logger = new Logger('McpResources');

/** How many of the latest items `resources/list` advertises per kind. */
const LIST_LIMIT = 50;

export function registerContentResources(
  server: McpServer,
  content: ContentApi,
): void {
  server.registerResource(
    'article',
    new ResourceTemplate('article://{slug}', {
      list: (ctx) =>
        guard('list articles', async () => {
          const page = await content.listArticles(
            { pageSize: LIST_LIMIT },
            ctx.mcpReq.signal,
          );
          return {
            resources: page.data.map((article) => ({
              uri: articleUri(article.slug),
              name: article.slug,
              title: article.title,
              description: article.excerpt ?? undefined,
              mimeType: 'text/markdown',
            })),
          };
        }),
    }),
    {
      title: 'Article',
      description: 'A published While Building article, as Markdown.',
      mimeType: 'text/markdown',
    },
    (uri, variables, ctx) =>
      guard('read article', async () => {
        const slug = slugOf(uri, variables);
        const article = await content.getArticle(slug, ctx.mcpReq.signal);
        if (!article) throw new ResourceNotFoundError(uri.href);
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'text/markdown',
              text: articleMarkdown(article),
            },
          ],
        };
      }),
  );

  server.registerResource(
    'project',
    new ResourceTemplate('project://{slug}', {
      list: (ctx) =>
        guard('list projects', async () => {
          const page = await content.listProjects(
            { pageSize: LIST_LIMIT },
            ctx.mcpReq.signal,
          );
          return {
            resources: page.data.map((project) => ({
              uri: projectUri(project.slug),
              name: project.slug,
              title: project.name,
              description: project.description,
              mimeType: 'text/markdown',
            })),
          };
        }),
    }),
    {
      title: 'Project',
      description: 'A published While Building project, as Markdown.',
      mimeType: 'text/markdown',
    },
    (uri, variables, ctx) =>
      guard('read project', async () => {
        const slug = slugOf(uri, variables);
        const project = await content.getProject(slug, ctx.mcpReq.signal);
        if (!project) throw new ResourceNotFoundError(uri.href);
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'text/markdown',
              text: projectMarkdown(project),
            },
          ],
        };
      }),
  );
}

/** The `{slug}` of a matched URI; anything that isn't a valid slug is simply not found. */
function slugOf(uri: URL, variables: Variables): string {
  const slug = variables.slug;
  if (typeof slug !== 'string' || !SLUG_PATTERN.test(slug)) {
    throw new ResourceNotFoundError(uri.href);
  }
  return slug;
}

/**
 * Protocol errors (e.g. not found) pass through; anything else is logged and
 * replaced by a generic internal error, so no internal detail reaches clients.
 */
async function guard<T>(action: string, body: () => Promise<T>): Promise<T> {
  try {
    return await body();
  } catch (error) {
    if (error instanceof ProtocolError) throw error;
    logger.warn(
      `${action} failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    throw new ProtocolError(
      ProtocolErrorCode.InternalError,
      'While Building content is temporarily unavailable.',
    );
  }
}
