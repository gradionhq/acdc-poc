import { NoteStore, type NoteColor, type TagColor } from './store.js';

/**
 * Dev-only sample-data seeding for the in-memory store.
 *
 * This module is intentionally NOT imported by `createApp` (the factory used
 * by unit/integration tests) — it is invoked only from the startup path in
 * `server.ts`, and only when {@link shouldSeed} returns true. That keeps every
 * test runner (and production) completely seed-free.
 */

/** A single tag together with the chip color it should be decorated with. */
interface SeedTag {
  name: string;
  color: TagColor;
}

const SEED_TAGS: readonly SeedTag[] = [
  { name: 'work', color: 'blue' },
  { name: 'personal', color: 'green' },
  { name: 'ideas', color: 'purple' },
  { name: 'urgent', color: 'red' },
  { name: 'reading', color: 'orange' },
  { name: 'recipes', color: 'yellow' },
  { name: 'travel', color: 'gray' },
  { name: 'finance', color: 'green' },
  { name: 'health', color: 'red' },
  { name: 'projects', color: 'blue' },
];

/** Final state to apply after creation (the store always creates "active"). */
type SeedState = 'pinned' | 'archived' | 'trashed';

/** Shape of a note before it is handed to the store, plus its post-create state. */
interface SeedNote {
  title: string;
  body: string;
  tags: string[];
  color?: NoteColor;
  state?: SeedState;
}

/**
 * A compact descriptor for one seed note. `tags` is a space-separated string
 * (kept terse to avoid repeating array/quote boilerplate per note); `color`
 * and `state` are optional. Mapped through {@link makeNote} into a SeedNote.
 */
type SeedSpec = {
  title: string;
  body: string;
  tags: string;
  color?: NoteColor;
  state?: SeedState;
};

/**
 * Build a {@link SeedNote} from a compact descriptor, applying sensible
 * defaults (no color, active state) so each entry only declares what differs.
 * Tags are split from the space-separated `tags` string.
 */
function makeNote(spec: SeedSpec): SeedNote {
  const note: SeedNote = {
    title: spec.title,
    body: spec.body,
    tags: spec.tags.split(' '),
  };
  if (spec.color !== undefined) note.color = spec.color;
  if (spec.state !== undefined) note.state = spec.state;
  return note;
}

/**
 * A realistic, varied dataset: ~36 notes spanning multiple pages at the
 * default page size, a spread of shared/colored tags, a few pinned, several
 * archived, a few trashed, and a mix of short, long, and markdown bodies.
 *
 * Authored as a flat list of compact descriptors mapped through {@link makeNote}
 * so the repeated object/array boilerplate lives in exactly one place.
 */
