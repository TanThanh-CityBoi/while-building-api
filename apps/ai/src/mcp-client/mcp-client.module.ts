import { Module } from '@nestjs/common';
import { McpClientService } from './mcp-client.service.js';
import { McpGateway } from './mcp-gateway.js';

@Module({
  providers: [{ provide: McpGateway, useClass: McpClientService }],
  exports: [McpGateway],
})
export class McpClientModule {}
