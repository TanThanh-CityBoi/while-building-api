/** Every LLM provider the app has an adapter for (src/llm/<provider>/). */
export const LLM_PROVIDERS = ['anthropic', 'openai', 'gemini'] as const;
export type LlmProviderId = (typeof LLM_PROVIDERS)[number];

export interface ModelInfo {
  /** The provider's model id, sent as-is to its API. */
  id: string;
  /** Shown in the CMS. */
  label: string;
  /** Reasons before answering (some adapters configure such models differently). */
  reasoning: boolean;
}

export interface ProviderInfo {
  label: string;
  /** Supported models, in the order offered by default; the first is the default. */
  models: readonly ModelInfo[];
}

/**
 * The providers and models the app supports. A model is listed only once its
 * request shape is known to work with the provider's adapter; environment
 * variables (`AI_<PROVIDER>_MODELS`) only choose among these.
 *
 * Adding a model: one line here. Adding a provider: an entry here, an adapter
 * under src/llm/<provider>/, a factory in LlmModule and its API key in the
 * environment schema.
 */
export const MODEL_CATALOG: Record<LlmProviderId, ProviderInfo> = {
  anthropic: {
    label: 'Anthropic',
    models: [
      // Both accept the adapter's request shape: adaptive thinking, effort,
      // server-side fallbacks.
      { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', reasoning: true },
      { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', reasoning: true },
    ],
  },
  openai: {
    label: 'OpenAI',
    models: [
      // Reasoning models on the Responses API (function tools, streaming).
      { id: 'gpt-5.5', label: 'GPT-5.5', reasoning: true },
      { id: 'gpt-5.4-mini', label: 'GPT-5.4 mini', reasoning: true },
    ],
  },
  gemini: {
    label: 'Google Gemini',
    models: [
      // Google's aliases for its latest Pro / Flash models (thinking, function
      // calling). They move with Google's releases; add a numbered model here to pin one.
      {
        id: 'gemini-pro-latest',
        label: 'Gemini Pro (latest)',
        reasoning: true,
      },
      {
        id: 'gemini-flash-latest',
        label: 'Gemini Flash (latest)',
        reasoning: true,
      },
      {
        id: 'gemini-3.8-flash',
        label: 'Gemini 3.8 Flash',
        reasoning: true,
      },
    ],
  },
};

export function isLlmProviderId(value: string): value is LlmProviderId {
  return (LLM_PROVIDERS as readonly string[]).includes(value);
}

export function findModel(
  provider: LlmProviderId,
  modelId: string,
): ModelInfo | undefined {
  return MODEL_CATALOG[provider].models.find((model) => model.id === modelId);
}

/** `AI_ANTHROPIC_MODELS`, … */
export function modelsEnvKey(provider: LlmProviderId): string {
  return `AI_${provider.toUpperCase()}_MODELS`;
}
