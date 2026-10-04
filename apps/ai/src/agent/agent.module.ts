import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module.js';
import { McpClientModule } from '../mcp-client/mcp-client.module.js';
import { AgentService } from './agent.service.js';

@Module({
  imports: [LlmModule, McpClientModule],
  providers: [AgentService],
  exports: [AgentService],
})
export class AgentModule {}
