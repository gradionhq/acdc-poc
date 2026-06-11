import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from 'react';
import {
  attachmentDownloadUrl,
  createNote,
  deleteAttachment,
  deleteNote,
  duplicateNote,
  listAttachments,
  listNotes,
  togglePin,
  updateNote,
  uploadAttachments,
  type AttachmentMeta,
  type Note,
  type SortOrder,
} from './api';
import { Button } from './components/Button';
import { NoteBody } from './NoteBody';
import { ToastContainer } from './ToastContainer';
import { useTheme } from './useTheme';
import { countWords, countChars } from './wordCount';
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
  const [sort, setSort] = useState<SortOrder>('newest');
  /** noteId → list of attachment metadata (loaded lazily on expand). */
  const [attachments, setAttachments] = useState<Record<string, AttachmentMeta[]>>({});
  /** noteId → true while attachments panel is open. */
  const [attachmentsOpen, setAttachmentsOpen] = useState<Record<string, boolean>>({});
  /** noteId → upload error string. */
  const [uploadError, setUploadError] = useState<Record<string, string | null>>({});
  /** noteId → true while a drag is active over that note's dropzone. */
  const [dragOver, setDragOver] = useState<Record<string, boolean>>({});

  // True only on the very first load — gates the skeleton so background
  // refreshes after mutations do not flash the whole list.
  const [initialLoading, setInitialLoading] = useState(true);

  // Monotonically increasing counter; each refresh call captures its own id
  // and only applies its result if no newer request has been issued since.
  const reqSeqRef = useRef(0);
  // Set to true when onSubmit clears the search programmatically so the
  // debounce effect skips its `setPage(1)` reset (onSubmit controls the page
  // directly in that case).
  const skipDebouncePageResetRef = useRef(false);

  // Ref for the title input so the empty-state CTA can focus it idiomatically.
  const titleInputRef = useRef<HTMLInputElement>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function refresh(p = page, q = query, tf = tagFilter, s = sort) {
    const seq = ++reqSeqRef.current;
    try {
      const result = await listNotes(p, PAGE_SIZE, q, tf, s);
      if (seq !== reqSeqRef.current) return; // stale — a newer request is in flight
      setNotes(result.notes);
      setTotal(result.total);
      setError(null);
    } catch (e: unknown) {
      if (seq !== reqSeqRef.current) return;
      const msg = e instanceof Error ? e.message : 'An unexpected error occurred';
      setError(msg);
    } finally {
      if (seq === reqSeqRef.current) setInitialLoading(false);
    }
  }

  useEffect(() => {
    void refresh(page, query, tagFilter, sort);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, query, tagFilter, sort]);

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
      // navigating to the target page of the unfiltered results would not show it.
      // Fetch the real (unfiltered) total to compute the correct destination page.
      const unfilteredTotal = query !== '' ? (await listNotes(1, 1, '')).total : total;
      if (query !== '') {
        // Signal the debounce effect to skip its setPage(1) reset; onSubmit
        // will set the correct page directly after clearing the search.
        skipDebouncePageResetRef.current = true;
        setSearchInput('');
        setQuery('');
      }
      const newTotal = unfilteredTotal + 1;
      // Navigate to the page where the newly created note will appear.
      if (sort === 'oldest') {
        // oldest: the new note always sorts last → last page.
        const lastPage = Math.max(1, Math.ceil(newTotal / PAGE_SIZE));
        if (page === lastPage && query === '') {
          await refresh(lastPage, '', tagFilter, sort);
        } else {
          setPage(lastPage);
        }
      } else if (sort === 'newest') {
        // newest: the new note always sorts first → page 1.
        if (page === 1 && query === '') {
          await refresh(1, '', tagFilter, sort);
        } else {
          setPage(1);
        }
      } else {
        // title: the new note's page depends on its alphabetical rank among
        // all (unfiltered) notes. Fetch the full sorted list to find its position.
        const fullPage = await listNotes(1, newTotal, '', tagFilter, 'title');
        const rank = fullPage.notes.findIndex((n) => n.title === title) + 1;
        const dest = rank > 0 ? Math.ceil(rank / PAGE_SIZE) : 1;
        if (page === dest && query === '') {
          await refresh(dest, '', tagFilter, sort);
        } else {
          setPage(dest);
        }
      }
    } catch (e: unknown) {
      addToast('Failed to create note', 'error');
      setError(e instanceof Error ? e.message : 'An unexpected error occurred');
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
    } catch (e: unknown) {
      addToast('Failed to update note', 'error');
      setError(e instanceof Error ? e.message : 'An unexpected error occurred');
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
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'An unexpected error occurred');
    }
  }

  async function uploadFiles(id: string, files: File[]) {
    if (files.length === 0) return;
    setUploadError((prev) => ({ ...prev, [id]: null }));
    try {
      await uploadAttachments(id, files);
      const metas = await listAttachments(id);
      setAttachments((prev) => ({ ...prev, [id]: metas }));
    } catch (err: unknown) {
      setUploadError((prev) => ({
        ...prev,
        [id]: err instanceof Error ? err.message : 'An unexpected error occurred',
      }));
    }
  }

  async function onUploadFile(id: string, e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    // Reset the input so the same file(s) can be re-uploaded after correction
    e.target.value = '';
    await uploadFiles(id, files);
  }

  function onDragOver(id: string, e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver((prev) => ({ ...prev, [id]: true }));
  }

  function onDragLeave(id: string, e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver((prev) => ({ ...prev, [id]: false }));
  }

  async function onDrop(id: string, e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver((prev) => ({ ...prev, [id]: false }));
    const files = Array.from(e.dataTransfer.files);
    await uploadFiles(id, files);
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
    } catch (e: unknown) {
      addToast('Failed to toggle pin', 'error');
      setError(e instanceof Error ? e.message : 'An unexpected error occurred');
    }
  }

  async function onDeleteAttachment(noteId: string, filename: string) {
    if (!window.confirm(`Delete attachment "${filename}"?`)) return;
    try {
      await deleteAttachment(noteId, filename);
      const metas = await listAttachments(noteId);
      setAttachments((prev) => ({ ...prev, [noteId]: metas }));
    } catch (e) {
      setUploadError((prev) => ({ ...prev, [noteId]: String(e) }));
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
    } catch (e: unknown) {
      addToast('Failed to delete note', 'error');
      setError(e instanceof Error ? e.message : 'An unexpected error occurred');
    }
  }

  async function onDuplicate(id: string) {
    try {
      await duplicateNote(id);
      setError(null);
      // The duplicate is appended at the end (newest createdAt); navigate to the
      // last page so it is immediately visible.
      const newTotal = total + 1;
      const lastPage = Math.max(1, Math.ceil(newTotal / PAGE_SIZE));
      if (page === lastPage) {
        await refresh(lastPage);
      } else {
        setPage(lastPage);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'An unexpected error occurred');
    }
  }

  // True when there are no notes to show AND no filter is active — i.e. the
  // store is genuinely empty (not just "no results for this search").
  const isFilterActive = query !== '' || tagFilter !== '';
  const showEmptyState = !initialLoading && !error && notes.length === 0;

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
        <div role="alert" className={styles.errorBanner}>
          <span className={styles.errorMessage}>{error}</span>
          <Button variant="danger" onClick={() => void refresh()} aria-label="Retry">
            Retry
          </Button>
        </div>
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
        <label className={styles.fieldLabel}>
          Sort by
          <select
            className={styles.input}
            aria-label="Sort notes"
            value={sort}
            onChange={(e) => {
              setPage(1);
              setSort(e.target.value as SortOrder);
            }}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="title">Title (A–Z)</option>
          </select>
        </label>
      </div>

      {/* Create-note form */}
      <form onSubmit={onSubmit} className={styles.form}>
        <div className={`${styles.card} ${styles.fieldGroup}`}>
          <h2 className={styles.formTitle}>New note</h2>
          <label className={styles.fieldLabel}>
            Title
            <input
              ref={titleInputRef}
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
          <p aria-live="polite" className={styles.wordCount}>
            {countWords(body)} {countWords(body) === 1 ? 'word' : 'words'}, {countChars(body)}{' '}
            {countChars(body) === 1 ? 'character' : 'characters'}
          </p>
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
                onClick={() => titleInputRef.current?.focus()}
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
                    aria-label={`Duplicate ${n.title}`}
                    onClick={() => void onDuplicate(n.id)}
                  >
                    Duplicate
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
                    {/* Drag-and-drop dropzone */}
                    <div
                      role="region"
                      aria-label={`Drop files here to attach to ${n.title}`}
                      className={`${styles.dropzone} ${dragOver[n.id] ? styles.dropzoneActive : ''}`}
                      onDragOver={(e) => onDragOver(n.id, e)}
                      onDragLeave={(e) => onDragLeave(n.id, e)}
                      onDrop={(e) => void onDrop(n.id, e)}
                    >
                      <span className={styles.dropzoneHint}>
                        Drag &amp; drop files here, or use the button below
                      </span>
                    </div>
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
            ),
          )}
        </ul>
      )}

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
