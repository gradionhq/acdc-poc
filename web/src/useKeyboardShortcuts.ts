import { useEffect } from 'react';

/** Returns true when the keyboard event originates from a text-editing element.
 *  Escape is intentionally excluded so it always fires regardless of focus. */
function isTypingContext(e: KeyboardEvent): boolean {
  if (e.key === 'Escape') return false;
  const target = e.target as HTMLElement | null;
  if (!target || typeof target.tagName !== 'string') return false;
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
}

export interface KeyboardShortcutHandlers {
  /** Called when `n` is pressed outside a text field — opens the new-note form. */
  onNewNote: () => void;
  /** Called when `/` is pressed outside a text field — focuses the search input. */
  onFocusSearch: () => void;
  /** Called when `Escape` is pressed — closes any open modal / clears focus / cancels edit. */
  onEscape: () => void;
  /** Called when `?` is pressed outside a text field — toggles the shortcut help panel. */
  onToggleHelp: () => void;
}

/**
 * Attaches global keyboard shortcut listeners and cleans them up on unmount.
 *
 * Shortcuts:
 *   `n`      → focus the new-note title input (suppressed while typing)
 *   `/`      → focus the search input (suppressed while typing)
 *   `Escape` → close modal / clear search focus / cancel edit (always fires)
 *   `?`      → toggle shortcut help panel (suppressed while typing)
 */
export function useKeyboardShortcuts(handlers: KeyboardShortcutHandlers): void {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (isTypingContext(e)) return;
      // Ignore combinations with modifier keys so we don't hijack
      // browser/OS shortcuts (e.g. Cmd+N, Ctrl+/).
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      switch (e.key) {
        case 'n':
          e.preventDefault();
          handlers.onNewNote();
          break;
        case '/':
          e.preventDefault();
          handlers.onFocusSearch();
          break;
        case 'Escape':
          handlers.onEscape();
          break;
        case '?':
          e.preventDefault();
          handlers.onToggleHelp();
          break;
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
    // handlers object reference may change every render; capture stable fns via
    // individual keys so the effect only re-runs when a handler actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handlers.onNewNote, handlers.onFocusSearch, handlers.onEscape, handlers.onToggleHelp]);
}

/** All shortcuts shown in the help panel. */
export const SHORTCUTS = [
  { key: 'n', description: 'Focus new-note title' },
  { key: '/', description: 'Focus search' },
  { key: '⌘/Ctrl K', description: 'Open command palette' },
  { key: 'Escape', description: 'Close / cancel / clear focus' },
  { key: '?', description: 'Toggle this help panel' },
] as const;
