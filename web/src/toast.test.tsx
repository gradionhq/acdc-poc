import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderHook } from '@testing-library/react';
import { useToast } from './useToast';
import { ToastContainer } from './ToastContainer';

// ---------------------------------------------------------------------------
// useToast hook tests
// ---------------------------------------------------------------------------
describe('useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with no toasts', () => {
    const { result } = renderHook(() => useToast());
    expect(result.current.toasts).toHaveLength(0);
  });

  it('addToast appends a toast with the correct message and kind', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.addToast('Note created', 'success');
    });
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].message).toBe('Note created');
    expect(result.current.toasts[0].kind).toBe('success');
  });

  it('addToast stacks multiple toasts', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.addToast('First', 'success');
      result.current.addToast('Second', 'error');
    });
    expect(result.current.toasts).toHaveLength(2);
  });

  it('dismissToast removes only the targeted toast', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.addToast('Keep', 'success');
      result.current.addToast('Remove', 'error');
    });
    const idToRemove = result.current.toasts[1].id;
    act(() => {
      result.current.dismissToast(idToRemove);
    });
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].message).toBe('Keep');
  });

  it('toast auto-dismisses after 4 seconds', async () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.addToast('Auto dismiss', 'success');
    });
    expect(result.current.toasts).toHaveLength(1);
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(result.current.toasts).toHaveLength(0);
  });

  it('toast does NOT auto-dismiss before 4 seconds', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.addToast('Still here', 'success');
    });
    act(() => {
      vi.advanceTimersByTime(3999);
    });
    expect(result.current.toasts).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// ToastContainer rendering tests
