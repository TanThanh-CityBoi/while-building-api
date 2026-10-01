import { Logger } from '@nestjs/common';
import type { CallToolResult } from '@modelcontextprotocol/server';
import { ContentApiUnavailableError } from '../../content-api/content-api.js';

const logger = new Logger('McpTools');

const UNAVAILABLE =
  'While Building content is temporarily unavailable. Try again later.';

/** A successful result: the structured output, also as JSON text for clients without structured output. */
export function ok(structured: Record<string, unknown>): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(structured) }],
    structuredContent: structured,
  };
}

/** An expected failure the model should see and can react to (e.g. "not found"). */
export function fail(message: string): CallToolResult {
  return { isError: true, content: [{ type: 'text', text: message }] };
}

/**
 * Runs a tool body. The SDK would copy a thrown error's message into the
 * result, so every failure is caught here: logged in full, answered generically.
 */
export async function runTool(
  name: string,
  body: () => Promise<CallToolResult>,
): Promise<CallToolResult> {
  try {
    return await body();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    if (error instanceof ContentApiUnavailableError) {
      logger.warn(`${name}: ${detail}`);
    } else {
      logger.error(`${name} failed unexpectedly: ${detail}`);
    }
    return fail(UNAVAILABLE);
  }
}
