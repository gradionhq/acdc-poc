import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  attachmentDownloadUrl,
  createNote,
  deleteNote,
  listAttachments,
  listNotes,
  togglePin,
  updateNote,
  uploadAttachment,
  type AttachmentMeta,
  type Note,
} from './api';
import { Button } from './components/Button';
import { ToastContainer } from './ToastContainer';
import { useTheme } from './useTheme';
import { useToast } from './useToast';
import styles from './App.module.css';

const PAGE_SIZE = 5;
const SEARCH_DEBOUNCE_MS = 300;

/** Parse a comma-separated string into a trimmed, non-empty, deduplicated string array. */
function parseTags(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t !== ''),
    ),
  ];
}

export function App() {
  const { theme, toggleTheme } = useTheme();
  const { toasts, addToast, dismissToast } = useToast();
  const [notes, setNotes] = useState<Note[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editTagsInput, setEditTagsInput] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  /** noteId → list of attachment metadata (loaded lazily on expand). */
  const [attachments, setAttachments] = useState<Record<string, AttachmentMeta[]>>({});
  /** noteId → true while attachments panel is open. */
  const [attachmentsOpen, setAttachmentsOpen] = useState<Record<string, boolean>>({});
  /** noteId → upload error string. */
  const [uploadError, setUploadError] = useState<Record<string, string | null>>({});

  // Monotonically increasing counter; each refresh call captures its own id
  // and only applies its result if no newer request has been issued since.
  const reqSeqRef = useRef(0);
  // Set to true when onSubmit clears the search programmatically so the
  // debounce effect skips its `setPage(1)` reset (onSubmit controls the page
  // directly in that case).
  const skipDebouncePageResetRef = useRef(false);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function refresh(p = page, q = query, tf = tagFilter) {
    const seq = ++reqSeqRef.current;
    try {
      const result = await listNotes(p, PAGE_SIZE, q, tf);
      if (seq !== reqSeqRef.current) return; // stale — a newer request is in flight
      setNotes(result.notes);
      setTotal(result.total);
    } catch (e) {
      if (seq !== reqSeqRef.current) return;
      setError(String(e));
    }
  }

  useEffect(() => {
    void refresh(page, query, tagFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, query, tagFilter]);

  // Debounce search input: update `query` after SEARCH_DEBOUNCE_MS of inactivity.
  // Reset to page 1 whenever the query changes so results are always from the start.
  // Skip the page reset when onSubmit has already positioned the page itself.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!skipDebouncePageResetRef.current) {
        setPage(1);
      }
      skipDebouncePageResetRef.current = false;
      setQuery(searchInput);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    try {
      await createNote({ title, body, tags: parseTags(tagsInput) });
      setTitle('');
      setBody('');
      setTagsInput('');
      setError(null);
      addToast('Note created', 'success');
      // If a search filter is active, clear it before navigating so the new
      // note is always visible. With a filter active, `total` reflects only
      // the filtered count; the new note may not match the query, so
      // navigating to `lastPage` of the filtered results would not show it.
      // Fetch the real (unfiltered) total to compute the correct last page.
      const unfilteredTotal = query !== '' ? (await listNotes(1, 1, '')).total : total;
      if (query !== '') {
        // Signal the debounce effect to skip its setPage(1) reset; onSubmit
        // will set the correct page directly after clearing the search.
        skipDebouncePageResetRef.current = true;
        setSearchInput('');
        setQuery('');
      }
      // New note is appended at the end (oldest-first ordering).
      // Navigate to the last page so it is immediately visible.
      const newTotal = unfilteredTotal + 1;
      const lastPage = Math.max(1, Math.ceil(newTotal / PAGE_SIZE));
      if (page === lastPage && query === '') {
        await refresh(lastPage, '');
      } else {
        setPage(lastPage);
      }
    } catch (e) {
      addToast('Failed to create note', 'error');
      setError(String(e));
    }
  }

  function onEditStart(note: Note) {
    setEditingId(note.id);
    setEditTitle(note.title);
    setEditBody(note.body);
    setEditTagsInput(note.tags.join(', '));
  }

  function onEditCancel() {
    setEditingId(null);
    setEditTitle('');
    setEditBody('');
    setEditTagsInput('');
  }

  async function onEditSave(id: string) {
    if (!editTitle.trim() || !editBody.trim()) return;
    try {
      await updateNote(id, { title: editTitle, body: editBody, tags: parseTags(editTagsInput) });
      setEditingId(null);
      setEditTitle('');
      setEditBody('');
      setEditTagsInput('');
      setError(null);
      addToast('Note updated', 'success');
      await refresh(page);
    } catch (e) {
      addToast('Failed to update note', 'error');
      setError(String(e));
    }
  }

  async function onToggleAttachments(id: string) {
    const isOpen = attachmentsOpen[id] ?? false;
    if (isOpen) {
      setAttachmentsOpen((prev) => ({ ...prev, [id]: false }));
      return;
    }
    setAttachmentsOpen((prev) => ({ ...prev, [id]: true }));
    try {
      const metas = await listAttachments(id);
      setAttachments((prev) => ({ ...prev, [id]: metas }));
    } catch (e) {
      setError(String(e));
    }
  }

  async function onUploadFile(id: string, e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset the input so the same file can be re-uploaded after correction
    e.target.value = '';
    setUploadError((prev) => ({ ...prev, [id]: null }));
    try {
      await uploadAttachment(id, file);
      const metas = await listAttachments(id);
      setAttachments((prev) => ({ ...prev, [id]: metas }));
    } catch (err) {
      setUploadError((prev) => ({ ...prev, [id]: String(err) }));
    }
  }

  async function onTogglePin(id: string, currentlyPinned: boolean) {
    try {
      await togglePin(id);
      setError(null);
      addToast(currentlyPinned ? 'Note unpinned' : 'Note pinned', 'success');
      if (currentlyPinned) {
        // Unpin: note stays on (or near) the current page — just refresh it.
        await refresh(page);
      } else {
        // Pin: the server moves pinned notes to the front of the sorted list,
        // so the just-pinned note will appear on page 1. Navigate there so the
        // user can see the confirmation (button changes to "Unpin …").
        if (page === 1) {
          await refresh(1);
        } else {
          setPage(1);
        }
      }
    } catch (e) {
      addToast('Failed to toggle pin', 'error');
      setError(String(e));
    }
  }

  async function onDelete(id: string) {
    try {
      await deleteNote(id);
      setError(null);
      addToast('Note deleted', 'success');
      // After deletion the current page may become empty; go back one if needed
      const newTotal = total - 1;
      const newTotalPages = Math.max(1, Math.ceil(newTotal / PAGE_SIZE));
      const newPage = Math.min(page, newTotalPages);
      if (newPage === page) {
        await refresh(page);
      } else {
        setPage(newPage);
      }
    } catch (e) {
      addToast('Failed to delete note', 'error');
      setError(String(e));
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Notes</h1>
        <button
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="theme-toggle"
          onClick={toggleTheme}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </header>
      {error && (
        <p role="alert" className={styles.alert}>
          {error}
        </p>
      )}

      {/* Search / filter bar */}
      <div className={styles.filterBar}>
        <label className={styles.fieldLabel}>
          Search
          <input
            className={styles.input}
            aria-label="Search notes"
            placeholder="Search notes…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </label>
        <label className={styles.fieldLabel}>
          Filter by tag
          <input
            className={styles.input}
            aria-label="Filter by tag"
            placeholder="Filter by tag…"
            value={tagFilter}
            onChange={(e) => {
              setPage(1);
              setTagFilter(e.target.value);
            }}
          />
        </label>
      </div>

      {/* Create-note form */}
      <form onSubmit={onSubmit} className={styles.form}>
        <div className={`${styles.card} ${styles.fieldGroup}`}>
          <h2 className={styles.formTitle}>New note</h2>
          <label className={styles.fieldLabel}>
            Title
            <input
              className={styles.input}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className={styles.fieldLabel}>
            Body
            <textarea
              className={styles.textarea}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </label>
          <label className={styles.fieldLabel}>
            Tags
            <input
              className={styles.input}
              aria-label="Tags"
              placeholder="comma-separated tags"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
            />
          </label>
          <div className={styles.formActions}>
            <Button type="submit" variant="primary">
              Add note
            </Button>
          </div>
        </div>
      </form>

      {/* Note list */}
      <ul className={styles.noteList}>
        {notes.map((n) =>
          editingId === n.id ? (
            <li key={n.id} className={styles.noteCard}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>
                  Edit title
                  <input
                    className={styles.input}
                    aria-label="Edit title"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                  />
                </label>
                <label className={styles.fieldLabel}>
                  Edit body
                  <textarea
                    className={styles.textarea}
                    aria-label="Edit body"
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                  />
                </label>
                <label className={styles.fieldLabel}>
                  Edit tags
                  <input
                    className={styles.input}
                    aria-label="Edit tags"
                    placeholder="comma-separated tags"
                    value={editTagsInput}
                    onChange={(e) => setEditTagsInput(e.target.value)}
                  />
                </label>
                <div className={styles.noteActions}>
                  <Button variant="primary" onClick={() => void onEditSave(n.id)}>
                    Save
                  </Button>
                  <Button variant="secondary" onClick={onEditCancel}>
                    Cancel
                  </Button>
                </div>
              </div>
            </li>
          ) : (
            <li key={n.id} className={styles.noteCard}>
              <div className={styles.noteHeader}>
                <span className={styles.noteTitle}>{n.title}</span>
                {n.pinned && (
                  <span aria-label="Pinned" className={styles.pinnedBadge}>
                    📌
                  </span>
                )}
              </div>
              <p className={styles.noteBody}>{n.body}</p>
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
                <Button
                  variant="secondary"
                  aria-label={n.pinned ? `Unpin ${n.title}` : `Pin ${n.title}`}
                  onClick={() => void onTogglePin(n.id, n.pinned)}
                >
                  {n.pinned ? 'Unpin' : 'Pin'}
                </Button>
                <Button
                  variant="secondary"
                  aria-label={`Edit ${n.title}`}
                  onClick={() => onEditStart(n)}
                >
                  Edit
                </Button>
                <Button
                  variant="danger"
                  aria-label={`Delete ${n.title}`}
                  onClick={() => void onDelete(n.id)}
                >
                  Delete
                </Button>
                <Button
                  variant="secondary"
                  aria-label={`Attachments for ${n.title}`}
                  onClick={() => void onToggleAttachments(n.id)}
                >
                  {attachmentsOpen[n.id] ? 'Hide attachments' : 'Attachments'}
                </Button>
              </div>
              {attachmentsOpen[n.id] && (
                <div
                  className={styles.attachmentsPanel}
                  aria-label={`Attachments panel for ${n.title}`}
                >
                  {uploadError[n.id] && (
                    <p role="alert" className={styles.alert}>
                      {uploadError[n.id]}
                    </p>
                  )}
                  <label className={styles.attachmentUpload}>
                    Attach file
                    <input
                      type="file"
                      aria-label={`Upload attachment for ${n.title}`}
                      onChange={(e) => void onUploadFile(n.id, e)}
                    />
                  </label>
                  {(attachments[n.id] ?? []).length === 0 ? (
                    <p className={styles.attachmentEmpty}>No attachments yet.</p>
                  ) : (
                    <ul
                      className={styles.attachmentList}
                      aria-label={`Attachment list for ${n.title}`}
                    >
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
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </li>
          ),
        )}
      </ul>

      {/* Pagination */}
      <nav aria-label="Pagination" className={styles.pagination}>
        <Button
          variant="secondary"
          onClick={() => setPage((p) => p - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          Previous
        </Button>
        <span className={styles.pageInfo}>
          Page {page} of {totalPages}
        </span>
        <Button
          variant="secondary"
          onClick={() => setPage((p) => p + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
        >
          Next
        </Button>
      </nav>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </main>
  );
}
