import Database, { type Database as DatabaseType } from 'better-sqlite3';

/**
 * Resolve where the SQLite database should live.
 *
 * - When {@link NoteStoreOptions.path} is given it wins (explicit caller intent).
 * - Otherwise the `NOTES_DB_PATH` environment variable selects a file-backed
 *   database so notes survive a process restart (the production default in
 *   `server.ts`).
 * - When neither is set the store opens an in-memory database (`:memory:`).
 *   Every `new NoteStore()` then gets its own isolated, disk-free database,
 *   which keeps the test suite hermetic without any per-test wiring.
 */
export function resolveDbPath(
  optionPath: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): string {
  if (optionPath !== undefined && optionPath !== '') return optionPath;
  const fromEnv = env.NOTES_DB_PATH;
  if (fromEnv !== undefined && fromEnv !== '') return fromEnv;
  return ':memory:';
}

/**
 * Ordered list of forward-only schema migrations. Each entry is applied exactly
 * once, in order, and the highest applied index is recorded in `PRAGMA
 * user_version` so re-opening an existing database is a no-op. Append new
 * migrations to the end — never edit or reorder an already-shipped statement.
 */
const MIGRATIONS: readonly string[] = [
  // v1 — initial schema.
  `
  CREATE TABLE notes (
    id         TEXT PRIMARY KEY,
    title      TEXT NOT NULL,
    body       TEXT NOT NULL,
    tags       TEXT NOT NULL,            -- JSON array of tag strings
    createdAt  INTEGER NOT NULL,         -- monotonic insertion counter
    pinned     INTEGER NOT NULL,         -- 0 | 1
    archived   INTEGER NOT NULL,         -- 0 | 1
    color      TEXT NOT NULL,
    deletedAt  INTEGER                   -- epoch ms, or NULL when active
  );

  CREATE TABLE attachments (
    key          TEXT PRIMARY KEY,       -- "<noteId>/<safeFilename>"
    noteId       TEXT NOT NULL,
    filename     TEXT NOT NULL,
    contentType  TEXT NOT NULL,
    size         INTEGER NOT NULL,
    data         BLOB NOT NULL
  );
  CREATE INDEX idx_attachments_noteId ON attachments (noteId);

  CREATE TABLE tag_colors (
    tag    TEXT PRIMARY KEY,
    color  TEXT NOT NULL
  );

  CREATE TABLE meta (
    key    TEXT PRIMARY KEY,
    value  INTEGER NOT NULL
  );
  INSERT INTO meta (key, value) VALUES ('seq', 0);
  `,
  // v2 — explicit ordering for pinned notes. NULL for unpinned notes (and for
  // notes pinned before this migration); a smaller value sorts earlier among
  // the pinned group. Unpinned notes keep NULL so they fall back to the normal
  // secondary sort.
  `
  ALTER TABLE notes ADD COLUMN pinnedOrder INTEGER;
  `,
];

/**
 * Open a SQLite database at the resolved path, apply any pending migrations,
 * and return the connection. Foreign-key enforcement and WAL journaling are
 * enabled for file-backed databases (WAL is skipped for `:memory:` where it is
 * meaningless). Idempotent: re-opening a fully migrated database applies
 * nothing.
 */
export function openDatabase(path: string): DatabaseType {
  const db = new Database(path);
  db.pragma('foreign_keys = ON');
  if (path !== ':memory:') {
    db.pragma('journal_mode = WAL');
  }
  migrate(db);
  return db;
}

/** Apply every migration newer than the database's current `user_version`. */
function migrate(db: DatabaseType): void {
  const current = db.pragma('user_version', { simple: true }) as number;
  for (let version = current; version < MIGRATIONS.length; version += 1) {
    const statement = MIGRATIONS[version];
    db.exec(statement);
    // user_version cannot be parameterised; version is an internal integer.
    db.pragma(`user_version = ${version + 1}`);
  }
}
