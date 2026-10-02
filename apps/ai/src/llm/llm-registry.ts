import type { LlmProvider } from './llm-provider.js';
import {
  isLlmProviderId,
  MODEL_CATALOG,
  type LlmProviderId,
  type ModelInfo,
} from './model-catalog.js';

/** A validated choice of provider and model for one chat request. */
export interface ModelSelection {
  provider: LlmProviderId;
  model: string;
}

/** What the CMS may offer: enabled providers and their allowed models. */
export interface ModelOptions {
  defaultProvider: LlmProviderId;
  providers: Array<{
    id: LlmProviderId;
    label: string;
    defaultModel: string;
    models: Array<{ id: string; label: string }>;
  }>;
}

/** An invalid provider/model choice. Its message is safe to show. */
export class ModelSelectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModelSelectionError';
  }
}

/**
 * The enabled LLM providers and the models each may use (configured subsets
 * of MODEL_CATALOG, first = default). The single place that turns an
 * untrusted `{ provider, model }` from a client into a valid selection.
 */
export class LlmRegistry {
  constructor(
    private readonly providers: ReadonlyMap<LlmProviderId, LlmProvider>,
    private readonly models: Readonly<
      Partial<Record<LlmProviderId, readonly string[]>>
    >,
    private readonly defaultProvider: LlmProviderId,
  ) {
    for (const id of providers.keys()) {
      if (!models[id]?.length)
        throw new Error(`No models configured for ${id}`);
    }
    if (!providers.has(defaultProvider)) {
      throw new Error(`The default provider ${defaultProvider} is not enabled`);
    }
  }

  options(): ModelOptions {
    return {
      defaultProvider: this.defaultProvider,
      providers: [...this.providers.keys()].map((id) => {
        const allowed = this.allowedModels(id);
        return {
          id,
          label: MODEL_CATALOG[id].label,
          defaultModel: allowed[0].id,
          models: allowed.map(({ id: modelId, label }) => ({
            id: modelId,
            label,
          })),
        };
      }),
    };
  }

  /** Validates a client's choice; missing parts fall back to the defaults. */
  resolve(choice: { provider?: string; model?: string } = {}): ModelSelection {
    const providerId = choice.provider ?? this.defaultProvider;
    if (!isLlmProviderId(providerId) || !this.providers.has(providerId)) {
      throw new ModelSelectionError(
        `Unknown or unavailable provider "${providerId}". Available: ${[...this.providers.keys()].join(', ')}.`,
      );
    }
    const allowed = this.allowedModels(providerId);
    const model = choice.model ?? allowed[0].id;
    if (!allowed.some((candidate) => candidate.id === model)) {
      throw new ModelSelectionError(
        `Model "${model}" is not available for ${providerId}. Available: ${allowed.map((m) => m.id).join(', ')}.`,
      );
    }
    return { provider: providerId, model };
  }

  /** The adapter of an enabled provider (selections come from `resolve`). */
  get(provider: LlmProviderId): LlmProvider {
    const adapter = this.providers.get(provider);
    if (!adapter) throw new Error(`Provider ${provider} is not enabled`);
    return adapter;
  }

  private allowedModels(provider: LlmProviderId): ModelInfo[] {
    const ids = this.models[provider] ?? [];
    return ids.flatMap((id) => {
      const model = MODEL_CATALOG[provider].models.find((m) => m.id === id);
      return model ? [model] : [];
    });
  }
}
