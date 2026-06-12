import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from 'react';
import {
  createNote,
  deleteAttachment,
  deleteNote,
  duplicateNote,
  listAttachments,
  listNotes,
  toggleArchive,
  togglePin,
  updateNote,
  uploadAttachments,
  type AttachmentMeta,
  type Note,
  type NoteColor,
  type SortOrder,
} from './api';
import { ConfirmDialog } from './ConfirmDialog';
import { ToastContainer } from './ToastContainer';
import { useTheme } from './useTheme';
import { useToast } from './useToast';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import { FilterBar } from './components/FilterBar';
import { Header } from './components/Header';
import { NoteComposer } from './components/NoteComposer';
import { NoteList } from './components/NoteList';
import { Pagination } from './components/Pagination';
import { Button } from './components/Button';
import styles from './App.module.css';

const PAGE_SIZE = 5;
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Given an already-sorted list of notes (in the exact order the server returns
 * them for a given sort, including pinned-first ordering), return the 1-based
 * page number on which the note with `id` appears for the given page size.
 *
 * Pure and synchronous: the page-index math is isolated here so it can be unit
 * tested deterministically without any async/UI plumbing. Returns 1 as a safe
 * fallback when the note is absent or `pageSize` is not positive.
 */
export function pageOfNoteById(
  sortedNotes: readonly Pick<Note, 'id'>[],
  id: string,
  pageSize: number,
): number {
  if (pageSize <= 0) return 1;
  const index = sortedNotes.findIndex((n) => n.id === id);
  return index >= 0 ? Math.floor(index / pageSize) + 1 : 1;
}

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
  const [showTagManager, setShowTagManager] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [color, setColor] = useState<NoteColor>('none');
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editTagsInput, setEditTagsInput] = useState('');
  const [editColor, setEditColor] = useState<NoteColor>('none');
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [sort, setSort] = useState<SortOrder>('newest');
  /** noteId → list of attachment metadata (loaded lazily on expand). */
  const [attachments, setAttachments] = useState<Record<string, AttachmentMeta[]>>({});
  /** noteId → true while attachments panel is open. */
  const [attachmentsOpen, setAttachmentsOpen] = useState<Record<string, boolean>>({});
  /** noteId → upload error string. */
  const [uploadError, setUploadError] = useState<Record<string, string | null>>({});
  /** Whether the keyboard shortcut help panel is open. */
  const [showHelp, setShowHelp] = useState(false);

  /** Ref to the new-note title input — used by the `n` shortcut. */
  const newNoteTitleRef = useRef<HTMLInputElement>(null);
  /** Ref to the search input — used by the `/` shortcut. */
  const searchInputRef = useRef<HTMLInputElement>(null);
  /** Ref to the help-toggle button — focus is restored here when the panel closes. */
  const helpToggleRef = useRef<HTMLButtonElement>(null);
  /** Ref to the help panel's close button — focused when the panel opens. */
  const helpCloseBtnRef = useRef<HTMLButtonElement>(null);
  /**
   * When non-null, the confirm dialog is open and this holds the id of the note
   * pending deletion.
   */
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  /** Ref to the delete button that triggered the dialog; focus returns here on close. */
  const deleteTriggerRef = useRef<HTMLButtonElement | null>(null);
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

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function refresh(p = page, q = query, tf = tagFilter, s = sort, archived = showArchived) {
    const seq = ++reqSeqRef.current;
    try {
      const result = await listNotes(p, PAGE_SIZE, q, tf, s, archived);
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
    void refresh(page, query, tagFilter, sort, showArchived);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, query, tagFilter, sort, showArchived]);

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

  /**
   * Determine which page contains the note with the given id under the given
   * sort order by fetching the full unfiltered sorted list and locating the
   * note by its unique id. This is robust to all sort orders, pinned-first
   * ordering (pinned notes always sort first regardless of sort direction), and
   * any note count. Returns 1 as a safe fallback if the note is not found.
   *
   * Deliberately does NOT special-case newest→1 or oldest→last because those
   * shortcuts are wrong when pinned notes occupy the first page(s).
   */
  async function pageContainingNote(id: string, s: typeof sort): Promise<number> {
    // First request discovers the real total; if the list fits within one page
    // we can resolve immediately. Otherwise fetch the exact number of notes so
    // we never silently miss notes beyond an arbitrary ceiling.
    const first = await listNotes(1, PAGE_SIZE, '', '', s);
    if (first.total <= PAGE_SIZE) {
      return pageOfNoteById(first.notes, id, PAGE_SIZE);
    }
    const full = await listNotes(1, first.total, '', '', s);
    return pageOfNoteById(full.notes, id, PAGE_SIZE);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    try {
      const created = await createNote({ title, body, tags: parseTags(tagsInput), color });
      setTitle('');
      setBody('');
      setTagsInput('');
      setColor('none');
      setError(null);
      addToast('Note created', 'success');
      // Clear both active filters before navigating so the new note is always
      // visible (it may not match the active query or tag filter).
      // pageContainingNote fetches the fully unfiltered list, so clearing both
      // filters ensures the displayed list matches the computed destination page.
      if (query !== '') {
        // Signal the debounce effect to skip its setPage(1) reset; onSubmit
        // will set the correct page directly after clearing the search.
        skipDebouncePageResetRef.current = true;
        setSearchInput('');
        setQuery('');
      }
      if (tagFilter !== '') {
        setTagFilter('');
      }
      // Navigate to the page where the newly created note will appear.
      // pageContainingNote fetches the full unfiltered list and finds the note
      // by its unique id — correct for all sort orders including pinned-first.
      const dest = await pageContainingNote(created.id, sort);
      if (page === dest && query === '' && tagFilter === '') {
        await refresh(dest, '', '', sort);
      } else {
        setPage(dest);
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
    setEditColor(note.color);
  }

  function onEditCancel() {
    setEditingId(null);
    setEditTitle('');
    setEditBody('');
    setEditTagsInput('');
    setEditColor('none');
  }

  async function onEditSave(id: string) {
    if (!editTitle.trim() || !editBody.trim()) return;
    try {
      await updateNote(id, {
        title: editTitle,
        body: editBody,
        tags: parseTags(editTagsInput),
        color: editColor,
      });
      setEditingId(null);
      setEditTitle('');
      setEditBody('');
      setEditTagsInput('');
      setEditColor('none');
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

  function onDragOver(id: string, e: DragEvent<HTMLElement>) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver((prev) => ({ ...prev, [id]: true }));
  }

  function onDragLeave(id: string, e: DragEvent<HTMLElement>) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver((prev) => ({ ...prev, [id]: false }));
  }

  async function onDrop(id: string, e: DragEvent<HTMLElement>) {
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

  async function onToggleArchive(id: string, currentlyArchived: boolean) {
    try {
      await toggleArchive(id);
      setError(null);
      addToast(currentlyArchived ? 'Note unarchived' : 'Note archived', 'success');
      // Note leaves the current view; the current page may become empty.
      const newTotal = total - 1;
      const newTotalPages = Math.max(1, Math.ceil(newTotal / PAGE_SIZE));
      const newPage = Math.min(page, newTotalPages);
      if (newPage === page) {
        await refresh(page);
      } else {
        setPage(newPage);
      }
    } catch (e) {
      addToast('Failed to toggle archive', 'error');
      setError(String(e));
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

  /** Opens the confirm dialog for deleting a note. */
  function onDeleteRequest(id: string, triggerEl: HTMLButtonElement) {
    deleteTriggerRef.current = triggerEl;
    setPendingDeleteId(id);
  }

  /** Cancels the confirm dialog without deleting anything. */
  function onDeleteCancel() {
    setPendingDeleteId(null);
    deleteTriggerRef.current?.focus();
    deleteTriggerRef.current = null;
  }

  /** Performs the actual deletion after the user confirmed. */
  async function onDeleteConfirm() {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    setPendingDeleteId(null);
    deleteTriggerRef.current?.focus();
    deleteTriggerRef.current = null;
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
      const copy = await duplicateNote(id);
      setError(null);
      addToast('Note duplicated', 'success');
      // Clear both active filters before navigating so the duplicated note is
      // always visible (it may not match the active query or tag filter).
      // pageContainingNote fetches the fully unfiltered list, so clearing both
      // filters ensures the displayed list matches the computed destination page.
      if (query !== '') {
        // Signal the debounce effect to skip its setPage(1) reset; onDuplicate
        // will set the correct page directly after clearing the search.
        skipDebouncePageResetRef.current = true;
        setSearchInput('');
        setQuery('');
      }
      if (tagFilter !== '') {
        setTagFilter('');
      }
      // Navigate to the page where the duplicated note will appear.
      // pageContainingNote fetches the full unfiltered list and finds the note
      // by its unique id — correct for all sort orders including pinned-first.
      const dest = await pageContainingNote(copy.id, sort);
      if (page === dest && query === '' && tagFilter === '') {
        await refresh(dest, '', '', sort);
      } else {
        setPage(dest);
      }
    } catch (e: unknown) {
      addToast('Failed to duplicate note', 'error');
      setError(e instanceof Error ? e.message : 'An unexpected error occurred');
    }
  }

  const shortcutHandlers = {
    onNewNote: useCallback(() => {
      newNoteTitleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      newNoteTitleRef.current?.focus();
    }, []),
    onFocusSearch: useCallback(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }, []),
    onEscape: useCallback(() => {
      // When the delete-confirm dialog is open, its own onKeyDown handler fires
      // first (React delegation, descendant before document) and calls onCancel,
      // which restores focus to the delete trigger.  The global handler must not
      // blur that just-restored focus, so we defer entirely to the dialog.
      if (pendingDeleteId !== null) {
        return;
      }
      if (showHelp) {
        setShowHelp(false);
        return;
      }
      if (editingId !== null) {
        setEditingId(null);
        setEditTitle('');
        setEditBody('');
        setEditTagsInput('');
        return;
      }
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    }, [pendingDeleteId, showHelp, editingId]),
    onToggleHelp: useCallback(() => setShowHelp((prev) => !prev), []),
  };

  useKeyboardShortcuts(shortcutHandlers);

  // Move focus into the help dialog when it opens; restore to the toggle button on close.
  const prevShowHelpRef = useRef(false);
  useEffect(() => {
    if (showHelp) {
      helpCloseBtnRef.current?.focus();
    } else if (prevShowHelpRef.current) {
      // Only restore focus when the panel was previously open (not on initial mount).
      helpToggleRef.current?.focus();
    }
    prevShowHelpRef.current = showHelp;
  }, [showHelp]);

  // True when there are no notes to show AND no filter is active — i.e. the
  // store is genuinely empty (not just "no results for this search").
  const isFilterActive = query !== '' || tagFilter !== '';
  const showEmptyState = !initialLoading && !error && notes.length === 0;

  return (
    <main className={styles.page}>
      <Header
        theme={theme}
        toggleTheme={toggleTheme}
        showHelp={showHelp}
        onToggleHelp={() => setShowHelp((prev) => !prev)}
        onCloseHelp={() => setShowHelp(false)}
        showTagManager={showTagManager}
        onToggleTagManager={() => setShowTagManager((v) => !v)}
        onTagsChanged={() => void refresh(page, query, tagFilter)}
        helpToggleRef={helpToggleRef}
        helpCloseBtnRef={helpCloseBtnRef}
      />

      {error && (
        <div role="alert" className={styles.errorBanner}>
          <span className={styles.errorMessage}>{error}</span>
          <Button variant="danger" onClick={() => void refresh()} aria-label="Retry">
            Retry
          </Button>
        </div>
      )}

      <FilterBar
        searchInput={searchInput}
        onSearchChange={setSearchInput}
        tagFilter={tagFilter}
        onTagFilterChange={(value) => {
          setPage(1);
          setTagFilter(value);
        }}
        sort={sort}
        onSortChange={(s) => {
          setPage(1);
          setSort(s);
        }}
        showArchived={showArchived}
        onToggleArchived={() => {
          setPage(1);
          setShowArchived((v) => !v);
        }}
        searchInputRef={searchInputRef}
      />

      <NoteComposer
        title={title}
        onTitleChange={setTitle}
        body={body}
        onBodyChange={setBody}
        tagsInput={tagsInput}
        onTagsInputChange={setTagsInput}
        color={color}
        onColorChange={setColor}
        onSubmit={onSubmit}
        newNoteTitleRef={newNoteTitleRef}
      />

      <NoteList
        notes={notes}
        initialLoading={initialLoading}
        isFilterActive={isFilterActive}
        showEmptyState={showEmptyState}
        editingId={editingId}
        editTitle={editTitle}
        editBody={editBody}
        editTagsInput={editTagsInput}
        editColor={editColor}
        onEditTitleChange={setEditTitle}
        onEditBodyChange={setEditBody}
        onEditTagsInputChange={setEditTagsInput}
        onEditColorChange={setEditColor}
        onEditSave={(id) => void onEditSave(id)}
        onEditCancel={onEditCancel}
        onEditStart={onEditStart}
        onTogglePin={(id, pinned) => void onTogglePin(id, pinned)}
        onToggleArchive={(id, archived) => void onToggleArchive(id, archived)}
        onDeleteRequest={onDeleteRequest}
        onDuplicate={(id) => void onDuplicate(id)}
        attachments={attachments}
        attachmentsOpen={attachmentsOpen}
        uploadError={uploadError}
        dragOver={dragOver}
        onToggleAttachments={(id) => void onToggleAttachments(id)}
        onUploadFile={onUploadFile}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onDeleteAttachment={onDeleteAttachment}
        newNoteTitleRef={newNoteTitleRef}
      />

      <Pagination
        page={page}
        totalPages={totalPages}
        onPrev={() => setPage((p) => p - 1)}
        onNext={() => setPage((p) => p + 1)}
      />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      {pendingDeleteId !== null && (
        <ConfirmDialog
          title="Delete note"
          message={`Delete "${notes.find((n) => n.id === pendingDeleteId)?.title ?? 'this note'}"? This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={() => void onDeleteConfirm()}
          onCancel={onDeleteCancel}
        />
      )}
    </main>
  );
}
