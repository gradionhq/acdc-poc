export const NOTE_COLORS = ['none', 'red', 'yellow', 'green', 'blue', 'purple'] as const;
export type NoteColor = (typeof NOTE_COLORS)[number];

export interface Note {
  id: string;
  title: string;
  body: string;
  tags: string[];
  pinned: boolean;
  archived: boolean;
  color: NoteColor;
  deletedAt: number | null;
}

function isNoteColor(value: unknown): value is NoteColor {
  return typeof value === 'string' && (NOTE_COLORS as readonly string[]).includes(value);
}

function isRawNote(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.title === 'string' &&
    typeof v.body === 'string' &&
    Array.isArray(v.tags) &&
    (v.tags as unknown[]).every((t) => typeof t === 'string') &&
    typeof v.pinned === 'boolean' &&
    typeof v.archived === 'boolean' &&
    isNoteColor(v.color) &&
    // deletedAt is null (active/restored), a positive integer (trashed), or
    // absent on legacy payloads (treated as null for forward-compatibility).
    (v.deletedAt === undefined || v.deletedAt === null || typeof v.deletedAt === 'number')
  );
}

/** Normalize a raw server payload into a typed Note, defaulting deletedAt to null. */
function toNote(value: Record<string, unknown>): Note {
  return {
    id: value.id as string,
    title: value.title as string,
    body: value.body as string,
    tags: value.tags as string[],
    pinned: value.pinned as boolean,
    archived: value.archived as boolean,
    color: value.color as NoteColor,
    deletedAt: typeof value.deletedAt === 'number' ? value.deletedAt : null,
  };
}

export interface NotesPage {
  notes: Note[];
  total: number;
  /** Total number of pages for the current filter and pageSize (always >= 1). */
  totalPages: number;
  /** True when a page after the current one exists. */
  hasNext: boolean;
}

export type SortOrder = 'newest' | 'oldest' | 'title';
export type TagMode = 'and' | 'or';

const base = '/api/notes';

export async function listNotes(
  page = 1,
  pageSize = 5,
  query?: string,
  tag?: string,
  sort: SortOrder = 'newest',
  archived = false,
  tags: string[] = [],
  tagMode: TagMode = 'or',
): Promise<NotesPage> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    sort,
  });
  if (query !== undefined && query !== '') {
    params.set('q', query);
  }
  if (tag !== undefined && tag !== '') {
    params.set('tag', tag);
  }
  if (archived) {
    params.set('archived', 'true');
  }
  if (tags.length > 0) {
    params.set('tags', tags.join(','));
    if (tagMode === 'and') {
      params.set('tagMode', 'and');
    }
  }
  const res = await fetch(`${base}?${params.toString()}`);
  if (!res.ok) throw new Error('failed to load notes');
  const raw = Number(res.headers.get('X-Total-Count'));
  const total = Number.isFinite(raw) && raw >= 0 ? raw : 0;
  // Prefer the server-supplied page count; fall back to inferring from total
  // and the requested pageSize for older servers that omit the header.
  const rawPages = Number(res.headers.get('X-Total-Pages'));
  const totalPages =
    Number.isInteger(rawPages) && rawPages >= 1
      ? rawPages
      : Math.max(1, Math.ceil(total / pageSize));
  // X-Has-Next is the canonical signal; derive it from page/totalPages when absent.
  const hasNextHeader = res.headers.get('X-Has-Next');
  const hasNext = hasNextHeader === null ? page < totalPages : hasNextHeader === 'true';
  const rawNotes = (await res.json()) as Record<string, unknown>[];
  const notes = rawNotes.map(toNote);
  return { notes, total, totalPages, hasNext };
}

export async function createNote(input: {
  title: string;
  body: string;
  tags?: string[];
  color?: NoteColor;
}): Promise<Note> {
  const res = await fetch(base, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error('failed to create note');
  const created: unknown = await res.json();
  if (!isRawNote(created)) throw new Error('invalid note payload');
  return toNote(created);
}

export async function updateNote(
  id: string,
  input: { title?: string; body?: string; tags?: string[]; color?: NoteColor },
): Promise<Note> {
  const res = await fetch(`${base}/${id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error('failed to update note');
  const updated: unknown = await res.json();
  if (!isRawNote(updated)) throw new Error('invalid note payload');
  return toNote(updated);
}

/**
 * Soft-delete: move a note to trash (sets deletedAt).
 * The note is excluded from the default list but can be restored.
 */
export async function deleteNote(id: string): Promise<void> {
  const res = await fetch(`${base}/${id}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 404) throw new Error('failed to delete note');
}

/** Restore a trashed note back to the active list. */
export async function restoreNote(id: string): Promise<Note> {
  const res = await fetch(`${base}/${id}/restore`, { method: 'PATCH' });
  if (!res.ok) throw new Error('failed to restore note');
  const updated: unknown = await res.json();
  if (!isRawNote(updated)) throw new Error('invalid note payload');
  return toNote(updated);
}

/** Permanently remove a note from the store (irreversible). */
export async function permanentDeleteNote(id: string): Promise<void> {
  const res = await fetch(`${base}/${id}/permanent`, { method: 'DELETE' });
  if (!res.ok && res.status !== 404) throw new Error('failed to permanently delete note');
}

/** List all trashed notes, sorted by most-recently trashed first. */
export async function listTrashedNotes(): Promise<Note[]> {
  const res = await fetch(`${base}/trash`);
  if (!res.ok) throw new Error('failed to load trash');
  const data: unknown = await res.json();
  if (!Array.isArray(data) || !data.every(isRawNote)) {
    throw new Error('invalid trash payload');
  }
  return data.map(toNote);
}

export async function duplicateNote(id: string): Promise<Note> {
  const res = await fetch(`${base}/${id}/duplicate`, { method: 'POST' });
  if (!res.ok) throw new Error('failed to duplicate note');
  const created: unknown = await res.json();
  if (!isRawNote(created)) throw new Error('invalid note payload');
  return toNote(created);
}

export async function togglePin(id: string): Promise<Note> {
  const res = await fetch(`${base}/${id}/pin`, { method: 'PATCH' });
  if (!res.ok) throw new Error('failed to toggle pin');
  const updated: unknown = await res.json();
  if (!isRawNote(updated)) throw new Error('invalid note payload');
  return toNote(updated);
}

export async function toggleArchive(id: string): Promise<Note> {
  const res = await fetch(`${base}/${id}/archive`, { method: 'PATCH' });
  if (!res.ok) throw new Error('failed to toggle archive');
  const updated: unknown = await res.json();
  if (!isRawNote(updated)) throw new Error('invalid note payload');
  return toNote(updated);
}

export interface AttachmentMeta {
  filename: string;
  contentType: string;
  size: number;
}

function isAttachmentMeta(value: unknown): value is AttachmentMeta {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.filename === 'string' &&
    typeof v.contentType === 'string' &&
    typeof v.size === 'number'
  );
}

