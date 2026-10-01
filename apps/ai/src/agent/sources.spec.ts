import { describe, expect, it } from 'vitest';
import { sourcesFrom } from './sources.js';

describe('sourcesFrom', () => {
  it('finds articles and projects anywhere in a tool output', () => {
    expect(
      sourcesFrom({
        articles: [
          { slug: 'a-b', title: 'A B', uri: 'article://a-b' },
          { slug: 'c', title: 'C', uri: 'article://c' },
        ],
        project: { name: 'P', uri: 'project://p' },
        total: 2,
      }),
    ).toEqual([
      { kind: 'article', slug: 'a-b', title: 'A B', uri: 'article://a-b' },
      { kind: 'article', slug: 'c', title: 'C', uri: 'article://c' },
      { kind: 'project', slug: 'p', title: 'P', uri: 'project://p' },
    ]);
  });

  it('ignores anything that is not a While Building resource with a title', () => {
    expect(
      sourcesFrom({
        a: { uri: 'https://example.com', title: 'x' },
        b: { uri: 'article://no-title' },
        c: { uri: 'article://Bad_Slug', title: 'x' },
      }),
    ).toEqual([]);
    expect(sourcesFrom(undefined)).toEqual([]);
    expect(sourcesFrom('article://x')).toEqual([]);
  });
});
