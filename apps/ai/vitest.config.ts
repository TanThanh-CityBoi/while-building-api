import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The app needs no external services (tests fake the API, the LLM and
    // the MCP server), so its end-to-end tests run with the unit tests.
    include: ['src/**/*.spec.ts', 'test/**/*.e2e-spec.ts'],
    env: {
      NODE_ENV: 'test',
      CORS_ORIGIN: 'http://localhost:5174',
      API_URL: 'http://api.test',
      MCP_URL: 'http://mcp.test/mcp',
      ANTHROPIC_API_KEY: 'test-key',
      AI_RATE_LIMIT: '5',
    },
  },
});
