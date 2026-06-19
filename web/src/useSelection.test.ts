import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useSelection, selectAllStateFor } from './useSelection';

describe('useSelection', () => {
  it('starts empty', () => {
    const { result } = renderHook(() => useSelection());
    expect(result.current.count).toBe(0);
    expect(result.current.hasSelection).toBe(false);
    expect(result.current.selectedIds).toEqual([]);
  });

  it('toggles a single id on and off', () => {
    const { result } = renderHook(() => useSelection());

    act(() => result.current.toggle('a'));
    expect(result.current.isSelected('a')).toBe(true);
    expect(result.current.count).toBe(1);
    expect(result.current.hasSelection).toBe(true);

    act(() => result.current.toggle('a'));
    expect(result.current.isSelected('a')).toBe(false);
    expect(result.current.count).toBe(0);
  });

  it('selects all visible ids when not all are selected', () => {
    const { result } = renderHook(() => useSelection());
    act(() => result.current.toggle('a'));
    act(() => result.current.toggleSelectAll(['a', 'b', 'c']));
    expect(result.current.selectedIds.sort()).toEqual(['a', 'b', 'c']);
  });

  it('deselects all visible ids when every one is already selected', () => {
    const { result } = renderHook(() => useSelection());
    act(() => result.current.toggleSelectAll(['a', 'b']));
    expect(result.current.count).toBe(2);
    act(() => result.current.toggleSelectAll(['a', 'b']));
    expect(result.current.count).toBe(0);
  });

  it('leaves ids outside the visible set untouched on select-all', () => {
    const { result } = renderHook(() => useSelection());
    act(() => result.current.toggle('x'));
    act(() => result.current.toggleSelectAll(['a', 'b']));
    expect(result.current.selectedIds.sort()).toEqual(['a', 'b', 'x']);
    // Deselecting the visible page keeps the out-of-page id.
    act(() => result.current.toggleSelectAll(['a', 'b']));
    expect(result.current.selectedIds).toEqual(['x']);
  });

  it('clears the entire selection', () => {
    const { result } = renderHook(() => useSelection());
    act(() => result.current.toggleSelectAll(['a', 'b']));
    act(() => result.current.clear());
    expect(result.current.count).toBe(0);
  });

  it('clear is a no-op when already empty (stable identity)', () => {
    const { result } = renderHook(() => useSelection());
    const before = result.current.selectedIds;
    act(() => result.current.clear());
    expect(result.current.selectedIds).toBe(before);
  });
});

describe('selectAllStateFor', () => {
  const selected = new Set(['a', 'b']);
  const isSelected = (id: string) => selected.has(id);

  it('returns "none" for an empty visible set', () => {
    expect(selectAllStateFor([], isSelected)).toBe('none');
  });

  it('returns "none" when no visible id is selected', () => {
    expect(selectAllStateFor(['x', 'y'], isSelected)).toBe('none');
  });

  it('returns "all" when every visible id is selected', () => {
    expect(selectAllStateFor(['a', 'b'], isSelected)).toBe('all');
  });

  it('returns "some" for a partial selection', () => {
    expect(selectAllStateFor(['a', 'x'], isSelected)).toBe('some');
  });
});
