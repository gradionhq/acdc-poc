import { Archive, FileText, Tag, Trash2, type LucideIcon } from 'lucide-react';
import styles from './Sidebar.module.css';

/** The selectable main views, switched from the sidebar navigation. */
export type AppView = 'all' | 'archived' | 'trash' | 'tags';

/**
 * Per-view item counts shown as a badge next to each nav item. Any view may be
 * omitted (or given `undefined`), in which case that item renders no badge —
 * useful while a count is still loading or is not applicable.
 */
export type SidebarCounts = Partial<Record<AppView, number>>;

export interface SidebarProps {
  /** The currently active view — its nav item is highlighted. */
  view: AppView;
  /** Switch the active view. */
  onSelectView: (view: AppView) => void;
  /** Optional per-view item counts, rendered as a badge next to each item. */
  counts?: SidebarCounts;
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

/** Counts at or above this threshold are abbreviated (e.g. 1234 → "1k+"). */
const BADGE_OVERFLOW = 1000;

/** Format a raw count for compact display inside a fixed-width badge. */
function formatCount(count: number): string {
  if (count >= BADGE_OVERFLOW) {
    return `${Math.floor(count / BADGE_OVERFLOW)}k+`;
  }
  return String(count);
}

/**
 * Persistent left navigation. Each item switches the main view; the active
 * item is highlighted and marked with aria-current. When a count is supplied
 * for a view it is shown as a badge next to the item label.
 */
export function Sidebar({ view, onSelectView, counts }: SidebarProps) {
  return (
    <nav className={styles.sidebar} aria-label="Views">
      <div className={styles.navList}>
        {NAV_ITEMS.map(({ view: itemView, label, ariaLabel, icon: Icon }) => {
          const active = view === itemView;
          const count = counts?.[itemView];
          const hasBadge = typeof count === 'number';
          // Fold the count into the accessible name so screen-reader users hear
          // it too; the visible badge stays aria-hidden to avoid a double read.
          const accessibleName = hasBadge ? `${ariaLabel} (${count})` : ariaLabel;
          return (
            <button
              key={itemView}
              type="button"
              aria-label={accessibleName}
              aria-current={active ? 'page' : undefined}
              className={`${styles.navItem} ${active ? styles.navItemActive : ''}`}
              onClick={() => onSelectView(itemView)}
            >
              <Icon size={16} aria-hidden="true" className={styles.navIcon} />
              <span className={styles.navLabel}>{label}</span>
              {hasBadge && (
                <span className={styles.badge} aria-hidden="true">
                  {formatCount(count)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
