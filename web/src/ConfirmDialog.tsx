import { useEffect, useRef } from 'react';
import { Button } from './components/Button';
import styles from './ConfirmDialog.module.css';

export interface ConfirmDialogProps {
  /** Dialog heading — shown prominently at the top. */
  readonly title: string;
  /** Descriptive message explaining what will happen. */
  readonly message: string;
  /** Label for the confirm (destructive) button. Defaults to "Confirm". */
  readonly confirmLabel?: string;
  /** Label for the cancel button. Defaults to "Cancel". */
  readonly cancelLabel?: string;
  /** Called when the user clicks the confirm button. */
  readonly onConfirm: () => void;
  /** Called when the user clicks cancel, presses Escape, or clicks the backdrop. */
  readonly onCancel: () => void;
}

/**
 * Accessible in-app confirmation dialog, implementing the ARIA APG modal dialog pattern.
 *
 * Uses the native `<dialog>` element so the browser supplies `role="dialog"`,
 * `aria-modal`, and built-in Escape handling automatically.
 *
 * Accessibility properties:
 * - Native `<dialog>` element so screen readers treat it as a modal.
 * - `aria-labelledby` points at the visible heading.
 * - The cancel button receives `autoFocus` so focus moves into the dialog on mount.
 * - Focus is trapped within the dialog panel: Tab/Shift+Tab cycle between focusable
 *   elements without escaping into the page behind the backdrop.
 * - The Escape key closes the dialog (handled via `onKeyDown` on the dialog element).
 * - Clicking the backdrop area (outside the panel) also cancels.
 * - Focus returns to the trigger element when the dialog closes (handled by the caller
 *   via `deleteTriggerRef`).
 */
export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = 'confirm-dialog-title';
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Trap Tab/Shift+Tab focus within the dialog.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  /**
   * Dismiss the dialog when the user clicks outside the panel content.
   * The native `<dialog>` element fills the viewport, so a click whose target
   * is the `<dialog>` itself (i.e. the backdrop area) means the user clicked
   * outside the inner panel div.
   */
  function handleBackdropClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === dialogRef.current) {
      onCancel();
    }
  }

  return (
    // The native <dialog> element renders with role="dialog" and is a
    // recognised interactive element, so click + keyboard handlers are valid.
    <dialog
      ref={dialogRef}
      aria-modal="true"
      aria-labelledby={titleId}
      className={styles.backdrop}
      data-testid="confirm-dialog-backdrop"
      onClick={handleBackdropClick}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onCancel();
      }}
      open
    >
      <div className={styles.dialog}>
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        <p className={styles.message}>{message}</p>
        <div className={styles.actions}>
          {/* autoFocus moves focus into the dialog when it opens (cancel is safe default). */}
          <Button variant="secondary" autoFocus onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
