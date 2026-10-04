import { describe, expect, it } from 'vitest';
import { InvalidArticleContentError } from '../errors/article.errors.js';
import { ArticleContent } from './article-content.js';

const text = (value: string, styles = {}) => ({
  type: 'text',
  text: value,
  styles,
});

describe('ArticleContent', () => {
  it('reads the text of blocks, links and nested blocks', () => {
    const content = ArticleContent.create([
      { type: 'heading', props: { level: 2 }, content: [text('Backups')] },
      {
        type: 'paragraph',
        content: [
          text('Run '),
          text('pg_dump', { code: true }),
          text(' nightly, see '),
          { type: 'link', href: 'https://x.dev', content: [text('the docs')] },
        ],
      },
      {
        type: 'bulletListItem',
        content: [text('Parent')],
        children: [{ type: 'bulletListItem', content: [text('Child')] }],
      },
    ]);

    expect(content.plainText()).toBe(
      'Backups\nRun pg_dump nightly, see the docs\nParent\nChild',
    );
    expect(content.wordCount).toBe(9);
    expect(content.isEmpty).toBe(false);
  });

  it('treats blocks without text as empty', () => {
    const content = ArticleContent.create([
      { type: 'paragraph', content: [] },
      { type: 'divider' },
      { type: 'image', props: { url: 'https://x.dev/a.png' } },
    ]);
    expect(content.isEmpty).toBe(true);
    expect(content.readingTimeMinutes).toBe(0);
  });

  it('estimates reading time at 200 words a minute, at least one', () => {
    const words = (n: number) =>
      ArticleContent.create([
        { type: 'paragraph', content: [text('word '.repeat(n))] },
      ]);
    expect(words(10).readingTimeMinutes).toBe(1);
    expect(words(1000).readingTimeMinutes).toBe(5);
  });

  it.each([
    ['not a list', { type: 'paragraph' }],
    ['a block without type', [{ content: [] }]],
    ['a non-object block', ['text']],
    ['invalid children', [{ type: 'paragraph', children: 'nope' }]],
  ])('rejects %s', (_, raw) => {
    expect(() => ArticleContent.create(raw)).toThrow(
      InvalidArticleContentError,
    );
  });

  it('rejects pathologically deep nesting', () => {
    let block: Record<string, unknown> = { type: 'paragraph' };
    for (let i = 0; i < 40; i += 1)
      block = { type: 'paragraph', children: [block] };
    expect(() => ArticleContent.create([block])).toThrow(
      InvalidArticleContentError,
    );
  });

  it('restores anything malformed as empty', () => {
    expect(ArticleContent.restore('oops').blocks).toEqual([]);
  });
});
