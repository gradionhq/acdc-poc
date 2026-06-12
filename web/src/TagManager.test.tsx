import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TagManager } from './TagManager';
import { App } from './App';

type TagColor = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'gray';
type TagStat = { tag: string; count: number; color: TagColor | null };

function mockTagFetch(
  initial: Array<{ tag: string; count: number; color?: TagColor | null }> = [],
) {
  let tags: TagStat[] = initial.map((t) => ({ color: null, ...t }));

  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const urlStr = url as string;

      // POST /api/tags/rename
      if (init?.method === 'POST' && urlStr.includes('/api/tags/rename')) {
        const { from, to } = JSON.parse(String(init.body)) as { from: string; to: string };
        if (!from || !to) {
          return new Response(JSON.stringify({ error: 'invalid' }), { status: 400 });
        }
        const toExists = tags.some((t) => t.tag === to && t.tag !== from);
        if (toExists) {
          return new Response(JSON.stringify({ error: `tag "${to}" already exists` }), {
            status: 409,
          });
        }
        let affected = 0;
        tags = tags.map((t) => {
          if (t.tag === from) {
            affected++;
            return { tag: to, count: t.count, color: t.color };
          }
          return t;
        });
        return new Response(JSON.stringify({ affected }), { status: 200 });
      }

      // PUT /api/tags/:name — set color
      if (init?.method === 'PUT' && urlStr.includes('/api/tags/')) {
        const tag = decodeURIComponent(urlStr.split('/api/tags/')[1]);
        const { color } = JSON.parse(String(init.body)) as { color: TagColor };
        tags = tags.map((t) => (t.tag === tag ? { ...t, color } : t));
        return new Response(JSON.stringify({ tag, color }), { status: 200 });
      }

      // DELETE /api/tags/:tag
      if (init?.method === 'DELETE' && urlStr.includes('/api/tags/')) {
        const tag = decodeURIComponent(urlStr.split('/api/tags/')[1]);
        let affected = 0;
        tags = tags.filter((t) => {
          if (t.tag === tag) {
            affected++;
            return false;
          }
          return true;
        });
        return new Response(JSON.stringify({ affected }), { status: 200 });
      }

      // GET /api/tags
      if (urlStr.includes('/api/tags')) {
        return new Response(JSON.stringify(tags), { status: 200 });
      }

      return new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
    }),
  );
}

