import type { RefObject } from 'react';
import { Search, Tag, ArrowUpDown, Archive } from 'lucide-react';
import type { SortOrder, TagMode, TagStat } from '../api';
import { TagChip } from './TagChip';
import styles from './FilterBar.module.css';

export interface FilterBarProps {
  searchInput: string;
  onSearchChange: (value: string) => void;
  tagFilter: string;
  onTagFilterChange: (value: string) => void;
  tagMode: TagMode;
  onTagModeChange: (mode: TagMode) => void;
  sort: SortOrder;
  onSortChange: (sort: SortOrder) => void;
  showArchived: boolean;
  onToggleArchived: () => void;
  searchInputRef: RefObject<HTMLInputElement>;
  /** All tags in use, with their colors — rendered as clickable filter chips. */
  tags?: TagStat[];
}

export function FilterBar({
  searchInput,
  onSearchChange,
  tagFilter,
  onTagFilterChange,
  tagMode,
  onTagModeChange,
  sort,
  onSortChange,
  showArchived,
  onToggleArchived,
  searchInputRef,
  tags = [],
}: FilterBarProps) {
  const isAndMode = tagMode === 'and';
  return (
    <div className={styles.filterBar} role="search" aria-label="Filter and sort notes">
      {/* Search */}
      <label className={`${styles.fieldLabel} ${styles.fieldSearch}`}>
        Search
        <div className={styles.inputWrapper}>
          <Search size={14} className={styles.inputIcon} aria-hidden="true" />
          <input
            ref={searchInputRef}
            className={styles.inputWithIcon}
            aria-label="Search notes"
            placeholder="Search notes…"
            value={searchInput}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </label>

      {/* Tag filter */}
      <label className={`${styles.fieldLabel} ${styles.fieldTag}`}>
        Filter by tag
        <div className={styles.inputWrapper}>
          <Tag size={14} className={styles.inputIcon} aria-hidden="true" />
          <input
            className={styles.inputWithIcon}
            aria-label="Filter by tag"
            placeholder="tag1, tag2…"
            value={tagFilter}
            onChange={(e) => onTagFilterChange(e.target.value)}
          />
        </div>
      </label>

      {/* Tag mode toggle */}
      <div className={styles.fieldToggle}>
        <button
          type="button"
          className={`${styles.toggleBtn} ${isAndMode ? styles.toggleBtnActive : ''}`}
          aria-label={isAndMode ? 'Match ALL tags' : 'Match ANY tag'}
          aria-pressed={isAndMode}
          onClick={() => onTagModeChange(isAndMode ? 'or' : 'and')}
        >
          {isAndMode ? 'Match ALL' : 'Match ANY'}
        </button>
      </div>

      {/* Sort */}
      <label className={`${styles.fieldLabel} ${styles.fieldSort}`}>
        Sort by
        <div className={styles.inputWrapper}>
          <ArrowUpDown size={14} className={styles.inputIcon} aria-hidden="true" />
          <select
            className={`${styles.select} ${styles.inputWithIcon}`}
            aria-label="Sort notes"
            value={sort}
            onChange={(e) => onSortChange(e.target.value as SortOrder)}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="title">Title (A–Z)</option>
          </select>
        </div>
      </label>

      {/* Archive toggle */}
      <div className={styles.fieldToggle}>
        <button
          type="button"
          className={`${styles.toggleBtn} ${showArchived ? styles.toggleBtnActive : ''}`}
          aria-label={showArchived ? 'Show active notes' : 'Show archived notes'}
          aria-pressed={showArchived}
          onClick={onToggleArchived}
        >
          <Archive size={14} aria-hidden="true" />
          {showArchived ? 'Active notes' : 'Archived notes'}
        </button>
      </div>

      {/* Clickable tag chips — colored, and toggle the tag filter on click */}
      {tags.length > 0 && (
        <div className={styles.tagChips} aria-label="Filter by tag chips">
          {tags.map(({ tag, color }) => {
            const active = tagFilter.trim().toLowerCase() === tag.toLowerCase();
            return (
              <button
                key={tag}
                type="button"
                aria-label={`Filter by tag ${tag}`}
                aria-pressed={active}
                className={`${styles.tagChipButton} ${active ? styles.tagChipActive : ''}`}
                onClick={() => onTagFilterChange(active ? '' : tag)}
              >
                <TagChip tag={tag} color={color} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
