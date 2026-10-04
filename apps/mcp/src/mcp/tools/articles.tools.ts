import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import type { ContentApi } from '../../content-api/content-api.js';
import {
  ArticleDetailSchema,
  ArticleSummarySchema,
  SLUG_PATTERN,
  toArticleDetail,
  toArticleSummary,
} from '../content.mappers.js';
import { fail, ok, runTool } from './tool-results.js';

const READ_ONLY = { readOnlyHint: true, openWorldHint: false } as const;

export function registerArticleTools(
  server: McpServer,
  content: ContentApi,
): void {
  server.registerTool(
    'search_articles',
    {
      title: 'Search articles',
      description:
        "Search While Building's published articles by keyword and/or category. " +
        'Returns summaries (no body), newest first. Use get_article for the full text.',
      inputSchema: z
        .object({
          query: z
            .string()
            .trim()
            .min(1)
            .max(100)
            .optional()
            .describe('Words to match in the title, summary, slug or category'),
          category: z
            .string()
            .trim()
            .min(1)
            .max(50)
            .optional()
            .describe('Exact category, case-insensitive, e.g. "DevOps"'),
          limit: z
            .number()
            .int()
            .min(1)
            .max(20)
            .default(5)
            .describe('Maximum number of articles to return'),
        })
        .strict(),
      outputSchema: z.object({
        articles: z.array(ArticleSummarySchema),
        total: z
          .number()
          .describe('Matching articles, including any beyond `limit`'),
      }),
      annotations: READ_ONLY,
    },
    ({ query, category, limit }, ctx) =>
      runTool('search_articles', async () => {
        const page = await content.listArticles(
          { search: query, category, pageSize: limit },
          ctx.mcpReq.signal,
        );
        return ok({
          articles: page.data.map(toArticleSummary),
          total: page.meta.total,
        });
      }),
  );

  server.registerTool(
    'get_article',
    {
      title: 'Get article',
      description:
        'Get one published While Building article by its slug, including the full Markdown body.',
      inputSchema: z
        .object({
          slug: z
            .string()
            .max(200)
            .regex(
              SLUG_PATTERN,
              'slug must be lower-case words joined by hyphens',
            )
            .describe('e.g. "building-a-nestjs-api-from-scratch"'),
        })
        .strict(),
      outputSchema: z.object({ article: ArticleDetailSchema }),
      annotations: READ_ONLY,
    },
    ({ slug }, ctx) =>
      runTool('get_article', async () => {
        const article = await content.getArticle(slug, ctx.mcpReq.signal);
        if (!article) return fail(`No published article with slug "${slug}".`);
        return ok({ article: toArticleDetail(article) });
      }),
  );
}
