import { createApp } from './app.js';
import { NoteStore } from './store.js';
import { seedStore, shouldSeed } from './seed.js';
import { startTrashPurger, trashRetentionDays } from './trash.js';

const port = Number(process.env.PORT ?? 3000);

// SQLite-backed store. The database path comes from NOTES_DB_PATH; when unset
// the store falls back to an in-memory database (handy for ephemeral runs).
// Set NOTES_DB_PATH to a file (e.g. ./data/notes.db) to persist notes across
// restarts. Migrations are applied automatically on open.
const store = new NoteStore();
const dbPath = process.env.NOTES_DB_PATH;
console.log(
  dbPath
    ? `notes persisted to SQLite at ${dbPath}`
    : 'notes stored in-memory (set NOTES_DB_PATH to persist)',
);

// Dev-only: optionally seed the store with sample data before the app starts.
// Gated by `shouldSeed` (requires SEED=1 and a non-prod/non-test env). Never
// runs from the `createApp` factory that tests import.
if (shouldSeed()) {
  const count = seedStore(store);
  console.log(`seeded ${count} sample notes (dev only)`);
}

// Background sweeper: permanently purge trashed notes once they exceed the
// configured retention window (TRASH_RETENTION_DAYS, default 30). Started only
// here on the startup path — never from `createApp`, so tests stay timer-free.
startTrashPurger(store);
console.log(`trash auto-purge enabled (retention: ${trashRetentionDays()} days)`);

createApp(store).listen(port, () => {
  console.log(`notes-api listening on :${port}`);
});
