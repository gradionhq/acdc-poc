import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import { listNotes } from './api';

function buildResponse(
  notes: Array<{ id: string; title: string; body: string }>,
  page = 1,
  pageSize = 5,
) {
  const start = (page - 1) * pageSize;
  const items = notes.slice(start, start + pageSize);
  return new Response(JSON.stringify(items), {
    status: 200,
    headers: { 'X-Total-Count': String(notes.length) },
  });
}

function mockFetchSequence() {
  let notes: Array<{ id: string; title: string; body: string }> = [];
  let seq = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        const b = JSON.parse(String(init.body)) as { title: string; body: string };
        const n = { id: String(++seq), title: b.title, body: b.body };
        notes.push(n);
        return new Response(JSON.stringify(n), { status: 201 });
      }
      if (init?.method === 'PUT') {
        const id = (url as string).split('/').pop();
        const b = JSON.parse(String(init.body)) as { title?: string; body?: string };
        notes = notes.map((n) =>
          n.id === id
            ? {
                ...n,
                ...(b.title !== undefined ? { title: b.title } : {}),
                ...(b.body !== undefined ? { body: b.body } : {}),
              }
            : n,
        );
        const updated = notes.find((n) => n.id === id);
        return updated
          ? new Response(JSON.stringify(updated), { status: 200 })
          : new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
      }
      if (init?.method === 'DELETE') {
        const id = (url as string).split('/').pop();
        notes = notes.filter((n) => n.id !== id);
        return new Response(null, { status: 204 });
      }
      // Parse page/pageSize/q from URL
      const urlObj = new URL(url as string, 'http://localhost');
      const page = Number(urlObj.searchParams.get('page') ?? '1');
      const pageSize = Number(urlObj.searchParams.get('pageSize') ?? '5');
      const q = urlObj.searchParams.get('q') ?? '';
      const term = q.trim().toLowerCase();
      const filtered =
        term === ''
          ? notes
          : notes.filter(
              (n) => n.title.toLowerCase().includes(term) || n.body.toLowerCase().includes(term),
            );
      const start = (page - 1) * pageSize;
      const items = filtered.slice(start, start + pageSize);
      return new Response(JSON.stringify(items), {
        status: 200,
        headers: { 'X-Total-Count': String(filtered.length) },
      });
    }),
  );
}

