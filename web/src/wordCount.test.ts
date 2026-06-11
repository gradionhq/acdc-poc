import { describe, it, expect } from 'vitest';
import { countWords, countChars } from './wordCount';

describe('countWords', () => {
  it('returns 0 for an empty string', () => {
    expect(countWords('')).toBe(0);
  });

  it('returns 0 for a string of only spaces', () => {
    expect(countWords('   ')).toBe(0);
  });

  it('returns 0 for a string of only newlines', () => {
    expect(countWords('\n\n\n')).toBe(0);
  });

  it('returns 0 for a string of mixed whitespace', () => {
    expect(countWords('  \t  \n  ')).toBe(0);
  });

  it('returns 1 for a single word', () => {
    expect(countWords('hello')).toBe(1);
  });

  it('counts simple space-separated words', () => {
    expect(countWords('hello world')).toBe(2);
  });

  it('handles multiple spaces between words', () => {
    expect(countWords('hello   world')).toBe(2);
  });

  it('handles leading spaces', () => {
    expect(countWords('  hello world')).toBe(2);
  });

  it('handles trailing spaces', () => {
    expect(countWords('hello world  ')).toBe(2);
  });

  it('handles leading and trailing spaces together', () => {
    expect(countWords('  hello world  ')).toBe(2);
  });

  it('handles newlines as word separators', () => {
    expect(countWords('hello\nworld')).toBe(2);
  });

  it('handles mixed whitespace (spaces, tabs, newlines)', () => {
    expect(countWords('one\ttwo\nthree   four')).toBe(4);
  });

  it('handles unicode words', () => {
    expect(countWords('héllo wörld')).toBe(2);
  });

  it('handles unicode emoji as tokens', () => {
    expect(countWords('hello 🌍 world')).toBe(3);
  });

  it('handles CJK characters as a single token', () => {
    // CJK text separated by a space — each space-separated chunk is one word
    expect(countWords('你好 世界')).toBe(2);
  });

  it('counts a longer sentence correctly', () => {
    expect(countWords('The quick brown fox jumps over the lazy dog')).toBe(9);
  });
});

describe('countChars', () => {
  it('returns 0 for an empty string', () => {
    expect(countChars('')).toBe(0);
  });

  it('counts characters in a simple word', () => {
    expect(countChars('hello')).toBe(5);
  });

  it('includes spaces in the character count', () => {
    expect(countChars('hello world')).toBe(11);
  });

  it('includes leading and trailing spaces', () => {
    expect(countChars('  hi  ')).toBe(6);
  });

  it('includes newlines in the character count', () => {
    expect(countChars('hello\nworld')).toBe(11);
  });

  it('returns the correct count for unicode characters', () => {
    expect(countChars('héllo')).toBe(5);
  });

  it('counts single-code-point emoji as one character', () => {
    // 🌍 is a single code point (U+1F30D); multi-code-point grapheme clusters
    // (flags, ZWJ sequences) count as more than one.
    expect(countChars('🌍')).toBe(1);
  });

  it('handles a string of only spaces', () => {
    expect(countChars('   ')).toBe(3);
  });
});
