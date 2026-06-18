// test/trash-purge.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NoteStore } from '../src/store';
import {
  DEFAULT_PURGE_INTERVAL_MS,
  DEFAULT_TRASH_RETENTION_DAYS,
  startTrashPurger,
  trashRetentionDays,
  trashRetentionMs,
} from '../src/trash';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('NoteStore.purgeExpiredTrash — retention boundary', () => {
  it('purges a trashed note once it is older than the retention window', () => {
    const store = new NoteStore();
    const n = store.create({ title: 't', body: 'b' });

    // Trash "now"; advance the reference clock just past the window.
    const trashedAt = 1_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(trashedAt);
    store.trash(n.id);
    vi.restoreAllMocks();

    const retentionMs = 30 * DAY_MS;
    const purged = store.purgeExpiredTrash(retentionMs, trashedAt + retentionMs + 1);
    expect(purged).toBe(1);
    expect(store.get(n.id)).toBeUndefined();
    expect(store.listTrashed()).toHaveLength(0);
  });

  it('keeps a trashed note that is still within the retention window', () => {
    const store = new NoteStore();
    const n = store.create({ title: 't', body: 'b' });
    const trashedAt = 1_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(trashedAt);
    store.trash(n.id);
    vi.restoreAllMocks();

    const retentionMs = 30 * DAY_MS;
    // One millisecond before the boundary — must survive.
    const purged = store.purgeExpiredTrash(retentionMs, trashedAt + retentionMs - 1);
    expect(purged).toBe(0);
    expect(store.get(n.id)).toBeDefined();
    expect(store.listTrashed()).toHaveLength(1);
  });

  it('purges exactly at the retention boundary (deletedAt <= cutoff)', () => {
    const store = new NoteStore();
    const n = store.create({ title: 't', body: 'b' });
    const trashedAt = 1_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(trashedAt);
    store.trash(n.id);
    vi.restoreAllMocks();

    const retentionMs = 30 * DAY_MS;
    // now - retentionMs === deletedAt → eligible.
    const purged = store.purgeExpiredTrash(retentionMs, trashedAt + retentionMs);
    expect(purged).toBe(1);
    expect(store.get(n.id)).toBeUndefined();
  });

  it('never touches active or archived notes', () => {
    const store = new NoteStore();
    const active = store.create({ title: 'active', body: 'b' });
    const archived = store.create({ title: 'archived', body: 'b' });
    store.toggleArchive(archived.id);

    const trashedAt = 1_000_000;
    const expired = store.create({ title: 'trashed', body: 'b' });
    vi.spyOn(Date, 'now').mockReturnValue(trashedAt);
    store.trash(expired.id);
    vi.restoreAllMocks();

    const retentionMs = 30 * DAY_MS;
    const purged = store.purgeExpiredTrash(retentionMs, trashedAt + retentionMs + 1);

    expect(purged).toBe(1);
    expect(store.get(active.id)).toBeDefined();
    expect(store.get(archived.id)).toBeDefined();
    expect(store.get(expired.id)).toBeUndefined();
  });

  it('removes the purged note attachments as well', () => {
    const store = new NoteStore();
    const n = store.create({ title: 't', body: 'b' });
    store.addAttachment(n.id, {
      filename: 'f.txt',
      contentType: 'text/plain',
      data: Buffer.from('x'),
    });

    const trashedAt = 1_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(trashedAt);
    store.trash(n.id);
    vi.restoreAllMocks();

    store.purgeExpiredTrash(30 * DAY_MS, trashedAt + 31 * DAY_MS);
    expect(store.listAttachments(n.id)).toBeUndefined();
  });

  it('purges every trashed note when retentionMs is zero', () => {
    const store = new NoteStore();
    const a = store.create({ title: 'a', body: 'b' });
    const b = store.create({ title: 'b', body: 'b' });
    store.create({ title: 'active', body: 'b' });
    store.trash(a.id);
    store.trash(b.id);

    const purged = store.purgeExpiredTrash(0);
    expect(purged).toBe(2);
    expect(store.listTrashed()).toHaveLength(0);
    expect(store.list(1, 10).total).toBe(1);
  });

  it('returns 0 when there is nothing to purge', () => {
    const store = new NoteStore();
    store.create({ title: 't', body: 'b' });
    expect(store.purgeExpiredTrash(30 * DAY_MS)).toBe(0);
  });
});

describe('trashRetentionDays / trashRetentionMs config', () => {
  it('defaults to 30 days when the env var is unset', () => {
    expect(trashRetentionDays({})).toBe(DEFAULT_TRASH_RETENTION_DAYS);
    expect(trashRetentionMs({})).toBe(DEFAULT_TRASH_RETENTION_DAYS * DAY_MS);
  });

  it('reads a valid positive integer from TRASH_RETENTION_DAYS', () => {
    expect(trashRetentionDays({ TRASH_RETENTION_DAYS: '7' })).toBe(7);
    expect(trashRetentionMs({ TRASH_RETENTION_DAYS: '7' })).toBe(7 * DAY_MS);
  });

  it('floors fractional values', () => {
    expect(trashRetentionDays({ TRASH_RETENTION_DAYS: '2.9' })).toBe(2);
  });

  it.each(['', 'abc', '0', '-5', 'NaN'])(
    'falls back to the default for invalid value %j',
    (value) => {
      expect(trashRetentionDays({ TRASH_RETENTION_DAYS: value })).toBe(
        DEFAULT_TRASH_RETENTION_DAYS,
      );
    },
  );
});

describe('startTrashPurger sweeper', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('purges expired trash on each interval tick and is unref-safe', () => {
    vi.useFakeTimers();
    const store = new NoteStore();
    const n = store.create({ title: 't', body: 'b' });

    const trashedAt = 1_000_000;
    vi.setSystemTime(trashedAt);
    store.trash(n.id);

    const retentionMs = 30 * DAY_MS;
    const timer = startTrashPurger(store, DEFAULT_PURGE_INTERVAL_MS, retentionMs);

    // Before the window elapses, a tick must not purge the note.
    vi.setSystemTime(trashedAt + retentionMs - DAY_MS);
    vi.advanceTimersByTime(DEFAULT_PURGE_INTERVAL_MS);
    expect(store.get(n.id)).toBeDefined();

    // After the window elapses, the next tick purges it.
    vi.setSystemTime(trashedAt + retentionMs + 1);
    vi.advanceTimersByTime(DEFAULT_PURGE_INTERVAL_MS);
    expect(store.get(n.id)).toBeUndefined();

    clearInterval(timer);
  });
});
