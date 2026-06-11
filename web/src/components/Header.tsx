import type { RefObject } from 'react';
import { Button } from './Button';
import { TagManager } from '../TagManager';
import { SHORTCUTS } from '../useKeyboardShortcuts';
import styles from './Header.module.css';

export interface HeaderProps {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  showHelp: boolean;
  onToggleHelp: () => void;
  onCloseHelp: () => void;
  showTagManager: boolean;
  onToggleTagManager: () => void;
  onTagsChanged: () => void;
  helpToggleRef: RefObject<HTMLButtonElement>;
  helpCloseBtnRef: RefObject<HTMLButtonElement>;
}

export function Header({
  theme,
  toggleTheme,
  showHelp,
  onToggleHelp,
  onCloseHelp,
  showTagManager,
  onToggleTagManager,
  onTagsChanged,
  helpToggleRef,
  helpCloseBtnRef,
}: HeaderProps) {
  return (
    <>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Notes</h1>
        <div className={styles.headerActions}>
          <button
            ref={helpToggleRef}
            aria-label="Show keyboard shortcuts"
            aria-pressed={showHelp}
            className={styles.iconButton}
            onClick={onToggleHelp}
          >
            ?
          </button>
          <Button
            variant="secondary"
            onClick={onToggleTagManager}
            aria-expanded={showTagManager}
            aria-controls="tag-manager-panel"
          >
            {showTagManager ? 'Hide tag manager' : 'Manage tags'}
          </Button>
          <button
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="theme-toggle"
            onClick={toggleTheme}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

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
              aria-label="Close keyboard shortcuts"
              className={styles.iconButton}
              onClick={onCloseHelp}
            >
              ✕
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

      {showTagManager && (
        <div id="tag-manager-panel">
          <TagManager onChanged={onTagsChanged} />
        </div>
      )}
    </>
  );
}
