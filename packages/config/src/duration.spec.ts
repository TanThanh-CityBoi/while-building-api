import { describe, expect, it } from 'vitest';
import { parseDurationToSeconds } from './duration.js';

describe('parseDurationToSeconds', () => {
  it.each([
    ['900', 900],
    ['45s', 45],
    ['15m', 900],
    ['12h', 43_200],
    ['7d', 604_800],
    [' 30 m ', 1_800],
  ])('parses %j as %d seconds', (input, seconds) => {
    expect(parseDurationToSeconds(input)).toBe(seconds);
  });

  it.each(['', '0', '0m', '-5m', '1.5h', '15 minutes', '1w', 'abc'])(
    'rejects %j',
    (input) => {
      expect(parseDurationToSeconds(input)).toBeNull();
    },
  );
});
