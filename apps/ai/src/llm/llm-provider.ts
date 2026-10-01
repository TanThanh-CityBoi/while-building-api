import type { LlmEvent, LlmTurnRequest } from './llm.types.js';

/**
 * One model turn, streamed (an abstract class so it doubles as the DI token).
 * Implementations yield `text` deltas as they arrive and finish with exactly
 * one `turn_end`. They throw LlmError on provider failures and rethrow
 * cancellation (the signal's abort) as-is. Provider-specific code stays in
 * the implementation; the agent only sees these types.
 */
export abstract class LlmProvider {
  abstract streamTurn(
    request: LlmTurnRequest,
    signal: AbortSignal,
  ): AsyncIterable<LlmEvent>;
}
