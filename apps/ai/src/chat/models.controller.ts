import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiAuthGuard } from '../auth/api-auth.guard.js';
import { LlmRegistry, type ModelOptions } from '../llm/llm-registry.js';

/**
 * GET /models — the providers and models the CMS may offer: only enabled
 * providers and their allowed models, with the defaults. Same authentication
 * as /chat; POST /chat validates the choice again.
 */
@Controller('models')
@UseGuards(ApiAuthGuard)
export class ModelsController {
  constructor(private readonly llms: LlmRegistry) {}

  @Get()
  list(): { data: ModelOptions } {
    return { data: this.llms.options() };
  }
}
