export interface Note {
  id: string;
  title: string;
  body: string;
}

const base = '/api/notes';

export async function listNotes(): Promise<Note[]> {
  const res = await fetch(base);
  if (!res.ok) throw new Error('failed to load notes');
  return res.json();
}

export async function createNote(input: { title: string; body: string }): Promise<Note> {
  const res = await fetch(base, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error('failed to create note');
  return res.json();
}

export async function deleteNote(id: string): Promise<void> {
  const res = await fetch(`${base}/${id}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 404) throw new Error('failed to delete note');
}
