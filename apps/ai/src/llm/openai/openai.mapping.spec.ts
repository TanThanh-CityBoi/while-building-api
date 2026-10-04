import type OpenAI from 'openai';
import { describe, expect, it } from 'vitest';
import {
  echoableItems,
  textOf,
  toFunctionTool,
  toInputItems,
  toolCallsOf,
  toStopReason,
} from './openai.mapping.js';

type OutputItem = OpenAI.Responses.ResponseOutputItem;
type Response = OpenAI.Responses.Response;
const items = (...values: unknown[]) => values as OutputItem[];

const reasoning = {
  type: 'reasoning',
  id: 'rs_1',
  summary: [],
  encrypted_content: 'enc',
};
const message = (text: string) => ({
  type: 'message',
  id: 'msg_1',
  role: 'assistant',
  status: 'completed',
  content: [{ type: 'output_text', text, annotations: [] }],
});
const refusal = {
  type: 'message',
  id: 'msg_2',
  role: 'assistant',
  status: 'completed',
  content: [{ type: 'refusal', refusal: "I can't help with that." }],
};
const functionCall = (callId: string, name: string, args: string) => ({
  type: 'function_call',
  id: `fc_${callId}`,
  call_id: callId,
  name,
  arguments: args,
  status: 'completed',
});
const response = (output: unknown[], extra: Partial<Response> = {}) =>
  ({
    status: 'completed',
    incomplete_details: null,
    output,
    ...extra,
  }) as unknown as Response;

describe('OpenAI mapping', () => {
  it('maps the conversation to Responses API input items', () => {
    const providerContent = [
      reasoning,
      functionCall('c1', 'search_articles', '{}'),
    ];
    expect(
      toInputItems([
        { role: 'user', text: 'Hi' },
        { role: 'assistant', text: 'Hello', toolCalls: [] },
        { role: 'user', text: 'k3s?' },
        { role: 'assistant', text: '', toolCalls: [], providerContent },
        {
          role: 'tool_results',
          results: [
            { toolCallId: 'c1', content: '{"articles":[]}', isError: false },
            { toolCallId: 'c2', content: 'not found', isError: true },
          ],
        },
      ]),
    ).toEqual([
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: 'Hello' },
      { role: 'user', content: 'k3s?' },
      ...providerContent,
      {
        type: 'function_call_output',
        call_id: 'c1',
        output: '{"articles":[]}',
      },
      {
        type: 'function_call_output',
        call_id: 'c2',
        output: 'Error: not found',
      },
    ]);
  });

  it('maps tool definitions to non-strict function tools, dropping $schema', () => {
    expect(
      toFunctionTool({
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
      type: 'function',
      name: 'get_article',
      description: 'Get one article.',
      parameters: {
        type: 'object',
        properties: { slug: { type: 'string' } },
        required: ['slug'],
      },
      strict: false,
    });
  });

  it('echoes reasoning, messages and function calls, and nothing else', () => {
    const output = items(
      reasoning,
      message('Looking.'),
      functionCall('c1', 'search_articles', '{"query":"k3s"}'),
      { type: 'web_search_call', id: 'ws_1', status: 'completed' },
    );
    expect(echoableItems(output)).toEqual(output.slice(0, 3));
  });

  it('extracts tool calls and text', () => {
    const output = items(
      message('Let me '),
      message('look.'),
      functionCall('c1', 'search_articles', '{"query":"k3s"}'),
      functionCall('c2', 'get_article', 'not json'),
      functionCall('c3', 'get_project', '["array"]'),
    );
    expect(toolCallsOf(output)).toEqual([
      { id: 'c1', name: 'search_articles', input: { query: 'k3s' } },
      { id: 'c2', name: 'get_article', input: {} },
      { id: 'c3', name: 'get_project', input: {} },
    ]);
    expect(textOf(output)).toBe('Let me look.');
  });

  it('maps the response status and output to a stop reason', () => {
    expect(toStopReason(response([message('Done.')]))).toBe('end');
    expect(toStopReason(response([functionCall('c1', 'x', '{}')]))).toBe(
      'tool_use',
    );
    expect(toStopReason(response([refusal]))).toBe('refusal');
    expect(
      toStopReason(
        response([functionCall('c1', 'x', '{"que')], {
          status: 'incomplete',
          incomplete_details: { reason: 'max_output_tokens' },
        }),
      ),
    ).toBe('max_tokens');
    expect(
      toStopReason(
        response([], {
          status: 'incomplete',
          incomplete_details: { reason: 'content_filter' },
        }),
      ),
    ).toBe('refusal');
  });
});
