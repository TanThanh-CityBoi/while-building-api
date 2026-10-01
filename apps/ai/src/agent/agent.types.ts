// The chat stream contract, sent to the CMS as server-sent events (one event
// per object, `event:` = `type`). Mirrored by `ChatStreamEvent` in
// while-building-web's packages/types. Every stream ends with exactly one
// `done` or `error`.

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Content the answer drew on, from the tools' results. */
export interface ChatSource {
  kind: 'article' | 'project';
  slug: string;
  title: string;
  /** MCP resource URI, e.g. `article://my-first-k3s-cluster`. */
  uri: string;
}

export type ChatErrorCode =
  'unavailable' | 'rate_limited' | 'refused' | 'timeout' | 'internal';

export type AgentEvent =
  /** `thinking`: waiting for the model; `tool_start` / `tool_end`: a lookup. */
  | {
      type: 'status';
      phase: 'thinking' | 'tool_start' | 'tool_end';
      tool?: string;
      /** On `tool_end`: whether the tool succeeded. */
      ok?: boolean;
    }
  | { type: 'text'; delta: string }
  | { type: 'sources'; sources: ChatSource[] }
  | { type: 'error'; code: ChatErrorCode; message: string }
  | { type: 'done' };

export interface AgentInput {
  /** The conversation so far, oldest first; the last message is the user's question. */
  messages: ChatMessage[];
  /** For logs only. */
  userId: string;
}
