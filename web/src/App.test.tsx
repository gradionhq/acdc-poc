import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import { listNotes } from './api';

type MockNote = { id: string; title: string; body: string; tags: string[]; pinned: boolean };

function buildResponse(notes: MockNote[], page = 1, pageSize = 5) {
  const start = (page - 1) * pageSize;
  const items = notes.slice(start, start + pageSize);
  return new Response(JSON.stringify(items), {
    status: 200,
    headers: { 'X-Total-Count': String(notes.length) },
  });
}

type MockAttachment = { filename: string; contentType: string; size: number; data: string };

function mockFetchSequence() {
  let notes: MockNote[] = [];
  let seq = 0;
  const attachmentStore: Record<string, MockAttachment[]> = {};
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const urlStr = url as string;

      // POST /api/notes/:id/attachments
      if (init?.method === 'POST' && /\/api\/notes\/[^/]+\/attachments$/.test(urlStr)) {
        const noteId = urlStr.split('/').at(-2) ?? '';
        if (!notes.find((n) => n.id === noteId)) {
          return new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
        }
        const form = init.body as FormData;
        const file = form.get('file') as File;
        const meta: MockAttachment = {
          filename: file.name,
          contentType: file.type,
          size: file.size,
          data: '',
        };
        if (!attachmentStore[noteId]) attachmentStore[noteId] = [];
        attachmentStore[noteId].push(meta);
        return new Response(
          JSON.stringify({
            filename: meta.filename,
            contentType: meta.contentType,
            size: meta.size,
          }),
          { status: 201 },
        );
      }

      // GET /api/notes/:id/attachments (no method = default GET)
      if (
        (init?.method === undefined || init?.method === 'GET') &&
        /\/api\/notes\/[^/]+\/attachments$/.test(urlStr)
      ) {
        const noteId = urlStr.split('/').at(-2) ?? '';
        if (!notes.find((n) => n.id === noteId)) {
          return new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
        }
        const metas = (attachmentStore[noteId] ?? []).map((a) => ({
          filename: a.filename,
          contentType: a.contentType,
          size: a.size,
        }));
        return new Response(JSON.stringify(metas), { status: 200 });
      }

      // DELETE /api/notes/:id/attachments/:filename
      if (init?.method === 'DELETE' && /\/api\/notes\/[^/]+\/attachments\/[^/]+$/.test(urlStr)) {
        const parts = urlStr.split('/');
        const noteId = parts.at(-3) ?? '';
        const filename = decodeURIComponent(parts.at(-1) ?? '');
        if (!notes.find((n) => n.id === noteId)) {
          return new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
        }
        const atts = attachmentStore[noteId] ?? [];
        const idx = atts.findIndex((a) => a.filename === filename);
        if (idx === -1) {
          return new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
        }
        atts.splice(idx, 1);
        return new Response(null, { status: 204 });
      }

      if (init?.method === 'PATCH' && /\/api\/notes\/[^/]+\/pin$/.test(urlStr)) {
        const noteId = urlStr.split('/').at(-2) ?? '';
        const idx = notes.findIndex((n) => n.id === noteId);
        if (idx === -1) {
          return new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
        }
        notes[idx] = { ...notes[idx], pinned: !notes[idx].pinned };
        return new Response(JSON.stringify(notes[idx]), { status: 200 });
      }

      // POST /api/notes/:id/duplicate
      if (init?.method === 'POST' && /\/api\/notes\/[^/]+\/duplicate$/.test(urlStr)) {
        const noteId = urlStr.split('/').at(-2) ?? '';
        const source = notes.find((n) => n.id === noteId);
        if (!source) {
          return new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
        }
        const copy: MockNote = {
          id: String(++seq),
          title: `Copy of ${source.title}`,
          body: source.body,
          tags: [...source.tags],
          pinned: false,
        };
        notes.push(copy);
        return new Response(JSON.stringify(copy), { status: 201 });
      }

      if (init?.method === 'POST') {
        const b = JSON.parse(String(init.body)) as {
          title: string;
          body: string;
          tags?: string[];
        };
        const n: MockNote = {
          id: String(++seq),
          title: b.title,
          body: b.body,
          tags: b.tags ?? [],
          pinned: false,
        };
        notes.push(n);
        return new Response(JSON.stringify(n), { status: 201 });
      }
      if (init?.method === 'PUT') {
        const id = urlStr.split('/').pop();
        const b = JSON.parse(String(init.body)) as {
          title?: string;
          body?: string;
          tags?: string[];
        };
        notes = notes.map((n) =>
          n.id === id
            ? {
                ...n,
                ...(b.title !== undefined ? { title: b.title } : {}),
                ...(b.body !== undefined ? { body: b.body } : {}),
                ...(b.tags !== undefined ? { tags: b.tags } : {}),
              }
            : n,
        );
        const updated = notes.find((n) => n.id === id);
        return updated
          ? new Response(JSON.stringify(updated), { status: 200 })
          : new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
      }
      if (init?.method === 'DELETE') {
        const id = urlStr.split('/').pop();
        notes = notes.filter((n) => n.id !== id);
        return new Response(null, { status: 204 });
      }
      // Parse page/pageSize/q/tag from URL
      const urlObj = new URL(urlStr, 'http://localhost');
      const page = Number(urlObj.searchParams.get('page') ?? '1');
      const pageSize = Number(urlObj.searchParams.get('pageSize') ?? '5');
      const q = urlObj.searchParams.get('q') ?? '';
      const tagParam = urlObj.searchParams.get('tag') ?? '';
      const term = q.trim().toLowerCase();
      const tagTerm = tagParam.trim().toLowerCase();
      const filtered = notes.filter(
        (n) =>
          (term === '' ||
            n.title.toLowerCase().includes(term) ||
            n.body.toLowerCase().includes(term)) &&
          (tagTerm === '' || n.tags.some((t) => t.toLowerCase() === tagTerm)),
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

  it('error banner shows a Retry button that re-fetches notes', async () => {
    let callCount = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        callCount += 1;
        // First call fails; subsequent calls succeed with an empty list
        if (callCount === 1) {
          return new Response('nope', { status: 500 });
        }
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'X-Total-Count': '0' },
        });
      }),
    );
    render(<App />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /retry/i }));

    // After retry the error banner should disappear
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  it('shows a loading skeleton while fetching notes', async () => {
    // Never resolves — keeps the app in loading state
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    );
    render(<App />);
    expect(screen.getByRole('list', { name: /loading notes/i })).toBeInTheDocument();
  });

  it('shows empty state when there are no notes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify([]), {
            status: 200,
            headers: { 'X-Total-Count': '0' },
          }),
      ),
    );
    render(<App />);
    await waitFor(() => expect(screen.getByText(/no notes yet/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /add your first note/i })).toBeInTheDocument();
  });

  it('empty state does not show when notes exist', async () => {
    render(<App />);
    await userEvent.type(screen.getByLabelText(/^title$/i), 'Has notes');
    await userEvent.type(screen.getByLabelText(/^body$/i), 'body text');
    await userEvent.click(screen.getByRole('button', { name: /add note/i }));
    await waitFor(() => expect(screen.getByText('Has notes')).toBeInTheDocument());
    expect(screen.queryByText(/no notes yet/i)).not.toBeInTheDocument();
  });

  it('error message does not expose raw stack traces', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 500 })),
    );
    render(<App />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    const alertText = screen.getByRole('alert').textContent ?? '';
    expect(alertText).not.toMatch(/Error:/);
    expect(alertText).not.toMatch(/at \w/);
    expect(alertText).not.toMatch(/\.tsx?:/);
  });

  it('disables Previous on page 1 and enables Next when there are multiple pages', async () => {
    // Pre-populate with 6 notes via mock so total > pageSize (5)
    let notes: Array<{ id: string; title: string; body: string; tags: string[]; pinned: boolean }> =
      Array.from({ length: 6 }, (_, i) => ({
        id: String(i + 1),
        title: `Note ${i + 1}`,
        body: `Body ${i + 1}`,
        tags: [],
        pinned: false,
      }));
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
      tags: [] as string[],
      pinned: false,
    }));
    const notes = [...initialNotes];
    let nextId = initialNotes.length + 1;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === 'POST') {
          const b = JSON.parse(String(init.body)) as {
            title: string;
            body: string;
            tags?: string[];
          };
          const n = {
            id: String(nextId++),
            title: b.title,
            body: b.body,
            tags: b.tags ?? [],
            pinned: false,
          };
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
      tags: [] as string[],
      pinned: false,
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

  it('shows "no notes match your search" when filter is active but no results match', async () => {
    render(<App />);

    await userEvent.type(screen.getByLabelText(/^title$/i), 'Filter test note');
    await userEvent.type(screen.getByLabelText(/^body$/i), 'some body');
    await userEvent.click(screen.getByRole('button', { name: /add note/i }));
    await waitFor(() => expect(screen.getByText('Filter test note')).toBeInTheDocument());

    // Search for something that won't match — should show filter-specific message, not the CTA
    await userEvent.type(screen.getByRole('textbox', { name: /search notes/i }), 'zzznomatch');
    await waitFor(() =>
      expect(screen.getByText(/no notes match your search/i)).toBeInTheDocument(),
    );
    // The "Add your first note" CTA must NOT appear when notes exist but filter has no results
    expect(screen.queryByRole('button', { name: /add your first note/i })).not.toBeInTheDocument();
  });

  it('creating a note while a search is active clears the search and shows the new note', async () => {
    render(<App />);

    // Create two notes so there is something to filter OUT, which lets us
    // confirm the debounce has fired before submitting the new note.
    await userEvent.type(screen.getByLabelText(/^title$/i), 'Alpha existing');
    await userEvent.type(screen.getByLabelText(/^body$/i), 'alpha body');
    await userEvent.click(screen.getByRole('button', { name: /add note/i }));
    await waitFor(() => expect(screen.getByText('Alpha existing')).toBeInTheDocument());

    await userEvent.type(screen.getByLabelText(/^title$/i), 'Beta existing');
    await userEvent.type(screen.getByLabelText(/^body$/i), 'beta body');
    await userEvent.click(screen.getByRole('button', { name: /add note/i }));
    await waitFor(() => expect(screen.getByText('Beta existing')).toBeInTheDocument());

    // Activate a search filter that excludes Beta.
    // Wait for Beta to disappear from the list to confirm the debounce fired
    // and `query` state is now set to 'Alpha'.
    const searchBox = screen.getByRole('textbox', { name: /search notes/i });
    await userEvent.type(searchBox, 'Alpha');
    await waitFor(() => expect(screen.queryByText('Beta existing')).not.toBeInTheDocument());
    expect(screen.getByText('Alpha existing')).toBeInTheDocument();

    // Create a new note that does NOT match the active filter ('Alpha')
    await userEvent.type(screen.getByLabelText(/^title$/i), 'Unrelated note');
    await userEvent.type(screen.getByLabelText(/^body$/i), 'unrelated body');
    await userEvent.click(screen.getByRole('button', { name: /add note/i }));

    // The search should be cleared; both the new note and the previously
    // filtered-out note should be visible again.
    await waitFor(() => expect(screen.getByText('Unrelated note')).toBeInTheDocument());
    await waitFor(() => expect(searchBox).toHaveValue(''));
    expect(screen.getByText('Beta existing')).toBeInTheDocument();
  });
});

