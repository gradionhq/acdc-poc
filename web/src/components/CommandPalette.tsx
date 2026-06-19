import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Search } from 'lucide-react';
import { Modal } from './Modal';
import { filterCommands, type Command } from '../commandPalette';
import styles from './CommandPalette.module.css';

export type { Command } from '../commandPalette';

export interface CommandPaletteProps {
  /** All selectable commands, in priority order (actions/views first, then notes). */
  readonly commands: readonly Command[];
  /**
   * Dismiss the palette. The caller is responsible for restoring focus to the
   * trigger (mirroring the Modal contract).
   */
  readonly onClose: () => void;
}

/**
 * Keyboard-first command palette (Cmd/Ctrl+K). Fuzzy-searches over the supplied
 * commands; ↑/↓ move the active row, Enter runs it, Escape closes. Built on the
 * Modal primitive for the focus trap, focus restore, and Escape handling — the
 * search input lives in the Modal header so it receives focus on open.
 */
export function CommandPalette({ commands, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const results = useMemo(() => filterCommands(commands, query), [commands, query]);

  // Keep the active row in range as the result set shrinks/grows.
  useEffect(() => {
    setActiveIndex((prev) => (results.length === 0 ? 0 : Math.min(prev, results.length - 1)));
  }, [results.length]);

  // Keep the active row scrolled into view.
  useEffect(() => {
    const active = listRef.current?.children[activeIndex];
    // `scrollIntoView` is unimplemented in jsdom; guard so tests don't throw.
    if (active instanceof HTMLElement && typeof active.scrollIntoView === 'function') {
      active.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  function runAt(index: number) {
    const command = results[index];
    if (!command) return;
    // Close first so focus restoration happens, then run the action.
    onClose();
    command.run();
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (results.length === 0 ? 0 : (prev + 1) % results.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) =>
        results.length === 0 ? 0 : (prev - 1 + results.length) % results.length,
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      runAt(activeIndex);
    }
  }

  const listboxId = 'command-palette-listbox';
  const activeOptionId = results[activeIndex]
    ? `command-option-${results[activeIndex].id}`
    : undefined;

  return (
    <Modal
      title="Command palette"
      onClose={onClose}
      initialFocusRef={inputRef}
      backdropTestId="command-palette-backdrop"
      padBody={false}
      panelClassName={styles.panel}
      renderHeader={({ titleId }) => (
        <div className={styles.searchRow}>
          <Search size={16} className={styles.searchIcon} aria-hidden="true" />
          <h2 id={titleId} className={styles.srOnly}>
            Command palette
          </h2>
          <input
            ref={inputRef}
            type="text"
            className={styles.input}
            placeholder="Type a command or search notes…"
            aria-label="Command palette search"
            role="combobox"
            aria-expanded="true"
            aria-controls={listboxId}
            aria-activedescendant={activeOptionId}
            autoComplete="off"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={onKeyDown}
          />
        </div>
      )}
    >
      {results.length === 0 ? (
        <p className={styles.empty}>No matching commands</p>
      ) : (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-label="Commands"
          className={styles.list}
        >
          {results.map((command, index) => {
            const active = index === activeIndex;
            return (
              <li
                key={command.id}
                id={`command-option-${command.id}`}
                role="option"
                aria-selected={active}
                className={`${styles.option} ${active ? styles.optionActive : ''}`}
              >
                <button
                  type="button"
                  className={styles.optionButton}
                  tabIndex={-1}
                  onMouseMove={() => setActiveIndex(index)}
                  onClick={() => runAt(index)}
                >
                  <span className={styles.optionTitle}>{command.title}</span>
                  <span className={styles.optionGroup}>{command.group}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}
