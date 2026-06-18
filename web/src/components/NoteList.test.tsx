import { createRef } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { NoteList, type NoteListProps } from './NoteList';
import type { Note, NoteColor } from '../api';

function makeNote(i: number): Note {
  return {
    id: String(i),
    title: `Note ${i}`,
    body: `Body ${i}`,
    tags: [],
    pinned: false,
    archived: false,
    color: 'none' as NoteColor,
    deletedAt: null,
  };
}

function makeProps(overrides: Partial<NoteListProps> = {}): NoteListProps {
  return {
    notes: [],
    tagColors: {},
    initialLoading: false,
    isFilterActive: false,
    showEmptyState: false,
    editingId: null,
    editTitle: '',
    editBody: '',
    editTagsInput: '',
    editColor: 'none',
    onEditTitleChange: vi.fn(),
    onEditBodyChange: vi.fn(),
    onEditTagsInputChange: vi.fn(),
    onEditColorChange: vi.fn(),
    onEditSave: vi.fn(),
    onEditCancel: vi.fn(),
    onEditStart: vi.fn(),
    onTogglePin: vi.fn(),
    onToggleArchive: vi.fn(),
    onDeleteRequest: vi.fn(),
    onDuplicate: vi.fn(),
    onRestore: vi.fn(),
    onPermanentDeleteRequest: vi.fn(),
    attachments: {},
    attachmentsOpen: {},
    uploadError: {},
    dragOver: {},
    onToggleAttachments: vi.fn(),
    onUploadFile: vi.fn(),
    onDragOver: vi.fn(),
    onDragLeave: vi.fn(),
    onDrop: vi.fn(),
    onDeleteAttachment: vi.fn(),
    newNoteTitleRef: createRef<HTMLInputElement>(),
    ...overrides,
  };
}

describe('NoteList rendering', () => {
  it('renders every row for a small list (non-virtualized path)', () => {
    const notes = Array.from({ length: 5 }, (_, i) => makeNote(i));
    render(<NoteList {...makeProps({ notes })} />);

    const list = screen.getByRole('list', { name: 'Notes list' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(5);
    expect(screen.getByText('Note 0')).toBeInTheDocument();
    expect(screen.getByText('Note 4')).toBeInTheDocument();
  });

  it('keeps the labelled Notes list landmark', () => {
    const notes = Array.from({ length: 3 }, (_, i) => makeNote(i));
    render(<NoteList {...makeProps({ notes })} />);
    expect(screen.getByRole('list', { name: 'Notes list' })).toBeInTheDocument();
  });
});

describe('NoteList virtualization (large datasets)', () => {
  const LARGE = 500;
  const notes = Array.from({ length: LARGE }, (_, i) => makeNote(i));

  it('renders only a window of rows, not the whole dataset', () => {
    render(<NoteList {...makeProps({ notes })} />);

    const list = screen.getByRole('list', { name: 'Notes list' });
    const rendered = within(list).getAllByRole('listitem');

    // Far fewer DOM rows than notes — that is the whole point of windowing.
    expect(rendered.length).toBeGreaterThan(0);
    expect(rendered.length).toBeLessThan(LARGE);
  });

  it('exposes the full set size and a true 1-based position on each rendered row', () => {
    render(<NoteList {...makeProps({ notes })} />);

    const list = screen.getByRole('list', { name: 'Notes list' });
    const rows = within(list).getAllByRole('listitem');

    for (const row of rows) {
      // Assistive tech is told the real total, not the windowed count.
      expect(row).toHaveAttribute('aria-setsize', String(LARGE));

      // The 1-based position matches the note that row actually renders, so the
      // ordering announced to screen readers stays correct under windowing.
      const title = within(row).getByRole('heading').textContent ?? '';
      const noteIndex = Number(title.replace('Note ', ''));
      expect(row).toHaveAttribute('aria-posinset', String(noteIndex + 1));
    }
  });
});

describe('NoteList non-list states', () => {
  it('shows the empty state when there are no notes', () => {
    render(<NoteList {...makeProps({ showEmptyState: true })} />);
    expect(screen.getByText('No notes yet. Create your first note above!')).toBeInTheDocument();
  });

  it('shows the filtered empty state', () => {
    render(<NoteList {...makeProps({ showEmptyState: true, isFilterActive: true })} />);
    expect(screen.getByText('No notes match your search.')).toBeInTheDocument();
  });

  it('shows the loading skeleton on initial load', () => {
    render(<NoteList {...makeProps({ initialLoading: true })} />);
    expect(screen.getByLabelText('Loading notes')).toBeInTheDocument();
  });
});
