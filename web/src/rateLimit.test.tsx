import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import {
  createNote,
  listNotes,
  updateNote,
  deleteNote,
  restoreNote,
  permanentDeleteNote,
  listTrashedNotes,
  duplicateNote,
  togglePin,
  toggleArchive,
  uploadAttachment,
  uploadAttachments,
  listAttachments,
  deleteAttachment,
  listTags,
  renameTag,
  setTagColor,
  deleteTag,
  RateLimitError,
  rateLimitMessage,
  type NoteColor,
} from './api';

// ---------------------------------------------------------------------------
// rateLimitMessage — friendly, Retry-After-aware copy
// ---------------------------------------------------------------------------
describe('rateLimitMessage', () => {
  it('includes the wait time when a Retry-After hint is present', () => {
    expect(rateLimitMessage(30)).toBe('Too many requests. Please try again in 30 seconds.');
  });

  it('uses the singular unit for a one-second wait', () => {
    expect(rateLimitMessage(1)).toBe('Too many requests. Please try again in 1 second.');
  });

  it('falls back to a generic message without a hint', () => {
    expect(rateLimitMessage(null)).toBe(
      'Too many requests. Please slow down and try again shortly.',
    );
  });

  it('falls back to a generic message for a zero wait', () => {
    expect(rateLimitMessage(0)).toBe('Too many requests. Please slow down and try again shortly.');
  });
});

// ---------------------------------------------------------------------------
// API client — 429 detection and Retry-After parsing
// ---------------------------------------------------------------------------
describe('API client 429 handling', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('throws RateLimitError with parsed delta-seconds Retry-After', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: 'too many requests' }), {
            status: 429,
            headers: { 'Retry-After': '42' },
          }),
      ),
    );
    const err = await createNote({ title: 't', body: 'b' }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RateLimitError);
    expect((err as RateLimitError).retryAfterSeconds).toBe(42);
  });

  it('throws RateLimitError with null hint when Retry-After is absent', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify([]), {
            status: 429,
          }),
      ),
    );
    const err = await listNotes().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RateLimitError);
    expect((err as RateLimitError).retryAfterSeconds).toBeNull();
  });

  it('ignores an unparseable Retry-After value', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(null, {
            status: 429,
            headers: { 'Retry-After': 'not-a-date' },
          }),
      ),
    );
    const err = await listNotes().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RateLimitError);
    expect((err as RateLimitError).retryAfterSeconds).toBeNull();
  });

  it('parses an HTTP-date Retry-After into seconds from now', async () => {
    const future = new Date(Date.now() + 60_000).toUTCString();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(null, {
            status: 429,
            headers: { 'Retry-After': future },
          }),
      ),
    );
    const err = await listNotes().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RateLimitError);
    const seconds = (err as RateLimitError).retryAfterSeconds;
    expect(seconds).not.toBeNull();
    expect(seconds!).toBeGreaterThan(55);
    expect(seconds!).toBeLessThanOrEqual(60);
  });
});

// ---------------------------------------------------------------------------
// Every API client call routes 429s through assertNotRateLimited, and falls
// back to its endpoint-specific Error for any other non-ok response.
// ---------------------------------------------------------------------------
describe('API client — 429 vs generic error across every endpoint', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** Each endpoint, invoked with throwaway args, and its generic failure message. */
  const endpoints: { name: string; call: () => Promise<unknown>; genericMessage: string }[] = [
    { name: 'listNotes', call: () => listNotes(), genericMessage: 'failed to load notes' },
    {
      name: 'createNote',
      call: () => createNote({ title: 't', body: 'b' }),
      genericMessage: 'failed to create note',
    },
    {
      name: 'updateNote',
      call: () => updateNote('1', { title: 't' }),
      genericMessage: 'failed to update note',
    },
    { name: 'deleteNote', call: () => deleteNote('1'), genericMessage: 'failed to delete note' },
    { name: 'restoreNote', call: () => restoreNote('1'), genericMessage: 'failed to restore note' },
    {
      name: 'permanentDeleteNote',
      call: () => permanentDeleteNote('1'),
      genericMessage: 'failed to permanently delete note',
    },
    {
      name: 'listTrashedNotes',
      call: () => listTrashedNotes(),
      genericMessage: 'failed to load trash',
    },
    {
      name: 'duplicateNote',
      call: () => duplicateNote('1'),
      genericMessage: 'failed to duplicate note',
    },
    { name: 'togglePin', call: () => togglePin('1'), genericMessage: 'failed to toggle pin' },
    {
      name: 'toggleArchive',
      call: () => toggleArchive('1'),
      genericMessage: 'failed to toggle archive',
    },
    {
      name: 'uploadAttachment',
      call: () => uploadAttachment('1', new File(['x'], 'a.txt', { type: 'text/plain' })),
      genericMessage: 'failed to upload attachment',
    },
    {
      name: 'uploadAttachments',
      call: () => uploadAttachments('1', [new File(['x'], 'a.txt', { type: 'text/plain' })]),
      genericMessage: 'failed to upload attachments',
    },
    {
      name: 'listAttachments',
      call: () => listAttachments('1'),
      genericMessage: 'failed to load attachments',
    },
    {
      name: 'deleteAttachment',
      call: () => deleteAttachment('1', 'a.txt'),
      genericMessage: 'failed to delete attachment',
    },
    { name: 'listTags', call: () => listTags(), genericMessage: 'failed to load tags' },
    {
      name: 'renameTag',
      call: () => renameTag('a', 'b'),
      genericMessage: 'failed to rename tag',
    },
    {
      name: 'setTagColor',
      call: () => setTagColor('a', 'red'),
      genericMessage: 'failed to set tag color',
    },
    { name: 'deleteTag', call: () => deleteTag('a'), genericMessage: 'failed to delete tag' },
  ];

  for (const { name, call, genericMessage } of endpoints) {
    it(`${name} throws RateLimitError on a 429`, async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(
          async () =>
            new Response(JSON.stringify({ error: 'too many requests' }), {
              status: 429,
              headers: { 'Retry-After': '7' },
            }),
        ),
      );
      const err = await call().catch((e: unknown) => e);
      expect(err).toBeInstanceOf(RateLimitError);
      expect((err as RateLimitError).retryAfterSeconds).toBe(7);
    });

    it(`${name} throws its generic error on a non-429 failure`, async () => {
      // Empty body (no `error` field) so endpoints that prefer a server-supplied
      // message fall back to their hardcoded copy via the `?? fallback` branch.
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response('{}', { status: 500 })),
      );
      const err = await call().catch((e: unknown) => e);
      expect(err).toBeInstanceOf(Error);
      expect(err).not.toBeInstanceOf(RateLimitError);
      expect((err as Error).message).toBe(genericMessage);
    });
  }

  // deleteNote / permanentDeleteNote / deleteAttachment swallow 404s; ensure a
  // 404 does NOT throw (the `&& res.status !== 404` guard) but a 429 still does.
  it('deleteNote treats 404 as success but still throws on 429', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 404 })),
    );
    await expect(deleteNote('missing')).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Component — App shows a non-blocking, friendly toast on a 429
