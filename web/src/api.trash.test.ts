import { describe, it, expect, afterEach, vi } from 'vitest';
import { restoreNote, permanentDeleteNote, listTrashedNotes } from './api';

const rawNote = (overrides: Record<string, unknown> = {}) => ({
  id: '1',
  title: 'Trashed note',
  body: 'body',
  tags: ['work'],
  pinned: false,
  archived: false,
  color: 'none',
  deletedAt: 123,
  ...overrides,
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('restoreNote', () => {
  it('PATCHes the restore endpoint and returns the normalized note', async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify(rawNote({ deletedAt: null })), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const note = await restoreNote('1');

    expect(fetchMock).toHaveBeenCalledWith('/api/notes/1/restore', { method: 'PATCH' });
    expect(note).toEqual({
      id: '1',
      title: 'Trashed note',
      body: 'body',
      tags: ['work'],
      pinned: false,
      archived: false,
      color: 'none',
      deletedAt: null,
    });
  });

  it('throws when the response is not ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 500 })),
    );
    await expect(restoreNote('1')).rejects.toThrow('failed to restore note');
  });

  it('throws when the payload is not a valid note', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ nope: true }), { status: 200 })),
    );
    await expect(restoreNote('1')).rejects.toThrow('invalid note payload');
  });
});

describe('permanentDeleteNote', () => {
  it('DELETEs the permanent endpoint and resolves on success', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(permanentDeleteNote('7')).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith('/api/notes/7/permanent', { method: 'DELETE' });
  });

  it('treats a 404 as success (already gone)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 404 })),
    );
    await expect(permanentDeleteNote('7')).resolves.toBeUndefined();
  });

  it('throws on a non-404 error status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 500 })),
    );
    await expect(permanentDeleteNote('7')).rejects.toThrow('failed to permanently delete note');
  });
});

describe('listTrashedNotes', () => {
  it('fetches the trash endpoint and returns normalized notes', async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify([rawNote(), rawNote({ id: '2' })]), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const notes = await listTrashedNotes();

    expect(fetchMock).toHaveBeenCalledWith('/api/notes/trash');
    expect(notes).toHaveLength(2);
    expect(notes[0].id).toBe('1');
    expect(notes[1].id).toBe('2');
    expect(notes[0].deletedAt).toBe(123);
  });

  it('throws when the response is not ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 500 })),
    );
    await expect(listTrashedNotes()).rejects.toThrow('failed to load trash');
  });

  it('throws when the payload is not an array of notes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify([{ bad: 1 }]), { status: 200 })),
    );
    await expect(listTrashedNotes()).rejects.toThrow('invalid trash payload');
  });
});
