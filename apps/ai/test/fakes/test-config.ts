import type { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../../src/config/env.validation.js';

/** A ConfigService stand-in for unit tests. */
export function testConfig(
  values: Partial<EnvironmentVariables> = {},
): ConfigService<EnvironmentVariables, true> {
  const all: Partial<EnvironmentVariables> = {
    API_URL: 'http://api.test',
    MCP_URL: 'http://mcp.test/mcp',
    AI_MAX_TOOL_ROUNDS: 3,
    AI_REQUEST_TIMEOUT: 90,
    AI_TOOL_TIMEOUT: 10,
    ...values,
  };
  return {
    get: (key: keyof EnvironmentVariables) => all[key],
  } as unknown as ConfigService<EnvironmentVariables, true>;
}
