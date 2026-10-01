import {
  All,
  Controller,
  Logger,
  Req,
  Res,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  hostHeaderValidation,
  originValidation,
  toNodeHandler,
} from '@modelcontextprotocol/node';
import {
  createMcpHandler,
  type McpHttpHandler,
} from '@modelcontextprotocol/server';
import type { Request, Response } from 'express';
import type { EnvironmentVariables } from '../config/env.validation.js';
import { ContentApi } from '../content-api/content-api.js';
import { createMcpServer } from './mcp-server.factory.js';

type RequestGuard = (req: Request, res: Response) => boolean;

/**
 * The MCP endpoint (Streamable HTTP). Stateless: every request gets a fresh
 * server from the factory, so GET/DELETE (session operations) answer 405.
 * Responses are plain JSON — no tool streams progress.
 */
@Controller()
export class McpController implements OnModuleDestroy {
  private readonly logger = new Logger(McpController.name);
  private readonly handler: McpHttpHandler;
  private readonly handle: ReturnType<typeof toNodeHandler>;
  private readonly guards: RequestGuard[];

  constructor(
    content: ContentApi,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    const onerror = (error: Error) =>
      this.logger.warn(`MCP request failed: ${error.message}`);
    this.handler = createMcpHandler(() => createMcpServer(content), {
      responseMode: 'json',
      onerror,
    });
    this.handle = toNodeHandler(this.handler, { onerror });

    // DNS rebinding protection: only known Host / Origin hostnames.
    const allowed = config.get('MCP_ALLOWED_HOSTS', { infer: true });
    this.guards = [hostHeaderValidation(allowed), originValidation(allowed)];
  }

  @All('mcp')
  async mcp(@Req() req: Request, @Res() res: Response): Promise<void> {
    if (!this.guards.every((guard) => guard(req, res))) return;
    // Nest has already read and parsed the JSON body, so hand it over.
    await this.handle(req, res, req.method === 'POST' ? req.body : undefined);
  }

  async onModuleDestroy(): Promise<void> {
    await this.handler.close();
  }
}
