import { beforeEach, describe, expect, it } from 'vitest';
import {
  call,
  FakeLlmProvider,
  type ScriptedTurn,
} from '../../test/fakes/fake-llm-provider.js';
import { FakeMcpGateway } from '../../test/fakes/fake-mcp-gateway.js';
import { testConfig } from '../../test/fakes/test-config.js';
import { LlmError } from '../llm/llm.errors.js';
import { AgentService } from './agent.service.js';
import type { AgentEvent, ChatMessage } from './agent.types.js';

const ask = (content: string): ChatMessage[] => [{ role: 'user', content }];

describe('AgentService', () => {
  let mcp: FakeMcpGateway;

  beforeEach(() => {
    mcp = new FakeMcpGateway();
  });

  function agentWith(turns: Array<ScriptedTurn | Error>, maxToolRounds = 3) {
    const llm = new FakeLlmProvider(turns);
    const agent = new AgentService(
      llm,
      mcp,
      testConfig({ AI_MAX_TOOL_ROUNDS: maxToolRounds }),
    );
    return { llm, agent };
  }

  async function collect(
    agent: AgentService,
    messages: ChatMessage[],
    signal = new AbortController().signal,
  ): Promise<AgentEvent[]> {
    const events: AgentEvent[] = [];
    for await (const event of agent.run({ messages, userId: 'u-1' }, signal)) {
      events.push(event);
    }
    return events;
  }

  const textOf = (events: AgentEvent[]) =>
    events.flatMap((e) => (e.type === 'text' ? [e.delta] : [])).join('');

  it('answers a question that needs no tool', async () => {
    const { llm, agent } = agentWith([{ text: ['Hello', ' there!'] }]);

    const events = await collect(agent, ask('Hi'));

    expect(events).toEqual([
      { type: 'status', phase: 'thinking' },
      { type: 'text', delta: 'Hello' },
      { type: 'text', delta: ' there!' },
      { type: 'done' },
    ]);
    expect(llm.requests).toHaveLength(1);
    expect(llm.requests[0]).toMatchObject({
      toolChoice: 'auto',
      conversation: [{ role: 'user', text: 'Hi' }],
    });
    expect(llm.requests[0]?.tools.map((t) => t.name)).toEqual([
      'search_articles',
      'get_article',
      'search_projects',
      'get_project',
    ]);
    expect(llm.requests[0]?.system).toContain('While Building');
    expect(mcp.closes).toBe(1);
  });

  it('searches articles, feeds the result back and cites the sources', async () => {
    const { llm, agent } = agentWith([
      {
        text: ['Let me look.'],
        toolCalls: [call('t1', 'search_articles', { query: 'k3s' })],
      },
      { text: ['There is "My k3s Homelab".'] },
    ]);

    const events = await collect(agent, ask('Any k3s articles?'));

    expect(events).toEqual([
      { type: 'status', phase: 'thinking' },
      { type: 'text', delta: 'Let me look.' },
      { type: 'status', phase: 'tool_start', tool: 'search_articles' },
      { type: 'status', phase: 'tool_end', tool: 'search_articles', ok: true },
      { type: 'status', phase: 'thinking' },
      { type: 'text', delta: 'There is "My k3s Homelab".' },
      {
        type: 'sources',
        sources: [
          {
            kind: 'article',
            slug: 'k3s-homelab',
            title: 'My k3s Homelab',
            uri: 'article://k3s-homelab',
          },
        ],
      },
      { type: 'done' },
    ]);
    expect(mcp.calls).toEqual([
      { name: 'search_articles', input: { query: 'k3s' } },
    ]);

    // Second turn: the assistant turn (with its provider content) and the tool result.
    const second = llm.requests[1]?.conversation;
    expect(second?.[1]).toMatchObject({
      role: 'assistant',
      toolCalls: [{ id: 't1', name: 'search_articles' }],
      providerContent: { fake: true },
    });
    expect(second?.[2]).toEqual({
      role: 'tool_results',
      results: [
        {
          toolCallId: 't1',
          content: JSON.stringify({
            articles: [
              {
                slug: 'k3s-homelab',
                title: 'My k3s Homelab',
                uri: 'article://k3s-homelab',
              },
            ],
            total: 1,
          }),
          isError: false,
        },
      ],
    });
  });

  it('gets a specific article and a project', async () => {
    const { agent } = agentWith([
      { toolCalls: [call('t1', 'get_article', { slug: 'k3s-homelab' })] },
      { toolCalls: [call('t2', 'get_project', { slug: 'mcp-playground' })] },
      { text: ['Done.'] },
    ]);

    const events = await collect(
      agent,
      ask('Tell me about k3s and the MCP project'),
    );

    expect(textOf(events)).toBe('Done.');
    expect(mcp.calls.map((c) => c.name)).toEqual([
      'get_article',
      'get_project',
    ]);
    expect(events.find((e) => e.type === 'sources')).toEqual({
      type: 'sources',
      sources: [
        expect.objectContaining({ kind: 'article', slug: 'k3s-homelab' }),
        expect.objectContaining({
          kind: 'project',
          slug: 'mcp-playground',
          title: 'MCP Playground',
        }),
      ],
    });
  });

  it('runs several tool calls of one turn in parallel and returns all results together', async () => {
    const { llm, agent } = agentWith([
      {
        toolCalls: [
          call('a', 'search_articles', { query: 'k3s' }),
          call('b', 'search_projects', { technology: 'MCP' }),
        ],
      },
      { text: ['Both found.'] },
    ]);

    const events = await collect(agent, ask('Articles and projects?'));

    expect(
      events
        .filter((e) => e.type === 'status')
        .map((e) => e.type === 'status' && e.phase),
    ).toEqual([
      'thinking',
      'tool_start',
      'tool_start',
      'tool_end',
      'tool_end',
      'thinking',
    ]);
    const results = llm.requests[1]?.conversation[2];
    expect(results).toMatchObject({
      role: 'tool_results',
      results: [{ toolCallId: 'a' }, { toolCallId: 'b' }],
    });
  });

  it('handles a search with no results as a normal answer without sources', async () => {
    const { agent } = agentWith([
      { toolCalls: [call('t1', 'search_articles', { query: 'nothing' })] },
      { text: ['Nothing about that yet.'] },
    ]);

    const events = await collect(agent, ask('Anything about nothing?'));

    expect(events.some((e) => e.type === 'sources')).toBe(false);
    expect(events.at(-1)).toEqual({ type: 'done' });
  });

  it('feeds tool errors (invalid arguments, not found) back to the model', async () => {
    const { llm, agent } = agentWith([
      {
        toolCalls: [
          call('bad', 'get_article', { slug: 'Not A Slug' }),
          call('missing', 'get_article', { slug: 'unknown' }),
        ],
      },
      { text: ['I could not find it.'] },
    ]);

    const events = await collect(agent, ask('Show me that article'));

    expect(events).toContainEqual({
      type: 'status',
      phase: 'tool_end',
      tool: 'get_article',
      ok: false,
    });
    expect(llm.requests[1]?.conversation[2]).toEqual({
      role: 'tool_results',
      results: [
        {
          toolCallId: 'bad',
          content: 'Input validation error: slug',
          isError: true,
        },
        {
          toolCallId: 'missing',
          content: 'No published article with slug "unknown".',
          isError: true,
        },
      ],
    });
    expect(events.some((e) => e.type === 'sources')).toBe(false);
  });

  it('answers without tools when the MCP server is unavailable', async () => {
    mcp.unavailable = true;
    const { llm, agent } = agentWith([
      { text: ["I can't look that up right now."] },
    ]);

    const events = await collect(agent, ask('Any k3s articles?'));

    expect(events.at(-1)).toEqual({ type: 'done' });
    expect(llm.requests[0]?.tools).toEqual([]);
    expect(llm.requests[0]?.system).toContain('content tools are unavailable');
  });

  it.each([
    [
      'unavailable',
      'unavailable',
      'The assistant is unavailable right now. Try again later.',
    ],
    [
      'rate_limited',
      'rate_limited',
      'The assistant is busy right now. Try again in a minute.',
    ],
    [
      'rejected',
      'unavailable',
      'The assistant is unavailable right now. Try again later.',
    ],
  ] as const)(
    'reports an LLM %s error as a friendly error event',
    async (kind, code, message) => {
      const { agent } = agentWith([
        new LlmError(kind, 'secret internal detail'),
      ]);

      const events = await collect(agent, ask('Hi'));

      expect(events.at(-1)).toEqual({ type: 'error', code, message });
      expect(JSON.stringify(events)).not.toContain('secret internal detail');
      expect(mcp.closes).toBe(1);
    },
  );

  it('reports unexpected failures generically', async () => {
    const { agent } = agentWith([new TypeError('boom at line 42')]);
    const events = await collect(agent, ask('Hi'));
    expect(events.at(-1)).toEqual({
      type: 'error',
      code: 'internal',
      message: 'Something went wrong while answering. Try again.',
    });
  });

  it('stops calling tools after the round limit and makes the model answer', async () => {
    const loop: ScriptedTurn = {
      toolCalls: [call('x', 'search_articles', { query: 'k3s' })],
    };
    const { llm, agent } = agentWith(
      [loop, loop, { text: ['Here is what I found.'] }],
      2,
    );

    const events = await collect(agent, ask('Search forever'));

    expect(mcp.calls).toHaveLength(2);
    expect(llm.requests.map((r) => r.toolChoice)).toEqual([
      'auto',
      'auto',
      'none',
    ]);
    // Tools stay declared: the conversation refers to earlier tool calls.
    expect(llm.requests[2]?.tools).toHaveLength(4);
    expect(textOf(events)).toBe('Here is what I found.');
    expect(events.at(-1)).toEqual({ type: 'done' });
  });

  it('never runs tool calls from a turn cut off by the token limit', async () => {
    const { agent } = agentWith([
      {
        text: ['Partial'],
        toolCalls: [call('t', 'get_article', { slug: 'k3s' })],
        stopReason: 'max_tokens',
      },
    ]);
    const events = await collect(agent, ask('Long answer please'));
    expect(mcp.calls).toEqual([]);
    expect(events.at(-1)).toEqual({ type: 'done' });
  });

  it('ends with a refusal error when the model declines', async () => {
    const { agent } = agentWith([{ stopReason: 'refusal' }]);
    const events = await collect(agent, ask('Something it declines'));
    expect(events.at(-1)).toEqual({
      type: 'error',
      code: 'refused',
      message: "The assistant can't help with that request.",
    });
  });

  it('stops silently when the client goes away', async () => {
    const { agent } = agentWith([{ text: ['Thinking about it'], hang: true }]);
    const controller = new AbortController();
    const events: AgentEvent[] = [];

    for await (const event of agent.run(
      { messages: ask('Hi'), userId: 'u-1' },
      controller.signal,
    )) {
      events.push(event);
      if (event.type === 'text') controller.abort();
    }

    expect(events.map((e) => e.type)).toEqual(['status', 'text']);
    expect(mcp.closes).toBe(1);
  });

  it('reports a timeout when the time budget runs out', async () => {
    const { agent } = agentWith([{ hang: true }]);
    const events = await collect(agent, ask('Hi'), AbortSignal.timeout(20));
    expect(events.at(-1)).toMatchObject({ type: 'error', code: 'timeout' });
  });

  it('replays earlier turns of the conversation as plain text', async () => {
    const { llm, agent } = agentWith([{ text: ['Sure.'] }]);
    await collect(agent, [
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: 'Hello!' },
      { role: 'user', content: 'More?' },
    ]);
    expect(llm.requests[0]?.conversation).toEqual([
      { role: 'user', text: 'Hi' },
      { role: 'assistant', text: 'Hello!', toolCalls: [] },
      { role: 'user', text: 'More?' },
    ]);
  });
});
