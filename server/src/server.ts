import { createApp } from './app.js';
import { NoteStore } from './store.js';
import { seedStore, shouldSeed } from './seed.js';
import { startTrashPurger, trashRetentionDays } from './trash.js';

const port = Number(process.env.PORT ?? 3000);

// Dev-only: optionally seed the in-memory store with sample data before the
// app starts. Gated by `shouldSeed` (requires SEED=1 and a non-prod/non-test
// env). Never runs from the `createApp` factory that tests import.
const store = new NoteStore();
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
