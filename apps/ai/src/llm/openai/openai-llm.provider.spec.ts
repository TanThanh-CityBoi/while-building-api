import OpenAI from 'openai';
import { describe, expect, it } from 'vitest';
import { LlmError } from '../llm.errors.js';
import type { LlmEvent, LlmTurnRequest } from '../llm.types.js';
import { OpenAILlmProvider } from './openai-llm.provider.js';
import type { OpenAISettings } from './openai.settings.js';

const sse = (events: object[]) =>
  events
    .map(
      (event) =>
        `event: ${(event as { type: string }).type}\ndata: ${JSON.stringify(event)}\n\n`,
    )
    .join('');

const completedResponse = (
  output: unknown[],
  extra: Record<string, unknown> = {},
) => ({
  id: 'resp_1',
  object: 'response',
  created_at: 1,
  status: 'completed',
  model: 'gpt-5.5-2026-04-23',
  output,
  error: null,
  incomplete_details: null,
  usage: {
    input_tokens: 120,
    output_tokens: 42,
    total_tokens: 162,
    input_tokens_details: { cached_tokens: 0 },
    output_tokens_details: { reasoning_tokens: 10 },
  },
  ...extra,
});

const reasoningItem = {
  type: 'reasoning',
  id: 'rs_1',
  summary: [],
  encrypted_content: 'enc',
};
const messageItem = {
  type: 'message',
  id: 'msg_1',
  role: 'assistant',
  status: 'completed',
  content: [{ type: 'output_text', text: 'Let me look.', annotations: [] }],
};
const callItem = {
  type: 'function_call',
  id: 'fc_1',
  call_id: 'call_1',
  name: 'search_articles',
  arguments: '{"query":"k3s"}',
  status: 'completed',
};

/** A streamed turn: reasoning, some text, then one function call. */
const TOOL_TURN = sse([
  {
    type: 'response.created',
    sequence_number: 0,
    response: completedResponse([], { status: 'in_progress' }),
  },
  {
    type: 'response.output_text.delta',
    sequence_number: 1,
    item_id: 'msg_1',
    output_index: 1,
    content_index: 0,
    delta: 'Let me ',
    logprobs: [],
  },
  {
    type: 'response.output_text.delta',
    sequence_number: 2,
    item_id: 'msg_1',
    output_index: 1,
    content_index: 0,
    delta: 'look.',
    logprobs: [],
  },
  {
    type: 'response.completed',
    sequence_number: 3,
    response: completedResponse([reasoningItem, messageItem, callItem]),
  },
]);

const streamResponse = (body: string) =>
  new Response(body, { headers: { 'content-type': 'text/event-stream' } });

interface Captured {
  url: string;
  headers: Headers;
  body: Record<string, unknown>;
}

