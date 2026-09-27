/**
 * @while-building/config — technical helpers for loading and validating
 * environment configuration.
 *
 * Each app declares and validates its own variables (for example
 * apps/api/src/config/env.validation.ts) using these readers. Business
 * settings — roles, permissions, content rules — never belong here.
 */
export { parseDurationToSeconds } from './duration.js';
export {
  NODE_ENVS,
  readBoolean,
  readChoice,
  readDuration,
  readOrigins,
  readPort,
  readRequired,
  readSecret,
  readString,
  readTrustProxy,
  throwIfErrors,
  type NodeEnv,
  type RawEnv,
} from './env.js';
