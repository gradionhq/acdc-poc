// test/persistence.test.ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { NoteStore } from '../src/store';
import { openDatabase, resolveDbPath } from '../src/db';

describe('NoteStore — SQLite persistence', () => {
  let dir: string;
  let dbPath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'notes-db-'));
    dbPath = join(dir, 'notes.db');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('creates the database file on disk for a file-backed store', () => {
    const store = new NoteStore({ path: dbPath });
    store.create({ title: 't', body: 'b' });
    expect(existsSync(dbPath)).toBe(true);
  });

  it('notes survive re-opening the same database file (restart simulation)', () => {
    const first = new NoteStore({ path: dbPath });
    const created = first.create({
      title: 'persisted',
      body: 'body text',
      tags: ['keep', 'me'],
      color: 'green',
    });
    first.togglePin(created.id);

    // Simulate a process restart: open a brand-new store against the same file.
    const second = new NoteStore({ path: dbPath });
    const reloaded = second.get(created.id);
    expect(reloaded).toBeDefined();
    expect(reloaded).toMatchObject({
      id: created.id,
      title: 'persisted',
      body: 'body text',
      tags: ['keep', 'me'],
      color: 'green',
      pinned: true,
    });
  });

  it('preserves the id sequence across restarts (no id reuse)', () => {
    const first = new NoteStore({ path: dbPath });
    const a = first.create({ title: 'a', body: 'b' });
    expect(a.id).toBe('1');

    const second = new NoteStore({ path: dbPath });
    const b = second.create({ title: 'b', body: 'b' });
    // The sequence must continue, not restart at 1.
    expect(b.id).toBe('2');
    expect(b.createdAt).toBeGreaterThan(a.createdAt);
  });

  it('persists attachments (binary data) across restarts', () => {
    const first = new NoteStore({ path: dbPath });
    const note = first.create({ title: 't', body: 'b' });
    const payload = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe]);
    first.addAttachment(note.id, {
      filename: 'binary.bin',
      contentType: 'application/json',
      data: payload,
    });

    const second = new NoteStore({ path: dbPath });
    const att = second.getAttachment(note.id, 'binary.bin');
    expect(att).toBeDefined();
    expect(att!.size).toBe(payload.byteLength);
    expect(Buffer.compare(att!.data, payload)).toBe(0);
  });

  it('persists tag colors across restarts', () => {
    const first = new NoteStore({ path: dbPath });
    first.setTagColor('work', 'blue');

    const second = new NoteStore({ path: dbPath });
    expect(second.getTagColor('work')).toBe('blue');
  });

  it('persists soft-deleted (trashed) notes across restarts', () => {
    const first = new NoteStore({ path: dbPath });
    const note = first.create({ title: 't', body: 'b' });
    first.trash(note.id);

    const second = new NoteStore({ path: dbPath });
    expect(second.list(1, 10).total).toBe(0);
    expect(second.listTrashed().map((n) => n.id)).toEqual([note.id]);
  });

  it('persists pinned ordering across restarts', () => {
    const first = new NoteStore({ path: dbPath });
    const a = first.create({ title: 'a', body: 'b' });
    const b = first.create({ title: 'b', body: 'b' });
    first.togglePin(a.id);
    first.togglePin(b.id);
    first.reorderPinned([b.id, a.id]);

    const second = new NoteStore({ path: dbPath });
    expect(second.list(1, 10).items.map((n) => n.id)).toEqual([b.id, a.id]);
  });

  it('isolates separate in-memory stores from one another', () => {
    const a = new NoteStore();
    const b = new NoteStore();
    a.create({ title: 'only in a', body: 'b' });
    expect(a.list(1, 10).total).toBe(1);
    expect(b.list(1, 10).total).toBe(0);
  });
});

describe('resolveDbPath', () => {
  it('prefers an explicit path option', () => {
    expect(resolveDbPath('/tmp/explicit.db', { NOTES_DB_PATH: '/env.db' })).toBe(
      '/tmp/explicit.db',
    );
  });

  it('falls back to NOTES_DB_PATH when no option is given', () => {
    expect(resolveDbPath(undefined, { NOTES_DB_PATH: '/env.db' })).toBe('/env.db');
  });

  it('uses an in-memory database when neither is set', () => {
    expect(resolveDbPath(undefined, {})).toBe(':memory:');
    expect(resolveDbPath('', { NOTES_DB_PATH: '' })).toBe(':memory:');
  });
});

describe('migrations', () => {
  let dir: string;
  let dbPath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'notes-mig-'));
    dbPath = join(dir, 'notes.db');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('creates the expected schema and records the user_version', () => {
    const db = openDatabase(dbPath);
    const tables = (
      db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).all() as {
        name: string;
      }[]
    ).map((r) => r.name);
    expect(tables).toEqual(expect.arrayContaining(['notes', 'attachments', 'tag_colors', 'meta']));
    expect(db.pragma('user_version', { simple: true })).toBe(2);
    // v2 migration added the pinnedOrder column to the notes table.
    const noteColumns = (db.pragma('table_info(notes)') as { name: string }[]).map((c) => c.name);
    expect(noteColumns).toContain('pinnedOrder');
    db.close();
  });

  it('is idempotent — re-opening an existing database applies nothing new', () => {
    const db1 = openDatabase(dbPath);
    db1
      .prepare(
        `INSERT INTO notes (id, title, body, tags, createdAt, pinned, archived, color, deletedAt)
       VALUES ('1','t','b','[]',1,0,0,'none',NULL)`,
      )
      .run();
    db1.close();

    // Re-open: migration must not wipe or recreate the existing table/data.
    const db2 = openDatabase(dbPath);
    expect(db2.pragma('user_version', { simple: true })).toBe(2);
    const row = db2.prepare(`SELECT title FROM notes WHERE id = '1'`).get() as { title: string };
    expect(row.title).toBe('t');
    db2.close();
  });

  it('seeds the persistent sequence counter at zero', () => {
    const db = openDatabase(dbPath);
    const row = db.prepare(`SELECT value FROM meta WHERE key = 'seq'`).get() as { value: number };
    expect(row.value).toBe(0);
    db.close();
  });

  it('round-trips a raw better-sqlite3 connection against the migrated file', () => {
    const created = openDatabase(dbPath);
    created.close();
    // A plain driver open must see the migrated schema (no migration side effects).
    const raw = new Database(dbPath);
    expect(raw.pragma('user_version', { simple: true })).toBe(2);
    raw.close();
  });
});
