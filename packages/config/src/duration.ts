const UNIT_SECONDS: Record<string, number> = {
  s: 1,
  m: 60,
  h: 60 * 60,
  d: 60 * 60 * 24,
};

/**
 * Parses a duration such as `900`, `45s`, `15m`, `12h` or `7d` into seconds.
 * Returns `null` for anything else (including zero).
 */
export function parseDurationToSeconds(value: string): number | null {
  const match = /^(\d+)\s*(s|m|h|d)?$/.exec(value.trim());
  if (!match) return null;

  const [, amount, unit = 's'] = match;
  const seconds = Number(amount) * UNIT_SECONDS[unit];
  return Number.isSafeInteger(seconds) && seconds > 0 ? seconds : null;
}
