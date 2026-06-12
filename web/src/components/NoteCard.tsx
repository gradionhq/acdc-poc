import type { ChangeEvent, DragEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import {
  Pin,
  PinOff,
  Pencil,
  Archive,
  ArchiveRestore,
  Paperclip,
  MoreHorizontal,
  Copy,
  Trash2,
} from 'lucide-react';
import { Button } from './Button';
import { NoteBody } from '../NoteBody';
import { TagChip } from './TagChip';
import {
  attachmentDownloadUrl,
  NOTE_COLORS,
  type AttachmentMeta,
  type Note,
  type NoteColor,
  type TagColor,
} from '../api';
import styles from './NoteCard.module.css';

export interface NoteCardProps {
  note: Note;
  /** Lookup of tag name → assigned chip color (absent/null = default style). */
  tagColors: Record<string, TagColor | null>;
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

/** A small icon-only button with a visible tooltip on hover/focus. */
function IconButton({
  label,
  onClick,
  variant = 'ghost',
  children,
  buttonRef,
  'aria-haspopup': ariaHasPopup,
  'aria-expanded': ariaExpanded,
}: {
  label: string;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  variant?: 'ghost' | 'danger';
  children: React.ReactNode;
  buttonRef?: React.RefObject<HTMLButtonElement>;
  'aria-haspopup'?: React.AriaAttributes['aria-haspopup'];
  'aria-expanded'?: React.AriaAttributes['aria-expanded'];
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      aria-haspopup={ariaHasPopup}
      aria-expanded={ariaExpanded}
      className={`${styles.iconBtn} ${variant === 'danger' ? styles.iconBtnDanger : ''}`}
    >
      {children}
    </button>
  );
}

export function NoteCard({
  note: n,
  tagColors,
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
  const [overflowOpen, setOverflowOpen] = useState(false);
  const overflowBtnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function closeOverflow() {
    setOverflowOpen(false);
    overflowBtnRef.current?.focus();
  }

  // While the overflow menu is open, listen for outside-clicks and Escape so
  // the menu can be dismissed.  The `onKeyDown` on the menu div never fires
  // because focus stays on the trigger button, hence the document-level handler.
  useEffect(() => {
    if (!overflowOpen) return;

    function handleMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      // Ignore clicks on the trigger itself — its own onClick handles the toggle
      // so we don't double-fire (mousedown would close and onClick would re-open).
      if (overflowBtnRef.current?.contains(target)) return;
      if (menuRef.current && !menuRef.current.contains(target)) {
        closeOverflow();
      }
    }

    function handleKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') {
        closeOverflow();
      }
    }

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [overflowOpen]);

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
      {/* ── Card header: title + pinned badge ── */}
      <div className={styles.noteHeader}>
        <span className={styles.noteTitle}>{n.title}</span>
        {n.pinned && (
          <span aria-label="Pinned" className={styles.pinnedBadge}>
            <Pin size={12} aria-hidden="true" />
          </span>
        )}
      </div>

      {/* ── Body ── */}
      <NoteBody body={n.body} className={styles.noteBody} />

      {/* ── Tags ── */}
      {n.tags.length > 0 && (
        <div className={styles.tagList} aria-label="Tags">
          {n.tags.map((tag) => (
            <TagChip key={tag} tag={tag} color={tagColors[tag] ?? null} />
          ))}
        </div>
      )}

      {/* ── Action toolbar ── */}
      <div className={styles.noteActions}>
        {/* Primary icon actions (always visible, non-archived only where applicable) */}
        {!n.archived && (
          <IconButton
            label={n.pinned ? `Unpin ${n.title}` : `Pin ${n.title}`}
            onClick={() => onTogglePin(n.id, n.pinned)}
          >
            {n.pinned ? (
              <PinOff size={16} aria-hidden="true" />
            ) : (
              <Pin size={16} aria-hidden="true" />
            )}
          </IconButton>
        )}

        {!n.archived && (
          <IconButton label={`Edit ${n.title}`} onClick={() => onEditStart(n)}>
            <Pencil size={16} aria-hidden="true" />
          </IconButton>
        )}

        <IconButton
          label={n.archived ? `Unarchive ${n.title}` : `Archive ${n.title}`}
          onClick={() => onToggleArchive(n.id, n.archived)}
        >
          {n.archived ? (
            <ArchiveRestore size={16} aria-hidden="true" />
          ) : (
            <Archive size={16} aria-hidden="true" />
          )}
        </IconButton>

        {!n.archived && (
          <IconButton
            label={`Attachments for ${n.title}`}
            onClick={() => onToggleAttachments(n.id)}
          >
            <Paperclip size={16} aria-hidden="true" />
          </IconButton>
        )}

        {/* Overflow menu — duplicate + delete */}
        <div className={styles.overflowWrapper}>
          <IconButton
            label="More actions"
            buttonRef={overflowBtnRef}
            onClick={() => setOverflowOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={overflowOpen}
          >
            <MoreHorizontal size={16} aria-hidden="true" />
          </IconButton>

          {overflowOpen && (
            <div ref={menuRef} className={styles.overflowMenu} role="menu">
              {!n.archived && (
                <button
                  type="button"
                  role="menuitem"
                  aria-label={`Duplicate ${n.title}`}
                  className={styles.menuItem}
                  onClick={() => {
                    closeOverflow();
                    onDuplicate(n.id);
                  }}
                >
                  <Copy size={14} aria-hidden="true" />
                  Duplicate
                </button>
              )}
              <button
                type="button"
                role="menuitem"
                aria-label={`Delete ${n.title}`}
                className={`${styles.menuItem} ${styles.menuItemDanger}`}
                onClick={() => {
                  closeOverflow();
                  // Return focus to the overflow trigger so it can receive focus after
                  // the dialog is dismissed (the menuitem is removed from DOM on close).
                  onDeleteRequest(n.id, overflowBtnRef.current as HTMLButtonElement);
                }}
              >
                <Trash2 size={14} aria-hidden="true" />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Attachments panel ── */}
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
              {(attachments[n.id] ?? []).map((att) => {
                const isImage = att.contentType.startsWith('image/');
                const downloadUrl = attachmentDownloadUrl(n.id, att.filename);
                return (
                  <li key={att.filename} className={styles.attachmentItem}>
                    {isImage && (
                      <a
                        href={downloadUrl}
                        download={att.filename}
                        aria-label={`Download thumbnail for ${att.filename}`}
                        className={styles.attachmentThumbnailLink}
                      >
                        <img
                          src={downloadUrl}
                          alt={`Thumbnail for ${att.filename}`}
                          loading="lazy"
                          className={styles.attachmentThumbnail}
                        />
                      </a>
                    )}
                    <a
                      href={downloadUrl}
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
                );
              })}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}