describe('TagManager', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows empty state when there are no tags', async () => {
    mockTagFetch([]);
    render(<TagManager onChanged={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/no tags in use/i)).toBeInTheDocument());
  });

  it('lists tags with counts', async () => {
    mockTagFetch([
      { tag: 'alpha', count: 3 },
      { tag: 'beta', count: 1 },
    ]);
    render(<TagManager onChanged={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('alpha')).toBeInTheDocument());
    expect(screen.getByText('beta')).toBeInTheDocument();
    expect(screen.getByText('3 notes')).toBeInTheDocument();
    expect(screen.getByText('1 note')).toBeInTheDocument();
  });

  it('shows Rename and Delete buttons for each tag', async () => {
    mockTagFetch([{ tag: 'work', count: 2 }]);
    render(<TagManager onChanged={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('work')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /rename tag work/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete tag work/i })).toBeInTheDocument();
  });

  it('opens rename input and saves new name', async () => {
    const onChanged = vi.fn();
    mockTagFetch([{ tag: 'old', count: 2 }]);
    render(<TagManager onChanged={onChanged} />);

    await waitFor(() => expect(screen.getByText('old')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /rename tag old/i }));

    const input = screen.getByRole('textbox', { name: /rename old/i });
    await userEvent.clear(input);
    await userEvent.type(input, 'new');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(screen.getByText('new')).toBeInTheDocument());
    expect(screen.queryByText('old')).not.toBeInTheDocument();
    expect(onChanged).toHaveBeenCalled();
  });

  it('cancel rename closes the input without saving', async () => {
    mockTagFetch([{ tag: 'keep', count: 1 }]);
    render(<TagManager onChanged={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('keep')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /rename tag keep/i }));
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }));

    expect(screen.getByText('keep')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /rename keep/i })).not.toBeInTheDocument();
  });

  it('shows error when renaming to an existing tag', async () => {
    mockTagFetch([
      { tag: 'alpha', count: 2 },
      { tag: 'beta', count: 1 },
    ]);
    render(<TagManager onChanged={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('alpha')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /rename tag alpha/i }));

    const input = screen.getByRole('textbox', { name: /rename alpha/i });
    await userEvent.clear(input);
    await userEvent.type(input, 'beta');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent(/already exists/i);
  });

  it('deletes a tag after confirmation', async () => {
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    );
    const onChanged = vi.fn();
    mockTagFetch([{ tag: 'remove-me', count: 2 }]);
    render(<TagManager onChanged={onChanged} />);

    await waitFor(() => expect(screen.getByText('remove-me')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /delete tag remove-me/i }));

    await waitFor(() => expect(screen.queryByText('remove-me')).not.toBeInTheDocument());
    expect(onChanged).toHaveBeenCalled();
  });

  it('does not delete when confirmation is cancelled', async () => {
    vi.stubGlobal(
      'confirm',
      vi.fn(() => false),
    );
    mockTagFetch([{ tag: 'stay', count: 1 }]);
    render(<TagManager onChanged={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('stay')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /delete tag stay/i }));

    expect(screen.getByText('stay')).toBeInTheDocument();
  });

  it('shows loading state while fetching', () => {
    // Return a promise that never resolves so we can see the loading state
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>(() => {
            /* never resolves */
          }),
      ),
    );
    render(<TagManager onChanged={vi.fn()} />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows error alert when load fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 500 })),
    );
    render(<TagManager onChanged={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });

  it('pressing Enter in rename input commits the rename', async () => {
    mockTagFetch([{ tag: 'enter-test', count: 1 }]);
    render(<TagManager onChanged={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('enter-test')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /rename tag enter-test/i }));

    const input = screen.getByRole('textbox', { name: /rename enter-test/i });
    await userEvent.clear(input);
    await userEvent.type(input, 'enter-new{Enter}');

    await waitFor(() => expect(screen.getByText('enter-new')).toBeInTheDocument());
    expect(screen.queryByText('enter-test')).not.toBeInTheDocument();
  });

  it('pressing Escape in rename input cancels the rename', async () => {
    mockTagFetch([{ tag: 'esc-test', count: 1 }]);
    render(<TagManager onChanged={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('esc-test')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /rename tag esc-test/i }));

    screen.getByRole('textbox', { name: /rename esc-test/i });
    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('textbox', { name: /rename esc-test/i })).not.toBeInTheDocument();
    expect(screen.getByText('esc-test')).toBeInTheDocument();
  });

  it('renders a color swatch button for every palette color', async () => {
    mockTagFetch([{ tag: 'work', count: 1 }]);
    render(<TagManager onChanged={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('work')).toBeInTheDocument());
    for (const color of ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'gray']) {
      expect(
        screen.getByRole('button', { name: new RegExp(`set work color ${color}`, 'i') }),
      ).toBeInTheDocument();
    }
  });

  it('assigns a color and marks its swatch as pressed', async () => {
    const onChanged = vi.fn();
    mockTagFetch([{ tag: 'work', count: 1 }]);
    render(<TagManager onChanged={onChanged} />);

    await waitFor(() => expect(screen.getByText('work')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /set work color blue/i }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /set work color blue/i })).toHaveAttribute(
        'aria-pressed',
        'true',
      ),
    );
    expect(onChanged).toHaveBeenCalled();
  });

  it('reflects a pre-existing color via aria-pressed', async () => {
    mockTagFetch([{ tag: 'urgent', count: 2, color: 'red' }]);
    render(<TagManager onChanged={vi.fn()} />);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /set urgent color red/i })).toHaveAttribute(
        'aria-pressed',
        'true',
      ),
    );
  });

  it('shows an error when setting a color fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        const urlStr = url as string;
        if (init?.method === 'PUT') {
          return new Response(JSON.stringify({ error: 'bad color' }), { status: 400 });
        }
        if (urlStr.includes('/api/tags')) {
          return new Response(JSON.stringify([{ tag: 'work', count: 1, color: null }]), {
            status: 200,
          });
        }
        return new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
      }),
    );
    render(<TagManager onChanged={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('work')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /set work color blue/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/bad color/i));
  });
});

describe('App — tag manager integration', () => {
  beforeEach(() => {
    // A minimal fetch mock that handles both notes and tags endpoints
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const urlStr = url as string;
        if (urlStr.includes('/api/tags')) {
          return new Response(JSON.stringify([]), { status: 200 });
        }
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'X-Total-Count': '0' },
        });
      }),
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  it('shows "Manage tags" button in the header', async () => {
    render(<App />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /manage tags/i })).toBeInTheDocument(),
    );
  });

  it('clicking "Manage tags" shows the TagManager panel', async () => {
    render(<App />);
    const btn = await screen.findByRole('button', { name: /manage tags/i });
    await userEvent.click(btn);
    await waitFor(() =>
      expect(screen.getByRole('region', { name: /tag manager/i })).toBeInTheDocument(),
    );
  });

  it('clicking "Hide tag manager" hides the panel', async () => {
    render(<App />);
    const btn = await screen.findByRole('button', { name: /manage tags/i });
    await userEvent.click(btn);
    await waitFor(() =>
      expect(screen.getByRole('region', { name: /tag manager/i })).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByRole('button', { name: /hide tag manager/i }));
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: /tag manager/i })).not.toBeInTheDocument(),
    );
  });
});
