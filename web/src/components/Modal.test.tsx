import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { Modal } from './Modal';

describe('Modal', () => {
  it('renders with role="dialog" and aria-modal="true"', () => {
    render(
      <Modal title="New note" onClose={vi.fn()}>
        <p>body</p>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('is labelled by its heading (aria-labelledby)', () => {
    render(
      <Modal title="New note" onClose={vi.fn()}>
        <p>body</p>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog');
    const labelId = dialog.getAttribute('aria-labelledby');
    expect(labelId).toBeTruthy();
    expect(document.getElementById(labelId!)?.textContent).toBe('New note');
  });

  it('calls onClose when the close button is clicked', async () => {
    const onClose = vi.fn();
    render(
      <Modal title="New note" onClose={onClose}>
        <p>body</p>
      </Modal>,
    );
    await userEvent.click(screen.getByRole('button', { name: /close dialog/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when Escape is pressed', async () => {
    const onClose = vi.fn();
    render(
      <Modal title="New note" onClose={onClose}>
        <p>body</p>
      </Modal>,
    );
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when the backdrop is clicked', async () => {
    const onClose = vi.fn();
    render(
      <Modal title="New note" onClose={onClose}>
        <p>body</p>
      </Modal>,
    );
    await userEvent.click(screen.getByTestId('modal-backdrop'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does NOT call onClose when clicking inside the dialog panel', async () => {
    const onClose = vi.fn();
    render(
      <Modal title="New note" onClose={onClose}>
        <p>inside panel</p>
      </Modal>,
    );
    await userEvent.click(screen.getByText('inside panel'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('moves focus to the first focusable element on open', () => {
    render(
      <Modal title="New note" onClose={vi.fn()}>
        <p>body</p>
      </Modal>,
    );
    // The close button is the first focusable element.
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /close dialog/i }));
  });

  it('moves focus to the provided initialFocusRef on open', () => {
    const inputRef = createRef<HTMLInputElement>();
    render(
      <Modal title="New note" onClose={vi.fn()} initialFocusRef={inputRef}>
        <input ref={inputRef} aria-label="Field" />
      </Modal>,
    );
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Field' }));
  });

  it('traps focus: Tab from the last focusable wraps to the first', async () => {
    render(
      <Modal title="New note" onClose={vi.fn()}>
        <button type="button">Action</button>
      </Modal>,
    );
    const closeBtn = screen.getByRole('button', { name: /close dialog/i });
    const actionBtn = screen.getByRole('button', { name: 'Action' });
    actionBtn.focus();
    expect(document.activeElement).toBe(actionBtn);
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(closeBtn);
  });

  it('traps focus: Shift+Tab from the first focusable wraps to the last', async () => {
    render(
      <Modal title="New note" onClose={vi.fn()}>
        <button type="button">Action</button>
      </Modal>,
    );
    const closeBtn = screen.getByRole('button', { name: /close dialog/i });
    const actionBtn = screen.getByRole('button', { name: 'Action' });
    closeBtn.focus();
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
    expect(document.activeElement).toBe(actionBtn);
  });

  it('renders a custom close label', () => {
    render(
      <Modal title="New note" onClose={vi.fn()} closeLabel="Dismiss">
        <p>body</p>
      </Modal>,
    );
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
  });
});
