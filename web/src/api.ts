export interface Note {
  id: string;
  title: string;
  body: string;
}

function isNote(value: unknown): value is Note {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === 'string' && typeof v.title === 'string' && typeof v.body === 'string';
}

export interface NotesPage {
  notes: Note[];
  total: number;
}

const base = '/api/notes';

export async function listNotes(page = 1, pageSize = 5, query?: string): Promise<NotesPage> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  if (query !== undefined && query !== '') {
    params.set('q', query);
  }
  const res = await fetch(`${base}?${params.toString()}`);
  if (!res.ok) throw new Error('failed to load notes');
  const raw = Number(res.headers.get('X-Total-Count'));
  const total = Number.isFinite(raw) && raw >= 0 ? raw : 0;
  const notes = (await res.json()) as Note[];
  return { notes, total };
}

export async function createNote(input: { title: string; body: string }): Promise<Note> {
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
  input: { title?: string; body?: string },
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
