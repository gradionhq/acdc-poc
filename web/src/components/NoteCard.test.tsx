import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NoteCard, type NoteCardProps } from './NoteCard';
import type { NoteColor } from '../api';

function makeProps(overrides: Partial<NoteCardProps> = {}): NoteCardProps {
  return {
    note: {
      id: '1',
      title: 'Test Note',
      body: 'Test body',
      tags: [],
      pinned: false,
      archived: false,
      color: 'none' as NoteColor,
      deletedAt: null,
    },
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
    ...overrides,
  };
}

describe('NoteCard overflow menu', () => {
  it('overflow trigger has aria-haspopup="menu" and aria-expanded=false when closed', () => {
    render(
      <ul>
        <NoteCard {...makeProps()} />
      </ul>,
    );
    const trigger = screen.getByRole('button', { name: /more actions/i });
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('overflow trigger has aria-expanded=true when menu is open', async () => {
    render(
      <ul>
        <NoteCard {...makeProps()} />
      </ul>,
    );
    const trigger = screen.getByRole('button', { name: /more actions/i });
    await userEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('closes the menu and returns focus when Escape is pressed', async () => {
    render(
      <ul>
        <NoteCard {...makeProps()} />
      </ul>,
    );
    const trigger = screen.getByRole('button', { name: /more actions/i });
    await userEvent.click(trigger);
    expect(screen.getByRole('menu')).toBeInTheDocument();

    // Pressing Escape at the document level should close the menu
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    // Focus should return to the trigger button
    expect(document.activeElement).toBe(trigger);
  });

  it('closes the menu when clicking outside', async () => {
    render(
      <div>
        <button type="button">Outside</button>
        <ul>
          <NoteCard {...makeProps()} />
        </ul>
      </div>,
    );
    const trigger = screen.getByRole('button', { name: /more actions/i });
    await userEvent.click(trigger);
    expect(screen.getByRole('menu')).toBeInTheDocument();

    // Click outside the menu
    fireEvent.mouseDown(screen.getByRole('button', { name: /outside/i }));

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('does not close the menu when clicking inside the menu', async () => {
    render(
      <ul>
        <NoteCard {...makeProps()} />
      </ul>,
    );
    const trigger = screen.getByRole('button', { name: /more actions/i });
    await userEvent.click(trigger);
    const menu = screen.getByRole('menu');
    expect(menu).toBeInTheDocument();

    // Clicking inside the menu should not close it
    fireEvent.mouseDown(menu);

    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('duplicate action closes menu and calls onDuplicate', async () => {
    const onDuplicate = vi.fn();
    render(
      <ul>
        <NoteCard {...makeProps({ onDuplicate })} />
      </ul>,
    );
    const trigger = screen.getByRole('button', { name: /more actions/i });
    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole('menuitem', { name: /duplicate/i }));

    expect(onDuplicate).toHaveBeenCalledWith('1');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
