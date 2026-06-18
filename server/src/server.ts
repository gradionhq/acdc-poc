import { createApp } from './app.js';
import { NoteStore } from './store.js';
import { seedStore, shouldSeed } from './seed.js';

const port = Number(process.env.PORT ?? 3000);

// Dev-only: optionally seed the in-memory store with sample data before the
// app starts. Gated by `shouldSeed` (requires SEED=1 and a non-prod/non-test
// env). Never runs from the `createApp` factory that tests import.
const store = new NoteStore();
if (shouldSeed()) {
  const count = seedStore(store);
  console.log(`seeded ${count} sample notes (dev only)`);
}

createApp(store).listen(port, () => {
  console.log(`notes-api listening on :${port}`);
});
