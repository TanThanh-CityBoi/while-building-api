import { z } from 'zod';
import type {
  ApiArticle,
  ApiArticleSummary,
  ApiProject,
} from '../content-api/content-api.types.js';
import { blocksToMarkdown } from './blocks-markdown.js';

// What the MCP layer exposes of the API's content: an explicit whitelist, so a
// field added to the API never leaks to AI clients by accident. Every item
// carries the URI of the MCP resource with its full content.

export const articleUri = (slug: string) => `article://${slug}`;
export const projectUri = (slug: string) => `project://${slug}`;

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const ArticleSummarySchema = z.object({
  slug: z.string(),
  title: z.string(),
  description: z
    .string()
    .nullable()
    .describe("Short summary (the article's excerpt)"),
  category: z.string().nullable(),
  author: z.string().nullable().describe("The author's name"),
  publishedAt: z.string().nullable().describe('ISO 8601 date'),
  readingTimeMinutes: z.number(),
  uri: z.string().describe('MCP resource with the full article'),
});
export type ArticleSummary = z.infer<typeof ArticleSummarySchema>;

export const ArticleDetailSchema = ArticleSummarySchema.extend({
  body: z.string().describe('The full text as Markdown'),
});
export type ArticleDetail = z.infer<typeof ArticleDetailSchema>;

export const ProjectSchema = z.object({
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  technologies: z.array(z.string()),
  stage: z.enum(['active', 'experimental', 'archived']).nullable(),
  featured: z.boolean(),
  links: z.array(z.object({ label: z.string(), href: z.string().optional() })),
  uri: z.string().describe('MCP resource with the project'),
});
export type ProjectSummary = z.infer<typeof ProjectSchema>;

export function toArticleSummary(article: ApiArticleSummary): ArticleSummary {
  return {
    slug: article.slug,
    title: article.title,
    description: article.excerpt,
    category: article.category,
    author: article.author?.name ?? null,
    publishedAt: article.publishedAt,
    readingTimeMinutes: article.readingTimeMinutes,
    uri: articleUri(article.slug),
  };
}

export function toArticleDetail(article: ApiArticle): ArticleDetail {
  return {
    ...toArticleSummary(article),
    body: blocksToMarkdown(article.content),
  };
}

export function toProject(project: ApiProject): ProjectSummary {
  return {
    slug: project.slug,
    name: project.name,
    description: project.description,
    technologies: [...project.technologies],
    stage: project.stage,
    featured: project.featured,
    links: project.links.map(({ label, href }) =>
      href === undefined ? { label } : { label, href },
    ),
    uri: projectUri(project.slug),
  };
}
