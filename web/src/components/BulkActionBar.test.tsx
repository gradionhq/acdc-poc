import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BulkActionBar, type BulkActionBarProps } from './BulkActionBar';

function makeProps(overrides: Partial<BulkActionBarProps> = {}): BulkActionBarProps {
  return {
    count: 2,
    selectAllState: 'some',
    onToggleSelectAll: vi.fn(),
    onClear: vi.fn(),
    onArchive: vi.fn(),
    onTrash: vi.fn(),
    onAddTag: vi.fn(),
    busy: false,
    ...overrides,
  };
}

describe('BulkActionBar', () => {
  it('renders as a labelled toolbar with the selection count', () => {
    render(<BulkActionBar {...makeProps({ count: 3 })} />);
    expect(screen.getByRole('toolbar', { name: 'Bulk actions' })).toBeInTheDocument();
    expect(screen.getByText('3 selected')).toBeInTheDocument();
  });

  it('reflects the select-all "all" state as a checked checkbox', () => {
    render(<BulkActionBar {...makeProps({ selectAllState: 'all' })} />);
    const checkbox = screen.getByRole('checkbox', { name: 'Select all notes on this page' });
    expect(checkbox).toBeChecked();
  });

  it('renders the "some" state as an indeterminate, unchecked checkbox', () => {
    render(<BulkActionBar {...makeProps({ selectAllState: 'some' })} />);
    const checkbox = screen.getByRole<HTMLInputElement>('checkbox', {
      name: 'Select all notes on this page',
    });
    expect(checkbox).not.toBeChecked();
    expect(checkbox.indeterminate).toBe(true);
  });

  it('fires the select-all, clear, archive and trash callbacks', async () => {
    const props = makeProps();
    render(<BulkActionBar {...props} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('checkbox', { name: 'Select all notes on this page' }));
    await user.click(screen.getByRole('button', { name: 'Archive selected notes' }));
    await user.click(screen.getByRole('button', { name: 'Move selected notes to trash' }));
    await user.click(screen.getByRole('button', { name: 'Clear selection' }));

    expect(props.onToggleSelectAll).toHaveBeenCalledTimes(1);
    expect(props.onArchive).toHaveBeenCalledTimes(1);
    expect(props.onTrash).toHaveBeenCalledTimes(1);
    expect(props.onClear).toHaveBeenCalledTimes(1);
  });

  it('submits a trimmed tag via the add-tag form and resets it', async () => {
    const props = makeProps();
    render(<BulkActionBar {...props} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Add a tag to selected notes' }));
    const input = screen.getByRole('textbox', { name: 'Tag to add to selected notes' });
    await user.type(input, '  urgent  ');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(props.onAddTag).toHaveBeenCalledWith('urgent');
    // Form closes after a successful add.
    expect(
      screen.queryByRole('textbox', { name: 'Tag to add to selected notes' }),
    ).not.toBeInTheDocument();
  });

  it('disables the Add button while the tag input is empty', async () => {
    render(<BulkActionBar {...makeProps()} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add a tag to selected notes' }));
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
  });

  it('cancels the add-tag form without firing onAddTag', async () => {
    const props = makeProps();
    render(<BulkActionBar {...props} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Add a tag to selected notes' }));
    await user.type(screen.getByRole('textbox', { name: 'Tag to add to selected notes' }), 'temp');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(props.onAddTag).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('textbox', { name: 'Tag to add to selected notes' }),
    ).not.toBeInTheDocument();
  });

  it('disables every action while busy', () => {
    render(<BulkActionBar {...makeProps({ busy: true })} />);
    expect(screen.getByRole('button', { name: 'Archive selected notes' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move selected notes to trash' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Clear selection' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Select all notes on this page' })).toBeDisabled();
  });
});
