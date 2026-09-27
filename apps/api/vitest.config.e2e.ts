import { defineConfig } from 'vitest/config';
import { TEST_ENV } from './test/setup/test-env.js';

export default defineConfig({
  test: {
    include: ['test/**/*.e2e-spec.ts'],
    // Creates the test database and applies migrations once.
    globalSetup: ['test/setup/global-setup.ts'],
    env: TEST_ENV,
    // All files share one database, so run them one after another.
    fileParallelism: false,
    hookTimeout: 30_000,
  },
});