const SEED_SPECS: readonly SeedSpec[] = [
  // --- Active (30: 2 pinned + 28 plain, spanning 3 pages at page size 10) ---
  {
    title: 'Welcome to your notes',
    body: 'This local dataset is seeded for development only. Explore filtering, pinning, archiving and the trash.',
    tags: 'personal',
    color: 'blue',
    state: 'pinned',
  },
  {
    title: 'Q3 roadmap planning',
    body: '## Themes\n\n- Reliability work (error budgets)\n- Onboarding revamp\n- **Search** improvements\n\n> Decision: lock scope by end of month.',
    tags: 'work projects urgent',
    color: 'red',
    state: 'pinned',
  },
  {
    title: 'Grocery list',
    body: 'Olive oil, eggs, spinach, sourdough, parmesan, tomatoes.',
    tags: 'personal recipes',
  },
  {
    title: 'Reading list 2026',
    body: '1. *The Pragmatic Programmer*\n2. *Designing Data-Intensive Applications*\n3. *Thinking in Systems*\n\nAdd notes per chapter as I go.',
    tags: 'reading ideas',
    color: 'purple',
  },
  {
    title: 'Standup notes',
    body: 'Yesterday: shipped the tag-color API. Today: dev seeding. Blockers: none.',
    tags: 'work',
  },
  {
    title: 'Pasta carbonara',
    body: '### Ingredients\n\n- 200g spaghetti\n- 2 eggs\n- 50g pecorino\n- guanciale\n\n### Method\n\nWhisk eggs + cheese, toss off the heat so it stays silky.',
    tags: 'recipes personal',
    color: 'yellow',
  },
  {
    title: 'Trip to Lisbon',
    body: 'Flights booked for October. Stay in Alfama. Day trip to Sintra. Try the pastéis de Belém.',
    tags: 'travel personal',
    color: 'green',
  },
  {
    title: 'Budget review',
    body: 'Subscriptions are creeping up — cancel the two unused streaming services. Move savings to the index fund.',
    tags: 'finance personal',
  },
  {
    title: 'Gym plan',
    body: 'Push / pull / legs split, three days a week. Track progressive overload on the big lifts.',
    tags: 'health',
    color: 'red',
  },
  {
    title: 'Product idea: shared note templates',
    body: 'Let teams publish reusable note templates (meeting, retro, 1:1). Could drive activation.',
    tags: 'ideas work projects',
    color: 'purple',
  },
  {
    title: 'Retro action items',
    body: '- Automate the release checklist\n- Add flaky-test quarantine\n- Document the on-call rotation',
    tags: 'work projects',
  },
  {
    title: 'Books to lend out',
    body: 'Lent *Project Hail Mary* to Sam. Get it back before the holidays.',
    tags: 'reading',
  },
  {
    title: 'Weekend chores',
    body: 'Laundry, water the plants, fix the squeaky door, back up the laptop.',
    tags: 'personal',
  },
  {
    title: 'API design principles',
    body: '## Guidelines\n\n- Validate at the boundary\n- Prefer explicit types over `any`\n- Make illegal states unrepresentable\n\nKeep handlers thin; push logic into the store.',
    tags: 'work ideas',
    color: 'blue',
  },
  {
    title: 'Tax documents checklist',
    body: 'Gather W-2s, brokerage statements, mortgage interest, charitable receipts.',
    tags: 'finance urgent',
    color: 'red',
  },
  {
    title: 'Meditation streak',
    body: '12 days in a row. Ten minutes each morning before email.',
    tags: 'health personal',
  },
  {
    title: 'Conference talk outline',
    body: '# Building boring software\n\n1. Why boring wins\n2. Operability first\n3. Cutting scope without guilt\n\nAim for 25 minutes + Q&A.',
    tags: 'work ideas',
    color: 'purple',
  },
  {
    title: 'Camping gear',
    body: 'Tent, sleeping bag (rated to 0°C), headlamp, stove, water filter.',
    tags: 'travel',
  },
  {
    title: 'Birthday gift ideas',
    body: 'For Alex: the espresso scale, or the pottery class voucher.',
    tags: 'personal ideas',
  },
  {
    title: 'Sourdough log',
    body: '### Bake notes\n\n- Hydration 75%\n- 4h bulk at 24°C\n- Overnight cold proof\n\nCrumb was open this time — keep the timing.',
    tags: 'recipes',
    color: 'yellow',
  },
  {
    title: 'Incident postmortem',
    body: '**Impact:** 18 min of elevated 500s.\n\n**Root cause:** unbounded retry loop.\n\n**Fix:** added a circuit breaker + alert on retry rate.',
    tags: 'work urgent projects',
    color: 'red',
  },
  {
    title: 'Learn Rust',
    body: 'Work through the book, then port a small CLI. Focus on ownership and error handling.',
    tags: 'ideas reading',
  },
  {
    title: 'House plants watering schedule',
    body: 'Monstera weekly, succulents fortnightly, fern twice a week.',
    tags: 'personal',
  },
  {
    title: 'Investment thesis notes',
    body: 'Dollar-cost average into broad index funds. Ignore the noise. Rebalance once a year.',
    tags: 'finance reading',
    color: 'green',
  },
  {
    title: 'Quarterly goals',
    body: '- [ ] Ship dev seeding\n- [ ] Improve test coverage\n- [x] Add tag colors\n- [ ] Write the design doc',
    tags: 'work projects',
  },
  {
    title: 'Recipe: weeknight curry',
    body: 'Onion, garlic, ginger, curry paste, coconut milk, chickpeas. 20 minutes, one pot.',
    tags: 'recipes personal',
    color: 'yellow',
  },
  {
    title: 'Travel packing checklist',
    body: 'Passport, chargers, adapter, meds, a paperback, noise-cancelling headphones.',
    tags: 'travel personal',
  },
  {
    title: 'Annual health checkup',
    body: 'Book the dentist and the eye test. Renew the prescription.',
    tags: 'health urgent',
  },
  {
    title: 'Open-source contribution ideas',
    body: 'Triage good-first-issues on the notes library. Improve the docs while reading the code.',
    tags: 'ideas work',
  },
  {
    title: 'Garden plan',
    body: '## Spring\n\n- Tomatoes (cherry + beefsteak)\n- Basil & rosemary\n- A row of carrots\n\nStart seeds indoors in March.',
    tags: 'personal ideas',
    color: 'green',
  },
  // --- Archived (4: older, completed) ---
  {
    title: 'Old meeting notes — Q1 kickoff',
    body: 'Archived after Q1 closed. Kept for reference.',
    tags: 'work',
    state: 'archived',
  },
  {
    title: 'Finished: kitchen renovation',
    body: 'Project complete. Final invoices paid; warranty docs filed.',
    tags: 'personal finance',
    state: 'archived',
  },
  {
    title: 'Archived reading: short stories',
    body: 'Done — moved off the active list to keep things tidy.',
    tags: 'reading',
    state: 'archived',
  },
  {
    title: 'Past trip: Kyoto',
    body: 'Wonderful autumn trip. Archiving the itinerary now that it is over.',
    tags: 'travel personal',
    state: 'archived',
  },
  // --- Trashed (2: soft-deleted) ---
  {
    title: 'Draft — discarded idea',
    body: 'Did not pan out. In the trash.',
    tags: 'ideas',
    state: 'trashed',
  },
  {
    title: 'Duplicate grocery list',
    body: 'Accidental duplicate — trashed.',
    tags: 'personal',
    state: 'trashed',
  },
];