describe('App — tags', () => {
  beforeEach(() => mockFetchSequence());

  it('creates a note with tags and renders them in the list', async () => {
    render(<App />);
    await userEvent.type(screen.getByLabelText(/^title$/i), 'Tagged note');
    await userEvent.type(screen.getByLabelText(/^body$/i), 'note body');
    await userEvent.type(screen.getByRole('textbox', { name: /^tags$/i }), 'alpha, beta');
    await userEvent.click(screen.getByRole('button', { name: /add note/i }));

    await waitFor(() => expect(screen.getByText('Tagged note')).toBeInTheDocument());
    expect(screen.getByText('alpha')).toBeInTheDocument();
    expect(screen.getByText('beta')).toBeInTheDocument();
  });

  it('edits tags on a note and shows updated tags', async () => {
    render(<App />);
    await userEvent.type(screen.getByLabelText(/^title$/i), 'Note for tags edit');
    await userEvent.type(screen.getByLabelText(/^body$/i), 'body');
    await userEvent.type(screen.getByRole('textbox', { name: /^tags$/i }), 'oldtag');
    await userEvent.click(screen.getByRole('button', { name: /add note/i }));

    await waitFor(() => expect(screen.getByText('Note for tags edit')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /^edit note for tags edit$/i }));

    const editTagsInput = screen.getByRole('textbox', { name: /edit tags/i });
    await userEvent.clear(editTagsInput);
    await userEvent.type(editTagsInput, 'newtag');

    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(screen.getByText('newtag')).toBeInTheDocument());
  });

  it('filters by tag when tag filter input is filled', async () => {
    render(<App />);

    await userEvent.type(screen.getByLabelText(/^title$/i), 'Work note');
    await userEvent.type(screen.getByLabelText(/^body$/i), 'body');
    await userEvent.type(screen.getByRole('textbox', { name: /^tags$/i }), 'work');
    await userEvent.click(screen.getByRole('button', { name: /add note/i }));

    await waitFor(() => expect(screen.getByText('Work note')).toBeInTheDocument());

    await userEvent.type(screen.getByLabelText(/^title$/i), 'Personal note');
    await userEvent.type(screen.getByLabelText(/^body$/i), 'body');
    await userEvent.type(screen.getByRole('textbox', { name: /^tags$/i }), 'personal');
    await userEvent.click(screen.getByRole('button', { name: /add note/i }));

    await waitFor(() => expect(screen.getByText('Personal note')).toBeInTheDocument());

    await userEvent.type(screen.getByRole('textbox', { name: /filter by tag/i }), 'work');
    await waitFor(() => expect(screen.queryByText('Personal note')).not.toBeInTheDocument());
    expect(screen.getByText('Work note')).toBeInTheDocument();
  });
});

