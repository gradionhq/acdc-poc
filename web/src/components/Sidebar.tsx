import { Archive, FileText, Tag, Trash2, type LucideIcon } from 'lucide-react';
import styles from './Sidebar.module.css';

/** The selectable main views, switched from the sidebar navigation. */
export type AppView = 'all' | 'archived' | 'trash' | 'tags';

export interface SidebarProps {
  /** The currently active view — its nav item is highlighted. */
  view: AppView;
  /** Switch the active view. */
  onSelectView: (view: AppView) => void;
}

interface NavItem {
  view: AppView;
  label: string;
  /** Stable accessible name, independent of the active state. */
  ariaLabel: string;
  icon: LucideIcon;
}

const NAV_ITEMS: readonly NavItem[] = [
  { view: 'all', label: 'All notes', ariaLabel: 'Show all notes', icon: FileText },
  { view: 'archived', label: 'Archived', ariaLabel: 'Show archived notes', icon: Archive },
  { view: 'trash', label: 'Trash', ariaLabel: 'Show trash', icon: Trash2 },
  { view: 'tags', label: 'Tags', ariaLabel: 'Manage tags', icon: Tag },
];

/**
 * Persistent left navigation. Each item switches the main view; the active
 * item is highlighted and marked with aria-current.
 */
export function Sidebar({ view, onSelectView }: SidebarProps) {
  return (
    <nav className={styles.sidebar} aria-label="Views">
      <div className={styles.navList}>
        {NAV_ITEMS.map(({ view: itemView, label, ariaLabel, icon: Icon }) => {
          const active = view === itemView;
          return (
            <button
              key={itemView}
              type="button"
              aria-label={ariaLabel}
              aria-current={active ? 'page' : undefined}
              className={`${styles.navItem} ${active ? styles.navItemActive : ''}`}
              onClick={() => onSelectView(itemView)}
            >
              <Icon size={16} aria-hidden="true" className={styles.navIcon} />
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
