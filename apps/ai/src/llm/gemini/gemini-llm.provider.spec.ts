import { GoogleGenAI } from '@google/genai';
import { describe, expect, it } from 'vitest';
import { LlmError } from '../llm.errors.js';
import type { LlmEvent, LlmTurnRequest } from '../llm.types.js';
import { GeminiLlmProvider } from './gemini-llm.provider.js';
import type { GeminiSettings } from './gemini.settings.js';

/** Gemini's streaming format: one `data:` line per response chunk. */
const sse = (chunks: object[]) =>
  chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join('');

const callPart = {
  functionCall: { name: 'search_articles', args: { query: 'k3s' } },
  thoughtSignature: 'sig-1',
};

/** A streamed turn: some text, then one function call with its thought signature. */
const TOOL_TURN = sse([
  {
    candidates: [{ content: { role: 'model', parts: [{ text: 'Let me ' }] } }],
    modelVersion: 'gemini-3.5-pro',
  },
  { candidates: [{ content: { role: 'model', parts: [{ text: 'look.' }] } }] },
  {
    candidates: [
      { content: { role: 'model', parts: [callPart] }, finishReason: 'STOP' },
    ],
    usageMetadata: {
      promptTokenCount: 120,
      candidatesTokenCount: 30,
      thoughtsTokenCount: 12,
    },
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
  settings: GeminiSettings = { maxOutputTokens: 64_000 },
) {
  const requests: Captured[] = [];
  const client = new GoogleGenAI({
    apiKey: 'test-key',
    httpOptions: {
      fetch: async (url: RequestInfo | URL, init?: RequestInit) => {
        // Like the real fetch: an aborted signal rejects.
        init?.signal?.throwIfAborted();
        requests.push({
          url: url instanceof Request ? url.url : url.toString(),
          headers: new Headers(init?.headers),
          // The SDK always sends a JSON string body.
          body: JSON.parse(init?.body as string) as Record<string, unknown>,
        });
        return response();
      },
    },
  });
  return { provider: new GeminiLlmProvider(client, settings), requests };
}

const request: LlmTurnRequest = {
  model: 'gemini-pro-latest',
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
  provider: GeminiLlmProvider,
  turn = request,
  signal = new AbortController().signal,
): Promise<LlmEvent[]> {
  const events: LlmEvent[] = [];
  for await (const event of provider.streamTurn(turn, signal))
    events.push(event);
  return events;
}

describe('GeminiLlmProvider', () => {
  it('streams text and ends with the function call, usage and the parts to echo', async () => {
    const { provider } = providerReturning(() => streamResponse(TOOL_TURN));

    const events = await run(provider);

    expect(events.slice(0, 2)).toEqual([
      { type: 'text', delta: 'Let me ' },
      { type: 'text', delta: 'look.' },
    ]);
    expect(events[2]).toEqual({
      type: 'turn_end',
      stopReason: 'tool_use',
      model: 'gemini-3.5-pro',
      usage: { inputTokens: 120, outputTokens: 42 },
      assistant: {
        role: 'assistant',
        text: 'Let me look.',
        toolCalls: [
          {
            id: 'gemini-call:0',
            name: 'search_articles',
            input: { query: 'k3s' },
          },
        ],
        providerContent: [{ text: 'Let me ' }, { text: 'look.' }, callPart],
      },
    });
  });

  it('sends a streaming request with the system prompt, tools and output limit', async () => {
    const { provider, requests } = providerReturning(() =>
      streamResponse(TOOL_TURN),
    );

    await run(provider);

    expect(requests).toHaveLength(1);
    const [sent] = requests;
    expect(sent?.url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-latest:streamGenerateContent?alt=sse',
    );
    expect(sent?.headers.get('x-goog-api-key')).toBe('test-key');
    expect(sent?.body).toMatchObject({
      contents: [{ role: 'user', parts: [{ text: 'Any k3s articles?' }] }],
      systemInstruction: { parts: [{ text: 'You are a test.' }] },
      tools: [
        {
          functionDeclarations: [
            {
              name: 'search_articles',
              description: 'Search.',
              parametersJsonSchema: {
                type: 'object',
                properties: { query: { type: 'string' } },
              },
            },
          ],
        },
      ],
      toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
      generationConfig: { maxOutputTokens: 64_000 },
    });
    expect(sent?.body.generationConfig).not.toHaveProperty('thinkingConfig');
  });

  it('sends the thinking level when configured, mode NONE, and no tools when there are none', async () => {
    const { provider, requests } = providerReturning(
      () => streamResponse(TOOL_TURN),
      {
        maxOutputTokens: 8_000,
        thinkingLevel: 'low',
      },
    );

    await run(provider, { ...request, toolChoice: 'none' });
    await run(provider, { ...request, tools: [] });

    expect(requests[0]?.body).toMatchObject({
      toolConfig: { functionCallingConfig: { mode: 'NONE' } },
      generationConfig: {
        maxOutputTokens: 8_000,
        thinkingConfig: { thinkingLevel: 'LOW' },
      },
    });
    expect(requests[1]?.body).not.toHaveProperty('tools');
    expect(requests[1]?.body).not.toHaveProperty('toolConfig');
  });

  it('reports the token limit and safety stops', async () => {
    const limited = providerReturning(() =>
      streamResponse(
        sse([
          {
            candidates: [
              {
                content: { role: 'model', parts: [callPart] },
                finishReason: 'MAX_TOKENS',
              },
            ],
          },
        ]),
      ),
    );
    expect((await run(limited.provider)).at(-1)).toMatchObject({
      stopReason: 'max_tokens',
    });

    const blocked = providerReturning(() =>
      streamResponse(sse([{ promptFeedback: { blockReason: 'SAFETY' } }])),
    );
    expect((await run(blocked.provider)).at(-1)).toMatchObject({
      stopReason: 'refusal',
    });
  });

  it.each([
    [429, 'RESOURCE_EXHAUSTED', 'rate_limited'],
    [400, 'INVALID_ARGUMENT', 'rejected'],
    [403, 'PERMISSION_DENIED', 'unavailable'],
    [500, 'INTERNAL', 'unavailable'],
  ] as const)(
    'maps HTTP %i to an LlmError of kind %s',
    async (status, code, kind) => {
      const { provider } = providerReturning(
        () =>
          new Response(
            JSON.stringify({
              error: { code: status, message: 'nope', status: code },
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