export async function uploadAttachment(noteId: string, file: File): Promise<AttachmentMeta> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${base}/${noteId}/attachments`, { method: 'POST', body: form });
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? 'failed to upload attachment');
  }
  const created: unknown = await res.json();
  if (!isAttachmentMeta(created)) throw new Error('invalid attachment payload');
  return created;
}

/**
 * Upload multiple files at once using the 'files' field.
 * Returns the list of successfully created attachment metadata.
 * Throws an Error with the server-provided message on failure.
 */
export async function uploadAttachments(noteId: string, files: File[]): Promise<AttachmentMeta[]> {
  const form = new FormData();
  for (const file of files) {
    form.append('files', file);
  }
  const res = await fetch(`${base}/${noteId}/attachments`, { method: 'POST', body: form });
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? 'failed to upload attachments');
  }
  const created: unknown = await res.json();
  if (!Array.isArray(created) || !created.every(isAttachmentMeta)) {
    throw new Error('invalid attachments payload');
  }
  return created;
}

export async function listAttachments(noteId: string): Promise<AttachmentMeta[]> {
  const res = await fetch(`${base}/${noteId}/attachments`);
  if (!res.ok) throw new Error('failed to load attachments');
  const data: unknown = await res.json();
  if (!Array.isArray(data) || !data.every(isAttachmentMeta)) {
    throw new Error('invalid attachments payload');
  }
  return data;
}

export function attachmentDownloadUrl(noteId: string, filename: string): string {
  return `${base}/${noteId}/attachments/${encodeURIComponent(filename)}`;
}

export async function deleteAttachment(noteId: string, filename: string): Promise<void> {
  const res = await fetch(`${base}/${noteId}/attachments/${encodeURIComponent(filename)}`, {
    method: 'DELETE',
  });
  if (!res.ok && res.status !== 404) throw new Error('failed to delete attachment');
}

// ── Tag management ────────────────────────────────────────────────────────────

/** Fixed palette of colors a tag chip may carry (independent of note colors). */
export const TAG_COLORS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'gray'] as const;
export type TagColor = (typeof TAG_COLORS)[number];

function isTagColor(value: unknown): value is TagColor {
  return typeof value === 'string' && (TAG_COLORS as readonly string[]).includes(value);
}

export interface TagStat {
  tag: string;
  count: number;
  /** Assigned chip color, or null when the tag uses the default style. */
  color: TagColor | null;
}

function isTagStat(value: unknown): value is TagStat {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.tag === 'string' &&
    typeof v.count === 'number' &&
    (v.color === null || isTagColor(v.color))
  );
}

const tagsBase = '/api/tags';

export async function listTags(): Promise<TagStat[]> {
  const res = await fetch(tagsBase);
  if (!res.ok) throw new Error('failed to load tags');
  const data: unknown = await res.json();
  if (!Array.isArray(data) || !data.every(isTagStat)) {
    throw new Error('invalid tags payload');
  }
  return data;
}

export async function renameTag(from: string, to: string): Promise<{ affected: number }> {
  const res = await fetch(`${tagsBase}/rename`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ from, to }),
  });
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? 'failed to rename tag');
  }
  return (await res.json()) as { affected: number };
}

export async function setTagColor(tag: string, color: TagColor): Promise<TagStat> {
  const res = await fetch(`${tagsBase}/${encodeURIComponent(tag)}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ color }),
  });
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? 'failed to set tag color');
  }
  const data = (await res.json()) as { tag: string; color: TagColor };
  return { tag: data.tag, count: 0, color: data.color };
}

export async function deleteTag(tag: string): Promise<{ affected: number }> {
  const res = await fetch(`${tagsBase}/${encodeURIComponent(tag)}`, { method: 'DELETE' });
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? 'failed to delete tag');
  }
  return (await res.json()) as { affected: number };
}
