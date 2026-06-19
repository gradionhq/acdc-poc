import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Archive, Trash2, Tag, X } from 'lucide-react';
import { Button } from './Button';
import type { SelectAllState } from '../useSelection';
import styles from './BulkActionBar.module.css';

export interface BulkActionBarProps {
  /** Number of currently selected notes. */
  count: number;
  /** Tri-state of the page-level select-all control. */
  selectAllState: SelectAllState;
  /** Toggle select-all-on-page. */
  onToggleSelectAll: () => void;
  /** Clear the entire selection. */
  onClear: () => void;
  /** Bulk-archive the selected notes. */
  onArchive: () => void;
  /** Bulk-trash the selected notes. */
  onTrash: () => void;
  /** Bulk add-tag the selected notes with the given (trimmed, non-empty) tag. */
  onAddTag: (tag: string) => void;
  /** Disables every action while a bulk request is in flight. */
  busy: boolean;
}

/**
 * Toolbar shown above the notes list while one or more notes are selected.
 * Hosts the page-level select-all checkbox, a live count, and the bulk
 * archive / trash / add-tag actions wired to the batch API. Rendered as an
 * ARIA toolbar so the grouped controls are announced and keyboard-navigable.
 */
export function BulkActionBar({
  count,
  selectAllState,
  onToggleSelectAll,
  onClear,
  onArchive,
  onTrash,
  onAddTag,
  busy,
}: BulkActionBarProps) {
  const [tagFormOpen, setTagFormOpen] = useState(false);
  const [tagValue, setTagValue] = useState('');
  const tagInputRef = useRef<HTMLInputElement>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);

  // Reflect the "some selected" middle state via the indeterminate property,
  // which cannot be set through markup and must be assigned imperatively.
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = selectAllState === 'some';
    }
  }, [selectAllState]);

  // Focus the tag input as soon as the add-tag form opens.
  useEffect(() => {
    if (tagFormOpen) {
      tagInputRef.current?.focus();
    }
  }, [tagFormOpen]);

  function submitTag(e: FormEvent) {
    e.preventDefault();
    const trimmed = tagValue.trim();
    if (trimmed === '') return;
    onAddTag(trimmed);
    setTagValue('');
    setTagFormOpen(false);
  }

  return (
    <div className={styles.bar} role="toolbar" aria-label="Bulk actions">
      <label className={styles.selectAll}>
        <input
          ref={selectAllRef}
          type="checkbox"
          checked={selectAllState === 'all'}
          onChange={onToggleSelectAll}
          aria-label="Select all notes on this page"
          disabled={busy}
        />
        <span aria-live="polite" className={styles.count}>
          {count} selected
        </span>
      </label>

      <div className={styles.actions}>
        <Button
          variant="secondary"
          onClick={onArchive}
          disabled={busy}
          aria-label="Archive selected notes"
        >
          <Archive size={16} aria-hidden="true" />
          Archive
        </Button>
        <Button
          variant="danger"
          onClick={onTrash}
          disabled={busy}
          aria-label="Move selected notes to trash"
        >
          <Trash2 size={16} aria-hidden="true" />
          Trash
        </Button>
        {tagFormOpen ? (
          <form className={styles.tagForm} onSubmit={submitTag}>
            <input
              ref={tagInputRef}
              className={styles.tagInput}
              type="text"
              value={tagValue}
              onChange={(e) => setTagValue(e.target.value)}
              placeholder="Tag to add"
              aria-label="Tag to add to selected notes"
              disabled={busy}
            />
            <Button type="submit" variant="primary" disabled={busy || tagValue.trim() === ''}>
              Add
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setTagFormOpen(false);
                setTagValue('');
              }}
              disabled={busy}
            >
              Cancel
            </Button>
          </form>
        ) : (
          <Button
            variant="secondary"
            onClick={() => setTagFormOpen(true)}
            disabled={busy}
            aria-label="Add a tag to selected notes"
          >
            <Tag size={16} aria-hidden="true" />
            Add tag
          </Button>
        )}
      </div>

      <Button
        variant="secondary"
        onClick={onClear}
        disabled={busy}
        aria-label="Clear selection"
        className={styles.clear}
      >
        <X size={16} aria-hidden="true" />
        Clear
      </Button>
    </div>
  );
}
