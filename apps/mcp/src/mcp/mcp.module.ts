import { Module } from '@nestjs/common';
import { ContentApi } from '../content-api/content-api.js';
import { HttpContentApi } from '../content-api/http-content-api.js';
import { McpController } from './mcp.controller.js';

@Module({
  controllers: [McpController],
  providers: [{ provide: ContentApi, useClass: HttpContentApi }],
})
export class McpModule {}
