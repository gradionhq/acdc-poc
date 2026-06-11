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
    // Default sort is 'newest': newest notes come first.
    const page1 = store.list(1, 2, undefined, undefined, 'oldest');
    expect(page1.total).toBe(5);
    expect(page1.items.map((n) => n.id)).toEqual([created[0].id, created[1].id]);
    const page2 = store.list(2, 2, undefined, undefined, 'oldest');
    expect(page2.items.map((n) => n.id)).toEqual([created[2].id, created[3].id]);
  });

  it('filters by query term case-insensitively across title and body', () => {
    const store = new NoteStore();
    store.create({ title: 'Hello World', body: 'some content' });
    store.create({ title: 'Goodbye', body: 'World is great' });
    store.create({ title: 'Unrelated', body: 'no match here' });

    // Use oldest sort so insertion order is preserved in this assertion.
    const result = store.list(1, 10, 'world', undefined, 'oldest');
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

  it('creates a note with pinned=false by default', () => {
    const store = new NoteStore();
    const n = store.create({ title: 't', body: 'b' });
    expect(n.pinned).toBe(false);
  });

  it('togglePin sets pinned=true then back to false', () => {
    const store = new NoteStore();
    const n = store.create({ title: 't', body: 'b' });
    expect(n.pinned).toBe(false);
    const pinned = store.togglePin(n.id);
    expect(pinned?.pinned).toBe(true);
    const unpinned = store.togglePin(n.id);
    expect(unpinned?.pinned).toBe(false);
  });

  it('togglePin returns undefined for unknown id', () => {
    const store = new NoteStore();
    expect(store.togglePin('nope')).toBeUndefined();
  });

  it('pinned notes sort before unpinned in list results', () => {
    const store = new NoteStore();
    const a = store.create({ title: 'a', body: 'A' });
    const b = store.create({ title: 'b', body: 'B' });
    const c = store.create({ title: 'c', body: 'C' });
    // Pin the last note
    store.togglePin(c.id);
    // Default sort is 'newest'; among unpinned, b (newer) sorts before a.
    const result = store.list(1, 10);
    expect(result.items[0].id).toBe(c.id); // pinned → top
    expect(result.items[1].id).toBe(b.id); // newest unpinned
    expect(result.items[2].id).toBe(a.id); // oldest unpinned
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

  it('creates a note with a valid color and persists it', () => {
    const store = new NoteStore();
    const n = store.create({ title: 't', body: 'b', color: 'red' });
    expect(n.color).toBe('red');
    expect(store.get(n.id)?.color).toBe('red');
  });

  it('defaults color to "none" when omitted on create', () => {
    const store = new NoteStore();
    const n = store.create({ title: 't', body: 'b' });
    expect(n.color).toBe('none');
  });

  it('updates color via update()', () => {
    const store = new NoteStore();
    const n = store.create({ title: 't', body: 'b', color: 'blue' });
    const updated = store.update(n.id, { color: 'green' });
    expect(updated?.color).toBe('green');
  });

  it('preserves existing color when update() does not specify color', () => {
    const store = new NoteStore();
    const n = store.create({ title: 't', body: 'b', color: 'yellow' });
    const updated = store.update(n.id, { title: 'new title' });
    expect(updated?.color).toBe('yellow');
  });

  it('sort=newest returns most-recently-created notes first (among unpinned)', () => {
    const store = new NoteStore();
    store.create({ title: 'first', body: 'b' });
    store.create({ title: 'second', body: 'b' });
    store.create({ title: 'third', body: 'b' });

    const result = store.list(1, 10, undefined, undefined, 'newest');
    const titles = result.items.map((n) => n.title);
    expect(titles).toEqual(['third', 'second', 'first']);
  });

  it('sort=oldest returns earliest-created notes first (among unpinned)', () => {
    const store = new NoteStore();
    store.create({ title: 'first', body: 'b' });
    store.create({ title: 'second', body: 'b' });
    store.create({ title: 'third', body: 'b' });

    const result = store.list(1, 10, undefined, undefined, 'oldest');
    const titles = result.items.map((n) => n.title);
    expect(titles).toEqual(['first', 'second', 'third']);
  });

  it('sort=title returns notes in A→Z order by title (among unpinned)', () => {
    const store = new NoteStore();
    store.create({ title: 'Banana', body: 'b' });
    store.create({ title: 'Apple', body: 'b' });
    store.create({ title: 'Cherry', body: 'b' });

    const result = store.list(1, 10, undefined, undefined, 'title');
    const titles = result.items.map((n) => n.title);
    expect(titles).toEqual(['Apple', 'Banana', 'Cherry']);
  });

  it('pinned notes always sort ahead of unpinned regardless of sort order', () => {
    const store = new NoteStore();
    const a = store.create({ title: 'Zebra', body: 'b' });
    store.create({ title: 'Apple', body: 'b' });
    store.togglePin(a.id); // pin 'Zebra'

    // title sort: 'Zebra' is pinned so it comes first despite Z > A
    const result = store.list(1, 10, undefined, undefined, 'title');
    expect(result.items[0].title).toBe('Zebra');
    expect(result.items[1].title).toBe('Apple');
  });

  it('sort=newest default is used when sort param is omitted', () => {
    const store = new NoteStore();
    store.create({ title: 'first', body: 'b' });
    store.create({ title: 'second', body: 'b' });

    // No sort arg — default is newest
    const result = store.list(1, 10);
    expect(result.items[0].title).toBe('second');
    expect(result.items[1].title).toBe('first');
  });
});

describe('NoteStore — archive', () => {
  it('creates a note with archived=false by default', () => {
    const store = new NoteStore();
    const n = store.create({ title: 't', body: 'b' });
    expect(n.archived).toBe(false);
  });

  it('toggleArchive sets archived=true then back to false', () => {
    const store = new NoteStore();
    const n = store.create({ title: 't', body: 'b' });
    const archived = store.toggleArchive(n.id);
    expect(archived?.archived).toBe(true);
    const unarchived = store.toggleArchive(n.id);
    expect(unarchived?.archived).toBe(false);
  });

  it('toggleArchive returns undefined for unknown id', () => {
    const store = new NoteStore();
    expect(store.toggleArchive('nope')).toBeUndefined();
  });

  it('list() excludes archived notes by default', () => {
    const store = new NoteStore();
    store.create({ title: 'visible', body: 'b' });
    const hidden = store.create({ title: 'hidden', body: 'b' });
    store.toggleArchive(hidden.id);

    const result = store.list(1, 10);
    expect(result.total).toBe(1);
    expect(result.items[0].title).toBe('visible');
  });

  it('list() with archived=true returns only archived notes', () => {
    const store = new NoteStore();
    store.create({ title: 'active', body: 'b' });
    const archived = store.create({ title: 'archived', body: 'b' });
    store.toggleArchive(archived.id);

    const result = store.list(1, 10, undefined, undefined, 'newest', true);
    expect(result.total).toBe(1);
    expect(result.items[0].title).toBe('archived');
  });

  it('archived notes are excluded from search (q filter) in default view', () => {
    const store = new NoteStore();
    store.create({ title: 'findable', body: 'b' });
    const archived = store.create({ title: 'findable archived', body: 'b' });
    store.toggleArchive(archived.id);

    const result = store.list(1, 10, 'findable');
    expect(result.total).toBe(1);
    expect(result.items[0].title).toBe('findable');
  });

  it('archived notes are excluded from tag filter in default view', () => {
    const store = new NoteStore();
    store.create({ title: 'tagged active', body: 'b', tags: ['work'] });
    const archived = store.create({ title: 'tagged archived', body: 'b', tags: ['work'] });
    store.toggleArchive(archived.id);

    const result = store.list(1, 10, undefined, 'work');
    expect(result.total).toBe(1);
    expect(result.items[0].title).toBe('tagged active');
  });

  it('pagination is correct when archived notes are excluded', () => {
    const store = new NoteStore();
    for (let i = 0; i < 4; i++) {
      store.create({ title: `note ${i}`, body: 'b' });
    }
    const archived = store.create({ title: 'archived', body: 'b' });
    store.toggleArchive(archived.id);

    const page1 = store.list(1, 2);
    expect(page1.total).toBe(4);
    expect(page1.items).toHaveLength(2);

    const page2 = store.list(2, 2);
    expect(page2.total).toBe(4);
    expect(page2.items).toHaveLength(2);
  });

  it('pinned notes still sort first when archived notes excluded', () => {
    const store = new NoteStore();
    const a = store.create({ title: 'a', body: 'b' });
    const b = store.create({ title: 'b', body: 'b' });
    const toArchive = store.create({ title: 'archived', body: 'b' });
    store.toggleArchive(toArchive.id);
    store.togglePin(b.id);

    const result = store.list(1, 10);
    expect(result.items[0].id).toBe(b.id); // pinned first
    expect(result.items[1].id).toBe(a.id);
  });
});

describe('NoteStore — deleteAttachment()', () => {
  it('returns undefined when the note does not exist', () => {
    const store = new NoteStore();
    expect(store.deleteAttachment('no-such', 'file.txt')).toBeUndefined();
  });

  it('returns false when the attachment does not exist on a valid note', () => {
    const store = new NoteStore();
    const note = store.create({ title: 't', body: 'b' });
    expect(store.deleteAttachment(note.id, 'ghost.txt')).toBe(false);
  });

  it('returns true and removes the attachment', () => {
    const store = new NoteStore();
    const note = store.create({ title: 't', body: 'b' });
    store.addAttachment(note.id, {
      filename: 'del.txt',
      contentType: 'text/plain',
      data: Buffer.from('x'),
    });

    expect(store.deleteAttachment(note.id, 'del.txt')).toBe(true);
    expect(store.listAttachments(note.id)).toEqual([]);
  });

  it('does not affect other attachments on the same note', () => {
    const store = new NoteStore();
    const note = store.create({ title: 't', body: 'b' });
    store.addAttachment(note.id, {
      filename: 'keep.txt',
      contentType: 'text/plain',
      data: Buffer.from('keep'),
    });
    store.addAttachment(note.id, {
      filename: 'remove.txt',
      contentType: 'text/plain',
      data: Buffer.from('remove'),
    });

    store.deleteAttachment(note.id, 'remove.txt');

    const list = store.listAttachments(note.id);
    expect(list).toHaveLength(1);
    expect(list![0].filename).toBe('keep.txt');
  });

  it('sanitises path traversal in filename before lookup', () => {
    const store = new NoteStore();
    const note = store.create({ title: 't', body: 'b' });
    // Traversal attempt must not blow up — just return false (not found)
    expect(store.deleteAttachment(note.id, '../../etc/passwd')).toBe(false);
  });
});

describe('NoteStore — duplicate()', () => {
  it('returns undefined when the source note does not exist', () => {
    const store = new NoteStore();
    expect(store.duplicate('nope')).toBeUndefined();
  });

  it('creates a new note with a distinct id', () => {
    const store = new NoteStore();
    const original = store.create({ title: 'Hello', body: 'World', tags: ['a', 'b'] });
    const copy = store.duplicate(original.id);
    expect(copy).toBeDefined();
    expect(copy!.id).not.toBe(original.id);
  });

  it('copies title prefixed with "Copy of …", body, and tags', () => {
    const store = new NoteStore();
    const original = store.create({ title: 'Hello', body: 'World', tags: ['a', 'b'] });
    const copy = store.duplicate(original.id);
    expect(copy!.title).toBe('Copy of Hello');
    expect(copy!.body).toBe(original.body);
    expect(copy!.tags).toEqual(original.tags);
  });

  it('duplicate is not pinned regardless of source', () => {
    const store = new NoteStore();
    const original = store.create({ title: 't', body: 'b' });
    store.togglePin(original.id);
    const copy = store.duplicate(original.id);
    expect(copy!.pinned).toBe(false);
  });

  it('duplicate has a newer createdAt than source so it sorts after unpinned notes', () => {
    const store = new NoteStore();
    const original = store.create({ title: 't', body: 'b' });
    const copy = store.duplicate(original.id);
    expect(copy!.createdAt).toBeGreaterThan(original.createdAt);
  });

  it('editing the original does not affect the duplicate', () => {
    const store = new NoteStore();
    const original = store.create({ title: 't', body: 'b', tags: ['x'] });
    const copy = store.duplicate(original.id)!;
    store.update(original.id, { title: 'changed', body: 'changed body', tags: ['y'] });
    const copyAfter = store.get(copy.id)!;
    expect(copyAfter.title).toBe('Copy of t');
    expect(copyAfter.body).toBe('b');
    expect(copyAfter.tags).toEqual(['x']);
  });

  it('duplicate appears at the top of the list (newest createdAt among unpinned)', () => {
    const store = new NoteStore();
    store.create({ title: 'first', body: 'b' });
    const second = store.create({ title: 'second', body: 'b' });
    store.duplicate(second.id);
    // Use 'newest' sort: duplicate has the highest createdAt so it sorts first.
    const resultNewest = store.list(1, 10, undefined, undefined, 'newest');
    const unpinnedNewest = resultNewest.items.filter((n) => !n.pinned);
    expect(unpinnedNewest[0].title).toBe('Copy of second');
    // Verify with 'oldest' sort: duplicate sorts last.
    const resultOldest = store.list(1, 10, undefined, undefined, 'oldest');
    const unpinnedOldest = resultOldest.items.filter((n) => !n.pinned);
    expect(unpinnedOldest[unpinnedOldest.length - 1].title).toBe('Copy of second');
  });

  it('preserves the source note color in the duplicate', () => {
    const store = new NoteStore();
    const original = store.create({ title: 't', body: 'b', color: 'blue' });
    const copy = store.duplicate(original.id);
    expect(copy!.color).toBe('blue');
  });
});

describe('NoteStore — reset()', () => {
  it('empties notes and attachments and resets the id sequence', () => {
    const store = new NoteStore();
    const n = store.create({ title: 'a', body: 'A' });
    store.addAttachment(n.id, {
      filename: 'f.txt',
      contentType: 'text/plain',
      data: Buffer.from('x'),
    });

    store.reset();

    // List must be empty with total 0
    const result = store.list(1, 10);
    expect(result.total).toBe(0);
    expect(result.items).toHaveLength(0);

    // Sequence resets: next created note gets id "1"
    const fresh = store.create({ title: 'b', body: 'B' });
    expect(fresh.id).toBe('1');
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

describe('NoteStore — reset()', () => {
  it('empties notes and attachments and resets the id sequence', () => {
    const store = new NoteStore();
    const n = store.create({ title: 'a', body: 'A' });
    store.addAttachment(n.id, {
      filename: 'f.txt',
      contentType: 'text/plain',
      data: Buffer.from('x'),
    });

    store.reset();

    // List must be empty with total 0
    const result = store.list(1, 10);
    expect(result.total).toBe(0);
    expect(result.items).toHaveLength(0);

    // Sequence resets: next created note gets id "1"
    const fresh = store.create({ title: 'b', body: 'B' });
    expect(fresh.id).toBe('1');
  });
});
