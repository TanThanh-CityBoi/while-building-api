import { describe, expect, it } from 'vitest';
import { blocksToMarkdown } from './blocks-markdown.js';

const text = (value: string, styles: Record<string, boolean> = {}) => ({
  type: 'text',
  text: value,
  styles,
});

describe('blocksToMarkdown', () => {
  it('renders headings, paragraphs, styles and links', () => {
    expect(
      blocksToMarkdown([
        { type: 'heading', props: { level: 2 }, content: [text('Backups')] },
        {
          type: 'paragraph',
          content: [
            text('Run '),
            text('pg_dump', { code: true }),
            text(' '),
            text('nightly', { bold: true }),
            text(', see '),
            {
              type: 'link',
              href: 'https://www.postgresql.org/docs/',
              content: [text('the docs', { italic: true })],
            },
            text('.'),
          ],
        },
      ]),
    ).toBe(
      '## Backups\n\nRun `pg_dump` **nightly**, see [_the docs_](https://www.postgresql.org/docs/).',
    );
  });

  it('keeps list items together, numbers them and nests children', () => {
    expect(
      blocksToMarkdown([
        { type: 'paragraph', content: [text('Lessons:')] },
        {
          type: 'numberedListItem',
          content: [text('Set requests')],
          children: [
            { type: 'bulletListItem', content: [text('memory first')] },
          ],
        },
        { type: 'numberedListItem', content: [text('Use a pooler')] },
        {
          type: 'checkListItem',
          props: { checked: true },
          content: [text('Backups')],
        },
        {
          type: 'checkListItem',
          props: { checked: false },
          content: [text('Restores')],
        },
      ]),
    ).toBe(
      [
        'Lessons:',
        '',
        '1. Set requests',
        '  - memory first',
        '2. Use a pooler',
        '',
        '- [x] Backups',
        '- [ ] Restores',
      ].join('\n'),
    );
  });

  it('renders quotes, code, dividers and images', () => {
    expect(
      blocksToMarkdown([
        { type: 'quote', content: [text('Ship it.')] },
        {
          type: 'codeBlock',
          props: { language: 'bash' },
          content: [text('kubectl get pods\nkubectl logs x')],
        },
        { type: 'divider' },
        {
          type: 'image',
          props: { url: 'https://x.dev/a.png', caption: 'The rack' },
        },
      ]),
    ).toBe(
      '> Ship it.\n\n```bash\nkubectl get pods\nkubectl logs x\n```\n\n---\n\n![The rack](https://x.dev/a.png)',
    );
  });

  it('tolerates malformed content', () => {
    expect(blocksToMarkdown(null)).toBe('');
    expect(blocksToMarkdown([null, 'x', { type: 'paragraph' }])).toBe('');
  });
});
