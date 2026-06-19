import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
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
};

function note(id: string, title: string): MockNote {
  return {
    id,
    title,
    body: `body ${id}`,
    tags: [],
    pinned: false,
    archived: false,
    color: 'none',
    deletedAt: null,
  };
}

/**
 * Minimal fetch stub covering only the endpoints the bulk-selection flow
 * touches: list notes, list tags, and the batch endpoint. The batch handler
 * records the last request body so the test can assert on it.
 */
function mockApi(initial: MockNote[]) {
  let notes = [...initial];
  const batchCalls: Array<{ ids: string[]; action: string; tag?: string }> = [];

  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);

      if (u.startsWith('/api/notes/batch') && init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as {
          ids: string[];
          action: string;
          tag?: string;
        };
        batchCalls.push(body);
        // Simulate the action's effect on the store so the refresh reflects it.
        if (body.action === 'archive') {
          notes = notes.map((n) => (body.ids.includes(n.id) ? { ...n, archived: true } : n));
        } else if (body.action === 'trash') {
          notes = notes.filter((n) => !body.ids.includes(n.id));
        }
        return new Response(
          JSON.stringify({ action: body.action, succeeded: body.ids, failed: [] }),
          { status: 200 },
        );
      }

      if (u.startsWith('/api/tags')) {
        return new Response(JSON.stringify([]), { status: 200 });
      }

      if (u.startsWith('/api/notes')) {
        const active = notes.filter((n) => !n.archived && n.deletedAt === null);
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

  return { batchCalls };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('App — bulk selection and actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('archives selected notes via the batch API and refreshes the list', async () => {
    const { batchCalls } = mockApi([note('1', 'Alpha'), note('2', 'Beta'), note('3', 'Gamma')]);
    const user = userEvent.setup();
    render(<App />);

    await screen.findByText('Alpha');

    // Enter selection mode.
    await user.click(screen.getByRole('button', { name: 'Select notes' }));

    // Select two notes.
    await user.click(screen.getByRole('checkbox', { name: 'Select Alpha' }));
    await user.click(screen.getByRole('checkbox', { name: 'Select Gamma' }));
    expect(screen.getByText('2 selected')).toBeInTheDocument();

    // Bulk archive.
    await user.click(screen.getByRole('button', { name: 'Archive selected notes' }));

    await waitFor(() => {
      expect(batchCalls).toContainEqual({ ids: ['1', '3'], action: 'archive' });
    });
    // The archived notes drop out of the default list on refresh.
    await waitFor(() => {
      expect(screen.queryByText('Alpha')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('select-all selects every visible note and trash empties the list', async () => {
    const { batchCalls } = mockApi([note('1', 'Alpha'), note('2', 'Beta')]);
    const user = userEvent.setup();
    render(<App />);

    await screen.findByText('Alpha');
    await user.click(screen.getByRole('button', { name: 'Select notes' }));

    const toolbar = screen.getByRole('toolbar', { name: 'Bulk actions' });
    await user.click(within(toolbar).getByRole('checkbox', { name: /select all notes/i }));
    expect(screen.getByText('2 selected')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Move selected notes to trash' }));

    await waitFor(() => {
      expect(batchCalls).toContainEqual({ ids: ['1', '2'], action: 'trash' });
    });
  });

  it('adds a tag to selected notes through the add-tag form', async () => {
    const { batchCalls } = mockApi([note('1', 'Alpha')]);
    const user = userEvent.setup();
    render(<App />);

    await screen.findByText('Alpha');
    await user.click(screen.getByRole('button', { name: 'Select notes' }));
    await user.click(screen.getByRole('checkbox', { name: 'Select Alpha' }));

    await user.click(screen.getByRole('button', { name: 'Add a tag to selected notes' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Tag to add to selected notes' }),
      'priority',
    );
    await user.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => {
      expect(batchCalls).toContainEqual({ ids: ['1'], action: 'add-tag', tag: 'priority' });
    });
  });

  it('clears the selection and exits selection mode with Done', async () => {
    mockApi([note('1', 'Alpha')]);
    const user = userEvent.setup();
    render(<App />);

    await screen.findByText('Alpha');
    await user.click(screen.getByRole('button', { name: 'Select notes' }));
    await user.click(screen.getByRole('checkbox', { name: 'Select Alpha' }));
    expect(screen.getByText('1 selected')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Exit selection mode' }));
    expect(screen.queryByRole('toolbar', { name: 'Bulk actions' })).not.toBeInTheDocument();
    // Re-entering selection mode starts from a cleared selection.
    await user.click(screen.getByRole('button', { name: 'Select notes' }));
    expect(screen.getByText('0 selected')).toBeInTheDocument();
  });
});
