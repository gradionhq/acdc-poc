import type { RefObject } from 'react';
import { HelpCircle, Moon, Plus, Search, Sun, X } from 'lucide-react';
import { Button } from './Button';
import { ExportMenu } from './ExportMenu';
import type { ExportFormat } from '../noteExport';
import { SHORTCUTS } from '../useKeyboardShortcuts';
import styles from './HeaderBar.module.css';

export interface HeaderBarProps {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  /** Current value of the global search box. */
  searchInput: string;
  onSearchChange: (value: string) => void;
  searchInputRef: RefObject<HTMLInputElement>;
  /** Invoked by the New-note action — opens the note composer modal. */
  onNewNote: () => void;
  /** Ref to the New-note trigger button; focus returns here when the modal closes. */
  newNoteTriggerRef?: RefObject<HTMLButtonElement>;
  /** Export the currently displayed notes in the chosen format. */
  onExport: (format: ExportFormat) => void;
  /** Whether any notes are available to export (disables the export trigger). */
  exportDisabled: boolean;
  showHelp: boolean;
  onToggleHelp: () => void;
  onCloseHelp: () => void;
  helpToggleRef: RefObject<HTMLButtonElement>;
  helpCloseBtnRef: RefObject<HTMLButtonElement>;
}

/**
 * Persistent, sticky top header: brand/title, global search, the New-note
 * action, and the help + theme toggles. The keyboard-shortcuts help panel is
 * owned here because the help toggle lives in the header.
 */
export function HeaderBar({
  theme,
  toggleTheme,
  searchInput,
  onSearchChange,
  searchInputRef,
  onNewNote,
  newNoteTriggerRef,
  onExport,
  exportDisabled,
  showHelp,
  onToggleHelp,
  onCloseHelp,
  helpToggleRef,
  helpCloseBtnRef,
}: HeaderBarProps) {
  return (
    <header className={styles.header}>
      <div className={styles.bar}>
        <h1 className={styles.brand}>Notes</h1>

        <div className={styles.search} role="search">
          <Search size={16} className={styles.searchIcon} aria-hidden="true" />
          <input
            ref={searchInputRef}
            className={styles.searchInput}
            aria-label="Search notes"
            placeholder="Search notes…"
            value={searchInput}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        <div className={styles.actions}>
          <Button ref={newNoteTriggerRef} variant="primary" onClick={onNewNote}>
            <Plus size={15} aria-hidden="true" className={styles.btnIcon} />
            New note
          </Button>
          <ExportMenu disabled={exportDisabled} onExport={onExport} />
          <button
            ref={helpToggleRef}
            type="button"
            aria-label="Show keyboard shortcuts"
            aria-pressed={showHelp}
            className={styles.iconButton}
            onClick={onToggleHelp}
          >
            <HelpCircle size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="theme-toggle"
            onClick={toggleTheme}
          >
            {theme === 'dark' ? (
              <Sun size={18} aria-hidden="true" />
            ) : (
              <Moon size={18} aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {showHelp && (
        <div
          role="dialog"
          aria-label="Keyboard shortcuts"
          aria-modal="true"
          className={styles.helpPanel}
        >
          <div className={styles.helpPanelHeader}>
            <h2 className={styles.helpPanelTitle}>Keyboard shortcuts</h2>
            <button
              ref={helpCloseBtnRef}
              type="button"
              aria-label="Close keyboard shortcuts"
              className={styles.iconButton}
              onClick={onCloseHelp}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          <ul className={styles.shortcutList}>
            {SHORTCUTS.map(({ key, description }) => (
              <li key={key} className={styles.shortcutItem}>
                <kbd className={styles.kbd}>{key}</kbd>
                <span>{description}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </header>
  );
}
