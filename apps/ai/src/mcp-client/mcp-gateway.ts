import type { ToolDefinition } from '../llm/llm.types.js';

/** What a tool call produced: text for the model, plus the structured output if any. */
export interface ToolOutcome {
  text: string;
  isError: boolean;
  structured?: Record<string, unknown>;
}

/** An open connection to the MCP server, for one chat request. */
export interface McpToolSession {
  readonly tools: readonly ToolDefinition[];
  callTool(
    name: string,
    input: Record<string, unknown>,
    signal: AbortSignal,
  ): Promise<ToolOutcome>;
  close(): Promise<void>;
}

/** The MCP server can't be reached. Its message is safe to log, not to show. */
export class McpUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'McpUnavailableError';
  }
}

/**
 * Access to the While Building MCP server's tools (an abstract class so it
 * doubles as the DI token).
 */
export abstract class McpGateway {
  /** Connects and discovers the tools. Rejects with McpUnavailableError. */
  abstract connect(signal: AbortSignal): Promise<McpToolSession>;
}
