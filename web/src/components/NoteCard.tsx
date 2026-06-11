import type { ChangeEvent, DragEvent } from 'react';
import { Button } from './Button';
import { NoteBody } from '../NoteBody';
import {
  attachmentDownloadUrl,
  NOTE_COLORS,
  type AttachmentMeta,
  type Note,
  type NoteColor,
} from '../api';
import styles from './NoteCard.module.css';

export interface NoteCardProps {
  note: Note;
  // Edit state
  editingId: string | null;
  editTitle: string;
  editBody: string;
  editTagsInput: string;
  editColor: NoteColor;
  onEditTitleChange: (value: string) => void;
  onEditBodyChange: (value: string) => void;
  onEditTagsInputChange: (value: string) => void;
  onEditColorChange: (color: NoteColor) => void;
  onEditSave: (id: string) => void;
  onEditCancel: () => void;
  // Actions
  onEditStart: (note: Note) => void;
  onTogglePin: (id: string, pinned: boolean) => void;
  onToggleArchive: (id: string, archived: boolean) => void;
  onDeleteRequest: (id: string, trigger: HTMLButtonElement) => void;
  onDuplicate: (id: string) => void;
  // Attachments
  attachments: Record<string, AttachmentMeta[]>;
  attachmentsOpen: Record<string, boolean>;
  uploadError: Record<string, string | null>;
  dragOver: Record<string, boolean>;
  onToggleAttachments: (id: string) => void;
  onUploadFile: (id: string, e: ChangeEvent<HTMLInputElement>) => void;
  onDragOver: (id: string, e: DragEvent<HTMLElement>) => void;
  onDragLeave: (id: string, e: DragEvent<HTMLElement>) => void;
  onDrop: (id: string, e: DragEvent<HTMLElement>) => void;
  onDeleteAttachment: (noteId: string, filename: string) => void;
}

