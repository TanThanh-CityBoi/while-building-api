import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import type { ContentApi } from '../../content-api/content-api.js';
import { ProjectSchema, SLUG_PATTERN, toProject } from '../content.mappers.js';
import { fail, ok, runTool } from './tool-results.js';

const READ_ONLY = { readOnlyHint: true, openWorldHint: false } as const;

export function registerProjectTools(
  server: McpServer,
  content: ContentApi,
): void {
  server.registerTool(
    'search_projects',
    {
      title: 'Search projects',
      description:
        "Search While Building's published projects by keyword, technology and/or featured flag. " +
        'Featured projects come first.',
      inputSchema: z
        .object({
          query: z
            .string()
            .trim()
            .min(1)
            .max(100)
            .optional()
            .describe(
              'Words to match in the name, description or technologies',
            ),
          technology: z
            .string()
            .trim()
            .min(1)
            .max(50)
            .optional()
            .describe('Exact technology, case-insensitive, e.g. "NestJS"'),
          featured: z
            .boolean()
            .optional()
            .describe(
              'Only featured (true) or only non-featured (false) projects',
            ),
          limit: z
            .number()
            .int()
            .min(1)
            .max(20)
            .default(5)
            .describe('Maximum number of projects to return'),
        })
        .strict(),
      outputSchema: z.object({
        projects: z.array(ProjectSchema),
        total: z
          .number()
          .describe('Matching projects, including any beyond `limit`'),
      }),
      annotations: READ_ONLY,
    },
    ({ query, technology, featured, limit }, ctx) =>
      runTool('search_projects', async () => {
        const page = await content.listProjects(
          { search: query, technology, featured, pageSize: limit },
          ctx.mcpReq.signal,
        );
        return ok({
          projects: page.data.map(toProject),
          total: page.meta.total,
        });
      }),
  );

  server.registerTool(
    'get_project',
    {
      title: 'Get project',
      description: 'Get one published While Building project by its slug.',
      inputSchema: z
        .object({
          slug: z
            .string()
            .max(200)
            .regex(
              SLUG_PATTERN,
              'slug must be lower-case words joined by hyphens',
            )
            .describe('e.g. "personal-homelab"'),
        })
        .strict(),
      outputSchema: z.object({ project: ProjectSchema }),
      annotations: READ_ONLY,
    },
    ({ slug }, ctx) =>
      runTool('get_project', async () => {
        const project = await content.getProject(slug, ctx.mcpReq.signal);
        if (!project) return fail(`No published project with slug "${slug}".`);
        return ok({ project: toProject(project) });
      }),
  );
}
