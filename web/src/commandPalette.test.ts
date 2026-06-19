import { describe, it, expect, vi } from 'vitest';
import { fuzzyMatch, filterCommands, type Command } from './commandPalette';

function cmd(id: string, title: string): Command {
  return { id, title, group: 'Test', run: vi.fn() };
}

describe('fuzzyMatch', () => {
  it('matches everything for an empty (or whitespace) query', () => {
    expect(fuzzyMatch('New note', '')).toBe(true);
    expect(fuzzyMatch('New note', '   ')).toBe(true);
  });

  it('matches a contiguous case-insensitive substring', () => {
    expect(fuzzyMatch('New note', 'note')).toBe(true);
    expect(fuzzyMatch('New note', 'NEW')).toBe(true);
  });

  it('matches a non-contiguous subsequence in order', () => {
    expect(fuzzyMatch('Toggle theme', 'tgth')).toBe(true);
    expect(fuzzyMatch('Go to: Archived', 'gta')).toBe(true);
  });

  it('rejects characters that appear out of order', () => {
    expect(fuzzyMatch('New note', 'eten')).toBe(false);
  });

  it('rejects a query with characters not present', () => {
    expect(fuzzyMatch('New note', 'xyz')).toBe(false);
  });
});

describe('filterCommands', () => {
  const commands = [cmd('a', 'New note'), cmd('b', 'Toggle theme'), cmd('c', 'Go to: Trash')];

  it('returns a copy of the full list for an empty query', () => {
    const result = filterCommands(commands, '');
    expect(result).toEqual(commands);
    expect(result).not.toBe(commands);
  });

  it('keeps only fuzzy-matching commands, preserving order', () => {
    const result = filterCommands(commands, 'to');
    expect(result.map((c) => c.id)).toEqual(['b', 'c']);
  });

  it('returns an empty array when nothing matches', () => {
    expect(filterCommands(commands, 'zzz')).toEqual([]);
  });
});
