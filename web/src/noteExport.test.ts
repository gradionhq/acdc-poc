import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  serializeNotes,
  exportFilename,
  downloadFile,
  exportNotes,
  type ExportFormat,
} from './noteExport';
import type { Note } from './api';

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'n1',
    title: 'My Note',
    body: 'Hello **world**',
    tags: ['work', 'urgent'],
    pinned: false,
    archived: false,
    color: 'none',
    deletedAt: null,
    ...overrides,
  };
}

describe('serializeNotes (json)', () => {
  it('produces a pretty-printed array even for a single note', () => {
    const out = serializeNotes([makeNote()], 'json');
    const parsed = JSON.parse(out);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toEqual({
      id: 'n1',
      title: 'My Note',
      body: 'Hello **world**',
      tags: ['work', 'urgent'],
      pinned: false,
      archived: false,
      color: 'none',
    });
  });

  it('omits transient fields like deletedAt', () => {
    const out = serializeNotes([makeNote({ deletedAt: 12345 })], 'json');
    expect(out).not.toContain('deletedAt');
  });

  it('serializes multiple notes as an array and ends with a newline', () => {
    const out = serializeNotes([makeNote({ id: 'a' }), makeNote({ id: 'b' })], 'json');
    expect(JSON.parse(out)).toHaveLength(2);
    expect(out.endsWith('\n')).toBe(true);
  });

  it('returns an empty array for no notes', () => {
    expect(JSON.parse(serializeNotes([], 'json'))).toEqual([]);
  });
});

describe('serializeNotes (md)', () => {
  it('renders the title as an H1 and includes the body verbatim', () => {
    const out = serializeNotes([makeNote({ title: 'Title', body: 'Body text' })], 'md');
    expect(out).toContain('# Title');
    expect(out).toContain('Body text');
  });

  it('lists tags with hash prefixes when present', () => {
    const out = serializeNotes([makeNote({ tags: ['x', 'y'] })], 'md');
    expect(out).toContain('Tags: #x #y');
  });

  it('omits the tags line when there are no tags', () => {
    const out = serializeNotes([makeNote({ tags: [] })], 'md');
    expect(out).not.toContain('Tags:');
  });

  it('falls back to "Untitled note" for a blank title', () => {
    const out = serializeNotes([makeNote({ title: '   ' })], 'md');
    expect(out).toContain('# Untitled note');
  });

  it('separates multiple notes with a horizontal rule', () => {
    const out = serializeNotes([makeNote({ id: 'a' }), makeNote({ id: 'b' })], 'md');
    expect(out).toContain('\n---\n');
  });

  it('ends each note with a single trailing newline', () => {
    const out = serializeNotes([makeNote({ body: 'text\n\n\n' })], 'md');
    expect(out.endsWith('\n')).toBe(true);
    expect(out.endsWith('\n\n')).toBe(false);
  });
});

describe('exportFilename', () => {
  it('slugifies the title and appends the format extension', () => {
    expect(exportFilename(makeNote({ title: 'My Great Note' }), 'md')).toBe('my-great-note.md');
    expect(exportFilename(makeNote({ title: 'My Great Note' }), 'json')).toBe('my-great-note.json');
  });

  it('strips unsafe filesystem characters', () => {
    expect(exportFilename(makeNote({ title: 'a/b:c*?"<>|d' }), 'md')).toBe('a-b-c-d.md');
  });

  it('falls back to "note" when the title produces an empty slug', () => {
    expect(exportFilename(makeNote({ title: '///' }), 'md')).toBe('note.md');
  });

  it('strips leading dots so it cannot create a hidden file', () => {
    expect(exportFilename(makeNote({ title: '...secret' }), 'json')).toBe('secret.json');
  });

  it('truncates very long titles to 100 characters of slug', () => {
    const long = 'a'.repeat(200);
    const name = exportFilename(makeNote({ title: long }), 'md');
    expect(name).toBe(`${'a'.repeat(100)}.md`);
  });

  it('uses a generic collection name when note is null', () => {
    expect(exportFilename(null, 'md')).toBe('notes.md');
    expect(exportFilename(null, 'json')).toBe('notes.json');
  });
});

describe('downloadFile', () => {
  const clickSpy = vi.fn();
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    clickSpy.mockClear();
    createObjectURL = vi.fn(() => 'blob:mock');
    revokeObjectURL = vi.fn();
    // jsdom does not implement object URL APIs.
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, configurable: true });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(clickSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a blob URL, clicks an anchor with the download name, and revokes the URL', () => {
    downloadFile('out.md', '# hi', 'md');
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(clickSpy).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock');
  });

  it('does not leave the transient anchor attached to the document', () => {
    downloadFile('out.json', '{}', 'json');
    expect(document.querySelector('a[download]')).toBeNull();
  });
});

describe('exportNotes', () => {
  beforeEach(() => {
    Object.defineProperty(URL, 'createObjectURL', {
      value: vi.fn(() => 'blob:x'),
      configurable: true,
    });
    Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('serializes and downloads using the single note filename when provided', () => {
    const note = makeNote({ title: 'Solo' });
    const downloadSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click');
    let captured: string | undefined;
    const setter = vi
      .spyOn(HTMLAnchorElement.prototype, 'download', 'set')
      .mockImplementation(function (this: HTMLAnchorElement, value: string) {
        captured = value;
      });
    exportNotes([note], 'md', note);
    expect(downloadSpy).toHaveBeenCalledOnce();
    expect(captured).toBe('solo.md');
    setter.mockRestore();
  });

  it('runs without throwing for the all-notes (null single) case', () => {
    const fmt: ExportFormat = 'json';
    expect(() => exportNotes([makeNote()], fmt, null)).not.toThrow();
  });
});