// ---------------------------------------------------------------------------
describe('App — rate-limit toast', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the Retry-After-aware toast when a create is rate limited', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === 'POST') {
          return new Response(JSON.stringify({ error: 'too many requests' }), {
            status: 429,
            headers: { 'Retry-After': '15' },
          });
        }
        // Initial (and any) list load succeeds with an empty page.
        return new Response(JSON.stringify([] as NoteColor[]), {
          status: 200,
          headers: { 'X-Total-Count': '0' },
        });
      }),
    );

    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: /new note/i }));
    await userEvent.type(screen.getByLabelText(/^title$/i), 'Rate limited');
    await userEvent.type(screen.getByLabelText(/^body$/i), 'body');
    await userEvent.click(screen.getByRole('button', { name: /add note/i }));

    await waitFor(() =>
      expect(
        screen.getByText('Too many requests. Please try again in 15 seconds.'),
      ).toBeInTheDocument(),
    );
    // Non-blocking: surfaced as a status toast, not an alert/dialog.
    expect(screen.getByTestId('toast')).toHaveClass('toast--error');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('shows the generic fallback toast when a create fails with a non-429 error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === 'POST') {
          return new Response(JSON.stringify({ error: 'server error' }), { status: 500 });
        }
        return new Response(JSON.stringify([] as NoteColor[]), {
          status: 200,
          headers: { 'X-Total-Count': '0' },
        });
      }),
    );

    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: /new note/i }));
    await userEvent.type(screen.getByLabelText(/^title$/i), 'Boom');
    await userEvent.type(screen.getByLabelText(/^body$/i), 'body');
    await userEvent.click(screen.getByRole('button', { name: /add note/i }));

    await waitFor(() => expect(screen.getByText('Failed to create note')).toBeInTheDocument());
    expect(screen.getByTestId('toast')).toHaveClass('toast--error');
  });

  it('routes a 429 on toggle-pin through the rate-limit toast', async () => {
    const note = {
      id: 'n1',
      title: 'Pin me',
      body: 'b',
      tags: [],
      pinned: false,
      archived: false,
      color: 'none' as NoteColor,
      deletedAt: null,
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === 'PATCH' && /\/pin$/.test(url)) {
          return new Response(JSON.stringify({ error: 'rate limited' }), {
            status: 429,
            headers: { 'Retry-After': '20' },
          });
        }
        return new Response(JSON.stringify([note]), {
          status: 200,
          headers: { 'X-Total-Count': '1' },
        });
      }),
    );

    render(<App />);
    await waitFor(() => expect(screen.getByText('Pin me')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /^pin pin me$/i }));

    await waitFor(() =>
      expect(
        screen.getByText('Too many requests. Please try again in 20 seconds.'),
      ).toBeInTheDocument(),
    );
  });

  it('shows the generic fallback toast when toggle-archive fails (non-429)', async () => {
    const note = {
      id: 'n2',
      title: 'Archive me',
      body: 'b',
      tags: [],
      pinned: false,
      archived: false,
      color: 'none' as NoteColor,
      deletedAt: null,
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === 'PATCH' && /\/archive$/.test(url)) {
          return new Response('{}', { status: 500 });
        }
        return new Response(JSON.stringify([note]), {
          status: 200,
          headers: { 'X-Total-Count': '1' },
        });
      }),
    );

    render(<App />);
    await waitFor(() => expect(screen.getByText('Archive me')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /^archive archive me$/i }));

    await waitFor(() => expect(screen.getByText('Failed to toggle archive')).toBeInTheDocument());
  });
});