describe('App — tag deduplication', () => {
  beforeEach(() => mockFetchSequence());

  it('deduplicates tags before sending to server', async () => {
    render(<App />);
    await userEvent.type(screen.getByLabelText(/^title$/i), 'Dup tag note');
    await userEvent.type(screen.getByLabelText(/^body$/i), 'body');
    await userEvent.type(screen.getByRole('textbox', { name: /^tags$/i }), 'alpha, beta, alpha');
    await userEvent.click(screen.getByRole('button', { name: /add note/i }));

    // Only two distinct tags should appear in the rendered note — no duplicate spans
    await waitFor(() => expect(screen.getByText('Dup tag note')).toBeInTheDocument());
    const tagSpans = screen.getAllByText('alpha');
    expect(tagSpans).toHaveLength(1);
  });
});

describe('App — pin', () => {
  beforeEach(() => mockFetchSequence());

  it('shows a Pin button for each note', async () => {
    render(<App />);
    await userEvent.type(screen.getByLabelText(/^title$/i), 'Pin me');
    await userEvent.type(screen.getByLabelText(/^body$/i), 'body');
    await userEvent.click(screen.getByRole('button', { name: /add note/i }));
    await waitFor(() => expect(screen.getByText('Pin me')).toBeInTheDocument());

    expect(screen.getByRole('button', { name: /^pin pin me$/i })).toBeInTheDocument();
  });

  it('toggling pin changes button label to Unpin', async () => {
    render(<App />);
    await userEvent.type(screen.getByLabelText(/^title$/i), 'Toggle pin');
    await userEvent.type(screen.getByLabelText(/^body$/i), 'body');
    await userEvent.click(screen.getByRole('button', { name: /add note/i }));
    await waitFor(() => expect(screen.getByText('Toggle pin')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /^pin toggle pin$/i }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^unpin toggle pin$/i })).toBeInTheDocument(),
    );
  });

  it('unpinning a note changes button label back to Pin', async () => {
    render(<App />);
    await userEvent.type(screen.getByLabelText(/^title$/i), 'Unpin me');
    await userEvent.type(screen.getByLabelText(/^body$/i), 'body');
    await userEvent.click(screen.getByRole('button', { name: /add note/i }));
    await waitFor(() => expect(screen.getByText('Unpin me')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /^pin unpin me$/i }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^unpin unpin me$/i })).toBeInTheDocument(),
    );

    await userEvent.click(screen.getByRole('button', { name: /^unpin unpin me$/i }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^pin unpin me$/i })).toBeInTheDocument(),
    );
  });

  it('pinning a note on page 2 navigates to page 1 so the pinned note is visible', async () => {
    // 6 notes: page 1 has notes 1-5, page 2 has note 6. Pin note 6 from page 2;
    // the app should navigate back to page 1 where pinned notes sort first.
    const initialNotes = Array.from({ length: 6 }, (_, i) => ({
      id: String(i + 1),
      title: `Pg2Pin ${i + 1}`,
      body: `body ${i + 1}`,
      tags: [] as string[],
      pinned: false,
    }));
    const notes = initialNotes.map((n) => ({ ...n }));
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        const urlStr = url as string;
        if (init?.method === 'PATCH' && /\/api\/notes\/[^/]+\/pin$/.test(urlStr)) {
          const noteId = urlStr.split('/').at(-2) ?? '';
          const idx = notes.findIndex((n) => n.id === noteId);
          if (idx !== -1) notes[idx] = { ...notes[idx], pinned: !notes[idx].pinned };
          const pinnedNotes = notes.filter((n) => n.pinned);
          const unpinnedNotes = notes.filter((n) => !n.pinned);
          notes.splice(0, notes.length, ...pinnedNotes, ...unpinnedNotes);
          return new Response(JSON.stringify(notes[idx === -1 ? 0 : 0]), { status: 200 });
        }
        const urlObj = new URL(urlStr, 'http://localhost');
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
    // Page 1 loads with notes 1-5
    await waitFor(() => expect(screen.getByText('Pg2Pin 1')).toBeInTheDocument());

    // Navigate to page 2
    await userEvent.click(screen.getByRole('button', { name: /next/i }));
    await waitFor(() => expect(screen.getByText('Pg2Pin 6')).toBeInTheDocument());
    expect(screen.queryByText('Pg2Pin 1')).not.toBeInTheDocument();

    // Pin the note on page 2
    await userEvent.click(screen.getByRole('button', { name: /^pin pg2pin 6$/i }));

    // App should navigate to page 1 where the pinned note now sorts first
    await waitFor(() => expect(screen.getByText('Pg2Pin 6')).toBeInTheDocument());
    // Page indicator should show page 1
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
  });
});

