import { createRef } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
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

function makePinned(i: number): Note {
  return { ...makeNote(i), pinned: true };
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

describe('NoteList selection plumbing', () => {
  it('renders a selection checkbox per note and forwards toggles', async () => {
    const onToggleSelect = vi.fn();
    render(
      <NoteList
        {...makeProps({
          notes: [makeNote(1), makeNote(2)],
          selectable: true,
          isSelected: (id) => id === '1',
          onToggleSelect,
        })}
      />,
    );

    const checkboxes = screen.getAllByRole('checkbox', { name: /select note/i });
    expect(checkboxes).toHaveLength(2);
    // First note is selected per the predicate.
    expect(checkboxes[0]).toBeChecked();
    expect(checkboxes[1]).not.toBeChecked();

    const { default: userEvent } = await import('@testing-library/user-event');
    await userEvent.click(checkboxes[1]);
    expect(onToggleSelect).toHaveBeenCalledWith('2');
  });

  it('renders no checkboxes when not selectable', () => {
    render(<NoteList {...makeProps({ notes: [makeNote(1)] })} />);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
});

describe('NoteList pinned reordering', () => {
  it('shows reorder controls for each pinned note when 2+ are pinned', () => {
    const onReorderPin = vi.fn();
    render(
      <NoteList
        {...makeProps({ notes: [makePinned(1), makePinned(2), makeNote(3)], onReorderPin })}
      />,
    );
    // Drag handles + move buttons appear for the two pinned notes, not the plain one.
    expect(screen.getAllByRole('button', { name: /drag to reorder/i })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: /move note \d+ up/i })).toHaveLength(2);
  });

  it('shows no reorder controls when only one note is pinned', () => {
    render(
      <NoteList {...makeProps({ notes: [makePinned(1), makeNote(2)], onReorderPin: vi.fn() })} />,
    );
    expect(screen.queryByRole('button', { name: /drag to reorder/i })).not.toBeInTheDocument();
  });

  it('shows no reorder controls when onReorderPin is absent', () => {
    render(<NoteList {...makeProps({ notes: [makePinned(1), makePinned(2)] })} />);
    expect(screen.queryByRole('button', { name: /drag to reorder/i })).not.toBeInTheDocument();
  });

  it('shows no reorder controls in selection mode', () => {
    render(
      <NoteList
        {...makeProps({
          notes: [makePinned(1), makePinned(2)],
          onReorderPin: vi.fn(),
          selectable: true,
        })}
      />,
    );
    expect(screen.queryByRole('button', { name: /drag to reorder/i })).not.toBeInTheDocument();
  });

  it('disables Move up on the first pinned note and Move down on the last', () => {
    render(
      <NoteList {...makeProps({ notes: [makePinned(1), makePinned(2)], onReorderPin: vi.fn() })} />,
    );
    expect(screen.getByRole('button', { name: 'Move Note 1 up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move Note 1 down' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Move Note 2 up' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Move Note 2 down' })).toBeDisabled();
  });

  it('forwards a keyboard move down with the note id and direction', async () => {
    const onReorderPin = vi.fn();
    render(<NoteList {...makeProps({ notes: [makePinned(1), makePinned(2)], onReorderPin })} />);
    const { default: userEvent } = await import('@testing-library/user-event');
    await userEvent.click(screen.getByRole('button', { name: 'Move Note 1 down' }));
    expect(onReorderPin).toHaveBeenCalledWith('1', { direction: 'down' });
  });

  it('forwards a keyboard move up with the note id and direction', async () => {
    const onReorderPin = vi.fn();
    render(<NoteList {...makeProps({ notes: [makePinned(1), makePinned(2)], onReorderPin })} />);
    const { default: userEvent } = await import('@testing-library/user-event');
    await userEvent.click(screen.getByRole('button', { name: 'Move Note 2 up' }));
    expect(onReorderPin).toHaveBeenCalledWith('2', { direction: 'up' });
  });

  it('forwards a drag-and-drop reorder with the dragged and target ids', () => {
    const onReorderPin = vi.fn();
    render(
      <NoteList
        {...makeProps({ notes: [makePinned(1), makePinned(2), makePinned(3)], onReorderPin })}
      />,
    );
    const handles = screen.getAllByRole('button', { name: /drag to reorder/i });
    const rows = within(screen.getByRole('list', { name: 'Notes list' })).getAllByRole('listitem');

    // Drag note 1 (first handle) and drop it on note 3 (third row).
    fireEvent.dragStart(handles[0]);
    fireEvent.dragOver(rows[2]);
    fireEvent.drop(rows[2]);

    expect(onReorderPin).toHaveBeenCalledWith('1', { targetId: '3' });
  });
});
