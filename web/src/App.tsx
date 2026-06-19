import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from 'react';
import {
  batchNotes,
  createNote,
  deleteAttachment,
  deleteNote,
  duplicateNote,
  listAttachments,
  listNotes,
  listTrashedNotes,
  permanentDeleteNote,
  rateLimitMessage,
  RateLimitError,
  reorderPins,
  restoreNote,
  listTags,
  toggleArchive,
  togglePin,
  updateNote,
  uploadAttachments,
  type AttachmentMeta,
  type Note,
  type NoteColor,
  type SortOrder,
  type TagColor,
  type TagMode,
  type TagStat,
} from './api';
import { ConfirmDialog } from './ConfirmDialog';
import { Modal } from './components/Modal';
import { CommandPalette, type Command } from './components/CommandPalette';
import { ToastContainer } from './ToastContainer';
import { TagManager } from './TagManager';
import { useTheme } from './useTheme';
import { useToast } from './useToast';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import { AppShell } from './components/AppShell';
import { FilterBar } from './components/FilterBar';
import { HeaderBar } from './components/HeaderBar';
import { Sidebar, type AppView, type SidebarCounts } from './components/Sidebar';
import { NoteComposer } from './components/NoteComposer';
import type { TemplateSeed } from './noteTemplates';
import { NoteList } from './components/NoteList';
import { BulkActionBar } from './components/BulkActionBar';
import { Pagination } from './components/Pagination';
import { Button } from './components/Button';
import { useSelection, selectAllStateFor } from './useSelection';
import { CheckSquare } from 'lucide-react';
import { exportNotes, type ExportFormat } from './noteExport';
import { dropPin, movePin, sameOrder } from './reorderPins';
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

  /**
   * Surface an error as a non-blocking toast. A rate-limit (429) gets a
   * friendly, Retry-After-aware message; any other failure uses `fallback`.
   */
  const notifyError = useCallback(
    (e: unknown, fallback: string) => {
      if (e instanceof RateLimitError) {
        addToast(rateLimitMessage(e.retryAfterSeconds), 'error');
      } else {
        addToast(fallback, 'error');
      }
    },
    [addToast],
  );
  /** The active main view, switched from the sidebar navigation. */
  const [view, setView] = useState<AppView>('all');
  const [notes, setNotes] = useState<Note[]>([]);
  /** All tags in use with their colors — drives chip colors and the filter row. */
  const [tags, setTags] = useState<TagStat[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [color, setColor] = useState<NoteColor>('none');
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  // Pagination metadata supplied by the server, consumed instead of inferred.
  const [totalPages, setTotalPages] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editTagsInput, setEditTagsInput] = useState('');
  const [editColor, setEditColor] = useState<NoteColor>('none');
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [tagMode, setTagMode] = useState<TagMode>('or');
  const [trashedNotes, setTrashedNotes] = useState<Note[]>([]);
  const [sort, setSort] = useState<SortOrder>('newest');
  /** Flat list of existing tag names for the autocomplete suggestion list. */
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  /** noteId → list of attachment metadata (loaded lazily on expand). */
  const [attachments, setAttachments] = useState<Record<string, AttachmentMeta[]>>({});
  /** noteId → true while attachments panel is open. */
  const [attachmentsOpen, setAttachmentsOpen] = useState<Record<string, boolean>>({});
  /** noteId → upload error string. */
  const [uploadError, setUploadError] = useState<Record<string, string | null>>({});
  /** Whether the keyboard shortcut help panel is open. */
  const [showHelp, setShowHelp] = useState(false);
  /** Whether the New-note composer modal dialog is open. */
  const [composerOpen, setComposerOpen] = useState(false);
  /** Whether the Cmd/Ctrl+K command palette is open. */
  const [paletteOpen, setPaletteOpen] = useState(false);

  /** Ref to the element focused when the palette opened; focus returns here on close. */
  const paletteTriggerRef = useRef<HTMLElement | null>(null);

  /** Ref to the new-note title input — focused when the composer modal opens. */
  const newNoteTitleRef = useRef<HTMLInputElement>(null);
  /** Ref to the header "+ New note" trigger; focus returns here when the modal closes. */
  const newNoteTriggerRef = useRef<HTMLButtonElement>(null);
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
  /**
   * When non-null, the permanent-delete confirm dialog is open and this holds
   * the id of the trashed note pending permanent deletion.
   */
  const [pendingPermanentDeleteId, setPendingPermanentDeleteId] = useState<string | null>(null);
  /** Ref to the permanent-delete button that triggered its dialog. */
  const permanentDeleteTriggerRef = useRef<HTMLButtonElement | null>(null);
  /** noteId → true while a drag is active over that note's dropzone. */
  const [dragOver, setDragOver] = useState<Record<string, boolean>>({});

  /** Whether the list is in multi-select mode (shows per-note checkboxes). */
  const [selectionMode, setSelectionMode] = useState(false);
  /** Selected-note ids and the helpers driving the bulk-action bar. */
  const selection = useSelection();
  /** True while a bulk (batch) request is in flight — disables the action bar. */
  const [bulkBusy, setBulkBusy] = useState(false);

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
  // The search query already committed to `query`. The debounce effect compares
  // against this so it only resets the page when the search text actually
  // changed — never on the initial mount run, whose stale timer could otherwise
  // fire mid-flow and clobber a page set by create/duplicate navigation.
  const committedSearchRef = useRef(searchInput);

  // The view booleans the data layer reasons about, derived from `view`.
  const showArchived = view === 'archived';
  const showTrash = view === 'trash';
  const showTagManager = view === 'tags';

  // Counts shown as badges in the sidebar. We only surface numbers we can state
  // accurately without extra fetches: the tag count (always loaded) and the
  // total for the active list view when it is unfiltered (so the number is the
  // true view total rather than a filtered subset). A filtered list omits its
  // badge instead of showing a misleading count.
  const unfilteredList = query === '' && tagFilter === '';
  const sidebarCounts: SidebarCounts = { tags: tags.length };
  if (showTrash) {
    sidebarCounts.trash = trashedNotes.length;
  } else if (!showTagManager && unfilteredList) {
    sidebarCounts[view] = total;
  }

  /** Parse a comma-separated tag filter string into a trimmed, non-empty, deduplicated tag list. */
  function parseTagFilter(raw: string): string[] {
    return [
      ...new Set(
        raw
          .split(',')
          .map((t) => t.trim())
          .filter((t) => t !== ''),
      ),
    ];
  }

  async function refresh(
    p = page,
    q = query,
    tf = tagFilter,
    s = sort,
    archived = showArchived,
    tm = tagMode,
  ) {
    const seq = ++reqSeqRef.current;
    try {
      const tags = parseTagFilter(tf);
      const result = await listNotes(p, PAGE_SIZE, q, undefined, s, archived, tags, tm);
      if (seq !== reqSeqRef.current) return; // stale — a newer request is in flight
      setNotes(result.notes);
      setTotal(result.total);
      setTotalPages(result.totalPages);
      setHasNext(result.hasNext);
      setError(null);
    } catch (e: unknown) {
      if (seq !== reqSeqRef.current) return;
      const msg = e instanceof Error ? e.message : 'An unexpected error occurred';
      setError(msg);
    } finally {
      if (seq === reqSeqRef.current) setInitialLoading(false);
    }
  }

  async function refreshTrash() {
    try {
      const trashed = await listTrashedNotes();
      setTrashedNotes(trashed);
      setError(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'An unexpected error occurred';
      setError(msg);
    } finally {
      setInitialLoading(false);
    }
  }

  // Load the tag list (names + colors) so chips can be painted everywhere.
  // Best-effort: failure here must not break the notes view, so errors are
  // swallowed (the chips simply fall back to the default style).
  const refreshTags = useCallback(async () => {
    try {
      setTags(await listTags());
    } catch {
      // ignore — chips fall back to default styling
    }
  }, []);

  useEffect(() => {
    if (showTrash) {
      void refreshTrash();
    } else {
      void refresh(page, query, tagFilter, sort, showArchived, tagMode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, query, tagFilter, sort, view, tagMode]);

  // Loaded once on mount (and refreshed after mutations); kept separate from the
  // notes refresh so it never blocks or interferes with the primary list load.
  useEffect(() => {
    void refreshTags();
  }, [refreshTags]);

  /** tag name → assigned color (null when unset), derived from `tags`. */
  const tagColors: Record<string, TagColor | null> = Object.fromEntries(
    tags.map(({ tag, color }) => [tag, color]),
  );

  /** Refresh the flat tag list used for autocomplete suggestions. */
  async function refreshTagSuggestions() {
    try {
      const stats = await listTags();
      setTagSuggestions(stats.map((s) => s.tag));
    } catch {
      // Non-fatal: suggestions simply won't update.
    }
  }

  // Load tag suggestions on mount.
  useEffect(() => {
    void refreshTagSuggestions();
  }, []);

  // Debounce search input: update `query` after SEARCH_DEBOUNCE_MS of inactivity.
  // Reset to page 1 whenever the query changes so results are always from the start.
  // Skip the page reset when onSubmit has already positioned the page itself.
  useEffect(() => {
    // Nothing to commit when the input matches what's already applied (e.g. the
    // initial mount run, where `query` already equals `searchInput`). Skipping
    // avoids a stray `setPage(1)` from a late-firing mount timer landing after
    // create/duplicate navigation has moved the user to another page.
    if (searchInput === committedSearchRef.current) return;
    const timer = setTimeout(() => {
      committedSearchRef.current = searchInput;
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
      // Close the composer modal and return focus to the trigger.
      setComposerOpen(false);
      newNoteTriggerRef.current?.focus();
      addToast('Note created', 'success');
      void refreshTags();
      void refreshTagSuggestions();
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
      notifyError(e, 'Failed to create note');
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
      void refreshTags();
      await refresh(page);
    } catch (e: unknown) {
      notifyError(e, 'Failed to update note');
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
      if (err instanceof RateLimitError) {
        addToast(rateLimitMessage(err.retryAfterSeconds), 'error');
        return;
      }
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
      notifyError(e, 'Failed to toggle pin');
      setError(e instanceof Error ? e.message : 'An unexpected error occurred');
    }
  }

  /**
   * Reorder the pinned group and persist the new order via the API.
   *
   * Pinned notes always sort first but may span multiple pages, so we fetch the
   * full active list to recover the complete pinned order (the server requires
   * the entire set). The new order is computed by the pure {@link movePin} /
   * {@link dropPin} helpers, sent to the server, then the visible page is
   * refreshed. A no-op move (already at the edge, dropped on itself) skips the
   * request entirely.
   */
  async function onReorderPin(
    id: string,
    move: { direction: 'up' | 'down' } | { targetId: string },
  ) {
    try {
      // Recover the complete top-to-bottom pinned order across all pages.
      const probe = await listNotes(1, PAGE_SIZE, '', '', sort);
      const full = probe.total <= PAGE_SIZE ? probe : await listNotes(1, probe.total, '', '', sort);
      const pinnedOrder = full.notes
        .filter((n) => n.pinned && n.deletedAt === null)
        .map((n) => n.id);

      const next =
        'direction' in move
          ? movePin(pinnedOrder, id, move.direction)
          : dropPin(pinnedOrder, id, move.targetId);

      if (sameOrder(pinnedOrder, next)) return; // nothing actually moved
      await reorderPins(next);
      setError(null);
      await refresh(page);
    } catch (e: unknown) {
      notifyError(e, 'Failed to reorder pinned notes');
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
      notifyError(e, 'Failed to toggle archive');
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

  /** Performs the soft-delete (trash) after the user confirmed. */
  async function onDeleteConfirm() {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    setPendingDeleteId(null);
    deleteTriggerRef.current?.focus();
    deleteTriggerRef.current = null;
    try {
      await deleteNote(id);
      setError(null);
      addToast('Note moved to trash', 'success');
      void refreshTags();
      // After trashing the current page may become empty; go back one if needed
      const newTotal = total - 1;
      const newTotalPages = Math.max(1, Math.ceil(newTotal / PAGE_SIZE));
      const newPage = Math.min(page, newTotalPages);
      if (newPage === page) {
        await refresh(page);
      } else {
        setPage(newPage);
      }
    } catch (e: unknown) {
      notifyError(e, 'Failed to move note to trash');
      setError(e instanceof Error ? e.message : 'An unexpected error occurred');
    }
  }

  /** Restore a trashed note back to the active list. */
  async function onRestore(id: string) {
    try {
      await restoreNote(id);
      setError(null);
      addToast('Note restored', 'success');
      await refreshTrash();
      void refreshTags();
    } catch (e: unknown) {
      notifyError(e, 'Failed to restore note');
      setError(e instanceof Error ? e.message : 'An unexpected error occurred');
    }
  }

  /** Opens the confirm dialog for permanently deleting a trashed note. */
  function onPermanentDeleteRequest(id: string, triggerEl: HTMLButtonElement) {
    permanentDeleteTriggerRef.current = triggerEl;
    setPendingPermanentDeleteId(id);
  }

  /** Cancels the permanent-delete confirm dialog. */
  function onPermanentDeleteCancel() {
    setPendingPermanentDeleteId(null);
    permanentDeleteTriggerRef.current?.focus();
    permanentDeleteTriggerRef.current = null;
  }

  /** Permanently removes a trashed note after the user confirmed. */
  async function onPermanentDeleteConfirm() {
    if (!pendingPermanentDeleteId) return;
    const id = pendingPermanentDeleteId;
    setPendingPermanentDeleteId(null);
    permanentDeleteTriggerRef.current?.focus();
    permanentDeleteTriggerRef.current = null;
    try {
      await permanentDeleteNote(id);
      setError(null);
      addToast('Note permanently deleted', 'success');
      await refreshTrash();
    } catch (e: unknown) {
      notifyError(e, 'Failed to permanently delete note');
      setError(e instanceof Error ? e.message : 'An unexpected error occurred');
    }
  }

  async function onDuplicate(id: string) {
    try {
      const copy = await duplicateNote(id);
      setError(null);
      addToast('Note duplicated', 'success');
      void refreshTags();
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
      notifyError(e, 'Failed to duplicate note');
      setError(e instanceof Error ? e.message : 'An unexpected error occurred');
    }
  }

  /**
   * Dismiss the composer modal, discarding the in-progress draft, and restore
   * focus to the "+ New note" trigger. Used by the close button, Escape, and
   * backdrop click.
   */
  const onComposerClose = useCallback(() => {
    setComposerOpen(false);
    setTitle('');
    setBody('');
    setTagsInput('');
    setColor('none');
    newNoteTriggerRef.current?.focus();
  }, []);

  /**
   * Seed the composer fields from a chosen built-in template, then return focus
   * to the title input so the user can edit the seeded title right away.
   */
  const onApplyTemplate = useCallback((seed: TemplateSeed) => {
    setTitle(seed.title);
    setBody(seed.body);
    setTagsInput(seed.tagsInput);
    setColor(seed.color);
    newNoteTitleRef.current?.focus();
  }, []);

  const shortcutHandlers = {
    onNewNote: useCallback(() => {
      setComposerOpen(true);
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
      // The composer modal handles Escape itself (and stops propagation); defer
      // entirely so the global handler does not also act on the same keypress.
      if (composerOpen) {
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
    }, [pendingDeleteId, composerOpen, showHelp, editingId]),
    onToggleHelp: useCallback(() => setShowHelp((prev) => !prev), []),
  };

  useKeyboardShortcuts(shortcutHandlers);

  /** Open the command palette, remembering the trigger to restore focus to. */
  const openPalette = useCallback(() => {
    paletteTriggerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setPaletteOpen(true);
  }, []);

  /** Close the command palette and restore focus to whatever opened it. */
  const closePalette = useCallback(() => {
    setPaletteOpen(false);
    paletteTriggerRef.current?.focus();
    paletteTriggerRef.current = null;
  }, []);

  // Global Cmd/Ctrl+K toggles the command palette. Kept separate from
  // useKeyboardShortcuts (which deliberately ignores modifier combos) so the
  // wiring stays a single self-contained listener.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        if (paletteOpen) {
          closePalette();
        } else {
          openPalette();
        }
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [paletteOpen, openPalette, closePalette]);

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
  const displayedNotes = showTrash ? trashedNotes : notes;
  const showEmptyState = !initialLoading && !error && displayedNotes.length === 0;

  /**
   * Switch the active main view. Always returns to page 1 and cancels any
   * in-progress inline edit so the new view starts from a clean state.
   */
  function onSelectView(next: AppView) {
    if (next === view) return;
    setPage(1);
    setEditingId(null);
    selection.clear();
    setView(next);
  }

  /**
   * Export the currently displayed notes (the active view's list) as a single
   * downloadable file in the chosen format. Purely client-side; no request is
   * made. No-op when there is nothing to export.
   */
  function onExport(format: ExportFormat) {
    if (displayedNotes.length === 0) return;
    const single = displayedNotes.length === 1 ? displayedNotes[0] : null;
    exportNotes(displayedNotes, format, single);
    addToast(
      `Exported ${displayedNotes.length} note${displayedNotes.length === 1 ? '' : 's'} as ${format.toUpperCase()}`,
      'success',
    );
  }

  /** Re-fetch notes and tag metadata after the tag manager mutates tags. */
  function onTagsChanged() {
    void refresh(page, query, tagFilter);
    void refreshTags();
    void refreshTagSuggestions();
  }

  // ── Bulk selection / actions ──────────────────────────────────────────────

  /** Ids of the notes currently visible on the page (the select-all scope). */
  const visibleIds = displayedNotes.map((n) => n.id);
  const selectAllState = selectAllStateFor(visibleIds, selection.isSelected);

  /** Toggle selection mode; leaving it always clears any pending selection. */
  function onToggleSelectionMode() {
    setSelectionMode((on) => {
      if (on) selection.clear();
      return !on;
    });
  }

  /**
   * Apply a bulk action to the selected notes via the batch API, then refresh
   * the list, tags, and clear the selection. A partial failure (some ids not
   * found) surfaces as a non-blocking toast but is not treated as fatal.
   */
  async function runBulkAction(
    action: 'archive' | 'trash' | 'add-tag',
    label: string,
    tag?: string,
  ) {
    const ids = selection.selectedIds;
    if (ids.length === 0 || bulkBusy) return;
    setBulkBusy(true);
    try {
      const result = await batchNotes(ids, action, tag);
      const ok = result.succeeded.length;
      if (result.failed.length > 0) {
        addToast(`${label} ${ok} note(s); ${result.failed.length} could not be updated.`, 'error');
      } else {
        addToast(`${label} ${ok} note(s).`, 'success');
      }
      selection.clear();
      await refresh(page);
      void refreshTags();
      void refreshTagSuggestions();
    } catch (e) {
      notifyError(e, `Failed to ${action.replace('-', ' ')} the selected notes.`);
    } finally {
      setBulkBusy(false);
    }
  }

  /**
   * Navigate to and reveal a note: clear filters, switch to the All view, and
   * page to wherever the note lives so a palette selection always lands on it.
   */
  const revealNote = useCallback(
    async (id: string) => {
      setView('all');
      setSearchInput('');
      setQuery('');
      setTagFilter('');
      try {
        const dest = await pageContainingNote(id, sort);
        setPage(dest);
      } catch (e: unknown) {
        notifyError(e, 'Failed to open note');
      }
    },
    // pageContainingNote closes over the current render's `sort`; re-create when
    // it (or the error notifier) changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sort, notifyError],
  );

  /**
   * Commands surfaced in the palette, in priority order: global actions, the
   * view switches, then one entry per visible note title (jump-to-note).
   */
  const paletteCommands: Command[] = useMemo(() => {
    const actions: Command[] = [
      {
        id: 'action-new-note',
        title: 'New note',
        group: 'Action',
        run: () => setComposerOpen(true),
      },
      {
        id: 'action-toggle-theme',
        title: theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
        group: 'Action',
        run: toggleTheme,
      },
    ];
    const views: Command[] = [
      { id: 'view-all', title: 'Go to: All notes', group: 'View', run: () => onSelectView('all') },
      {
        id: 'view-archived',
        title: 'Go to: Archived',
        group: 'View',
        run: () => onSelectView('archived'),
      },
      { id: 'view-trash', title: 'Go to: Trash', group: 'View', run: () => onSelectView('trash') },
      { id: 'view-tags', title: 'Go to: Tags', group: 'View', run: () => onSelectView('tags') },
    ];
    const noteCommands: Command[] = displayedNotes.map((n) => ({
      id: `note-${n.id}`,
      title: n.title,
      group: 'Note',
      run: () => void revealNote(n.id),
    }));
    return [...actions, ...views, ...noteCommands];
    // onSelectView is a stable function declaration; deps cover the dynamic bits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, toggleTheme, displayedNotes, revealNote]);

  const errorBanner = error && (
    <div role="alert" className={styles.errorBanner}>
      <span className={styles.errorMessage}>{error}</span>
      <Button variant="danger" onClick={() => void refresh()} aria-label="Retry">
        Retry
      </Button>
    </div>
  );

  const noteList = (
    <NoteList
      notes={displayedNotes}
      tagColors={tagColors}
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
      onReorderPin={showTrash ? undefined : (id, move) => void onReorderPin(id, move)}
      onDeleteRequest={onDeleteRequest}
      onDuplicate={(id) => void onDuplicate(id)}
      onRestore={(id) => void onRestore(id)}
      onPermanentDeleteRequest={onPermanentDeleteRequest}
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
      selectable={selectionMode}
      isSelected={selection.isSelected}
      onToggleSelect={selection.toggle}
    />
  );

  const pagination = (
    <Pagination
      page={page}
      totalPages={totalPages}
      hasNext={hasNext}
      onPrev={() => setPage((p) => p - 1)}
      onNext={() => setPage((p) => p + 1)}
    />
  );

  return (
    <AppShell
      header={
        <HeaderBar
          theme={theme}
          toggleTheme={toggleTheme}
          searchInput={searchInput}
          onSearchChange={setSearchInput}
          searchInputRef={searchInputRef}
          onNewNote={shortcutHandlers.onNewNote}
          newNoteTriggerRef={newNoteTriggerRef}
          onExport={onExport}
          exportDisabled={displayedNotes.length === 0}
          showHelp={showHelp}
          onToggleHelp={() => setShowHelp((prev) => !prev)}
          onCloseHelp={() => setShowHelp(false)}
          helpToggleRef={helpToggleRef}
          helpCloseBtnRef={helpCloseBtnRef}
        />
      }
      sidebar={<Sidebar view={view} onSelectView={onSelectView} counts={sidebarCounts} />}
    >
      {errorBanner}

      {showTagManager ? (
        <TagManager onChanged={onTagsChanged} />
      ) : (
        <>
          <FilterBar
            tagFilter={tagFilter}
            onTagFilterChange={(value) => {
              setPage(1);
              setTagFilter(value);
            }}
            tagMode={tagMode}
            onTagModeChange={(mode) => {
              setPage(1);
              setTagMode(mode);
            }}
            sort={sort}
            onSortChange={(s) => {
              setPage(1);
              setSort(s);
            }}
            tags={tags}
          />

          {!showTrash && !showEmptyState && (
            <div className={styles.selectionControls}>
              <Button
                variant={selectionMode ? 'primary' : 'secondary'}
                onClick={onToggleSelectionMode}
                aria-pressed={selectionMode}
                aria-label={selectionMode ? 'Exit selection mode' : 'Select notes'}
              >
                <CheckSquare size={16} aria-hidden="true" />
                {selectionMode ? 'Done' : 'Select'}
              </Button>
            </div>
          )}

          {selectionMode && !showTrash && (
            <BulkActionBar
              count={selection.count}
              selectAllState={selectAllState}
              onToggleSelectAll={() => selection.toggleSelectAll(visibleIds)}
              onClear={selection.clear}
              onArchive={() => void runBulkAction('archive', 'Archived')}
              onTrash={() => void runBulkAction('trash', 'Trashed')}
              onAddTag={(tag) => void runBulkAction('add-tag', 'Tagged', tag)}
              busy={bulkBusy}
            />
          )}

          {noteList}

          {pagination}
        </>
      )}

      {composerOpen && (
        <Modal title="New note" onClose={onComposerClose} initialFocusRef={newNoteTitleRef}>
          <NoteComposer
            title={title}
            onTitleChange={setTitle}
            body={body}
            onBodyChange={setBody}
            tagsInput={tagsInput}
            onTagsInputChange={setTagsInput}
            tagSuggestions={tagSuggestions}
            color={color}
            onColorChange={setColor}
            onSubmit={onSubmit}
            newNoteTitleRef={newNoteTitleRef}
            onApplyTemplate={onApplyTemplate}
            embedded
          />
        </Modal>
      )}

      {paletteOpen && <CommandPalette commands={paletteCommands} onClose={closePalette} />}

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      {pendingDeleteId !== null && (
        <ConfirmDialog
          title="Move to trash"
          message={`Move "${notes.find((n) => n.id === pendingDeleteId)?.title ?? 'this note'}" to trash? You can restore it later.`}
          confirmLabel="Delete"
          onConfirm={() => void onDeleteConfirm()}
          onCancel={onDeleteCancel}
        />
      )}
      {pendingPermanentDeleteId !== null && (
        <ConfirmDialog
          title="Permanently delete note"
          message={`Permanently delete "${trashedNotes.find((n) => n.id === pendingPermanentDeleteId)?.title ?? 'this note'}"? This cannot be undone.`}
          confirmLabel="Delete permanently"
          onConfirm={() => void onPermanentDeleteConfirm()}
          onCancel={onPermanentDeleteCancel}
        />
      )}
    </AppShell>
  );
}