describe('App — attachments', () => {
  beforeEach(() => mockFetchSequence());

  it('shows Attachments button for each note', async () => {
    render(<App />);
    await userEvent.type(screen.getByLabelText(/^title$/i), 'Attach note');
    await userEvent.type(screen.getByLabelText(/^body$/i), 'body');
    await userEvent.click(screen.getByRole('button', { name: /add note/i }));
    await waitFor(() => expect(screen.getByText('Attach note')).toBeInTheDocument());

    expect(
      screen.getByRole('button', { name: /attachments for attach note/i }),
    ).toBeInTheDocument();
  });

  it('opens attachments panel and shows empty state', async () => {
    render(<App />);
    await userEvent.type(screen.getByLabelText(/^title$/i), 'Attach note open');
    await userEvent.type(screen.getByLabelText(/^body$/i), 'body');
    await userEvent.click(screen.getByRole('button', { name: /add note/i }));
    await waitFor(() => expect(screen.getByText('Attach note open')).toBeInTheDocument());

    const attBtn = screen.getByRole('button', { name: /attachments for attach note open/i });
    await userEvent.click(attBtn);

    await waitFor(() => expect(screen.getByText(/no attachments yet/i)).toBeInTheDocument());
  });

  it('uploads an attachment and shows it in the list', async () => {
    render(<App />);
    await userEvent.type(screen.getByLabelText(/^title$/i), 'Attach note upload');
    await userEvent.type(screen.getByLabelText(/^body$/i), 'body');
    await userEvent.click(screen.getByRole('button', { name: /add note/i }));
    await waitFor(() => expect(screen.getByText('Attach note upload')).toBeInTheDocument());

    // Open the attachments panel
    await userEvent.click(
      screen.getByRole('button', { name: /attachments for attach note upload/i }),
    );
    await waitFor(() => expect(screen.getByText(/no attachments yet/i)).toBeInTheDocument());

    // Upload a file via the hidden file input
    const file = new File(['hello world'], 'hello.txt', { type: 'text/plain' });
    const uploadInput = screen.getByLabelText(/upload attachment for attach note upload/i);
    await userEvent.upload(uploadInput, file);

    await waitFor(() => expect(screen.getByText('hello.txt')).toBeInTheDocument());
    expect(screen.queryByText(/no attachments yet/i)).not.toBeInTheDocument();
  });

  it('shows a Delete button for each attachment', async () => {
    render(<App />);
    await userEvent.type(screen.getByLabelText(/^title$/i), 'Delete btn note');
    await userEvent.type(screen.getByLabelText(/^body$/i), 'body');
    await userEvent.click(screen.getByRole('button', { name: /add note/i }));
    await waitFor(() => expect(screen.getByText('Delete btn note')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /attachments for delete btn note/i }));
    await waitFor(() => expect(screen.getByText(/no attachments yet/i)).toBeInTheDocument());

    const file = new File(['x'], 'btn-test.txt', { type: 'text/plain' });
    const uploadInput = screen.getByLabelText(/upload attachment for delete btn note/i);
    await userEvent.upload(uploadInput, file);

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /delete attachment btn-test\.txt/i }),
      ).toBeInTheDocument(),
    );
  });

  it('deletes an attachment after confirmation and removes it from the list', async () => {
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    );

    render(<App />);
    await userEvent.type(screen.getByLabelText(/^title$/i), 'Del att note');
    await userEvent.type(screen.getByLabelText(/^body$/i), 'body');
    await userEvent.click(screen.getByRole('button', { name: /add note/i }));
    await waitFor(() => expect(screen.getByText('Del att note')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /attachments for del att note/i }));
    await waitFor(() => expect(screen.getByText(/no attachments yet/i)).toBeInTheDocument());

    // Upload two attachments
    const fileA = new File(['a'], 'alpha.txt', { type: 'text/plain' });
    const fileB = new File(['b'], 'beta.txt', { type: 'text/plain' });
    const uploadInput = screen.getByLabelText(/upload attachment for del att note/i);

    await userEvent.upload(uploadInput, fileA);
    await waitFor(() => expect(screen.getByText('alpha.txt')).toBeInTheDocument());

    await userEvent.upload(uploadInput, fileB);
    await waitFor(() => expect(screen.getByText('beta.txt')).toBeInTheDocument());

    // Delete alpha.txt
    await userEvent.click(screen.getByRole('button', { name: /delete attachment alpha\.txt/i }));

    // alpha.txt gone, beta.txt remains
    await waitFor(() => expect(screen.queryByText('alpha.txt')).not.toBeInTheDocument());
    expect(screen.getByText('beta.txt')).toBeInTheDocument();

    vi.unstubAllGlobals();
  });

  it('does not delete when confirmation is cancelled', async () => {
    vi.stubGlobal(
      'confirm',
      vi.fn(() => false),
    );

    render(<App />);
    await userEvent.type(screen.getByLabelText(/^title$/i), 'Cancel del note');
    await userEvent.type(screen.getByLabelText(/^body$/i), 'body');
    await userEvent.click(screen.getByRole('button', { name: /add note/i }));
    await waitFor(() => expect(screen.getByText('Cancel del note')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /attachments for cancel del note/i }));
    await waitFor(() => expect(screen.getByText(/no attachments yet/i)).toBeInTheDocument());

    const file = new File(['x'], 'nodelet.txt', { type: 'text/plain' });
    const uploadInput = screen.getByLabelText(/upload attachment for cancel del note/i);
    await userEvent.upload(uploadInput, file);
    await waitFor(() => expect(screen.getByText('nodelet.txt')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /delete attachment nodelet\.txt/i }));

    // File should still be present
    expect(screen.getByText('nodelet.txt')).toBeInTheDocument();

    vi.unstubAllGlobals();
  });
});

