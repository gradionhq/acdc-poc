import { NoteStore } from './store.js';

/**
 * Default retention window for trashed notes, in days. After a note has sat in
 * the trash for this long it is permanently purged. Tunable via the
 * `TRASH_RETENTION_DAYS` environment variable (see {@link trashRetentionDays}).
 */
export const DEFAULT_TRASH_RETENTION_DAYS = 30;

/** Milliseconds in one day — used to convert the retention window. */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * How often the background sweeper runs, in milliseconds. The exact cadence is
 * not significant: notes are purged on the first sweep at or after their
 * retention boundary, so an hourly tick keeps the trash bounded without busy
 * work.
 */
export const DEFAULT_PURGE_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Resolve the configured retention window in whole days.
 *
 * Reads `TRASH_RETENTION_DAYS` from the environment. A missing, empty, or
 * invalid value (non-finite, or less than 1) falls back to
 * {@link DEFAULT_TRASH_RETENTION_DAYS}. Fractional values are floored.
 */
export function trashRetentionDays(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.TRASH_RETENTION_DAYS;
  if (raw === undefined || raw === '') return DEFAULT_TRASH_RETENTION_DAYS;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_TRASH_RETENTION_DAYS;
  return Math.floor(n);
}

/** Resolve the configured retention window in milliseconds. */
export function trashRetentionMs(env: NodeJS.ProcessEnv = process.env): number {
  return trashRetentionDays(env) * MS_PER_DAY;
}

/**
 * Start a background timer that periodically purges trashed notes older than the
 * configured retention window. Intended for the startup path in `server.ts`
 * only — `createApp` (used by tests) never starts it, so the test runner stays
 * timer-free.
 *
 * The timer is `unref`'d so it never keeps the process alive on its own.
 * Returns a handle to the interval so callers can stop it if needed.
 *
 * @param store The note store to sweep.
 * @param intervalMs Sweep cadence. Defaults to {@link DEFAULT_PURGE_INTERVAL_MS}.
 * @param retentionMs Retention window. Defaults to {@link trashRetentionMs}.
 */
export function startTrashPurger(
  store: NoteStore,
  intervalMs: number = DEFAULT_PURGE_INTERVAL_MS,
  retentionMs: number = trashRetentionMs(),
): NodeJS.Timeout {
  const timer = setInterval(() => {
    store.purgeExpiredTrash(retentionMs);
  }, intervalMs);
  timer.unref();
  return timer;
}
