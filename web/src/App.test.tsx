import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';

function mockFetchSequence() {
  let notes: Array<{ id: string; title: string; body: string }> = [];
  let seq = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        const b = JSON.parse(String(init.body));
        const n = { id: String(++seq), title: b.title, body: b.body };
        notes.push(n);
        return new Response(JSON.stringify(n), { status: 201 });
      }
      if (init?.method === 'DELETE') {
        const id = url.split('/').pop();
        notes = notes.filter((n) => n.id !== id);
        return new Response(null, { status: 204 });
      }
      return new Response(JSON.stringify(notes), {
        status: 200,
        headers: { 'X-Total-Count': String(notes.length) },
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

  it('shows an error when loading notes fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 500 })),
    );
    render(<App />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });
});