// ---------------------------------------------------------------------------
describe('ToastContainer', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when toasts array is empty', () => {
    const { container } = render(<ToastContainer toasts={[]} onDismiss={() => undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders a success toast with the correct message', () => {
    render(
      <ToastContainer
        toasts={[{ id: 1, message: 'Note created', kind: 'success' }]}
        onDismiss={() => undefined}
      />,
    );
    expect(screen.getByText('Note created')).toBeInTheDocument();
    expect(screen.getByTestId('toast')).toHaveClass('toast--success');
  });

  it('renders an error toast with the correct class', () => {
    render(
      <ToastContainer
        toasts={[{ id: 1, message: 'Failed to create note', kind: 'error' }]}
        onDismiss={() => undefined}
      />,
    );
    expect(screen.getByTestId('toast')).toHaveClass('toast--error');
  });

  it('calls onDismiss with the correct id when dismiss button is clicked', async () => {
    const onDismiss = vi.fn();
    render(
      <ToastContainer
        toasts={[{ id: 42, message: 'Note created', kind: 'success' }]}
        onDismiss={onDismiss}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /dismiss notification/i }));
    expect(onDismiss).toHaveBeenCalledWith(42);
  });

  it('renders multiple toasts stacked', () => {
    render(
      <ToastContainer
        toasts={[
          { id: 1, message: 'First', kind: 'success' },
          { id: 2, message: 'Second', kind: 'error' },
        ]}
        onDismiss={() => undefined}
      />,
    );
    expect(screen.getAllByTestId('toast')).toHaveLength(2);
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// App integration — toast messages on actions
// ---------------------------------------------------------------------------
import { App } from './App';
import { listNotes, type NoteColor } from './api';

type MockNote = {
  id: string;
  title: string;
  body: string;
  tags: string[];
  pinned: boolean;
  archived: boolean;
  color: NoteColor;
};

function mockFetchSequence() {
  let notes: MockNote[] = [];
  let seq = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const urlStr = url as string;

      if (init?.method === 'PATCH' && /\/api\/notes\/[^/]+\/pin$/.test(urlStr)) {
        const noteId = urlStr.split('/').at(-2) ?? '';
        const idx = notes.findIndex((n) => n.id === noteId);
        if (idx === -1) {
          return new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
        }
        notes[idx] = { ...notes[idx], pinned: !notes[idx].pinned };
        return new Response(JSON.stringify(notes[idx]), { status: 200 });
      }
      if (init?.method === 'PATCH' && /\/api\/notes\/[^/]+\/archive$/.test(urlStr)) {
        const noteId = urlStr.split('/').at(-2) ?? '';
        const idx = notes.findIndex((n) => n.id === noteId);
        if (idx === -1) {
          return new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
        }
        notes[idx] = { ...notes[idx], archived: !notes[idx].archived };
        return new Response(JSON.stringify(notes[idx]), { status: 200 });
      }
      if (init?.method === 'POST') {
        const b = JSON.parse(String(init.body)) as {
          title: string;
          body: string;
          tags?: string[];
          color?: NoteColor;
        };
        const n: MockNote = {
          id: String(++seq),
          title: b.title,
          body: b.body,
          tags: b.tags ?? [],
          pinned: false,
          archived: false,
          color: b.color ?? 'none',
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
          color?: NoteColor;
        };
        notes = notes.map((n) =>
          n.id === id
            ? {
                ...n,
                ...(b.title !== undefined ? { title: b.title } : {}),
                ...(b.body !== undefined ? { body: b.body } : {}),
                ...(b.tags !== undefined ? { tags: b.tags } : {}),
                ...(b.color !== undefined ? { color: b.color } : {}),
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
      // GET list
      const urlObj = new URL(urlStr, 'http://localhost');
      const page = Number(urlObj.searchParams.get('page') ?? '1');
      const pageSize = Number(urlObj.searchParams.get('pageSize') ?? '5');
      const q = urlObj.searchParams.get('q') ?? '';
      const archivedParam = urlObj.searchParams.get('archived') === 'true';
      const term = q.trim().toLowerCase();
      const filtered = notes.filter(
        (n) =>
          n.archived === archivedParam &&
          (term === '' ||
            n.title.toLowerCase().includes(term) ||
            n.body.toLowerCase().includes(term)),
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

describe('App — toast notifications', () => {
  beforeEach(() => {
    vi.useRealTimers();
    mockFetchSequence();
  });

  it('shows a success toast after creating a note', async () => {
    render(<App />);
    await userEvent.type(screen.getByLabelText(/^title$/i), 'Toast note');
    await userEvent.type(screen.getByLabelText(/^body$/i), 'body text');
    await userEvent.click(screen.getByRole('button', { name: /add note/i }));
    await waitFor(() => expect(screen.getByText('Note created')).toBeInTheDocument());
  });

  it('shows a success toast after deleting a note', async () => {
    render(<App />);
    await userEvent.type(screen.getByLabelText(/^title$/i), 'Delete me');
    await userEvent.type(screen.getByLabelText(/^body$/i), 'body');
    await userEvent.click(screen.getByRole('button', { name: /add note/i }));
    await waitFor(() => expect(screen.getByText('Delete me')).toBeInTheDocument());

    // Use the exact aria-label to avoid matching dismiss-toast buttons.
    // Deletion now requires confirming in a dialog.
    await userEvent.click(screen.getByRole('button', { name: /^delete delete me$/i }));
    await userEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    await waitFor(() => expect(screen.getByText('Note deleted')).toBeInTheDocument());
  });

  it('shows a success toast after editing a note', async () => {
    render(<App />);
    await userEvent.type(screen.getByLabelText(/^title$/i), 'Edit me');
    await userEvent.type(screen.getByLabelText(/^body$/i), 'original body');
    await userEvent.click(screen.getByRole('button', { name: /add note/i }));
    await waitFor(() => expect(screen.getByText('Edit me')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /^edit edit me$/i }));
    const editTitle = screen.getByRole('textbox', { name: /edit title/i });
    await userEvent.clear(editTitle);
    await userEvent.type(editTitle, 'Edited title');
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(screen.getByText('Note updated')).toBeInTheDocument());
  });

  it('shows a success toast after pinning a note', async () => {
    render(<App />);
    await userEvent.type(screen.getByLabelText(/^title$/i), 'Pin toast note');
    await userEvent.type(screen.getByLabelText(/^body$/i), 'body');
    await userEvent.click(screen.getByRole('button', { name: /add note/i }));
    await waitFor(() => expect(screen.getByText('Pin toast note')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /^pin pin toast note$/i }));
    await waitFor(() => expect(screen.getByText('Note pinned')).toBeInTheDocument());
  });

  it('shows a success toast after unpinning a note', async () => {
    render(<App />);
    await userEvent.type(screen.getByLabelText(/^title$/i), 'Unpin toast note');
    await userEvent.type(screen.getByLabelText(/^body$/i), 'body');
    await userEvent.click(screen.getByRole('button', { name: /add note/i }));
    await waitFor(() => expect(screen.getByText('Unpin toast note')).toBeInTheDocument());

    // Pin it first
    await userEvent.click(screen.getByRole('button', { name: /^pin unpin toast note$/i }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^unpin unpin toast note$/i })).toBeInTheDocument(),
    );

    // Now unpin
    await userEvent.click(screen.getByRole('button', { name: /^unpin unpin toast note$/i }));
    await waitFor(() => expect(screen.getByText('Note unpinned')).toBeInTheDocument());
  });

  it('shows an error toast when create fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === 'POST') {
          return new Response(JSON.stringify({ error: 'server error' }), { status: 500 });
        }
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'X-Total-Count': '0' },
        });
      }),
    );
    render(<App />);
    await userEvent.type(screen.getByLabelText(/^title$/i), 'Fail note');
    await userEvent.type(screen.getByLabelText(/^body$/i), 'body');
    await userEvent.click(screen.getByRole('button', { name: /add note/i }));
    await waitFor(() => expect(screen.getByText('Failed to create note')).toBeInTheDocument());
  });

  it('dismisses a toast manually when the dismiss button is clicked', async () => {
    render(<App />);
    await userEvent.type(screen.getByLabelText(/^title$/i), 'Manual dismiss');
    await userEvent.type(screen.getByLabelText(/^body$/i), 'body');
    await userEvent.click(screen.getByRole('button', { name: /add note/i }));
    await waitFor(() => expect(screen.getByText('Note created')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /dismiss notification/i }));
    await waitFor(() => expect(screen.queryByText('Note created')).not.toBeInTheDocument());
  });
});

// Suppress listNotes import warning — it is used in App.test.tsx but listed
// here as an import to keep consistent with the test pattern; just reference it.
void listNotes;
