import { useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './components/Button';
import { Modal } from './components/Modal';
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
 * Built on top of the {@link Modal} primitive, which supplies the single shared
 * implementation of the dialog semantics, focus trap, Escape handling and
 * dismissable backdrop. ConfirmDialog only contributes its destructive-action
 * presentation (warning icon, message, confirm/cancel buttons).
 *
 * Accessibility properties:
 * - `role="dialog"` + `aria-modal` via the underlying Modal panel.
 * - `aria-labelledby` points at the visible heading.
 * - The cancel button receives focus when the dialog opens (safe default).
 * - Focus is trapped within the dialog panel: Tab/Shift+Tab cycle between focusable
 *   elements without escaping into the page behind the backdrop.
 * - The Escape key closes the dialog.
 * - Clicking the backdrop area (outside the panel) also cancels.
 * - Focus returns to the trigger element when the dialog closes (handled by the caller).
 */
export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  // Focus the (safe) cancel button when the dialog opens.
  const cancelRef = useRef<HTMLButtonElement>(null);

  return (
    <Modal
      title={title}
      onClose={onCancel}
      initialFocusRef={cancelRef}
      backdropTestId="confirm-dialog-backdrop"
      panelClassName={styles.dialog}
      padBody={false}
      renderHeader={({ titleId }) => (
        <div className={styles.titleRow}>
          <AlertTriangle size={20} className={styles.warningIcon} aria-hidden="true" />
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
        </div>
      )}
    >
      <p className={styles.message}>{message}</p>
      <div className={styles.actions}>
        <Button ref={cancelRef} variant="secondary" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button variant="danger" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
