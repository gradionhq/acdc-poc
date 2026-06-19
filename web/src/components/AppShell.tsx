import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Menu, X } from 'lucide-react';
import styles from './AppShell.module.css';

export interface AppShellProps {
  /** The persistent top header bar (brand, search, actions). */
  header: ReactNode;
  /** The persistent left navigation sidebar. */
  sidebar: ReactNode;
  /** The main content area for the currently selected view. */
  children: ReactNode;
}

/** Id of the main landmark; the skip link targets this. */
export const MAIN_CONTENT_ID = 'main-content';

/** Selector for focusable elements used to move focus into the open drawer. */
const FOCUSABLE_SELECTOR = 'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])';

/**
 * App shell layout: a sticky top header spanning the full width, a persistent
 * left sidebar, and a main content area to the right.
 *
 * On wide viewports the sidebar sits beside the main content. On narrow (phone)
 * viewports it collapses into an off-canvas drawer toggled by a hamburger button
 * in the header; the main content then spans the full width. The single sidebar
 * instance simply re-flows between the two layouts via CSS, so the navigation is
 * never duplicated in the DOM. The drawer:
 * - moves focus to its first focusable element on open and restores focus to the
 *   hamburger toggle on close;
 * - closes on Escape and on clicking the scrim;
 * - exposes its state via `aria-expanded` on the hamburger toggle.
 *
 * A "Skip to main content" link is the first focusable element so keyboard and
 * screen-reader users can bypass the header and sidebar and jump straight to
 * the main landmark. It stays visually hidden until focused.
 */
export function AppShell({ header, sidebar, children }: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const openDrawer = useCallback(() => setDrawerOpen(true), []);

  // Move focus into the drawer when it opens; restore it to the hamburger
  // toggle when it closes (but not on initial mount).
  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (drawerOpen) {
      const panel = drawerRef.current;
      panel?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();
    } else if (prevOpenRef.current) {
      toggleRef.current?.focus();
    }
    prevOpenRef.current = drawerOpen;
  }, [drawerOpen]);

  // Close the drawer on Escape while it is open. Handled at the document level
  // so the key works regardless of where focus sits inside the drawer.
  useEffect(() => {
    if (!drawerOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeDrawer();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen, closeDrawer]);

  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href={`#${MAIN_CONTENT_ID}`}>
        Skip to main content
      </a>

      <div className={styles.headerRow}>
        <button
          ref={toggleRef}
          type="button"
          className={styles.menuButton}
          aria-label="Open navigation menu"
          aria-expanded={drawerOpen}
          aria-controls={drawerId}
          onClick={openDrawer}
        >
          <Menu size={20} aria-hidden="true" />
        </button>
        <div className={styles.headerSlot}>{header}</div>
      </div>

      <div className={styles.body}>
        {/*
          A single sidebar instance. On wide viewports it renders inline at the
          left of `.body`. On phone widths the `.drawer` wrapper becomes a fixed
          off-canvas panel slid in/out by `.drawerOpen`; the navigation is never
          duplicated. The drawer is dismissed via the close button, the scrim, or
          Escape.
        */}
        <div
          ref={drawerRef}
          id={drawerId}
          className={`${styles.drawer} ${drawerOpen ? styles.drawerOpen : ''}`}
        >
          <button
            type="button"
            className={styles.drawerClose}
            aria-label="Close navigation menu"
            onClick={closeDrawer}
          >
            <X size={20} aria-hidden="true" />
          </button>
          {sidebar}
        </div>

        <main id={MAIN_CONTENT_ID} className={styles.main} tabIndex={-1}>
          {children}
        </main>
      </div>

      {drawerOpen && (
        <button
          type="button"
          aria-label="Dismiss navigation menu"
          className={styles.scrim}
          tabIndex={-1}
          onClick={closeDrawer}
        />
      )}
    </div>
  );
}
