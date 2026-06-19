/**
 * Pure logic for the command palette (Cmd/Ctrl+K): the fuzzy matcher and the
 * command-list filter. Kept free of React/DOM so it can be unit-tested in
 * isolation and reused by the component without re-deriving any plumbing.
 */

/** A single selectable entry in the palette. */
export interface Command {
  /** Stable identity for list keys and selection. */
  readonly id: string;
  /** Human-readable label shown in the list and matched against the query. */
  readonly title: string;
  /** Coarse grouping shown as a muted hint (e.g. "Action", "View", "Note"). */
  readonly group: string;
  /** Invoked when the entry is selected. */
  readonly run: () => void;
}

/**
 * Subsequence fuzzy match: returns true when every character of `query`
 * appears in `text` in order (case-insensitive), allowing gaps. An empty
 * query matches everything. This is the classic command-palette behaviour
 * where typing "tn" matches "Toggle theme … New".
 */
export function fuzzyMatch(text: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q === '') return true;
  const haystack = text.toLowerCase();
  let qi = 0;
  for (let hi = 0; hi < haystack.length && qi < q.length; hi++) {
    if (haystack[hi] === q[qi]) qi++;
  }
  return qi === q.length;
}

/**
 * Filter commands by a fuzzy match against their title, preserving the input
 * order (callers supply commands already in priority order: actions/views
 * first, then notes). A blank query returns the full list unchanged.
 */
export function filterCommands(commands: readonly Command[], query: string): Command[] {
  const q = query.trim();
  if (q === '') return [...commands];
  return commands.filter((c) => fuzzyMatch(c.title, q));
}
