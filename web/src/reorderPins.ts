/**
 * Pure helpers for computing a new pinned-note order.
 *
 * The UI knows the current top-to-bottom order of the pinned notes (an array of
 * note ids) and the user's intent — either nudge one note up/down by a step, or
 * drop a dragged note onto another. These functions compute the resulting order
 * without touching the DOM or the network, so the ordering logic is unit-tested
 * in isolation and reused by both the keyboard and drag code paths.
 *
 * Every function returns a brand-new array and never mutates its input. When the
 * requested move is a no-op (id not present, already at the edge, or source and
 * target are the same) the original order is returned unchanged so callers can
 * cheaply skip a redundant network request via a reference/equality check.
 */

export type MoveDirection = 'up' | 'down';

/**
 * Move the note `id` one position toward the top (`'up'`) or bottom (`'down'`)
 * of `order`. Returns the original array unchanged when `id` is absent or the
 * note is already at the relevant edge.
 */
export function movePin(order: readonly string[], id: string, direction: MoveDirection): string[] {
  const index = order.indexOf(id);
  if (index === -1) return [...order];
  const target = direction === 'up' ? index - 1 : index + 1;
  if (target < 0 || target >= order.length) return [...order];
  const next = [...order];
  // Swap the note with its neighbour in the requested direction.
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/**
 * Reposition the dragged note `draggedId` so it lands at the position currently
 * occupied by `targetId`, shifting the intervening notes. Returns the original
 * array unchanged when either id is missing or the two ids are identical.
 */
export function dropPin(order: readonly string[], draggedId: string, targetId: string): string[] {
  if (draggedId === targetId) return [...order];
  const from = order.indexOf(draggedId);
  const to = order.indexOf(targetId);
  if (from === -1 || to === -1) return [...order];
  const next = [...order];
  next.splice(from, 1);
  // After removal indices at/after `from` shift left by one; recompute the
  // insertion point from the (possibly shifted) target id to stay correct
  // regardless of drag direction.
  const insertAt = next.indexOf(targetId);
  next.splice(direction(from, to) === 'down' ? insertAt + 1 : insertAt, 0, draggedId);
  return next;
}

/** Whether the drag moved the note downward (to a larger index) or upward. */
function direction(from: number, to: number): MoveDirection {
  return to > from ? 'down' : 'up';
}

/**
 * True when two id orders are identical (same length and element-wise equal).
 * Lets callers skip a persistence request when a computed reorder is a no-op.
 */
export function sameOrder(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((id, i) => id === b[i]);
}
