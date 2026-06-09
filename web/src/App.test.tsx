import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';

function mockFetchSequence() {
  const notes: Array<{ id: string; title: string; body: string }> = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      const b = JSON.parse(String(init.body));
      const n = { id: String(notes.length + 1), title: b.title, body: b.body };
      notes.push(n);
      return new Response(JSON.stringify(n), { status: 201 });
    }
    return new Response(JSON.stringify(notes), {
      status: 200, headers: { 'X-Total-Count': String(notes.length) },
    });
  }));
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
});
