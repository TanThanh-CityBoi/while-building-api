import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.validation.js';
import { HealthController } from './health/health.controller.js';
import { McpModule } from './mcp/mcp.module.js';

/**
 * MCP app: exposes While Building's published content to AI agents as
 * read-only MCP tools and resources. It holds no business logic and no
 * database — every answer comes from the API over HTTP.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    McpModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
