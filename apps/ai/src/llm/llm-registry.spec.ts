import { describe, expect, it } from 'vitest';
import { FakeLlmProvider } from '../../test/fakes/fake-llm-provider.js';
import { LlmRegistry, ModelSelectionError } from './llm-registry.js';

describe('LlmRegistry', () => {
  const anthropic = new FakeLlmProvider();
  const registry = new LlmRegistry(
    new Map([['anthropic', anthropic]]),
    { anthropic: ['claude-sonnet-5-5', 'claude-opus-5-5'] },
    'anthropic',
  );

  it('lists the enabled providers with their allowed models, first as default', () => {
    expect(registry.options()).toEqual({
      defaultProvider: 'anthropic',
      providers: [
        {
          id: 'anthropic',
          label: 'Anthropic',
          defaultModel: 'claude-sonnet-5-5',
          models: [
            { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5' },
            { id: 'claude-opus-5-5', label: 'Claude Opus 5.5' },
          ],
        },
      ],
    });
  });

  it('falls back to the default provider and model', () => {
    expect(registry.resolve()).toEqual({
      provider: 'anthropic',
      model: 'claude-sonnet-5-5',
    });
    expect(registry.resolve({ model: 'claude-opus-5-5' })).toEqual({
      provider: 'anthropic',
      model: 'claude-opus-5-5',
    });
    expect(registry.resolve({ provider: 'anthropic' })).toEqual({
      provider: 'anthropic',
      model: 'claude-sonnet-5-5',
    });
  });

  it.each([
    [
      { provider: 'mistral' },
      'Unknown or unavailable provider "mistral". Available: anthropic.',
    ],
    [
      { provider: 'anthropic', model: 'claude-haiku-4-5' },
      'Model "claude-haiku-4-5" is not available for anthropic. Available: claude-sonnet-5-5, claude-opus-5-5.',
    ],
    [
      { model: 'gpt-5.5' },
      'Model "gpt-5.5" is not available for anthropic. Available: claude-sonnet-5-5, claude-opus-5-5.',
    ],
  ])('rejects %j', (choice, message) => {
    expect(() => registry.resolve(choice)).toThrow(
      new ModelSelectionError(message),
    );
  });

  it('only allows configured models that exist in the catalog', () => {
    const narrow = new LlmRegistry(
      new Map([['anthropic', anthropic]]),
      { anthropic: ['claude-opus-5-5'] },
      'anthropic',
    );
    expect(() => narrow.resolve({ model: 'claude-sonnet-5-5' })).toThrow(
      ModelSelectionError,
    );
  });

  it('returns the adapter of an enabled provider', () => {
    expect(registry.get('anthropic')).toBe(anthropic);
  });

  it('refuses an inconsistent configuration', () => {
    expect(
      () =>
        new LlmRegistry(new Map([['anthropic', anthropic]]), {}, 'anthropic'),
    ).toThrow('No models configured for anthropic');
  });
});
