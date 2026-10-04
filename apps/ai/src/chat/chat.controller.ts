import {
  BadRequestException,
  Body,
  Controller,
  Logger,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Response } from 'express';
import { AgentService } from '../agent/agent.service.js';
import { ApiAuthGuard } from '../auth/api-auth.guard.js';
import type { AuthenticatedRequest } from '../auth/authenticated-user.js';
import type { EnvironmentVariables } from '../config/env.validation.js';
import {
  LlmRegistry,
  ModelSelectionError,
  type ModelSelection,
} from '../llm/llm-registry.js';
import { CHAT_LIMITS, ChatRequestDto } from './dto/chat-request.dto.js';
import { openEventStream } from './sse.js';

/**
 * POST /chat — answers the last user message as a stream of server-sent
 * events (see src/agent/agent.types.ts). Authentication (401/403), rate
 * limiting (429) and validation (400) fail as plain JSON before the stream
 * starts; failures after that arrive as an `error` event.
 */
@Controller('chat')
// Auth first: the rate limit is per signed-in user.
@UseGuards(ApiAuthGuard, ThrottlerGuard)
export class ChatController {
  private readonly logger = new Logger(ChatController.name);
  private readonly requestTimeoutMs: number;

  constructor(
    private readonly agent: AgentService,
    private readonly llms: LlmRegistry,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.requestTimeoutMs =
      config.get('AI_REQUEST_TIMEOUT', { infer: true }) * 1000;
  }

  @Post()
  async chat(
    @Body() body: ChatRequestDto,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ): Promise<void> {
    assertConversation(body);
    const selection = this.select(body);

    // `res` closes before finishing only if the client went away (stop
    // button, navigation). Not `req`: it closes as soon as the body is read.
    const disconnected = new AbortController();
    res.on('close', () => {
      if (!res.writableFinished) disconnected.abort();
    });
    const signal = AbortSignal.any([
      disconnected.signal,
      AbortSignal.timeout(this.requestTimeoutMs),
    ]);

    const stream = openEventStream(res);
    try {
      const events = this.agent.run(
        {
          messages: body.messages,
          ...selection,
          userId: req.user?.id ?? 'unknown',
        },
        signal,
      );
      for await (const event of events) stream.send(event);
    } catch (error) {
      // AgentService reports its own failures; this is the last resort.
      this.logger.error(
        `Chat stream failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      stream.send({
        type: 'error',
        code: 'internal',
        message: 'Something went wrong while answering. Try again.',
      });
    } finally {
      stream.close();
    }
  }

  /** The client's provider/model choice, validated (never trusted as-is). */
  private select({ provider, model }: ChatRequestDto): ModelSelection {
    try {
      return this.llms.resolve({ provider, model });
    } catch (error) {
      if (error instanceof ModelSelectionError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }
}

function assertConversation({ messages }: ChatRequestDto): void {
  if (messages[0]?.role !== 'user' || messages.at(-1)?.role !== 'user') {
    throw new BadRequestException(
      'The conversation must start and end with a user message.',
    );
  }
  const total = messages.reduce((sum, m) => sum + m.content.length, 0);
  if (total > CHAT_LIMITS.maxTotalLength) {
    throw new BadRequestException(
      `The conversation is too long (at most ${CHAT_LIMITS.maxTotalLength} characters). Start a new one.`,
    );
  }
}
