import type { TransformFnParams } from 'class-transformer';

// class-transformer helpers for request DTOs. Non-strings pass through untouched
// so the validators can reject them.

export const trimString = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : (value as unknown);

export const trimAndLowercase = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : (value as unknown);
