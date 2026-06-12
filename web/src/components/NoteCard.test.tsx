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

describe('NoteCard attachment thumbnails', () => {
  function makePropsWithAttachments(
    attachmentList: { filename: string; contentType: string; size: number }[],
  ): NoteCardProps {
    return makeProps({
      attachments: { '1': attachmentList },
      attachmentsOpen: { '1': true },
    });
  }

  it('renders an img thumbnail for an image/png attachment', () => {
    render(
      <ul>
        <NoteCard
          {...makePropsWithAttachments([
            { filename: 'photo.png', contentType: 'image/png', size: 1234 },
          ])}
        />
      </ul>,
    );
    const img = screen.getByRole('img', { name: /thumbnail for photo\.png/i });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).toHaveAttribute('src', expect.stringContaining('photo.png'));
  });

  it('renders an img thumbnail for an image/jpeg attachment', () => {
    render(
      <ul>
        <NoteCard
          {...makePropsWithAttachments([
            { filename: 'shot.jpg', contentType: 'image/jpeg', size: 5678 },
          ])}
        />
      </ul>,
    );
    expect(screen.getByRole('img', { name: /thumbnail for shot\.jpg/i })).toBeInTheDocument();
  });

  it('does not render a thumbnail for a non-image attachment', () => {
    render(
      <ul>
        <NoteCard
          {...makePropsWithAttachments([
            { filename: 'doc.pdf', contentType: 'application/pdf', size: 999 },
          ])}
        />
      </ul>,
    );
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('does not render a thumbnail for text/plain attachment', () => {
    render(
      <ul>
        <NoteCard
          {...makePropsWithAttachments([
            { filename: 'notes.txt', contentType: 'text/plain', size: 42 },
          ])}
        />
      </ul>,
    );
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('renders thumbnails only for image attachments in a mixed list', () => {
    render(
      <ul>
        <NoteCard
          {...makePropsWithAttachments([
            { filename: 'img.png', contentType: 'image/png', size: 100 },
            { filename: 'file.txt', contentType: 'text/plain', size: 50 },
            { filename: 'pic.gif', contentType: 'image/gif', size: 200 },
          ])}
        />
      </ul>,
    );
    // Only img.png and pic.gif should have thumbnails
    const thumbnails = screen.getAllByRole('img');
    expect(thumbnails).toHaveLength(2);
    expect(screen.getByRole('img', { name: /thumbnail for img\.png/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /thumbnail for pic\.gif/i })).toBeInTheDocument();
  });

  it('thumbnail link href matches the download URL', () => {
    render(
      <ul>
        <NoteCard
          {...makePropsWithAttachments([
            { filename: 'image.webp', contentType: 'image/webp', size: 300 },
          ])}
        />
      </ul>,
    );
    const img = screen.getByRole('img', { name: /thumbnail for image\.webp/i });
    const link = img.closest('a');
    expect(link).toHaveAttribute('href', expect.stringContaining('image.webp'));
    expect(link).toHaveAttribute('download', 'image.webp');
    expect(link).toHaveAttribute('aria-label', 'Download thumbnail for image.webp');
  });
});
