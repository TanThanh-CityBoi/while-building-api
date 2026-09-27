import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The app needs no external services, so its end-to-end boot test runs
    // with the unit tests.
    include: ['src/**/*.spec.ts', 'test/**/*.e2e-spec.ts'],
  },
});
