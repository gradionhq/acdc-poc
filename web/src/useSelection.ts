import { useCallback, useMemo, useState } from 'react';

/**
 * Tri-state of the "select all on this page" control, mirroring the native
 * checkbox states: `none` (nothing selected), `all` (every visible id
 * selected), and `some` (a non-empty subset — rendered as indeterminate).
 */
export type SelectAllState = 'none' | 'some' | 'all';

export interface UseSelectionResult {
  /** The currently selected ids, as a stable array (insertion order). */
  selectedIds: string[];
  /** Number of selected ids. */
  count: number;
  /** True when at least one id is selected. */
  hasSelection: boolean;
  /** Whether a given id is currently selected. */
  isSelected: (id: string) => boolean;
  /** Toggle a single id on or off. */
  toggle: (id: string) => void;
  /**
   * Select-all-on-page toggle: when every visible id is already selected,
   * deselect them; otherwise add all visible ids to the selection. Ids not in
   * `visibleIds` are left untouched.
   */
  toggleSelectAll: (visibleIds: string[]) => void;
  /** Clear the entire selection. */
  clear: () => void;
}

/**
 * Manage a set of selected note ids for the multi-select / bulk-action UX.
 *
 * The hook is intentionally agnostic of how ids are rendered: callers pass the
 * currently visible ids into the page-level helpers so the same selection can
 * survive pagination and filtering. Selection is held in a `Set` for O(1)
 * membership checks and exposed as a stable array for consumers.
 */
export function useSelection(): UseSelectionResult {
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());

  const isSelected = useCallback((id: string) => selected.has(id), [selected]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback((visibleIds: string[]) => {
    setSelected((prev) => {
      const allSelected = visibleIds.length > 0 && visibleIds.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allSelected) {
        for (const id of visibleIds) next.delete(id);
      } else {
        for (const id of visibleIds) next.add(id);
      }
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setSelected((prev) => (prev.size === 0 ? prev : new Set<string>()));
  }, []);

  const selectedIds = useMemo(() => [...selected], [selected]);

  return {
    selectedIds,
    count: selected.size,
    hasSelection: selected.size > 0,
    isSelected,
    toggle,
    toggleSelectAll,
    clear,
  };
}

/**
 * Derive the tri-state of a page-level select-all control for a set of visible
 * ids against the current selection. Pure so it can be unit tested and reused
 * by the bulk-action bar without re-reading the selection set internals.
 */
export function selectAllStateFor(
  visibleIds: readonly string[],
  isSelected: (id: string) => boolean,
): SelectAllState {
  if (visibleIds.length === 0) return 'none';
  let selectedCount = 0;
  for (const id of visibleIds) {
    if (isSelected(id)) selectedCount++;
  }
  if (selectedCount === 0) return 'none';
  if (selectedCount === visibleIds.length) return 'all';
  return 'some';
}
