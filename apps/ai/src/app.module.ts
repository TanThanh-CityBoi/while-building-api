import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ChatModule } from './chat/chat.module.js';
import { validateEnv } from './config/env.validation.js';
import { HealthController } from './health/health.controller.js';

/**
 * AI app: the assistant's backend. A signed-in CMS user chats through
 * POST /chat; an agent loop answers with an LLM, looking things up with the
 * MCP server's read-only tools. LLM credentials never leave this app.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      // Tests run on the environment vitest sets, never on a developer's .env
      // (which holds real keys and local provider choices).
      ignoreEnvFile: process.env.NODE_ENV === 'test',
    }),
    ChatModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
