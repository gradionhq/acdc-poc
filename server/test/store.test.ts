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
});