export function NoteCard({
  note: n,
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
}: NoteCardProps) {
  if (editingId === n.id) {
    return (
      <li key={n.id} className={styles.noteCard}>
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>
            Edit title
            <input
              className={styles.input}
              aria-label="Edit title"
              value={editTitle}
              onChange={(e) => onEditTitleChange(e.target.value)}
            />
          </label>
          <label className={styles.fieldLabel}>
            Edit body
            <textarea
              className={styles.textarea}
              aria-label="Edit body"
              value={editBody}
              onChange={(e) => onEditBodyChange(e.target.value)}
            />
          </label>
          <label className={styles.fieldLabel}>
            Edit tags
            <input
              className={styles.input}
              aria-label="Edit tags"
              placeholder="comma-separated tags"
              value={editTagsInput}
              onChange={(e) => onEditTagsInputChange(e.target.value)}
            />
          </label>
          <fieldset className={styles.fieldLabel}>
            <legend>Edit color</legend>
            <div className={styles.colorPicker}>
              {NOTE_COLORS.map((c) => {
                const swatchKey = `swatch-${c}` as keyof typeof styles;
                const editSwatchCls = [
                  styles.colorSwatch,
                  styles[swatchKey],
                  editColor === c ? styles.colorSwatchSelected : '',
                ].join(' ');
                return (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Color ${c}`}
                    aria-pressed={editColor === c}
                    className={editSwatchCls}
                    onClick={() => onEditColorChange(c)}
                  />
                );
              })}
            </div>
          </fieldset>
          <div className={styles.noteActions}>
            <Button variant="primary" onClick={() => onEditSave(n.id)}>
              Save
            </Button>
            <Button variant="secondary" onClick={onEditCancel}>
              Cancel
            </Button>
          </div>
        </div>
      </li>
    );
  }

  return (
    <li
      key={n.id}
      className={[
        styles.noteCard,
        n.color === 'none' ? '' : styles[`card-${n.color}` as keyof typeof styles],
      ].join(' ')}
      data-color={n.color}
    >
      <div className={styles.noteHeader}>
        <span className={styles.noteTitle}>{n.title}</span>
        {n.pinned && (
          <span aria-label="Pinned" className={styles.pinnedBadge}>
            📌
          </span>
        )}
      </div>
      <NoteBody body={n.body} className={styles.noteBody} />
      {n.tags.length > 0 && (
        <div className={styles.tagList} aria-label="Tags">
          {n.tags.map((tag) => (
            <span key={tag} data-tag={tag} className={styles.tag}>
              {tag}
            </span>
          ))}
        </div>
      )}
      <div className={styles.noteActions}>
        {!n.archived && (
          <Button
            variant="secondary"
            aria-label={n.pinned ? `Unpin ${n.title}` : `Pin ${n.title}`}
            onClick={() => onTogglePin(n.id, n.pinned)}
          >
            {n.pinned ? 'Unpin' : 'Pin'}
          </Button>
        )}
        <Button
          variant="secondary"
          aria-label={n.archived ? `Unarchive ${n.title}` : `Archive ${n.title}`}
          onClick={() => onToggleArchive(n.id, n.archived)}
        >
          {n.archived ? 'Unarchive' : 'Archive'}
        </Button>
        {!n.archived && (
          <Button variant="secondary" aria-label={`Edit ${n.title}`} onClick={() => onEditStart(n)}>
            Edit
          </Button>
        )}
        <Button
          variant="danger"
          aria-label={`Delete ${n.title}`}
          onClick={(e) => onDeleteRequest(n.id, e.currentTarget)}
        >
          Delete
        </Button>
        {!n.archived && (
          <Button
            variant="secondary"
            aria-label={`Duplicate ${n.title}`}
            onClick={() => onDuplicate(n.id)}
          >
            Duplicate
          </Button>
        )}
        {!n.archived && (
          <Button
            variant="secondary"
            aria-label={`Attachments for ${n.title}`}
            onClick={() => onToggleAttachments(n.id)}
          >
            {attachmentsOpen[n.id] ? 'Hide attachments' : 'Attachments'}
          </Button>
        )}
      </div>
      {attachmentsOpen[n.id] && (
        <div className={styles.attachmentsPanel} aria-label={`Attachments panel for ${n.title}`}>
          {uploadError[n.id] && (
            <p role="alert" className={styles.alert}>
              {uploadError[n.id]}
            </p>
          )}
          {/* Drag-and-drop dropzone */}
          <section
            aria-label={`Drop files here to attach to ${n.title}`}
            className={`${styles.dropzone} ${dragOver[n.id] ? styles.dropzoneActive : ''}`}
            onDragOver={(e) => onDragOver(n.id, e)}
            onDragLeave={(e) => onDragLeave(n.id, e)}
            onDrop={(e) => void onDrop(n.id, e)}
          >
            <span className={styles.dropzoneHint}>
              Drag &amp; drop files here, or use the button below
            </span>
          </section>
          <label className={styles.attachmentUpload}>
            Attach files
            <input
              type="file"
              multiple
              aria-label={`Upload attachment for ${n.title}`}
              onChange={(e) => void onUploadFile(n.id, e)}
            />
          </label>
          {(attachments[n.id] ?? []).length === 0 ? (
            <p className={styles.attachmentEmpty}>No attachments yet.</p>
          ) : (
            <ul className={styles.attachmentList} aria-label={`Attachment list for ${n.title}`}>
              {(attachments[n.id] ?? []).map((att) => (
                <li key={att.filename}>
                  <a
                    href={attachmentDownloadUrl(n.id, att.filename)}
                    download={att.filename}
                    aria-label={`Download ${att.filename}`}
                  >
                    {att.filename}
                  </a>{' '}
                  ({att.size} bytes)
                  <Button
                    variant="danger"
                    aria-label={`Delete attachment ${att.filename}`}
                    onClick={() => void onDeleteAttachment(n.id, att.filename)}
                  >
                    Delete
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}
