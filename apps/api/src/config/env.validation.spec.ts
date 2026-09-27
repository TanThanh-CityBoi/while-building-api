import { describe, expect, it } from 'vitest';
import { validateEnv } from './env.validation.js';

const ACCESS_SECRET = 'a'.repeat(32);
const REFRESH_SECRET = 'b'.repeat(32);

const validEnv = {
  DATABASE_HOST: 'localhost',
  DATABASE_USER: 'postgres',
  DATABASE_PASSWORD: 'postgres',
  DATABASE_NAME: 'while_building',
  CORS_ORIGIN: 'http://localhost:5173',
  JWT_ACCESS_SECRET: ACCESS_SECRET,
  JWT_REFRESH_SECRET: REFRESH_SECRET,
};

describe('validateEnv', () => {
  it('applies defaults for optional values', () => {
    expect(validateEnv(validEnv)).toEqual({
      NODE_ENV: 'development',
      PORT: 3000,
      DATABASE_HOST: 'localhost',
      DATABASE_PORT: 5432,
      DATABASE_USER: 'postgres',
      DATABASE_PASSWORD: 'postgres',
      DATABASE_NAME: 'while_building',
      CORS_ORIGIN: ['http://localhost:5173'],
      TRUST_PROXY: undefined,
      JWT_ACCESS_SECRET: ACCESS_SECRET,
      JWT_REFRESH_SECRET: REFRESH_SECRET,
      JWT_ACCESS_EXPIRES_IN: 15 * 60,
      JWT_REFRESH_EXPIRES_IN: 7 * 24 * 60 * 60,
      COOKIE_SECURE: false,
      COOKIE_SAME_SITE: 'lax',
      COOKIE_DOMAIN: undefined,
      SWAGGER_ENABLED: true,
      ROOT_EMAIL: undefined,
      ROOT_PASSWORD: undefined,
      ROOT_NAME: undefined,
    });
  });

  it('coerces ports to numbers', () => {
    const env = validateEnv({
      ...validEnv,
      PORT: '8080',
      DATABASE_PORT: '5433',
    });

    expect(env.PORT).toBe(8080);
    expect(env.DATABASE_PORT).toBe(5433);
  });

  it('allows an empty database password', () => {
    expect(
      validateEnv({ ...validEnv, DATABASE_PASSWORD: '' }).DATABASE_PASSWORD,
    ).toBe('');
  });

  it('parses a comma-separated list of CORS origins', () => {
    const env = validateEnv({
      ...validEnv,
      CORS_ORIGIN: 'https://example.com, https://www.example.com',
    });

    expect(env.CORS_ORIGIN).toEqual([
      'https://example.com',
      'https://www.example.com',
    ]);
  });

  it('reports every missing required variable at once', () => {
    expect(() => validateEnv({})).toThrow(
      /DATABASE_HOST is required[\s\S]*DATABASE_USER is required[\s\S]*DATABASE_NAME is required[\s\S]*CORS_ORIGIN is required[\s\S]*JWT_ACCESS_SECRET is required[\s\S]*JWT_REFRESH_SECRET is required/,
    );
  });

  it.each(['abc', '0', '70000', '3000.5'])('rejects PORT=%s', (port) => {
    expect(() => validateEnv({ ...validEnv, PORT: port })).toThrow(
      /PORT must be an integer/,
    );
  });

  it.each([
    'http://localhost:5173/',
    'https://example.com/app',
    'localhost:5173',
    '*',
  ])('rejects CORS_ORIGIN=%s', (origin) => {
    expect(() => validateEnv({ ...validEnv, CORS_ORIGIN: origin })).toThrow(
      /CORS_ORIGIN contains/,
    );
  });

  it('rejects a CORS_ORIGIN with no origins', () => {
    expect(() => validateEnv({ ...validEnv, CORS_ORIGIN: ' , ' })).toThrow(
      /CORS_ORIGIN is required/,
    );
  });

  describe('JWT settings', () => {
    it('requires secrets of at least 32 characters', () => {
      expect(() =>
        validateEnv({ ...validEnv, JWT_ACCESS_SECRET: 'change-me' }),
      ).toThrow(/JWT_ACCESS_SECRET must be at least 32 characters/);
    });

    it('requires different access and refresh secrets', () => {
      expect(() =>
        validateEnv({ ...validEnv, JWT_REFRESH_SECRET: ACCESS_SECRET }),
      ).toThrow(/must be different/);
    });

    it('rejects placeholder secrets in production only', () => {
      const placeholder = 'change-me-to-a-long-random-secret-for-access-tokens';
      expect(
        validateEnv({ ...validEnv, JWT_ACCESS_SECRET: placeholder })
          .JWT_ACCESS_SECRET,
      ).toBe(placeholder);
      expect(() =>
        validateEnv({
          ...validEnv,
          NODE_ENV: 'production',
          JWT_ACCESS_SECRET: placeholder,
        }),
      ).toThrow(/JWT_ACCESS_SECRET still contains a placeholder/);
    });

    it('parses lifetimes and requires the refresh token to outlive the access token', () => {
      const env = validateEnv({
        ...validEnv,
        JWT_ACCESS_EXPIRES_IN: '600',
        JWT_REFRESH_EXPIRES_IN: '12h',
      });
      expect(env.JWT_ACCESS_EXPIRES_IN).toBe(600);
      expect(env.JWT_REFRESH_EXPIRES_IN).toBe(12 * 3600);

      expect(() =>
        validateEnv({ ...validEnv, JWT_ACCESS_EXPIRES_IN: 'soon' }),
      ).toThrow(/JWT_ACCESS_EXPIRES_IN must be a duration/);
      expect(() =>
        validateEnv({
          ...validEnv,
          JWT_ACCESS_EXPIRES_IN: '1d',
          JWT_REFRESH_EXPIRES_IN: '1h',
        }),
      ).toThrow(/must be longer than JWT_ACCESS_EXPIRES_IN/);
    });
  });

  describe('production defaults and cookie settings', () => {
    it('turns on secure cookies and turns off Swagger in production', () => {
      const env = validateEnv({ ...validEnv, NODE_ENV: 'production' });
      expect(env.COOKIE_SECURE).toBe(true);
      expect(env.SWAGGER_ENABLED).toBe(false);
    });

    it('requires secure cookies for SameSite=None', () => {
      expect(() =>
        validateEnv({ ...validEnv, COOKIE_SAME_SITE: 'none' }),
      ).toThrow(/COOKIE_SAME_SITE=none requires COOKIE_SECURE=true/);
      expect(
        validateEnv({
          ...validEnv,
          COOKIE_SAME_SITE: 'none',
          COOKIE_SECURE: 'true',
        }).COOKIE_SAME_SITE,
      ).toBe('none');
    });

    it('rejects unknown enum and boolean values', () => {
      expect(() => validateEnv({ ...validEnv, NODE_ENV: 'staging' })).toThrow(
        /NODE_ENV must be one of/,
      );
      expect(() => validateEnv({ ...validEnv, COOKIE_SECURE: 'yes' })).toThrow(
        /COOKIE_SECURE must be "true" or "false"/,
      );
    });

    it('parses TRUST_PROXY into what Express expects', () => {
      expect(validateEnv({ ...validEnv, TRUST_PROXY: '1' }).TRUST_PROXY).toBe(
        1,
      );
      expect(
        validateEnv({ ...validEnv, TRUST_PROXY: 'true' }).TRUST_PROXY,
      ).toBe(true);
      expect(
        validateEnv({ ...validEnv, TRUST_PROXY: 'loopback' }).TRUST_PROXY,
      ).toBe('loopback');
    });
  });
});
