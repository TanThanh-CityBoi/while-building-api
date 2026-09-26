import { describe, expect, it } from 'vitest';
import { validateEnv } from './env.validation.js';

const validEnv = {
  DATABASE_HOST: 'localhost',
  DATABASE_USER: 'postgres',
  DATABASE_PASSWORD: 'postgres',
  DATABASE_NAME: 'while_building',
  CORS_ORIGIN: 'http://localhost:5173',
};

describe('validateEnv', () => {
  it('applies defaults for optional values', () => {
    expect(validateEnv(validEnv)).toEqual({
      PORT: 3000,
      DATABASE_HOST: 'localhost',
      DATABASE_PORT: 5432,
      DATABASE_USER: 'postgres',
      DATABASE_PASSWORD: 'postgres',
      DATABASE_NAME: 'while_building',
      CORS_ORIGIN: ['http://localhost:5173'],
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
      /DATABASE_HOST is required[\s\S]*DATABASE_USER is required[\s\S]*DATABASE_NAME is required[\s\S]*CORS_ORIGIN is required/,
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
});