describe('attachment mock — 404 contract', () => {
  beforeEach(() => mockFetchSequence());

  it('returns 404 for GET attachments on an unknown (non-numeric) note id', async () => {
    const res = await fetch('/api/notes/non-numeric-id/attachments');
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('not found');
  });

  it('returns 404 for POST attachments on an unknown (non-numeric) note id', async () => {
    const form = new FormData();
    form.append('file', new File(['x'], 'x.txt', { type: 'text/plain' }));
    const res = await fetch('/api/notes/non-numeric-id/attachments', {
      method: 'POST',
      body: form,
    });
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('not found');
  });

  it('returns 404 for GET attachments on a valid-looking but non-existent numeric note id', async () => {
    const res = await fetch('/api/notes/99999/attachments');
    expect(res.status).toBe(404);
  });
});

describe('App — word/character count', () => {
  beforeEach(() => mockFetchSequence());

  it('shows "0 words, 0 characters" initially when body is empty', async () => {
    render(<App />);
    expect(screen.getByText('0 words, 0 characters')).toBeInTheDocument();
  });

  it('updates word and character count as user types in the body field', async () => {
    render(<App />);
    const bodyInput = screen.getByLabelText(/^body$/i);
    await userEvent.type(bodyInput, 'hello world');
    expect(screen.getByText('2 words, 11 characters')).toBeInTheDocument();
  });

  it('uses singular "word" when count is 1', async () => {
    render(<App />);
    const bodyInput = screen.getByLabelText(/^body$/i);
    await userEvent.type(bodyInput, 'hello');
    expect(screen.getByText('1 word, 5 characters')).toBeInTheDocument();
  });

  it('uses singular "character" when count is 1', async () => {
    render(<App />);
    const bodyInput = screen.getByLabelText(/^body$/i);
    await userEvent.type(bodyInput, 'a');
    expect(screen.getByText('1 word, 1 character')).toBeInTheDocument();
  });

  it('resets count to 0 after note is submitted', async () => {
    render(<App />);
    await userEvent.type(screen.getByLabelText(/^title$/i), 'My note');
    await userEvent.type(screen.getByLabelText(/^body$/i), 'hello world');
    expect(screen.getByText('2 words, 11 characters')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /add note/i }));
    await waitFor(() => expect(screen.getByText('My note')).toBeInTheDocument());
    expect(screen.getByText('0 words, 0 characters')).toBeInTheDocument();
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

describe('App — dark mode toggle', () => {
  beforeEach(() => {
    mockFetchSequence();
    localStorage.removeItem('theme');
    // Default: no OS dark preference
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
    // Reset data-theme to avoid bleed between tests
    document.documentElement.removeAttribute('data-theme');
  });

  afterEach(() => {
    localStorage.removeItem('theme');
    document.documentElement.removeAttribute('data-theme');
    vi.unstubAllGlobals();
  });

  it('defaults to light theme when no stored preference and no OS dark preference', async () => {
    render(<App />);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /notes/i })).toBeInTheDocument(),
    );
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('defaults to dark theme when OS prefers dark and no stored preference', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
    render(<App />);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /notes/i })).toBeInTheDocument(),
    );
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('uses stored light preference over OS dark preference', async () => {
    localStorage.setItem('theme', 'light');
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
    render(<App />);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /notes/i })).toBeInTheDocument(),
    );
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('toggle button switches from light to dark and persists to localStorage', async () => {
    render(<App />);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /notes/i })).toBeInTheDocument(),
    );
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    await userEvent.click(screen.getByRole('button', { name: /switch to dark mode/i }));

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('toggle button switches from dark to light and persists to localStorage', async () => {
    localStorage.setItem('theme', 'dark');
    render(<App />);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /notes/i })).toBeInTheDocument(),
    );
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    await userEvent.click(screen.getByRole('button', { name: /switch to light mode/i }));

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem('theme')).toBe('light');
  });
});