function providerReturning(
  response: () => Response | Promise<Response>,
  settings: OpenAISettings = { maxOutputTokens: 64_000 },
) {
  const requests: Captured[] = [];
  const client = new OpenAI({
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
  return { provider: new OpenAILlmProvider(client, settings), requests };
}

const request: LlmTurnRequest = {
  model: 'gpt-5.5',
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
  provider: OpenAILlmProvider,
  turn = request,
  signal = new AbortController().signal,
): Promise<LlmEvent[]> {
  const events: LlmEvent[] = [];
  for await (const event of provider.streamTurn(turn, signal))
    events.push(event);
  return events;
}

describe('OpenAILlmProvider', () => {
  it('streams text and ends with the tool calls, usage and echoable items', async () => {
    const { provider } = providerReturning(() => streamResponse(TOOL_TURN));

    const events = await run(provider);

    expect(events.slice(0, 2)).toEqual([
      { type: 'text', delta: 'Let me ' },
      { type: 'text', delta: 'look.' },
    ]);
    expect(events[2]).toEqual({
      type: 'turn_end',
      stopReason: 'tool_use',
      model: 'gpt-5.5-2026-04-23',
      usage: { inputTokens: 120, outputTokens: 42 },
      assistant: {
        role: 'assistant',
        text: 'Let me look.',
        toolCalls: [
          { id: 'call_1', name: 'search_articles', input: { query: 'k3s' } },
        ],
        providerContent: [reasoningItem, messageItem, callItem],
      },
    });
  });

  it('sends a stateless streaming request with the tools and encrypted reasoning', async () => {
    const { provider, requests } = providerReturning(() =>
      streamResponse(TOOL_TURN),
    );

    await run(provider);

    expect(requests).toHaveLength(1);
    const [sent] = requests;
    expect(sent?.url).toBe('https://api.openai.com/v1/responses');
    expect(sent?.headers.get('authorization')).toBe('Bearer test-key');
    expect(sent?.body).toEqual({
      model: 'gpt-5.5',
      instructions: 'You are a test.',
      input: [{ role: 'user', content: 'Any k3s articles?' }],
      tools: [
        {
          type: 'function',
          name: 'search_articles',
          description: 'Search.',
          parameters: {
            type: 'object',
            properties: { query: { type: 'string' } },
          },
          strict: false,
        },
      ],
      tool_choice: 'auto',
      parallel_tool_calls: true,
      max_output_tokens: 64_000,
      store: false,
      include: ['reasoning.encrypted_content'],
      stream: true,
    });
  });

  it('sends the reasoning effort when configured, tool_choice none, and no tools when there are none', async () => {
    const { provider, requests } = providerReturning(
      () => streamResponse(TOOL_TURN),
      {
        maxOutputTokens: 8_000,
        reasoningEffort: 'low',
      },
    );

    await run(provider, { ...request, toolChoice: 'none' });
    await run(provider, { ...request, tools: [] });

    expect(requests[0]?.body).toMatchObject({
      tool_choice: 'none',
      max_output_tokens: 8_000,
      reasoning: { effort: 'low' },
    });
    expect(requests[1]?.body).not.toHaveProperty('tools');
    expect(requests[1]?.body).not.toHaveProperty('tool_choice');
  });

  it('reports a response cut off by the token limit as max_tokens', async () => {
    const { provider } = providerReturning(() =>
      streamResponse(
        sse([
          {
            type: 'response.incomplete',
            sequence_number: 0,
            response: completedResponse([callItem], {
              status: 'incomplete',
              incomplete_details: { reason: 'max_output_tokens' },
            }),
          },
        ]),
      ),
    );
    const events = await run(provider);
    expect(events.at(-1)).toMatchObject({
      type: 'turn_end',
      stopReason: 'max_tokens',
    });
  });

  it.each([
    [
      'response.failed',
      {
        type: 'response.failed',
        sequence_number: 0,
        response: completedResponse([], {
          status: 'failed',
          error: { code: 'server_error', message: 'boom' },
        }),
      },
    ],
    [
      'error',
      {
        type: 'error',
        sequence_number: 0,
        code: 'server_error',
        message: 'boom',
        param: null,
      },
    ],
  ])('maps a %s event to an unavailable LlmError', async (_name, event) => {
    const { provider } = providerReturning(() => streamResponse(sse([event])));
    await expect(run(provider)).rejects.toMatchObject({ kind: 'unavailable' });
  });

  it.each([
    [429, 'rate_limited'],
    [500, 'unavailable'],
    [401, 'unavailable'],
    [400, 'rejected'],
  ] as const)(
    'maps HTTP %i to an LlmError of kind %s',
    async (status, kind) => {
      const { provider } = providerReturning(
        () =>
          new Response(
            JSON.stringify({
              error: { message: 'nope', type: 'x', code: null, param: null },
            }),
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
    const { provider } = providerReturning(() => streamResponse(TOOL_TURN));
    await expect(
      run(provider, request, controller.signal),
    ).rejects.not.toBeInstanceOf(LlmError);
  });
});
