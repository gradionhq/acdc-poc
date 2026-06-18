import { useRef, type RefObject } from 'react';
import { FileText, SearchX } from 'lucide-react';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { Button } from './Button';
import { NoteCard, type NoteCardProps, type NoteCardRowProps } from './NoteCard';
import type { Note } from '../api';
import styles from './NoteList.module.css';

/** All props that NoteList passes through to each NoteCard, plus NoteList-specific props. */
export type NoteListProps = Omit<NoteCardProps, 'note'> & {
  notes: Note[];
  initialLoading: boolean;
  isFilterActive: boolean;
  showEmptyState: boolean;
  // Empty state CTA
  newNoteTitleRef: RefObject<HTMLInputElement>;
};

/**
 * Render only the visible rows once the list grows past this many notes.
 * Smaller lists render in full — windowing adds no value there and keeping the
 * whole list in the DOM avoids any measurement edge cases for the common case.
 */
const VIRTUALIZE_THRESHOLD = 20;

/**
 * Estimated row height (note card + inter-row gap) used to seed the
 * virtualizer before real heights are measured. Actual heights are measured
 * per row via `measureElement`, so a rough estimate is sufficient and cards of
 * any height (edit mode, attachments, long bodies) are handled correctly.
 */
const ESTIMATED_ROW_HEIGHT = 140;

/** Number of off-screen rows to render on each side of the viewport. */
const OVERSCAN = 6;

export function NoteList(props: NoteListProps) {
  const { notes, initialLoading, isFilterActive, showEmptyState, newNoteTitleRef } = props;

  return (
    <section aria-label="Notes" className={styles.noteListRegion}>
      {/* Loading skeleton — only on initial load, not background refresh */}
      {initialLoading && (
        <ul aria-label="Loading notes" aria-busy="true" className={styles.noteList}>
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i} className={`${styles.noteCard} ${styles.skeletonCard}`} aria-hidden="true">
              <span className={`${styles.skeletonLine} ${styles.skeletonTitle}`} />
              <span className={`${styles.skeletonLine} ${styles.skeletonBody}`} />
            </li>
          ))}
        </ul>
      )}

      {/* Empty state */}
      {showEmptyState && (
        <div className={styles.emptyState} role="status">
          {isFilterActive ? (
            <>
              <SearchX size={40} className={styles.emptyIcon} aria-hidden="true" />
              <p>No notes match your search.</p>
            </>
          ) : (
            <>
              <FileText size={40} className={styles.emptyIcon} aria-hidden="true" />
              <p>No notes yet. Create your first note above!</p>
              <Button
                variant="primary"
                onClick={() => newNoteTitleRef.current?.focus()}
                aria-label="Add your first note"
              >
                Add your first note
              </Button>
            </>
          )}
        </div>
      )}

      {/* Note list — always rendered after initial load to avoid flash on mutations */}
      {!initialLoading &&
        (notes.length > VIRTUALIZE_THRESHOLD ? (
          <VirtualNoteList {...props} />
        ) : (
          <ul className={styles.noteList} aria-label="Notes list">
            {notes.map((n) => renderCard(n, props))}
          </ul>
        ))}
    </section>
  );
}

/**
 * Windowed variant: only rows within (and just outside) the viewport are kept
 * in the DOM. Heights are measured per row, so variable-height cards work. The
 * outer `<ul>` keeps its full scroll height via the virtualizer's total size,
 * and each row keeps `aria-setsize`/`aria-posinset` so assistive tech still
 * sees the complete list and its true ordering.
 */
function VirtualNoteList(props: NoteListProps) {
  const { notes } = props;
  const listRef = useRef<HTMLUListElement>(null);

  const virtualizer = useWindowVirtualizer({
    count: notes.length,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: OVERSCAN,
    // Offset of the list within the document, so window scroll maps to row
    // positions correctly even with content above the list.
    scrollMargin: listRef.current?.offsetTop ?? 0,
  });

  const items = virtualizer.getVirtualItems();

  return (
    <ul
      ref={listRef}
      className={styles.noteList}
      aria-label="Notes list"
      style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}
    >
      {items.map((item) => {
        const note = notes[item.index];
        return renderCard(note, props, {
          ref: virtualizer.measureElement,
          'data-index': item.index,
          'aria-setsize': notes.length,
          'aria-posinset': item.index + 1,
          style: {
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            transform: `translateY(${item.start - virtualizer.options.scrollMargin}px)`,
          },
        });
      })}
    </ul>
  );
}

/** Render a single NoteCard, forwarding every pass-through prop from NoteList. */
function renderCard(note: Note, props: NoteListProps, rowProps?: NoteCardRowProps) {
  return (
    <NoteCard
      key={note.id}
      note={note}
      tagColors={props.tagColors}
      editingId={props.editingId}
      editTitle={props.editTitle}
      editBody={props.editBody}
      editTagsInput={props.editTagsInput}
      editColor={props.editColor}
      onEditTitleChange={props.onEditTitleChange}
      onEditBodyChange={props.onEditBodyChange}
      onEditTagsInputChange={props.onEditTagsInputChange}
      onEditColorChange={props.onEditColorChange}
      onEditSave={props.onEditSave}
      onEditCancel={props.onEditCancel}
      onEditStart={props.onEditStart}
      onTogglePin={props.onTogglePin}
      onToggleArchive={props.onToggleArchive}
      onDeleteRequest={props.onDeleteRequest}
      onDuplicate={props.onDuplicate}
      onRestore={props.onRestore}
      onPermanentDeleteRequest={props.onPermanentDeleteRequest}
      attachments={props.attachments}
      attachmentsOpen={props.attachmentsOpen}
      uploadError={props.uploadError}
      dragOver={props.dragOver}
      onToggleAttachments={props.onToggleAttachments}
      onUploadFile={props.onUploadFile}
      onDragOver={props.onDragOver}
      onDragLeave={props.onDragLeave}
      onDrop={props.onDrop}
      onDeleteAttachment={props.onDeleteAttachment}
      rowProps={rowProps}
    />
  );
}
