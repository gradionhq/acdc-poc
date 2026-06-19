import { describe, it, expect, afterEach, vi } from 'vitest';
import { batchNotes, RateLimitError } from './api';

afterEach(() => {
  vi.unstubAllGlobals();
});

const okResult = (overrides: Record<string, unknown> = {}) => ({
  action: 'archive',
  succeeded: ['1', '2'],
  failed: [],
  ...overrides,
});

describe('batchNotes', () => {
  it('POSTs the batch endpoint without a tag for non-tag actions', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(okResult()), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await batchNotes(['1', '2'], 'archive');

    expect(fetchMock).toHaveBeenCalledWith('/api/notes/batch', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ids: ['1', '2'], action: 'archive' }),
    });
    expect(result).toEqual({ action: 'archive', succeeded: ['1', '2'], failed: [] });
  });

  it('includes the tag in the body for tag actions', async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify(okResult({ action: 'add-tag' })), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await batchNotes(['1'], 'add-tag', 'work');

    expect(fetchMock).toHaveBeenCalledWith('/api/notes/batch', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ids: ['1'], action: 'add-tag', tag: 'work' }),
    });
  });

  it('returns the per-id failure report', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify(
            okResult({ succeeded: ['1'], failed: [{ id: '2', reason: 'not found' }] }),
          ),
          { status: 200 },
        ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await batchNotes(['1', '2'], 'archive');
    expect(result.succeeded).toEqual(['1']);
    expect(result.failed).toEqual([{ id: '2', reason: 'not found' }]);
  });

  it('throws the server-provided error message on a non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: 'action must be one of: ...' }), { status: 400 }),
      ),
    );
    await expect(batchNotes(['1'], 'archive')).rejects.toThrow('action must be one of: ...');
  });

  it('falls back to a generic message when the error body is unparseable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('not json', { status: 500 })),
    );
    await expect(batchNotes(['1'], 'archive')).rejects.toThrow('failed to apply bulk action');
  });

  it('throws a RateLimitError on a 429 response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 429, headers: { 'Retry-After': '12' } })),
    );
    await expect(batchNotes(['1'], 'archive')).rejects.toBeInstanceOf(RateLimitError);
  });

  it('throws when the payload shape is invalid', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ action: 'archive', succeeded: 'nope' }), {
            status: 200,
          }),
      ),
    );
    await expect(batchNotes(['1'], 'archive')).rejects.toThrow('invalid batch payload');
  });

  it('rejects an unknown action in the payload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ action: 'bogus', succeeded: [], failed: [] }), {
            status: 200,
          }),
      ),
    );
    await expect(batchNotes(['1'], 'archive')).rejects.toThrow('invalid batch payload');
  });
});
