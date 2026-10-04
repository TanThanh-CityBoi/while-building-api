import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Client,
  StreamableHTTPClientTransport,
  type CallToolResult,
  type Tool,
  type Transport,
} from '@modelcontextprotocol/client';
import type { EnvironmentVariables } from '../config/env.validation.js';
import type { ToolDefinition } from '../llm/llm.types.js';
import {
  McpGateway,
  McpUnavailableError,
  type McpToolSession,
  type ToolOutcome,
} from './mcp-gateway.js';

const CLIENT_INFO = { name: 'while-building-ai', version: '0.1.0' };

/** Tool output larger than this is cut (with a note) before it reaches the model. */
export const MAX_TOOL_OUTPUT_CHARS = 30_000;

/**
 * McpGateway over the MCP server's Streamable HTTP endpoint. One connection
 * per chat request: the server is stateless and the connection is cheap next
 * to the LLM calls.
 */
@Injectable()
export class McpClientService extends McpGateway {
  private readonly url: URL;
  private readonly timeoutMs: number;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    super();
    this.url = new URL(config.get('MCP_URL', { infer: true }));
    this.timeoutMs = config.get('AI_TOOL_TIMEOUT', { infer: true }) * 1000;
  }

  async connect(signal: AbortSignal): Promise<McpToolSession> {
    const client = new Client(CLIENT_INFO);
    try {
      await client.connect(this.createTransport(), {
        timeout: this.timeoutMs,
        signal,
      });
      const tools: Tool[] = [];
      let cursor: string | undefined;
      do {
        const page = await client.listTools(cursor ? { cursor } : undefined, {
          timeout: this.timeoutMs,
          signal,
        });
        tools.push(...page.tools);
        cursor = page.nextCursor;
      } while (cursor);
      return new ClientToolSession(
        client,
        tools.map(toDefinition),
        this.timeoutMs,
      );
    } catch (error) {
      await client.close().catch(() => undefined);
      if (signal.aborted) throw error;
      throw new McpUnavailableError(
        `Cannot connect to the MCP server at ${this.url.origin}: ${describe(error)}`,
        { cause: error },
      );
    }
  }

  /** Overridable for tests (e.g. an in-memory transport). */
  protected createTransport(): Transport {
    return new StreamableHTTPClientTransport(this.url);
  }
}

class ClientToolSession implements McpToolSession {
  constructor(
    private readonly client: Client,
    readonly tools: readonly ToolDefinition[],
    private readonly timeoutMs: number,
  ) {}

  async callTool(
    name: string,
    input: Record<string, unknown>,
    signal: AbortSignal,
  ): Promise<ToolOutcome> {
    try {
      const result = await this.client.callTool(
        { name, arguments: input },
        { timeout: this.timeoutMs, signal },
      );
      return toOutcome(result);
    } catch (error) {
      if (signal.aborted) throw error;
      // Unknown tool, timeout, transport failure: the model sees a generic error.
      return {
        text: `The ${name} tool failed (${describe(error)}). Try something else or answer without it.`,
        isError: true,
      };
    }
  }

  async close(): Promise<void> {
    await this.client.close().catch(() => undefined);
  }
}

function toDefinition(tool: Tool): ToolDefinition {
  return {
    name: tool.name,
    description: tool.description ?? tool.title ?? tool.name,
    inputSchema: tool.inputSchema,
  };
}

function toOutcome(result: CallToolResult): ToolOutcome {
  const text = result.content
    .flatMap((block) => (block.type === 'text' ? [block.text] : []))
    .join('\n');
  return {
    text:
      text.length > MAX_TOOL_OUTPUT_CHARS
        ? `${text.slice(0, MAX_TOOL_OUTPUT_CHARS)}\n[Output truncated: ${text.length} characters in total.]`
        : text,
    isError: result.isError === true,
    structured: isRecord(result.structuredContent)
      ? result.structuredContent
      : undefined,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
