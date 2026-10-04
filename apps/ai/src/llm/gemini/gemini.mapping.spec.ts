import {
  FinishReason,
  type GenerateContentResponse,
  type Part,
} from '@google/genai';
import { describe, expect, it } from 'vitest';
import {
  GeminiTurn,
  toContents,
  toFunctionDeclaration,
} from './gemini.mapping.js';

const chunk = (
  parts: Part[],
  extra: Partial<
    GenerateContentResponse['candidates'] extends (infer C)[] | undefined
      ? C
      : never
  > = {},
  top: Partial<GenerateContentResponse> = {},
) =>
  ({
    candidates: [{ content: { role: 'model', parts }, ...extra }],
    ...top,
  }) as GenerateContentResponse;

describe('Gemini mapping', () => {
  it('maps the conversation to contents, naming function responses', () => {
    const echoed: Part[] = [
      { text: 'Looking.' },
      {
        functionCall: { name: 'search_articles', args: { query: 'k3s' } },
        thoughtSignature: 'sig',
      },
      {
        functionCall: { id: 'fc-2', name: 'get_project', args: { slug: 'x' } },
      },
    ];
    expect(
      toContents([
        { role: 'user', text: 'Hi' },
        { role: 'assistant', text: 'Hello', toolCalls: [] },
        { role: 'user', text: 'k3s?' },
        {
          role: 'assistant',
          text: 'Looking.',
          toolCalls: [
            {
              id: 'gemini-call:0',
              name: 'search_articles',
              input: { query: 'k3s' },
            },
            { id: 'fc-2', name: 'get_project', input: { slug: 'x' } },
          ],
          providerContent: echoed,
        },
        {
          role: 'tool_results',
          results: [
            {
              toolCallId: 'gemini-call:0',
              content: '{"articles":[]}',
              isError: false,
            },
            { toolCallId: 'fc-2', content: 'not found', isError: true },
          ],
        },
      ]),
    ).toEqual([
      { role: 'user', parts: [{ text: 'Hi' }] },
      { role: 'model', parts: [{ text: 'Hello' }] },
      { role: 'user', parts: [{ text: 'k3s?' }] },
      { role: 'model', parts: echoed },
      {
        role: 'user',
        parts: [
          // Gemini gave no id: the response goes by name only.
          {
            functionResponse: {
              name: 'search_articles',
              response: { output: '{"articles":[]}' },
            },
          },
          {
            functionResponse: {
              id: 'fc-2',
              name: 'get_project',
              response: { error: 'not found' },
            },
          },
        ],
      },
    ]);
  });

  it('maps tool definitions to function declarations with their JSON Schema', () => {
    expect(
      toFunctionDeclaration({
        name: 'get_article',
        description: 'Get one article.',
        inputSchema: {
          $schema: 'http://json-schema.org/draft-07/schema#',
          type: 'object',
          properties: { slug: { type: 'string' } },
          required: ['slug'],
        },
      }),
    ).toEqual({
      name: 'get_article',
      description: 'Get one article.',
      parametersJsonSchema: {
        type: 'object',
        properties: { slug: { type: 'string' } },
        required: ['slug'],
      },
    });
  });

  it('rebuilds a streamed turn: visible text, calls with made-up ids, parts as received', () => {
    const turn = new GeminiTurn();
    expect(
      turn.add(chunk([{ text: 'secret', thought: true }, { text: 'Let me ' }])),
    ).toEqual(['Let me ']);
    expect(
      turn.add(chunk([{ text: 'look.' }], {}, { modelVersion: 'gemini-x' })),
    ).toEqual(['look.']);
    turn.add(
      chunk(
        [
          {
            functionCall: { name: 'search_articles', args: { query: 'k3s' } },
            thoughtSignature: 'sig',
          },
          {
            functionCall: { id: 'fc-2', name: 'get_project', args: undefined },
          },
        ],
        { finishReason: FinishReason.STOP },
        {
          usageMetadata: {
            promptTokenCount: 100,
            candidatesTokenCount: 20,
            thoughtsTokenCount: 5,
          },
        },
      ),
    );

    expect(turn.text()).toBe('Let me look.');
    expect(turn.toolCalls()).toEqual([
      { id: 'gemini-call:0', name: 'search_articles', input: { query: 'k3s' } },
      { id: 'fc-2', name: 'get_project', input: {} },
    ]);
    expect(turn.parts).toHaveLength(5);
    expect(turn.parts[3]).toMatchObject({ thoughtSignature: 'sig' });
    expect(turn.stopReason()).toBe('tool_use');
    expect(turn.usage()).toEqual({ inputTokens: 100, outputTokens: 25 });
    expect(turn.modelVersion).toBe('gemini-x');
  });

  it.each([
    [[chunk([{ text: 'Done.' }], { finishReason: FinishReason.STOP })], 'end'],
    [
      [chunk([{ text: 'Cut' }], { finishReason: FinishReason.MAX_TOKENS })],
      'max_tokens',
    ],
    [
      [
        chunk([{ functionCall: { name: 'x', args: {} } }], {
          finishReason: FinishReason.MAX_TOKENS,
        }),
      ],
      'max_tokens',
    ],
    [[chunk([], { finishReason: FinishReason.SAFETY })], 'refusal'],
    [[chunk([], { finishReason: FinishReason.PROHIBITED_CONTENT })], 'refusal'],
    [
      [
        {
          promptFeedback: { blockReason: 'SAFETY' },
        } as GenerateContentResponse,
      ],
      'refusal',
    ],
  ] as const)('maps the turn to a stop reason (%#)', (chunks, expected) => {
    const turn = new GeminiTurn();
    for (const c of chunks) turn.add(c);
    expect(turn.stopReason()).toBe(expected);
  });
});
