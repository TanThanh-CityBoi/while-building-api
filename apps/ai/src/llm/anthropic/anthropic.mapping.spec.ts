import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import {
  echoableContent,
  textOf,
  toMessageParams,
  toolCallsOf,
  toStopReason,
  toTool,
} from './anthropic.mapping.js';

type Block = Anthropic.Beta.BetaContentBlock;
const blocks = (...items: unknown[]) => items as Block[];

const thinking = { type: 'thinking', thinking: '', signature: 'sig' };
const text = (value: string) => ({
  type: 'text',
  text: value,
  citations: null,
});
const toolUse = (id: string, name: string, input: unknown = {}) => ({
  type: 'tool_use',
  id,
  name,
  input,
});
const fallback = {
  type: 'fallback',
  from: { model: 'claude-opus-5-5' },
  to: { model: 'claude-opus-4-8' },
  trigger: { type: 'refusal' },
};

describe('Anthropic mapping', () => {
  it('maps the conversation to Messages API params', () => {
    const providerContent = [thinking, toolUse('t1', 'search_articles')];
    expect(
      toMessageParams([
        { role: 'user', text: 'Hi' },
        { role: 'assistant', text: 'Hello', toolCalls: [] },
        { role: 'user', text: 'k3s?' },
        { role: 'assistant', text: '', toolCalls: [], providerContent },
        {
          role: 'tool_results',
          results: [
            { toolCallId: 't1', content: '{"articles":[]}', isError: false },
            { toolCallId: 't2', content: 'not found', isError: true },
          ],
        },
      ]),
    ).toEqual([
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: 'Hello' },
      { role: 'user', content: 'k3s?' },
      { role: 'assistant', content: providerContent },
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 't1',
            content: '{"articles":[]}',
            is_error: false,
          },
          {
            type: 'tool_result',
            tool_use_id: 't2',
            content: 'not found',
            is_error: true,
          },
        ],
      },
    ]);
  });

  it('maps tool definitions, dropping $schema', () => {
    expect(
      toTool({
        name: 'get_article',
        description: 'Get one article.',
        inputSchema: {
          $schema: 'http://json-schema.org/draft-07/schema#',
          type: 'object',
          properties: { slug: { type: 'string' } },
          required: ['slug'],
          additionalProperties: false,
        },
      }),
    ).toEqual({
      name: 'get_article',
      description: 'Get one article.',
      input_schema: {
        type: 'object',
        properties: { slug: { type: 'string' } },
        required: ['slug'],
        additionalProperties: false,
      },
    });
  });

  it('echoes content unchanged and runs every tool call when there was no fallback', () => {
    const content = blocks(
      thinking,
      text('Looking.'),
      toolUse('t1', 'search_articles', { query: 'k3s' }),
    );
    expect(echoableContent(content)).toEqual(content);
    expect(toolCallsOf(content)).toEqual([
      { id: 't1', name: 'search_articles', input: { query: 'k3s' } },
    ]);
    expect(textOf(content)).toBe('Looking.');
  });

  it('after a fallback, drops the declined model’s thinking and tool calls but keeps its text', () => {
    const content = blocks(
      thinking,
      text('Partial '),
      toolUse('declined', 'get_article', { slug: 'x' }),
      fallback,
      thinking,
      text('continued.'),
      toolUse('t2', 'search_articles'),
    );

    expect(echoableContent(content)).toEqual([
      text('Partial '),
      fallback,
      thinking,
      text('continued.'),
      toolUse('t2', 'search_articles'),
    ]);
    expect(toolCallsOf(content).map((c) => c.id)).toEqual(['t2']);
  });

  it('never passes a non-object tool input on', () => {
    expect(toolCallsOf(blocks(toolUse('t', 'x', 'oops')))[0]?.input).toEqual(
      {},
    );
  });

  it.each([
    ['end_turn', 'end'],
    ['stop_sequence', 'end'],
    ['pause_turn', 'end'],
    [null, 'end'],
    ['tool_use', 'tool_use'],
    ['max_tokens', 'max_tokens'],
    ['model_context_window_exceeded', 'max_tokens'],
    ['refusal', 'refusal'],
  ] as const)('maps stop reason %s to %s', (reason, expected) => {
    expect(toStopReason(reason)).toBe(expected);
  });
});
