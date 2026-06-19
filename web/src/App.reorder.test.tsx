import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';

type MockNote = {
  id: string;
  title: string;
  body: string;
  tags: string[];
  pinned: boolean;
  archived: boolean;
  color: 'none';
  deletedAt: number | null;
  pinnedOrder: number | null;
};

function pinned(id: string, title: string, order: number): MockNote {
  return {
    id,
    title,
    body: `body ${id}`,
    tags: [],
    pinned: true,
    archived: false,
    color: 'none',
    deletedAt: null,
    pinnedOrder: order,
  };
}

/**
 * Minimal fetch stub covering the reorder flow: list notes (pinned-first, in
 * persisted order) and the PATCH /api/notes/pin-order endpoint. Records the
 * order received by the server so the test can assert on it.
 */
function mockApi(initial: MockNote[]) {
  let notes = [...initial];
  const reorderCalls: string[][] = [];

  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);

      if (u.startsWith('/api/notes/pin-order') && init?.method === 'PATCH') {
        const body = JSON.parse(String(init.body)) as { ids: string[] };
        reorderCalls.push(body.ids);
        // Persist the new order so a subsequent list reflects it.
        body.ids.forEach((id, index) => {
          notes = notes.map((n) => (n.id === id ? { ...n, pinnedOrder: index } : n));
        });
        return new Response(JSON.stringify({ ids: body.ids }), { status: 200 });
      }

      if (u.startsWith('/api/tags')) {
        return new Response(JSON.stringify([]), { status: 200 });
      }

      if (u.startsWith('/api/notes')) {
        const active = notes
          .filter((n) => !n.archived && n.deletedAt === null)
          .sort((a, b) => {
            if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
            return (a.pinnedOrder ?? 0) - (b.pinnedOrder ?? 0);
          });
        return new Response(JSON.stringify(active), {
          status: 200,
          headers: {
            'X-Total-Count': String(active.length),
            'X-Total-Pages': '1',
            'X-Has-Next': 'false',
          },
        });
      }

      return new Response('not found', { status: 404 });
    }),
  );

  return { reorderCalls };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('App — pinned note reordering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('persists a keyboard move-down via the pin-order API and reflects the new order', async () => {
    const { reorderCalls } = mockApi([
      pinned('1', 'Alpha', 0),
      pinned('2', 'Beta', 1),
      pinned('3', 'Gamma', 2),
    ]);
    const user = userEvent.setup();
    render(<App />);

    await screen.findByText('Alpha');

    // Move "Alpha" down one position.
    await user.click(screen.getByRole('button', { name: 'Move Alpha down' }));

    await waitFor(() => {
      expect(reorderCalls).toContainEqual(['2', '1', '3']);
    });

    // After refresh the headings appear in the new order.
    await waitFor(() => {
      const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
      expect(headings).toEqual(['Beta', 'Alpha', 'Gamma']);
    });
  });

  it('persists a keyboard move-up via the pin-order API', async () => {
    const { reorderCalls } = mockApi([pinned('1', 'Alpha', 0), pinned('2', 'Beta', 1)]);
    const user = userEvent.setup();
    render(<App />);

    await screen.findByText('Beta');
    await user.click(screen.getByRole('button', { name: 'Move Beta up' }));

    await waitFor(() => {
      expect(reorderCalls).toContainEqual(['2', '1']);
    });
  });
});
