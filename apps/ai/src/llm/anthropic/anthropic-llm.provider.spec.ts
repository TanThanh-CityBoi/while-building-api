import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import { LlmError } from '../llm.errors.js';
import type { LlmEvent, LlmTurnRequest } from '../llm.types.js';
import { AnthropicLlmProvider } from './anthropic-llm.provider.js';

const sse = (events: object[]) =>
  events
    .map(
      (event) =>
        `event: ${(event as { type: string }).type}\ndata: ${JSON.stringify(event)}\n\n`,
    )
    .join('');

/** A streamed turn: some text, then one tool call. */
const TOOL_TURN = sse([
  {
    type: 'message_start',
    message: {
      id: 'msg_1',
      type: 'message',
      role: 'assistant',
      model: 'claude-opus-5-5',
      content: [],
      stop_reason: null,
      stop_sequence: null,
      usage: { input_tokens: 120, output_tokens: 1 },
    },
  },
  {
    type: 'content_block_start',
    index: 0,
    content_block: { type: 'text', text: '' },
  },
  {
    type: 'content_block_delta',
    index: 0,
    delta: { type: 'text_delta', text: 'Let me ' },
  },
  {
    type: 'content_block_delta',
    index: 0,
    delta: { type: 'text_delta', text: 'look.' },
  },
  { type: 'content_block_stop', index: 0 },
  {
    type: 'content_block_start',
    index: 1,
    content_block: {
      type: 'tool_use',
      id: 'toolu_1',
      name: 'search_articles',
      input: {},
    },
  },
  {
    type: 'content_block_delta',
    index: 1,
    delta: { type: 'input_json_delta', partial_json: '{"query": "k3s"}' },
  },
  { type: 'content_block_stop', index: 1 },
  {
    type: 'message_delta',
    delta: { stop_reason: 'tool_use', stop_sequence: null },
    usage: { output_tokens: 42 },
  },
  { type: 'message_stop' },
]);

interface Captured {
  url: string;
  headers: Headers;
  body: Record<string, unknown>;
}

function providerReturning(response: () => Response | Promise<Response>) {
  const requests: Captured[] = [];
  const client = new Anthropic({
    apiKey: 'test-key',
    maxRetries: 0,
    fetch: async (url, init) => {
      requests.push({
        url: url instanceof Request ? url.url : url.toString(),
        headers: new Headers(init?.headers),
        // The SDK always sends a JSON string body.
        body: JSON.parse(init?.body as string) as Record<string, unknown>,
      });
      return response();
    },
  });
  const provider = new AnthropicLlmProvider(client, {
    model: 'claude-opus-5-5',
    effort: 'medium',
    maxOutputTokens: 64_000,
  });
  return { provider, requests };
}

const request: LlmTurnRequest = {
  system: 'You are a test.',
  conversation: [{ role: 'user', text: 'Any k3s articles?' }],
  tools: [
    {
      name: 'search_articles',
      description: 'Search.',
      inputSchema: {
        type: 'object',
        properties: { query: { type: 'string' } },
      },
    },
  ],
};

async function run(
  provider: AnthropicLlmProvider,
  turn = request,
  signal = new AbortController().signal,
): Promise<LlmEvent[]> {
  const events: LlmEvent[] = [];
  for await (const event of provider.streamTurn(turn, signal))
    events.push(event);
  return events;
}

describe('AnthropicLlmProvider', () => {
  it('streams text and ends with the tool calls, usage and echoable content', async () => {
    const { provider } = providerReturning(
      () =>
        new Response(TOOL_TURN, {
          headers: { 'content-type': 'text/event-stream' },
        }),
    );

    const events = await run(provider);

    expect(events.slice(0, 2)).toEqual([
      { type: 'text', delta: 'Let me ' },
      { type: 'text', delta: 'look.' },
    ]);
    expect(events[2]).toMatchObject({
      type: 'turn_end',
      stopReason: 'tool_use',
      model: 'claude-opus-5-5',
      usage: { inputTokens: 120, outputTokens: 42 },
      assistant: {
        role: 'assistant',
        text: 'Let me look.',
        toolCalls: [
          { id: 'toolu_1', name: 'search_articles', input: { query: 'k3s' } },
        ],
        providerContent: [
          expect.objectContaining({ type: 'text', text: 'Let me look.' }),
          expect.objectContaining({ type: 'tool_use', id: 'toolu_1' }),
        ],
      },
    });
  });

  it('sends a streaming request with adaptive thinking, effort, fallbacks, caching and the tools', async () => {
    const { provider, requests } = providerReturning(
      () =>
        new Response(TOOL_TURN, {
          headers: { 'content-type': 'text/event-stream' },
        }),
    );

    await run(provider);

    expect(requests).toHaveLength(1);
    const [sent] = requests;
    expect(sent?.url).toContain('/v1/messages');
    expect(sent?.headers.get('anthropic-beta')).toContain(
      'server-side-fallback-2026-07-01',
    );
    expect(sent?.headers.get('x-api-key')).toBe('test-key');
    expect(sent?.body).toMatchObject({
      model: 'claude-opus-5-5',
      max_tokens: 64_000,
      stream: true,
      system: 'You are a test.',
      messages: [{ role: 'user', content: 'Any k3s articles?' }],
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' },
      fallbacks: 'default',
      cache_control: { type: 'ephemeral' },
      tool_choice: { type: 'auto' },
      tools: [
        {
          name: 'search_articles',
          description: 'Search.',
          input_schema: {
            type: 'object',
            properties: { query: { type: 'string' } },
          },
        },
      ],
    });
    expect(sent?.body).not.toHaveProperty('betas');
  });

  it('passes tool_choice none through, and omits tools when there are none', async () => {
    const { provider, requests } = providerReturning(
      () =>
        new Response(TOOL_TURN, {
          headers: { 'content-type': 'text/event-stream' },
        }),
    );

    await run(provider, { ...request, toolChoice: 'none' });
    await run(provider, { ...request, tools: [] });

    expect(requests[0]?.body.tool_choice).toEqual({ type: 'none' });
    expect(requests[1]?.body).not.toHaveProperty('tools');
    expect(requests[1]?.body).not.toHaveProperty('tool_choice');
  });

  it.each([
    [429, 'rate_limit_error', 'rate_limited'],
    [529, 'overloaded_error', 'unavailable'],
    [500, 'api_error', 'unavailable'],
    [401, 'authentication_error', 'unavailable'],
    [400, 'invalid_request_error', 'rejected'],
  ] as const)(
    'maps HTTP %i to an LlmError of kind %s',
    async (status, type, kind) => {
      const { provider } = providerReturning(
        () =>
          new Response(
            JSON.stringify({ type: 'error', error: { type, message: 'nope' } }),
            {
              status,
              headers: { 'content-type': 'application/json' },
            },
          ),
      );

      const failure = run(provider);
      await expect(failure).rejects.toBeInstanceOf(LlmError);
      await expect(failure).rejects.toMatchObject({ kind });
    },
  );

  it('maps a network failure to unavailable', async () => {
    const { provider } = providerReturning(() => {
      throw new TypeError('fetch failed');
    });
    await expect(run(provider)).rejects.toMatchObject({ kind: 'unavailable' });
  });

  it('lets cancellation through unchanged', async () => {
    const controller = new AbortController();
    controller.abort();
    const { provider } = providerReturning(
      () =>
        new Response(TOOL_TURN, {
          headers: { 'content-type': 'text/event-stream' },
        }),
    );
    await expect(
      run(provider, request, controller.signal),
    ).rejects.not.toBeInstanceOf(LlmError);
  });
});
