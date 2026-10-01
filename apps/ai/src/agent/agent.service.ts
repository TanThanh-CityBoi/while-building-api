import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../config/env.validation.js';
import { LlmError } from '../llm/llm.errors.js';
import { LlmProvider } from '../llm/llm-provider.js';
import type { ConversationItem, LlmEvent } from '../llm/llm.types.js';
import {
  McpGateway,
  McpUnavailableError,
  type McpToolSession,
} from '../mcp-client/mcp-gateway.js';
import type { AgentEvent, AgentInput, ChatSource } from './agent.types.js';
import { sourcesFrom } from './sources.js';
import { buildSystemPrompt } from './system-prompt.js';

type TurnEnd = Extract<LlmEvent, { type: 'turn_end' }>;

/** At most this many sources are sent with an answer. */
const MAX_SOURCES = 10;

/**
 * Answers one chat message: streams the model's turns, runs the tools it asks
 * for through MCP (in parallel, bounded rounds), feeds the results back, and
 * finishes with the sources it used. Provider-neutral: it only knows
 * LlmProvider and McpGateway.
 */
@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);
  private readonly maxToolRounds: number;

  constructor(
    private readonly llm: LlmProvider,
    private readonly mcp: McpGateway,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.maxToolRounds = config.get('AI_MAX_TOOL_ROUNDS', { infer: true });
  }

  async *run(
    input: AgentInput,
    signal: AbortSignal,
  ): AsyncGenerator<AgentEvent> {
    const started = Date.now();
    const stats = { rounds: 0, toolCalls: 0, inputTokens: 0, outputTokens: 0 };
    let outcome = 'done';
    let session: McpToolSession | null = null;

    try {
      yield { type: 'status', phase: 'thinking' };
      session = await this.openTools(signal);
      const tools = session?.tools ?? [];
      const system = buildSystemPrompt({ toolsAvailable: session !== null });
      const conversation: ConversationItem[] = input.messages.map((message) =>
        message.role === 'user'
          ? { role: 'user', text: message.content }
          : { role: 'assistant', text: message.content, toolCalls: [] },
      );
      const sources = new Map<string, ChatSource>();

      for (let round = 0; ; round++) {
        // After the last allowed round the model must answer with what it has.
        // Tools stay declared (earlier tool calls refer to them).
        const canUseTools = tools.length > 0 && round < this.maxToolRounds;
        let end: TurnEnd | undefined;
        for await (const event of this.llm.streamTurn(
          {
            system,
            conversation,
            tools,
            toolChoice: canUseTools ? 'auto' : 'none',
          },
          signal,
        )) {
          if (event.type === 'text') yield { type: 'text', delta: event.delta };
          else end = event;
        }
        if (!end) throw new Error('The model turn ended without a result');

        stats.rounds += 1;
        stats.inputTokens += end.usage.inputTokens;
        stats.outputTokens += end.usage.outputTokens;
        conversation.push(end.assistant);

        if (end.stopReason === 'refusal') {
          outcome = 'refused';
          yield {
            type: 'error',
            code: 'refused',
            message: "The assistant can't help with that request.",
          };
          return;
        }
        const calls = end.assistant.toolCalls;
        if (
          end.stopReason !== 'tool_use' ||
          !canUseTools ||
          !session ||
          calls.length === 0
        ) {
          break;
        }

        for (const call of calls) {
          yield { type: 'status', phase: 'tool_start', tool: call.name };
        }
        const toolSession = session;
        const outcomes = await Promise.all(
          calls.map((call) =>
            toolSession.callTool(call.name, call.input, signal),
          ),
        );
        stats.toolCalls += calls.length;
        for (const [index, call] of calls.entries()) {
          const result = outcomes[index];
          yield {
            type: 'status',
            phase: 'tool_end',
            tool: call.name,
            ok: !result.isError,
          };
          if (!result.isError) {
            for (const source of sourcesFrom(result.structured)) {
              sources.set(source.uri, source);
            }
          }
        }
        conversation.push({
          role: 'tool_results',
          results: calls.map((call, index) => ({
            toolCallId: call.id,
            content: outcomes[index].text || '(no output)',
            isError: outcomes[index].isError,
          })),
        });
        yield { type: 'status', phase: 'thinking' };
      }

      if (sources.size > 0) {
        yield {
          type: 'sources',
          sources: [...sources.values()].slice(0, MAX_SOURCES),
        };
      }
      yield { type: 'done' };
    } catch (error) {
      const event = this.toErrorEvent(error, signal);
      outcome = event?.code ?? 'cancelled';
      if (event) yield event;
    } finally {
      await session?.close();
      // Never log message contents.
      this.logger.log(
        `chat user=${input.userId} outcome=${outcome} rounds=${stats.rounds} tools=${stats.toolCalls} ` +
          `tokens=${stats.inputTokens}/${stats.outputTokens} ${Date.now() - started}ms`,
      );
    }
  }

  /** The MCP tools, or null when the server is down: the model then answers without them. */
  private async openTools(signal: AbortSignal): Promise<McpToolSession | null> {
    try {
      return await this.mcp.connect(signal);
    } catch (error) {
      if (!(error instanceof McpUnavailableError)) throw error;
      this.logger.warn(`Answering without tools: ${error.message}`);
      return null;
    }
  }

  /** The terminal error event for a failure, or null when the client went away. */
  private toErrorEvent(
    error: unknown,
    signal: AbortSignal,
  ): Extract<AgentEvent, { type: 'error' }> | null {
    if (signal.aborted) {
      const reason: unknown = signal.reason;
      if (reason instanceof DOMException && reason.name === 'TimeoutError') {
        return {
          type: 'error',
          code: 'timeout',
          message:
            'The assistant took too long to answer. Try again or ask something simpler.',
        };
      }
      return null;
    }
    if (error instanceof LlmError) {
      this.logger.warn(`LLM ${error.kind}: ${error.message}`);
      return error.kind === 'rate_limited'
        ? {
            type: 'error',
            code: 'rate_limited',
            message: 'The assistant is busy right now. Try again in a minute.',
          }
        : {
            type: 'error',
            code: 'unavailable',
            message: 'The assistant is unavailable right now. Try again later.',
          };
    }
    this.logger.error(
      `Chat failed: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`,
    );
    return {
      type: 'error',
      code: 'internal',
      message: 'Something went wrong while answering. Try again.',
    };
  }
}
