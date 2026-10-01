import type { ChatSource } from './agent.types.js';

const RESOURCE_URI = /^(article|project):\/\/([a-z0-9]+(?:-[a-z0-9]+)*)$/;

/**
 * Finds the content items in a tool's structured output: objects with a
 * While Building resource `uri` and a `title` (articles) or `name` (projects).
 */
export function sourcesFrom(structured: unknown, depth = 0): ChatSource[] {
  if (depth > 3 || typeof structured !== 'object' || structured === null) {
    return [];
  }
  if (Array.isArray(structured)) {
    return structured.flatMap((item) => sourcesFrom(item, depth + 1));
  }
  const record = structured as Record<string, unknown>;
  const match =
    typeof record.uri === 'string' ? RESOURCE_URI.exec(record.uri) : null;
  const title =
    typeof record.title === 'string'
      ? record.title
      : typeof record.name === 'string'
        ? record.name
        : undefined;
  if (match && title) {
    return [
      {
        kind: match[1] as ChatSource['kind'],
        slug: match[2],
        title,
        uri: record.uri as string,
      },
    ];
  }
  return Object.values(record).flatMap((value) =>
    sourcesFrom(value, depth + 1),
  );
}
