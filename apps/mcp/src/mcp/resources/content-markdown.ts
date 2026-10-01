import type {
  ApiArticle,
  ApiProject,
} from '../../content-api/content-api.types.js';

// Renders content as Markdown for MCP resources: compact metadata an LLM can
// use as context, followed by the content itself.

const day = (iso: string | null) => (iso ? iso.slice(0, 10) : 'unpublished');

export function articleMarkdown(article: ApiArticle): string {
  const frontMatter = [
    '---',
    `title: ${JSON.stringify(article.title)}`,
    `description: ${JSON.stringify(article.description)}`,
    `category: ${JSON.stringify(article.category)}`,
    `published: ${day(article.publishedAt)}`,
    `reading_time_minutes: ${article.readingTimeMinutes}`,
    '---',
  ].join('\n');
  const body =
    article.body?.trim() || `# ${article.title}\n\n${article.description}`;
  return `${frontMatter}\n\n${body}\n`;
}

export function projectMarkdown(project: ApiProject): string {
  const links = project.links.map((link) =>
    link.href
      ? `[${link.label}](${link.href})`
      : `${link.label} (not available yet)`,
  );
  return [
    `# ${project.name}`,
    '',
    project.description,
    '',
    `- Stage: ${project.stage ?? 'unspecified'}`,
    `- Featured: ${project.featured ? 'yes' : 'no'}`,
    `- Technologies: ${project.technologies.join(', ') || 'none listed'}`,
    `- Links: ${links.join(', ') || 'none'}`,
    '',
  ].join('\n');
}
