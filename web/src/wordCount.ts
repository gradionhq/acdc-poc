/**
 * Pure helpers for counting words and characters in a string.
 * No side effects; safe to call on every keystroke.
 */

/**
 * Count the number of whitespace-separated tokens in `text`.
 * An empty or all-whitespace string returns 0.
 */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed === '') return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * Count the number of Unicode code points in `text`.
 * Surrogate-pair code points (e.g. 🌍) count as 1, but multi-code-point
 * grapheme clusters (flags, ZWJ sequences, skin-tone modifiers) count as
 * more than one.
 */
export function countChars(text: string): number {
  return [...text].length;
}
