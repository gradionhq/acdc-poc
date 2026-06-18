// test/seed.test.ts
import { describe, expect, it } from 'vitest';
import { NoteStore, NOTE_COLORS, TAG_COLORS } from '../src/store';
import { seedStore, shouldSeed } from '../src/seed';

describe('shouldSeed gating', () => {
  it('seeds only when SEED=1 and env is not production/test', () => {
    expect(shouldSeed({ SEED: '1', NODE_ENV: 'development' })).toBe(true);
    // No NODE_ENV set is treated as dev-like (still requires the flag).
    expect(shouldSeed({ SEED: '1' })).toBe(true);
  });

  it('never seeds when the flag is unset', () => {
    expect(shouldSeed({})).toBe(false);
    expect(shouldSeed({ SEED: '0' })).toBe(false);
    expect(shouldSeed({ NODE_ENV: 'development' })).toBe(false);
  });

  it('never seeds in test or production even with the flag set', () => {
    expect(shouldSeed({ SEED: '1', NODE_ENV: 'test' })).toBe(false);
    expect(shouldSeed({ SEED: '1', NODE_ENV: 'production' })).toBe(false);
  });
});

describe('seedStore', () => {
  it('produces a varied, multi-page dataset of valid notes', () => {
    const store = new NoteStore();
    const created = seedStore(store);

    // Enough to span more than one page at the default page size (10).
    expect(created).toBeGreaterThanOrEqual(30);

    const active = store.list(1, 1000);
    const archived = store.list(1, 1000, undefined, undefined, 'newest', true);
    const trashed = store.listTrashed();

    // A spread across states.
    expect(active.items.some((n) => n.pinned)).toBe(true);
    expect(archived.total).toBeGreaterThanOrEqual(1);
    expect(trashed.length).toBeGreaterThanOrEqual(1);
    expect(created).toBe(active.total + archived.total + trashed.length);

    // Every note is structurally valid against the Note type/contract.
    for (const note of [...active.items, ...archived.items, ...trashed]) {
      expect(typeof note.id).toBe('string');
      expect(note.title.length).toBeGreaterThan(0);
      expect(typeof note.body).toBe('string');
      expect(Array.isArray(note.tags)).toBe(true);
      expect((NOTE_COLORS as readonly string[]).includes(note.color)).toBe(true);
    }
  });

  it('assigns colors from the palette to tags and shares tags across notes', () => {
    const store = new NoteStore();
    seedStore(store);

    const tags = store.listTags();
    // Several notes share tags (counts > 1 exist).
    expect(tags.some((t) => t.count > 1)).toBe(true);
    // Tags carry valid palette colors.
    const colored = tags.filter((t) => t.color !== null);
    expect(colored.length).toBeGreaterThan(0);
    for (const t of colored) {
      expect((TAG_COLORS as readonly string[]).includes(t.color as string)).toBe(true);
    }
  });

  it('orders notes so newest and oldest differ visibly', () => {
    const store = new NoteStore();
    seedStore(store);
    const newest = store.list(1, 5, undefined, undefined, 'newest');
    const oldest = store.list(1, 5, undefined, undefined, 'oldest');
    expect(newest.items.map((n) => n.id)).not.toEqual(oldest.items.map((n) => n.id));
  });

  it('is idempotent — does not duplicate when the store is non-empty', () => {
    const store = new NoteStore();
    const first = seedStore(store);
    const before = store.list(1, 1000).total + store.listTrashed().length;

    const second = seedStore(store);
    const after = store.list(1, 1000).total + store.listTrashed().length;

    expect(second).toBe(0);
    expect(after).toBe(before);
    expect(first).toBeGreaterThan(0);
  });

  it('does not re-seed when only a trashed note exists', () => {
    const store = new NoteStore();
    const n = store.create({ title: 'only', body: 'x' });
    store.trash(n.id);
    expect(seedStore(store)).toBe(0);
  });
});
