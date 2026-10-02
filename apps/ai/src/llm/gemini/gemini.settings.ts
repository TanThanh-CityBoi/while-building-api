/** Values for Gemini's `thinkingConfig.thinkingLevel` (support varies by model). */
export const GEMINI_THINKING_LEVELS = [
  'minimal',
  'low',
  'medium',
  'high',
] as const;
export type GeminiThinkingLevel = (typeof GEMINI_THINKING_LEVELS)[number];

export interface GeminiSettings {
  maxOutputTokens: number;
  /** Unset: the model's default (dynamic) thinking. */
  thinkingLevel?: GeminiThinkingLevel;
}
