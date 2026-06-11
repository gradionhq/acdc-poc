import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from './ConfirmDialog';

describe('ConfirmDialog', () => {
  it('renders with role="dialog" and aria-modal="true"', () => {
    render(
      <ConfirmDialog
        title="Delete note"
        message="Are you sure?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('renders the title and message', () => {
    render(
      <ConfirmDialog
        title="Remove item"
        message="This cannot be undone."
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText('Remove item')).toBeInTheDocument();
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument();
  });

  it('is labelled by its heading (aria-labelledby)', () => {
    render(
      <ConfirmDialog
        title="Delete note"
        message="Are you sure?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const dialog = screen.getByRole('dialog');
    const labelId = dialog.getAttribute('aria-labelledby');
    expect(labelId).toBeTruthy();
    const heading = document.getElementById(labelId!);
    expect(heading?.textContent).toBe('Delete note');
  });

  it('renders custom confirmLabel and cancelLabel', () => {
    render(
      <ConfirmDialog
        title="Title"
        message="Msg"
        confirmLabel="Yes, delete"
        cancelLabel="No, keep"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Yes, delete' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'No, keep' })).toBeInTheDocument();
  });

  it('renders default "Confirm" / "Cancel" button labels when not provided', () => {
    render(<ConfirmDialog title="Title" message="Msg" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('calls onConfirm when the confirm button is clicked', async () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog title="Title" message="Msg" onConfirm={onConfirm} onCancel={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('calls onCancel when the cancel button is clicked', async () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog title="Title" message="Msg" onConfirm={vi.fn()} onCancel={onCancel} />);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('calls onCancel when Escape is pressed', async () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog title="Title" message="Msg" onConfirm={vi.fn()} onCancel={onCancel} />);
    await userEvent.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('calls onCancel when the backdrop is clicked', async () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog title="Title" message="Msg" onConfirm={vi.fn()} onCancel={onCancel} />);
    await userEvent.click(screen.getByTestId('confirm-dialog-backdrop'));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('does NOT call onCancel when clicking inside the dialog panel', async () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog title="Title" message="Msg" onConfirm={vi.fn()} onCancel={onCancel} />);
    // Click on the message text inside the dialog — should not trigger cancel.
    await userEvent.click(screen.getByText('Msg'));
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('moves focus to the cancel button on mount', () => {
    render(<ConfirmDialog title="Title" message="Msg" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    expect(document.activeElement).toBe(cancelBtn);
  });

  it('traps focus: Tab from last button wraps to first button', async () => {
    render(<ConfirmDialog title="Title" message="Msg" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    const confirmBtn = screen.getByRole('button', { name: 'Confirm' });
    // Move focus to last button (Confirm).
    confirmBtn.focus();
    expect(document.activeElement).toBe(confirmBtn);
    // Tab should wrap to first button (Cancel).
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(cancelBtn);
  });

  it('traps focus: Shift+Tab from first button wraps to last button', async () => {
    render(<ConfirmDialog title="Title" message="Msg" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    const confirmBtn = screen.getByRole('button', { name: 'Confirm' });
    // Focus is already on Cancel (first) via autoFocus.
    expect(document.activeElement).toBe(cancelBtn);
    // Shift+Tab should wrap to last button (Confirm).
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
    expect(document.activeElement).toBe(confirmBtn);
  });
});
