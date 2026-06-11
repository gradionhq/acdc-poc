// test/store.test.ts
import { describe, expect, it } from 'vitest';
import { NoteStore } from '../src/store';

describe('NoteStore', () => {
  it('creates a note with a unique id and stable order', () => {
    const store = new NoteStore();
    const a = store.create({ title: 'a', body: 'A' });
    const b = store.create({ title: 'b', body: 'B' });
    expect(a.id).not.toEqual(b.id);
    expect(store.get(a.id)).toEqual(a);
  });

  it('lists notes 1-based by page, returning the first page first', () => {
    const store = new NoteStore();
    const created = Array.from({ length: 5 }, (_, i) =>
      store.create({ title: `t${i}`, body: `b${i}` }),
    );
    const page1 = store.list(1, 2);
    expect(page1.total).toBe(5);
    expect(page1.items.map((n) => n.id)).toEqual([created[0].id, created[1].id]);
    const page2 = store.list(2, 2);
    expect(page2.items.map((n) => n.id)).toEqual([created[2].id, created[3].id]);
  });

  it('filters by query term case-insensitively across title and body', () => {
    const store = new NoteStore();
    store.create({ title: 'Hello World', body: 'some content' });
    store.create({ title: 'Goodbye', body: 'World is great' });
    store.create({ title: 'Unrelated', body: 'no match here' });

    const result = store.list(1, 10, 'world');
    expect(result.total).toBe(2);
    expect(result.items.map((n) => n.title)).toEqual(['Hello World', 'Goodbye']);
  });

  it('returns all notes when query is empty string', () => {
    const store = new NoteStore();
    store.create({ title: 'a', body: 'b' });
    store.create({ title: 'c', body: 'd' });

    const result = store.list(1, 10, '');
    expect(result.total).toBe(2);
  });

  it('returns all notes when query is undefined', () => {
    const store = new NoteStore();
    store.create({ title: 'a', body: 'b' });

    const result = store.list(1, 10);
    expect(result.total).toBe(1);
  });

  it('paginates filtered results correctly', () => {
    const store = new NoteStore();
    for (let i = 0; i < 5; i += 1) {
      store.create({ title: `xyzterm note ${i}`, body: 'shared' });
    }
    store.create({ title: 'other', body: 'unrelated content' });

    const page1 = store.list(1, 2, 'xyzterm');
    expect(page1.total).toBe(5);
    expect(page1.items).toHaveLength(2);

    const page2 = store.list(2, 2, 'xyzterm');
    expect(page2.total).toBe(5);
    expect(page2.items).toHaveLength(2);
  });

  it('updates and deletes notes, reporting misses', () => {
    const store = new NoteStore();
    const n = store.create({ title: 't', body: 'b' });
    expect(store.update(n.id, { title: 'x' })?.title).toBe('x');
    expect(store.update('nope', { title: 'x' })).toBeUndefined();
    expect(store.delete(n.id)).toBe(true);
    expect(store.delete(n.id)).toBe(false);
  });

  it('creates a note with tags and returns them', () => {
    const store = new NoteStore();
    const n = store.create({ title: 't', body: 'b', tags: ['foo', 'bar'] });
    expect(n.tags).toEqual(['foo', 'bar']);
    expect(store.get(n.id)?.tags).toEqual(['foo', 'bar']);
  });

  it('creates a note with empty tags when tags are omitted', () => {
    const store = new NoteStore();
    const n = store.create({ title: 't', body: 'b' });
    expect(n.tags).toEqual([]);
  });

  it('updates tags via update()', () => {
    const store = new NoteStore();
    const n = store.create({ title: 't', body: 'b', tags: ['old'] });
    const updated = store.update(n.id, { tags: ['new1', 'new2'] });
    expect(updated?.tags).toEqual(['new1', 'new2']);
  });

  it('filters notes by tag (case-insensitive exact match)', () => {
    const store = new NoteStore();
    store.create({ title: 'a', body: 'b', tags: ['work'] });
    store.create({ title: 'c', body: 'd', tags: ['personal'] });
    store.create({ title: 'e', body: 'f' });

    const result = store.list(1, 10, undefined, 'work');
    expect(result.total).toBe(1);
    expect(result.items[0].title).toBe('a');
  });

  it('tag filter is case-insensitive', () => {
    const store = new NoteStore();
    store.create({ title: 'a', body: 'b', tags: ['Work'] });
    const result = store.list(1, 10, undefined, 'work');
    expect(result.total).toBe(1);
  });

  it('returns all notes when tag filter is empty', () => {
    const store = new NoteStore();
    store.create({ title: 'a', body: 'b', tags: ['work'] });
    store.create({ title: 'c', body: 'd' });
    const result = store.list(1, 10, undefined, '');
    expect(result.total).toBe(2);
  });

  it('combines query and tag filters', () => {
    const store = new NoteStore();
    store.create({ title: 'match title', body: 'b', tags: ['work'] });
    store.create({ title: 'match title', body: 'b', tags: ['personal'] });
    store.create({ title: 'other', body: 'b', tags: ['work'] });

    const result = store.list(1, 10, 'match', 'work');
    expect(result.total).toBe(1);
    expect(result.items[0].title).toBe('match title');
    expect(result.items[0].tags).toContain('work');
  });
});

