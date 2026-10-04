/**
 * - `unavailable`: the provider can't be reached, is overloaded or misconfigured;
 * - `rate_limited`: too many requests for now;
 * - `rejected`: the provider refused the request itself (a bug on our side).
 */
export type LlmErrorKind = 'unavailable' | 'rate_limited' | 'rejected';

/** An LLM failure, independent of the provider. Its message is safe to log, not to show. */
export class LlmError extends Error {
  constructor(
    readonly kind: LlmErrorKind,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'LlmError';
  }
}
