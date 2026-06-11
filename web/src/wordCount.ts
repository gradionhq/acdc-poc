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
 * Count the number of Unicode code points (characters) in `text`.
 * Uses the string iterator which correctly counts surrogate pairs
 * (emoji, CJK supplementary, etc.) as a single character each.
 */
export function countChars(text: string): number {
  return [...text].length;
}
