import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';

function makeHandlers() {
  return {
    onNewNote: vi.fn(),
    onFocusSearch: vi.fn(),
    onEscape: vi.fn(),
    onToggleHelp: vi.fn(),
  };
}

/** Dispatch a keydown event on `target` (bubbles to document). */
function fireKey(key: string, target: EventTarget = document.body): void {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
}

function makeInput(tag: 'input' | 'textarea' | 'select' = 'input'): HTMLElement {
  const el = document.createElement(tag);
  document.body.appendChild(el);
  return el;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('useKeyboardShortcuts', () => {
  it('calls onNewNote when "n" is pressed on the document body', () => {
    const handlers = makeHandlers();
    renderHook(() => useKeyboardShortcuts(handlers));

    fireKey('n');

    expect(handlers.onNewNote).toHaveBeenCalledOnce();
  });

  it('calls onFocusSearch when "/" is pressed on the document body', () => {
    const handlers = makeHandlers();
    renderHook(() => useKeyboardShortcuts(handlers));

    fireKey('/');

    expect(handlers.onFocusSearch).toHaveBeenCalledOnce();
  });

  it('calls onEscape when "Escape" is pressed on the document body', () => {
    const handlers = makeHandlers();
    renderHook(() => useKeyboardShortcuts(handlers));

    fireKey('Escape');

    expect(handlers.onEscape).toHaveBeenCalledOnce();
  });

  it('calls onToggleHelp when "?" is pressed on the document body', () => {
    const handlers = makeHandlers();
    renderHook(() => useKeyboardShortcuts(handlers));

    fireKey('?');

    expect(handlers.onToggleHelp).toHaveBeenCalledOnce();
  });

  it('does NOT call onNewNote when "n" is pressed while focus is in an input', () => {
    const handlers = makeHandlers();
    renderHook(() => useKeyboardShortcuts(handlers));

    const input = makeInput('input');
    fireKey('n', input);

    expect(handlers.onNewNote).not.toHaveBeenCalled();
  });

  it('does NOT call onFocusSearch when "/" is pressed while focus is in a textarea', () => {
    const handlers = makeHandlers();
    renderHook(() => useKeyboardShortcuts(handlers));

    const textarea = makeInput('textarea');
    fireKey('/', textarea);

    expect(handlers.onFocusSearch).not.toHaveBeenCalled();
  });

  it('does NOT call onToggleHelp when "?" is pressed while focus is in a select', () => {
    const handlers = makeHandlers();
    renderHook(() => useKeyboardShortcuts(handlers));

    const select = makeInput('select');
    fireKey('?', select);

    expect(handlers.onToggleHelp).not.toHaveBeenCalled();
  });

  it('DOES call onEscape even when focus is inside a text field', () => {
    const handlers = makeHandlers();
    renderHook(() => useKeyboardShortcuts(handlers));

    const input = makeInput('input');
    fireKey('Escape', input);

    expect(handlers.onEscape).toHaveBeenCalledOnce();
  });

  it('removes the event listener on unmount (no leaks)', () => {
    const handlers = makeHandlers();
    const { unmount } = renderHook(() => useKeyboardShortcuts(handlers));

    unmount();
    fireKey('n');

    expect(handlers.onNewNote).not.toHaveBeenCalled();
  });

  it('does not call any handler for unrecognised keys', () => {
    const handlers = makeHandlers();
    renderHook(() => useKeyboardShortcuts(handlers));

    fireKey('a');
    fireKey('Enter');
    fireKey('Tab');

    expect(handlers.onNewNote).not.toHaveBeenCalled();
    expect(handlers.onFocusSearch).not.toHaveBeenCalled();
    expect(handlers.onEscape).not.toHaveBeenCalled();
    expect(handlers.onToggleHelp).not.toHaveBeenCalled();
  });
});
