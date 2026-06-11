export interface Note {
  id: string;
  title: string;
  body: string;
  tags: string[];
  pinned: boolean;
}

function isNote(value: unknown): value is Note {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.title === 'string' &&
    typeof v.body === 'string' &&
    Array.isArray(v.tags) &&
    (v.tags as unknown[]).every((t) => typeof t === 'string') &&
    typeof v.pinned === 'boolean'
  );
}

export interface NotesPage {
  notes: Note[];
  total: number;
}

export type SortOrder = 'newest' | 'oldest' | 'title';

const base = '/api/notes';

export async function listNotes(
  page = 1,
  pageSize = 5,
  query?: string,
  tag?: string,
  sort: SortOrder = 'newest',
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
  const res = await fetch(`${base}?${params.toString()}`);
  if (!res.ok) throw new Error('failed to load notes');
  const raw = Number(res.headers.get('X-Total-Count'));
  const total = Number.isFinite(raw) && raw >= 0 ? raw : 0;
  const notes = (await res.json()) as Note[];
  return { notes, total };
}

export async function createNote(input: {
  title: string;
  body: string;
  tags?: string[];
}): Promise<Note> {
  const res = await fetch(base, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error('failed to create note');
  const created: unknown = await res.json();
  if (!isNote(created)) throw new Error('invalid note payload');
  return created;
}

export async function updateNote(
  id: string,
  input: { title?: string; body?: string; tags?: string[] },
): Promise<Note> {
  const res = await fetch(`${base}/${id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error('failed to update note');
  const updated: unknown = await res.json();
  if (!isNote(updated)) throw new Error('invalid note payload');
  return updated;
}

export async function deleteNote(id: string): Promise<void> {
  const res = await fetch(`${base}/${id}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 404) throw new Error('failed to delete note');
}

export async function duplicateNote(id: string): Promise<Note> {
  const res = await fetch(`${base}/${id}/duplicate`, { method: 'POST' });
  if (!res.ok) throw new Error('failed to duplicate note');
  const created: unknown = await res.json();
  if (!isNote(created)) throw new Error('invalid note payload');
  return created;
}

export async function togglePin(id: string): Promise<Note> {
  const res = await fetch(`${base}/${id}/pin`, { method: 'PATCH' });
  if (!res.ok) throw new Error('failed to toggle pin');
  const updated: unknown = await res.json();
  if (!isNote(updated)) throw new Error('invalid note payload');
  return updated;
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
