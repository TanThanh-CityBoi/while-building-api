/** Escapes LIKE/ILIKE wildcards so user input only ever matches literally. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}
