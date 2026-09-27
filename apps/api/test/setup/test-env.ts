/**
 * Environment for the e2e tests. Applied on top of .env / the real environment
 * (for the PostgreSQL host and credentials), so tests always use their own
 * database and secrets.
 */
export const TEST_ENV = {
  NODE_ENV: 'test',
  DATABASE_NAME: 'while_building_test',
  CORS_ORIGIN: 'http://localhost:5173,http://localhost:5174',
  JWT_ACCESS_SECRET: 'test-access-secret-0123456789abcdefghijklmnopqrstuvwxyz',
  JWT_REFRESH_SECRET:
    'test-refresh-secret-0123456789abcdefghijklmnopqrstuvwxyz',
  JWT_ACCESS_EXPIRES_IN: '15m',
  JWT_REFRESH_EXPIRES_IN: '7d',
  ROOT_EMAIL: 'root@while-building.test',
  ROOT_PASSWORD: 'root-password-for-tests',
  ROOT_NAME: 'Root',
} as const;
