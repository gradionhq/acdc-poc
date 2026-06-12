import { describe, it, expect } from 'vitest';
import { pageOfNoteById } from './App';
import type { Note, NoteColor, SortOrder } from './api';

/**
 * Deterministic, synchronous unit tests for the page-index math that drives
 * post-create / post-duplicate navigation. This is the logic that the
 * full-App "create → navigate to the right page" tests used to exercise
 * through a long, racy chain of async fetches; testing it directly here makes
 * the behavior provable without any wall-clock timing.
 */

function note(id: string, title: string, pinned = false): Note {
  return {
    id,
    title,
    body: 'b',
    tags: [],
    pinned,
    archived: false,
    color: 'none' as NoteColor,
  };
}

/** Mirrors the server's sort: pinned first, then the chosen order. */
function serverSort(notes: Note[], sort: SortOrder): Note[] {
  return [...notes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (sort === 'title') return a.title.localeCompare(b.title) || Number(a.id) - Number(b.id);
    if (sort === 'oldest') return Number(a.id) - Number(b.id);
    return Number(b.id) - Number(a.id); // newest
  });
}

const PAGE_SIZE = 5;

describe('pageOfNoteById', () => {
  it('returns 1 when the note is on the first page', () => {
    const notes = [note('1', 'a'), note('2', 'b'), note('3', 'c')];
    expect(pageOfNoteById(notes, '2', PAGE_SIZE)).toBe(1);
  });

  it('returns the last index page for the final element of a full first page', () => {
    const notes = Array.from({ length: 5 }, (_, i) => note(String(i + 1), `n${i + 1}`));
    expect(pageOfNoteById(notes, '5', PAGE_SIZE)).toBe(1);
  });

  it('returns page 2 for the 6th note', () => {
    const notes = Array.from({ length: 6 }, (_, i) => note(String(i + 1), `n${i + 1}`));
    expect(pageOfNoteById(notes, '6', PAGE_SIZE)).toBe(2);
  });

  it('newest sort: a freshly created note (highest id) lands on page 1', () => {
    const base = Array.from({ length: 5 }, (_, i) => note(String(i + 1), `Existing ${i + 1}`));
    const created = note('6', 'Sixth note');
    const sorted = serverSort([...base, created], 'newest');
    expect(pageOfNoteById(sorted, '6', PAGE_SIZE)).toBe(1);
  });

  it('oldest sort: a freshly created note (highest id) lands on the last page', () => {
    const base = Array.from({ length: 5 }, (_, i) => note(String(i + 1), `OldSort ${i + 1}`));
    const created = note('6', 'Sixth note');
    const sorted = serverSort([...base, created], 'oldest');
    expect(pageOfNoteById(sorted, '6', PAGE_SIZE)).toBe(2);
  });

  it('title sort: a new "Zebra" sorts last and lands on page 2', () => {
    const base = [
      note('1', 'Apple'),
      note('2', 'Banana'),
      note('3', 'Cherry'),
      note('4', 'Date'),
      note('5', 'Elderberry'),
    ];
    const created = note('6', 'Zebra');
    const sorted = serverSort([...base, created], 'title');
    expect(pageOfNoteById(sorted, '6', PAGE_SIZE)).toBe(2);
  });

  it('title sort with a duplicate title: the new note is located by id, not title', () => {
    // An existing "Zebra" (id 6) is on page 2; creating a second "Zebra" (id 7)
    // must resolve to the page that holds id 7 specifically.
    const base = [
      note('1', 'Apple'),
      note('2', 'Banana'),
      note('3', 'Cherry'),
      note('4', 'Date'),
      note('5', 'Elderberry'),
      note('6', 'Zebra'),
    ];
    const created = note('7', 'Zebra');
    const sorted = serverSort([...base, created], 'title');
    // 7 notes, the two Zebras occupy ranks 6 and 7 (0-based 5,6) → both on page 2.
    expect(pageOfNoteById(sorted, '7', PAGE_SIZE)).toBe(2);
    expect(pageOfNoteById(sorted, '6', PAGE_SIZE)).toBe(2);
  });

  it('pinned-first ordering: a pinned note sorts onto page 1 regardless of sort direction', () => {
    // Under oldest sort a high-id note would normally be last, but pinning it
    // moves it to the front — the math must reflect the server-supplied order.
    const base = Array.from({ length: 6 }, (_, i) => note(String(i + 1), `n${i + 1}`));
    base[5] = note('6', 'n6', true); // pin the would-be-last note
    const sorted = serverSort(base, 'oldest');
    expect(pageOfNoteById(sorted, '6', PAGE_SIZE)).toBe(1);
  });

  it('returns 1 as a safe fallback when the note is absent', () => {
    const notes = [note('1', 'a'), note('2', 'b')];
    expect(pageOfNoteById(notes, 'missing', PAGE_SIZE)).toBe(1);
  });

  it('returns 1 when pageSize is not positive', () => {
    const notes = [note('1', 'a')];
    expect(pageOfNoteById(notes, '1', 0)).toBe(1);
    expect(pageOfNoteById(notes, '1', -3)).toBe(1);
  });
});
