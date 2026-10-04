// Turns an article's content (a BlockNote block document, as the API returns
// it) into Markdown, the format LLMs read best. Lossy on purpose: colours,
// alignment and unknown block types are reduced to their text.

interface Block {
  type?: unknown;
  props?: Record<string, unknown>;
  content?: unknown;
  children?: unknown;
}

const LIST_PREFIX: Partial<
  Record<string, (block: Block, index: number) => string>
> = {
  bulletListItem: () => '- ',
  numberedListItem: (_, index) => `${index + 1}. `,
  checkListItem: (block) =>
    block.props?.checked === true ? '- [x] ' : '- [ ] ',
};

export function blocksToMarkdown(content: unknown): string {
  return renderBlocks(asBlocks(content), '').trim();
}

function renderBlocks(blocks: Block[], indent: string): string {
  let output = '';
  let listIndex = 0;
  let previousType: unknown;

  for (const block of blocks) {
    const type = typeof block.type === 'string' ? block.type : '';
    const list = LIST_PREFIX[type];
    listIndex = type === previousType ? listIndex + 1 : 0;
    // Consecutive list items stay together; everything else is a paragraph.
    const separator =
      output === '' ? '' : list && type === previousType ? '\n' : '\n\n';
    previousType = type;

    const text = list
      ? `${indent}${list(block, listIndex)}${inline(block.content)}`
      : `${indent}${renderBlock(type, block)}`;
    const children = asBlocks(block.children);
    const nested = children.length
      ? `\n${renderBlocks(children, `${indent}  `)}`
      : '';
    output += separator + text + nested;
  }
  return output;
}

function renderBlock(type: string, block: Block): string {
  const props = block.props ?? {};
  switch (type) {
    case 'heading': {
      const level = Math.min(Math.max(Number(props.level) || 1, 1), 6);
      return `${'#'.repeat(level)} ${inline(block.content)}`;
    }
    case 'quote':
      return `> ${inline(block.content)}`;
    case 'codeBlock': {
      const language = typeof props.language === 'string' ? props.language : '';
      const code = plain(block.content);
      return `\`\`\`${language === 'text' ? '' : language}\n${code}\n\`\`\``;
    }
    case 'divider':
      return '---';
    case 'image': {
      const url = typeof props.url === 'string' ? props.url : '';
      const caption = typeof props.caption === 'string' ? props.caption : '';
      return url ? `![${caption}](${url})` : caption;
    }
    default:
      return inline(block.content);
  }
}

/** Text runs with their styles, and links. */
function inline(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((node: unknown) => {
      if (typeof node !== 'object' || node === null) return '';
      const run = node as {
        type?: unknown;
        text?: unknown;
        href?: unknown;
        content?: unknown;
        styles?: Record<string, unknown>;
      };
      if (run.type === 'link') {
        return `[${inline(run.content)}](${typeof run.href === 'string' ? run.href : ''})`;
      }
      if (typeof run.text !== 'string') return inline(run.content);
      return styled(run.text, run.styles ?? {});
    })
    .join('');
}

function styled(text: string, styles: Record<string, unknown>): string {
  if (text.trim() === '') return text;
  if (styles.code === true) return `\`${text}\``;
  let result = text;
  if (styles.bold === true) result = `**${result}**`;
  if (styles.italic === true) result = `_${result}_`;
  if (styles.strike === true) result = `~~${result}~~`;
  return result;
}

/** Text without Markdown styling (for code blocks). */
function plain(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((node: unknown) =>
      typeof node === 'object' && node !== null && 'text' in node
        ? String(node.text)
        : '',
    )
    .join('');
}

function asBlocks(value: unknown): Block[] {
  return Array.isArray(value)
    ? value.filter(
        (block): block is Block => typeof block === 'object' && block !== null,
      )
    : [];
}
