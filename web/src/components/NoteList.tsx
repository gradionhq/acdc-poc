import type { RefObject } from 'react';
import { Button } from './Button';
import { NoteCard, type NoteCardProps } from './NoteCard';
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

export function NoteList({
  notes,
  initialLoading,
  isFilterActive,
  showEmptyState,
  editingId,
  editTitle,
  editBody,
  editTagsInput,
  editColor,
  onEditTitleChange,
  onEditBodyChange,
  onEditTagsInputChange,
  onEditColorChange,
  onEditSave,
  onEditCancel,
  onEditStart,
  onTogglePin,
  onToggleArchive,
  onDeleteRequest,
  onDuplicate,
  attachments,
  attachmentsOpen,
  uploadError,
  dragOver,
  onToggleAttachments,
  onUploadFile,
  onDragOver,
  onDragLeave,
  onDrop,
  onDeleteAttachment,
  newNoteTitleRef,
}: NoteListProps) {
  return (
    <>
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
            <p>No notes match your search.</p>
          ) : (
            <>
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
      {!initialLoading && (
        <ul className={styles.noteList} aria-label="Notes list">
          {notes.map((n) => (
            <NoteCard
              key={n.id}
              note={n}
              editingId={editingId}
              editTitle={editTitle}
              editBody={editBody}
              editTagsInput={editTagsInput}
              editColor={editColor}
              onEditTitleChange={onEditTitleChange}
              onEditBodyChange={onEditBodyChange}
              onEditTagsInputChange={onEditTagsInputChange}
              onEditColorChange={onEditColorChange}
              onEditSave={onEditSave}
              onEditCancel={onEditCancel}
              onEditStart={onEditStart}
              onTogglePin={onTogglePin}
              onToggleArchive={onToggleArchive}
              onDeleteRequest={onDeleteRequest}
              onDuplicate={onDuplicate}
              attachments={attachments}
              attachmentsOpen={attachmentsOpen}
              uploadError={uploadError}
              dragOver={dragOver}
              onToggleAttachments={onToggleAttachments}
              onUploadFile={onUploadFile}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onDeleteAttachment={onDeleteAttachment}
            />
          ))}
        </ul>
      )}
    </>
  );
}
