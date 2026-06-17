import type { ReactNode } from 'react';
import styles from './AppShell.module.css';

export interface AppShellProps {
  /** The persistent top header bar (brand, search, actions). */
  header: ReactNode;
  /** The persistent left navigation sidebar. */
  sidebar: ReactNode;
  /** The main content area for the currently selected view. */
  children: ReactNode;
}

/**
 * App shell layout: a sticky top header spanning the full width, a persistent
 * left sidebar, and a main content area to the right.
 *
 * Pure presentational wrapper — it owns only the grid layout and renders the
 * three regions it is handed. The single <main> landmark lives here so the rest
 * of the app composes cleanly inside it.
 */
export function AppShell({ header, sidebar, children }: AppShellProps) {
  return (
    <div className={styles.shell}>
      {header}
      <div className={styles.body}>
        {sidebar}
        <main className={styles.main}>{children}</main>
      </div>
    </div>
  );
}