describe('App — duplicate', () => {
  beforeEach(() => mockFetchSequence());

  it('shows a Duplicate button for each note', async () => {
    render(<App />);
    await userEvent.type(screen.getByLabelText(/^title$/i), 'Dup me');
    await userEvent.type(screen.getByLabelText(/^body$/i), 'body');
    await userEvent.click(screen.getByRole('button', { name: /add note/i }));
    await waitFor(() => expect(screen.getByText('Dup me')).toBeInTheDocument());

    expect(screen.getByRole('button', { name: /duplicate dup me/i })).toBeInTheDocument();
  });

  it('clicking Duplicate creates a copy with prefixed title in the list', async () => {
    render(<App />);
    await userEvent.type(screen.getByLabelText(/^title$/i), 'Original note');
    await userEvent.type(screen.getByLabelText(/^body$/i), 'the body');
    await userEvent.click(screen.getByRole('button', { name: /add note/i }));
    await waitFor(() => expect(screen.getByText('Original note')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /duplicate original note/i }));
    await waitFor(() => expect(screen.getByText('Copy of Original note')).toBeInTheDocument());
  });

  it('the copy and the original are independent — editing one does not affect the other', async () => {
    render(<App />);
    await userEvent.type(screen.getByLabelText(/^title$/i), 'Source');
    await userEvent.type(screen.getByLabelText(/^body$/i), 'body');
    await userEvent.click(screen.getByRole('button', { name: /add note/i }));
    await waitFor(() => expect(screen.getByText('Source')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /duplicate source/i }));
    await waitFor(() => expect(screen.getByText('Copy of Source')).toBeInTheDocument());

    // Edit the original
    await userEvent.click(screen.getByRole('button', { name: /^edit source$/i }));
    const editTitle = screen.getByRole('textbox', { name: /edit title/i });
    await userEvent.clear(editTitle);
    await userEvent.type(editTitle, 'Source EDITED');
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(screen.getByText('Source EDITED')).toBeInTheDocument());
    // The copy should still have its original title
    expect(screen.getByText('Copy of Source')).toBeInTheDocument();
  });
});
