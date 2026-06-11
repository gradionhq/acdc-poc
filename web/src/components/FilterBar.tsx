import type { RefObject } from 'react';
import { Button } from './Button';
import type { SortOrder } from '../api';
import styles from './FilterBar.module.css';

export interface FilterBarProps {
  searchInput: string;
  onSearchChange: (value: string) => void;
  tagFilter: string;
  onTagFilterChange: (value: string) => void;
  sort: SortOrder;
  onSortChange: (sort: SortOrder) => void;
  showArchived: boolean;
  onToggleArchived: () => void;
  searchInputRef: RefObject<HTMLInputElement>;
}

export function FilterBar({
  searchInput,
  onSearchChange,
  tagFilter,
  onTagFilterChange,
  sort,
  onSortChange,
  showArchived,
  onToggleArchived,
  searchInputRef,
}: FilterBarProps) {
  return (
    <div className={styles.filterBar}>
      <label className={styles.fieldLabel}>
        Search
        <input
          ref={searchInputRef}
          className={styles.input}
          aria-label="Search notes"
          placeholder="Search notes…"
          value={searchInput}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </label>
      <label className={styles.fieldLabel}>
        Filter by tag
        <input
          className={styles.input}
          aria-label="Filter by tag"
          placeholder="Filter by tag…"
          value={tagFilter}
          onChange={(e) => onTagFilterChange(e.target.value)}
        />
      </label>
      <label className={styles.fieldLabel}>
        Sort by
        <select
          className={styles.input}
          aria-label="Sort notes"
          value={sort}
          onChange={(e) => onSortChange(e.target.value as SortOrder)}
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="title">Title (A–Z)</option>
        </select>
      </label>
      <Button
        variant="secondary"
        aria-label={showArchived ? 'Show active notes' : 'Show archived notes'}
        onClick={onToggleArchived}
      >
        {showArchived ? 'Active notes' : 'Archived notes'}
      </Button>
    </div>
  );
}
