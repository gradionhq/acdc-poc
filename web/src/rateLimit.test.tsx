import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import { createNote, listNotes, RateLimitError, rateLimitMessage, type NoteColor } from './api';

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
});
