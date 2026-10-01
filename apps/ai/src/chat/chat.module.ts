import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AgentModule } from '../agent/agent.module.js';
import { AuthModule } from '../auth/auth.module.js';
import type { AuthenticatedRequest } from '../auth/authenticated-user.js';
import type { EnvironmentVariables } from '../config/env.validation.js';
import { ChatController } from './chat.controller.js';

@Module({
  imports: [
    AgentModule,
    AuthModule,
    // Each answer costs LLM tokens: limit requests per signed-in user.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => ({
        throttlers: [
          {
            name: 'chat',
            ttl: config.get('AI_RATE_LIMIT_WINDOW', { infer: true }) * 1000,
            limit: config.get('AI_RATE_LIMIT', { infer: true }),
          },
        ],
        getTracker: (req: Record<string, unknown>) =>
          (req as unknown as AuthenticatedRequest).user?.id ?? String(req.ip),
        errorMessage:
          'Too many questions in a short time. Try again in a few minutes.',
      }),
    }),
  ],
  controllers: [ChatController],
})
export class ChatModule {}