describe('App', () => {
  beforeEach(() => mockFetchSequence());

  it('creates a note and shows it in the list', async () => {
    render(<App />);
    await userEvent.type(screen.getByLabelText(/title/i), 'My note');
    await userEvent.type(screen.getByLabelText(/body/i), 'Hello');
    await userEvent.click(screen.getByRole('button', { name: /add note/i }));
    await waitFor(() => expect(screen.getByText('My note')).toBeInTheDocument());
  });

  it('deletes a note so it disappears from the list', async () => {
    render(<App />);
    await userEvent.type(screen.getByLabelText(/title/i), 'Temp note');
    await userEvent.type(screen.getByLabelText(/body/i), 'to delete');
    await userEvent.click(screen.getByRole('button', { name: /add note/i }));
    await waitFor(() => expect(screen.getByText('Temp note')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /delete/i }));
    await waitFor(() => expect(screen.queryByText('Temp note')).not.toBeInTheDocument());
  });

  it('edits a note and shows the updated text in the list', async () => {
    render(<App />);
    await userEvent.type(screen.getByLabelText(/^title$/i), 'Original title');
    await userEvent.type(screen.getByLabelText(/^body$/i), 'Original body');
    await userEvent.click(screen.getByRole('button', { name: /add note/i }));
    await waitFor(() => expect(screen.getByText('Original title')).toBeInTheDocument());

    // Click Edit to open inline form
    await userEvent.click(screen.getByRole('button', { name: /edit/i }));

    // Clear and type new values
    const editTitleInput = screen.getByRole('textbox', { name: /edit title/i });
    await userEvent.clear(editTitleInput);
    await userEvent.type(editTitleInput, 'Updated title');

    const editBodyInput = screen.getByRole('textbox', { name: /edit body/i });
    await userEvent.clear(editBodyInput);
    await userEvent.type(editBodyInput, 'Updated body');

    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(screen.getByText('Updated title')).toBeInTheDocument());
    expect(screen.queryByText('Original title')).not.toBeInTheDocument();
  });

  it('does not save when edit title or body is cleared to whitespace', async () => {
    render(<App />);
    await userEvent.type(screen.getByLabelText(/^title$/i), 'Keep me');
    await userEvent.type(screen.getByLabelText(/^body$/i), 'Keep body');
    await userEvent.click(screen.getByRole('button', { name: /add note/i }));
    await waitFor(() => expect(screen.getByText('Keep me')).toBeInTheDocument());

    // Open edit form and clear the title field
    await userEvent.click(screen.getByRole('button', { name: /edit/i }));
    const editTitleInput = screen.getByRole('textbox', { name: /edit title/i });
    await userEvent.clear(editTitleInput);

    // Clicking Save should be a no-op — note stays in the list unchanged
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    // Edit form should still be visible (save was suppressed)
    expect(screen.getByRole('textbox', { name: /edit title/i })).toBeInTheDocument();
  });

  it('shows an error when loading notes fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 500 })),
    );
    render(<App />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });

  it('disables Previous on page 1 and enables Next when there are multiple pages', async () => {
    // Pre-populate with 6 notes via mock so total > pageSize (5)
    let notes: Array<{ id: string; title: string; body: string }> = Array.from(
      { length: 6 },
      (_, i) => ({
        id: String(i + 1),
        title: `Note ${i + 1}`,
        body: `Body ${i + 1}`,
      }),
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === 'DELETE') {
          const id = (url as string).split('/').pop();
          notes = notes.filter((n) => n.id !== id);
          return new Response(null, { status: 204 });
        }
        const urlObj = new URL(url as string, 'http://localhost');
        const page = Number(urlObj.searchParams.get('page') ?? '1');
        const pageSize = Number(urlObj.searchParams.get('pageSize') ?? '5');
        const start = (page - 1) * pageSize;
        const items = notes.slice(start, start + pageSize);
        return new Response(JSON.stringify(items), {
          status: 200,
          headers: { 'X-Total-Count': String(notes.length) },
        });
      }),
    );

    render(<App />);

    await waitFor(() => expect(screen.getByText('Note 1')).toBeInTheDocument());

    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /next/i })).not.toBeDisabled();
  });

  it('new note is visible after create — lands on the last page', async () => {
    // Start with 5 notes so page 1 is full; creating a 6th pushes it to page 2
    const initialNotes = Array.from({ length: 5 }, (_, i) => ({
      id: String(i + 1),
      title: `Existing ${i + 1}`,
      body: `body ${i + 1}`,
    }));
    const notes = [...initialNotes];
    let nextId = initialNotes.length + 1;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === 'POST') {
          const b = JSON.parse(String(init.body)) as { title: string; body: string };
          const n = { id: String(nextId++), title: b.title, body: b.body };
          notes.push(n);
          return new Response(JSON.stringify(n), { status: 201 });
        }
        const urlObj = new URL(url as string, 'http://localhost');
        const page = Number(urlObj.searchParams.get('page') ?? '1');
        const pageSize = Number(urlObj.searchParams.get('pageSize') ?? '5');
        return buildResponse(notes, page, pageSize);
      }),
    );

    render(<App />);
    await waitFor(() => expect(screen.getByText('Existing 1')).toBeInTheDocument());

    // Create a 6th note — it lands on page 2
    await userEvent.type(screen.getByLabelText(/title/i), 'Sixth note');
    await userEvent.type(screen.getByLabelText(/body/i), 'last');
    await userEvent.click(screen.getByRole('button', { name: /add note/i }));

    // App must navigate to page 2 where the new note is visible
    await waitFor(() => expect(screen.getByText('Sixth note')).toBeInTheDocument());
    // Page 1 notes should no longer be shown
    expect(screen.queryByText('Existing 1')).not.toBeInTheDocument();
  });

  it('navigates to next and previous pages', async () => {
    const notes = Array.from({ length: 6 }, (_, i) => ({
      id: String(i + 1),
      title: `Note ${i + 1}`,
      body: `Body ${i + 1}`,
    }));
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const urlObj = new URL(url as string, 'http://localhost');
        const page = Number(urlObj.searchParams.get('page') ?? '1');
        const pageSize = Number(urlObj.searchParams.get('pageSize') ?? '5');
        const start = (page - 1) * pageSize;
        const items = notes.slice(start, start + pageSize);
        return new Response(JSON.stringify(items), {
          status: 200,
          headers: { 'X-Total-Count': String(notes.length) },
        });
      }),
    );

    render(<App />);

    // Page 1: Notes 1-5 visible
    await waitFor(() => expect(screen.getByText('Note 1')).toBeInTheDocument());
    expect(screen.queryByText('Note 6')).not.toBeInTheDocument();

    // Go to next page
    await userEvent.click(screen.getByRole('button', { name: /next/i }));
    await waitFor(() => expect(screen.getByText('Note 6')).toBeInTheDocument());
    expect(screen.queryByText('Note 1')).not.toBeInTheDocument();

    // Next should now be disabled (last page)
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /previous/i })).not.toBeDisabled();

    // Go back
    await userEvent.click(screen.getByRole('button', { name: /previous/i }));
    await waitFor(() => expect(screen.getByText('Note 1')).toBeInTheDocument());
    expect(screen.queryByText('Note 6')).not.toBeInTheDocument();
  });

  it('search box filters the note list', async () => {
    render(<App />);

    // Create two notes with different titles
    await userEvent.type(screen.getByLabelText(/^title$/i), 'Alpha note');
    await userEvent.type(screen.getByLabelText(/^body$/i), 'first body');
    await userEvent.click(screen.getByRole('button', { name: /add note/i }));
    await waitFor(() => expect(screen.getByText('Alpha note')).toBeInTheDocument());

    await userEvent.type(screen.getByLabelText(/^title$/i), 'Beta note');
    await userEvent.type(screen.getByLabelText(/^body$/i), 'second body');
    await userEvent.click(screen.getByRole('button', { name: /add note/i }));
    await waitFor(() => expect(screen.getByText('Beta note')).toBeInTheDocument());

    // Type in the search box — debounce fires after 300 ms (vi fake timers
    // are not used here; userEvent.type triggers the timer naturally via
    // the real timer in jsdom so we wait for the UI to update instead).
    await userEvent.type(screen.getByRole('textbox', { name: /search notes/i }), 'Alpha');
    await waitFor(() => expect(screen.queryByText('Beta note')).not.toBeInTheDocument());
    expect(screen.getByText('Alpha note')).toBeInTheDocument();

    // Clearing the search restores both notes
    await userEvent.clear(screen.getByRole('textbox', { name: /search notes/i }));
    await waitFor(() => expect(screen.getByText('Beta note')).toBeInTheDocument());
    expect(screen.getByText('Alpha note')).toBeInTheDocument();
  });

  it('search with no matches shows an empty list', async () => {
    render(<App />);

    await userEvent.type(screen.getByLabelText(/^title$/i), 'Unique note');
    await userEvent.type(screen.getByLabelText(/^body$/i), 'some content');
    await userEvent.click(screen.getByRole('button', { name: /add note/i }));
    await waitFor(() => expect(screen.getByText('Unique note')).toBeInTheDocument());

    await userEvent.type(screen.getByRole('textbox', { name: /search notes/i }), 'zzznomatch');
    await waitFor(() => expect(screen.queryByText('Unique note')).not.toBeInTheDocument());
  });
});

describe('listNotes — X-Total-Count validation', () => {
  it('returns total=0 when X-Total-Count header is missing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify([]), { status: 200 })),
    );
    const result = await listNotes(1, 5);
    expect(result.total).toBe(0);
    expect(Number.isFinite(result.total)).toBe(true);
  });

  it('returns total=0 when X-Total-Count is malformed (not a number)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify([]), {
            status: 200,
            headers: { 'X-Total-Count': 'not-a-number' },
          }),
      ),
    );
    const result = await listNotes(1, 5);
    expect(result.total).toBe(0);
    expect(Number.isFinite(result.total)).toBe(true);
  });

  it('returns the correct total when X-Total-Count is a valid number', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify([]), {
            status: 200,
            headers: { 'X-Total-Count': '42' },
          }),
      ),
    );
    const result = await listNotes(1, 5);
    expect(result.total).toBe(42);
  });
});