describe('NoteStore — attachment security', () => {
  it('strips double-quotes from filenames so Content-Disposition is safe', () => {
    const store = new NoteStore();
    const note = store.create({ title: 't', body: 'b' });
    // Simulate a filename with a double-quote (would be header-injection risk)
    const meta = store.addAttachment(note.id, {
      filename: 'evil".txt',
      contentType: 'text/plain',
      data: Buffer.from('x'),
    });
    expect(meta).toBeDefined();
    // Stored filename must not contain a raw double-quote
    expect(meta!.filename).not.toContain('"');
  });

  it('strips control characters from filenames', () => {
    const store = new NoteStore();
    const note = store.create({ title: 't', body: 'b' });
    const meta = store.addAttachment(note.id, {
      // CR + LF would cause header injection / Node to throw ERR_INVALID_CHAR
      filename: 'bad\r\nname.txt',
      contentType: 'text/plain',
      data: Buffer.from('x'),
    });
    expect(meta).toBeDefined();
    // eslint-disable-next-line no-control-regex
    expect(meta!.filename).not.toMatch(/[\x00-\x1f]/);
  });

  it('disambiguates colliding filenames with a numeric suffix', () => {
    const store = new NoteStore();
    const note = store.create({ title: 't', body: 'b' });
    const m1 = store.addAttachment(note.id, {
      filename: 'dup.txt',
      contentType: 'text/plain',
      data: Buffer.from('first'),
    });
    const m2 = store.addAttachment(note.id, {
      filename: 'dup.txt',
      contentType: 'text/plain',
      data: Buffer.from('second'),
    });
    expect(m1).toBeDefined();
    expect(m2).toBeDefined();
    expect(m1!.filename).not.toEqual(m2!.filename);
    // Both must be retrievable
    expect(store.listAttachments(note.id)).toHaveLength(2);
  });

  it('returns undefined once the per-note attachment cap is reached', () => {
    const store = new NoteStore();
    const note = store.create({ title: 't', body: 'b' });
    const cap = NoteStore.MAX_ATTACHMENTS_PER_NOTE;
    for (let i = 0; i < cap; i++) {
      const meta = store.addAttachment(note.id, {
        filename: `file${i}.txt`,
        contentType: 'text/plain',
        data: Buffer.from(`d${i}`),
      });
      expect(meta).toBeDefined();
    }
    // One beyond the cap must be rejected
    const overflow = store.addAttachment(note.id, {
      filename: 'overflow.txt',
      contentType: 'text/plain',
      data: Buffer.from('x'),
    });
    expect(overflow).toBeUndefined();
  });
});
