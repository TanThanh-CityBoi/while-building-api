import {
  NODE_ENVS,
  readChoice,
  readPort,
  throwIfErrors,
  type NodeEnv,
  type RawEnv,
} from '@while-building/config';

export interface EnvironmentVariables {
  NODE_ENV: NodeEnv;
  PORT: number;
}

/**
 * Validates and coerces environment variables once at startup, so the app
 * fails fast on bad configuration and ConfigService returns typed values.
 */
export function validateEnv(raw: RawEnv): EnvironmentVariables {
  const errors: string[] = [];
  const env: EnvironmentVariables = {
    NODE_ENV: readChoice(raw, 'NODE_ENV', NODE_ENVS, 'development', errors),
    PORT: readPort(raw, 'PORT', 3001, errors),
  };
  throwIfErrors(errors);
  return env;
}
