import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The app needs no external services (tests fake the API), so its
    // end-to-end tests run with the unit tests.
    include: ['src/**/*.spec.ts', 'test/**/*.e2e-spec.ts'],
    env: { API_URL: 'http://api.test' },
  },
});
