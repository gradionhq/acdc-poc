import { useEffect, useState, type FormEvent } from 'react';
import { createNote, deleteNote, listNotes, type Note } from './api';

export function App() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setNotes(await listNotes());
    } catch (e) {
      setError(String(e));
    }
  }
  useEffect(() => {
    void refresh();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    try {
      await createNote({ title, body });
      setTitle('');
      setBody('');
      setError(null);
      await refresh();
    } catch (e) {
      setError(String(e));
    }
  }

  async function onDelete(id: string) {
    try {
      await deleteNote(id);
      setError(null);
      await refresh();
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <main>
      <h1>Notes</h1>
      {error && <p role="alert">{error}</p>}
      <form onSubmit={onSubmit}>
        <label>
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label>
          Body
          <textarea value={body} onChange={(e) => setBody(e.target.value)} />
        </label>
        <button type="submit">Add note</button>
      </form>
      <ul>
        {notes.map((n) => (
          <li key={n.id}>
            <strong>{n.title}</strong>: {n.body}
            <button onClick={() => void onDelete(n.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </main>
  );
}
