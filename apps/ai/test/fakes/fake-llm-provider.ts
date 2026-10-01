import { LlmProvider } from '../../src/llm/llm-provider.js';
import type {
  ConversationItem,
  LlmEvent,
  LlmStopReason,
  LlmTurnRequest,
  ToolCall,
} from '../../src/llm/llm.types.js';

export interface ScriptedTurn {
  /** Text deltas, streamed in order. */
  text?: string[];
  toolCalls?: ToolCall[];
  /** Defaults to `tool_use` when there are tool calls, else `end`. */
  stopReason?: LlmStopReason;
  /** Stream the text, then hang until the request is aborted. */
  hang?: boolean;
}

/** A recorded request; the conversation is copied (the agent keeps appending to its own). */
export type RecordedRequest = Omit<LlmTurnRequest, 'conversation'> & {
  conversation: ConversationItem[];
};

/** LlmProvider for tests: plays scripted turns (or throws scripted errors) in order. */
export class FakeLlmProvider extends LlmProvider {
  readonly requests: RecordedRequest[] = [];

  constructor(private readonly turns: Array<ScriptedTurn | Error> = []) {
    super();
  }

  /** Queues more turns (for a provider shared across tests). */
  enqueue(...turns: Array<ScriptedTurn | Error>): void {
    this.turns.push(...turns);
  }

  reset(): void {
    this.turns.length = 0;
    this.requests.length = 0;
  }

  async *streamTurn(
    request: LlmTurnRequest,
    signal: AbortSignal,
  ): AsyncIterable<LlmEvent> {
    this.requests.push({ ...request, conversation: [...request.conversation] });
    const turn = this.turns.shift() ?? { text: ['(no scripted turn left)'] };
    if (turn instanceof Error) throw turn;

    for (const delta of turn.text ?? []) {
      signal.throwIfAborted();
      await Promise.resolve();
      yield { type: 'text', delta };
    }
    if (turn.hang) {
      await new Promise((_, reject) => {
        if (signal.aborted) reject(signal.reason as Error);
        signal.addEventListener('abort', () => reject(signal.reason as Error));
      });
    }
    const toolCalls = turn.toolCalls ?? [];
    yield {
      type: 'turn_end',
      stopReason:
        turn.stopReason ?? (toolCalls.length > 0 ? 'tool_use' : 'end'),
      assistant: {
        role: 'assistant',
        text: (turn.text ?? []).join(''),
        toolCalls,
        providerContent: { fake: true },
      },
      usage: { inputTokens: 100, outputTokens: 10 },
      model: 'fake-model',
    };
  }
}

export function call(
  id: string,
  name: string,
  input: Record<string, unknown> = {},
): ToolCall {
  return { id, name, input };
}
