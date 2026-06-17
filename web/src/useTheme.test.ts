import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useTheme } from './useTheme';

const STORAGE_KEY = 'theme';

/**
 * Stub window.matchMedia so the hook can read an OS-level
 * `prefers-color-scheme: dark` preference. `prefersDark` controls the value
 * returned for the dark-scheme query.
 */
function mockMatchMedia(prefersDark: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn((query: string) => ({
      matches: query.includes('dark') ? prefersDark : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function currentTheme(): string | null {
  return document.documentElement.getAttribute('data-theme');
}

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    mockMatchMedia(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('defaults to light when no stored preference and OS prefers light', () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('light');
    expect(currentTheme()).toBe('light');
  });

  it('defaults to dark when no stored preference and OS prefers dark', () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('dark');
    expect(currentTheme()).toBe('dark');
  });

  it('a persisted preference wins over the OS preference', () => {
    mockMatchMedia(true); // OS prefers dark…
    localStorage.setItem(STORAGE_KEY, 'light'); // …but the user stored light.
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('light');
    expect(currentTheme()).toBe('light');
  });

  it('ignores an invalid stored value and falls back to the OS preference', () => {
    mockMatchMedia(true);
    localStorage.setItem(STORAGE_KEY, 'banana');
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('dark');
  });

  it('toggleTheme switches light → dark and applies it to <html>', () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('light');

    act(() => {
      result.current.toggleTheme();
    });

    expect(result.current.theme).toBe('dark');
    expect(currentTheme()).toBe('dark');
  });

  it('toggleTheme switches dark → light and applies it to <html>', () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('dark');

    act(() => {
      result.current.toggleTheme();
    });

    expect(result.current.theme).toBe('light');
    expect(currentTheme()).toBe('light');
  });

  it('persists the selected theme to localStorage', () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.toggleTheme();
    });
    expect(localStorage.getItem(STORAGE_KEY)).toBe('dark');

    act(() => {
      result.current.toggleTheme();
    });
    expect(localStorage.getItem(STORAGE_KEY)).toBe('light');
  });

  it('re-reads the persisted theme on a fresh mount (persistence across reloads)', () => {
    mockMatchMedia(false);

    const first = renderHook(() => useTheme());
    act(() => {
      first.result.current.toggleTheme(); // -> dark, written to storage
    });
    expect(localStorage.getItem(STORAGE_KEY)).toBe('dark');
    first.unmount();

    // A fresh mount simulates a page reload: the stored 'dark' must win.
    const second = renderHook(() => useTheme());
    expect(second.result.current.theme).toBe('dark');
    expect(currentTheme()).toBe('dark');
  });
});