const SEED_NOTES: readonly SeedNote[] = SEED_SPECS.map(makeNote);

/**
 * Decide whether the dev server should seed sample data.
 *
 * Seeding requires an explicit opt-in flag (`SEED=1`) AND a non-production,
 * non-test environment. This double gate guarantees production and every test
 * runner stay seed-free even if the flag is accidentally set.
 */
export function shouldSeed(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.SEED !== '1') return false;
  const nodeEnv = env.NODE_ENV;
  if (nodeEnv === 'production' || nodeEnv === 'test') return false;
  return true;
}

/**
 * Populate the store with the sample dataset. Idempotent: does nothing when the
 * store already holds notes (so restarts / hot-reloads never duplicate data).
 * Returns the number of notes created.
 */
export function seedStore(store: NoteStore): number {
  // Idempotency guard: only seed an empty store.
  if (store.list(1, 1).total > 0 || store.listTrashed().length > 0) {
    return 0;
  }

  // Assign colors to every known tag so chips are decorated in the UI.
  for (const { name, color } of SEED_TAGS) {
    store.setTagColor(name, color);
  }

  let created = 0;
  for (const seed of SEED_NOTES) {
    const note = store.create({
      title: seed.title,
      body: seed.body,
      tags: seed.tags,
      ...(seed.color === undefined ? {} : { color: seed.color }),
    });
    created += 1;

    // The store always creates notes "active"; apply the desired final state.
    switch (seed.state) {
      case 'pinned':
        store.togglePin(note.id);
        break;
      case 'archived':
        store.toggleArchive(note.id);
        break;
      case 'trashed':
        store.trash(note.id);
        break;
      default:
        break;
    }
  }

  return created;
}
