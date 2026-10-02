/** Values the Responses API accepts for `reasoning.effort` (support varies by model). */
export const OPENAI_REASONING_EFFORTS = [
  'none',
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
] as const;
export type OpenAIReasoningEffort = (typeof OPENAI_REASONING_EFFORTS)[number];

export interface OpenAISettings {
  maxOutputTokens: number;
  /** Unset: the model's default effort. */
  reasoningEffort?: OpenAIReasoningEffort;
}
