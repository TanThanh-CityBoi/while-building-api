import { InvalidArticleContentError } from '../errors/article.errors.js';

/**
 * One block of an article: a paragraph, heading, list item, image… The editor
 * (BlockNote in the CMS) decides the block types and their fields; the domain
 * only relies on this generic shape.
 */
export interface ContentBlock {
  type: string;
  /** Inline content (text runs, links) or block-specific data. */
  content?: unknown;
  /** Nested blocks, e.g. the items under a list item. */
  children?: ContentBlock[];
  [field: string]: unknown;
}

/** Deep enough for any real document; stops pathological nesting. */
const MAX_DEPTH = 32;
const WORDS_PER_MINUTE = 200;

/**
 * An article's body: a block document, stored as JSON exactly as the editor
 * produced it. The domain never converts it to another format; it only reads
 * the text in it (to tell a written article from an empty one, and to estimate
 * the reading time).
 */
export class ArticleContent {
  private constructor(readonly blocks: readonly ContentBlock[]) {}

  static create(raw: unknown): ArticleContent {
    if (!isBlockList(raw, 0)) throw new InvalidArticleContentError();
    return new ArticleContent(raw);
  }

  static empty(): ArticleContent {
    return new ArticleContent([]);
  }

  /** Rehydrates stored content; anything that isn't a block list reads as empty. */
  static restore(raw: unknown): ArticleContent {
    return isBlockList(raw, 0)
      ? new ArticleContent(raw)
      : ArticleContent.empty();
  }

  /** The document's text, one line per block. */
  plainText(): string {
    const lines: string[] = [];
    const visit = (blocks: readonly ContentBlock[]): void => {
      for (const block of blocks) {
        lines.push(textOf(block.content).trim());
        if (block.children) visit(block.children);
      }
    };
    visit(this.blocks);
    return lines.filter(Boolean).join('\n');
  }

  /** Nothing to read: no blocks, or only blocks without text. */
  get isEmpty(): boolean {
    return this.plainText().length === 0;
  }

  get wordCount(): number {
    return this.plainText().split(/\s+/).filter(Boolean).length;
  }

  /** Whole minutes at an average reading speed; at least 1 for a written article. */
  get readingTimeMinutes(): number {
    const words = this.wordCount;
    return words === 0 ? 0 : Math.max(1, Math.round(words / WORDS_PER_MINUTE));
  }
}

function isBlockList(value: unknown, depth: number): value is ContentBlock[] {
  return (
    Array.isArray(value) &&
    depth < MAX_DEPTH &&
    value.every((block) => isBlock(block, depth))
  );
}

function isBlock(value: unknown, depth: number): value is ContentBlock {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const block = value as Record<string, unknown>;
  return (
    typeof block.type === 'string' &&
    block.type.length > 0 &&
    (block.children === undefined || isBlockList(block.children, depth + 1))
  );
}

/** The `text` of every text run inside a block's content (including inside links). */
function textOf(node: unknown): string {
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (typeof node !== 'object' || node === null) return '';
  const record = node as Record<string, unknown>;
  if (typeof record.text === 'string') return record.text;
  return Object.entries(record)
    .filter(([key]) => key !== 'props' && key !== 'styles')
    .map(([, value]) => textOf(value))
    .join('');
}
