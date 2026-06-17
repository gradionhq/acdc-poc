import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react';
import { X } from 'lucide-react';
import styles from './Modal.module.css';

export interface ModalProps {
  /** Accessible dialog heading, shown at the top and used as the dialog's label. */
  readonly title: string;
  /**
   * Called when the user dismisses the dialog via the close button, the
   * Escape key, or a backdrop click. The caller is responsible for restoring
   * focus to the trigger element.
   */
  readonly onClose: () => void;
  /** Dialog body content. */
  readonly children: ReactNode;
  /** Accessible label for the close button. Defaults to "Close dialog". */
  readonly closeLabel?: string;
  /**
   * Element to receive focus when the dialog opens. When omitted, focus moves
   * to the first focusable element in the dialog.
   */
  readonly initialFocusRef?: RefObject<HTMLElement>;
}

/**
 * Accessible modal dialog primitive implementing the ARIA APG modal pattern.
 *
 * Uses the native `<dialog>` element so the browser supplies `role="dialog"`
 * and `aria-modal` semantics. Provides:
 * - `aria-labelledby` pointing at the visible heading.
 * - Focus moved into the dialog on open (first focusable element).
 * - A focus trap: Tab/Shift+Tab cycle within the dialog panel.
 * - Escape closes (the event is stopped so it does not reach global handlers).
 * - Backdrop click closes.
 *
 * Focus restoration to the triggering element is the caller's responsibility
 * (it should re-focus the trigger inside `onClose`).
 */
export function Modal({
  title,
  onClose,
  children,
  closeLabel = 'Close dialog',
  initialFocusRef,
}: ModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Move focus into the dialog when it opens. Prefer the caller-provided target;
  // otherwise focus the first focusable element.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (initialFocusRef?.current) {
      initialFocusRef.current.focus();
      return;
    }
    const focusable = dialog.querySelector<HTMLElement>(
      'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus();
  }, [initialFocusRef]);

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
   * Dismiss when the user clicks outside the inner panel. The native `<dialog>`
   * fills the viewport, so a click whose target is the `<dialog>` itself means
   * the user clicked the backdrop area rather than the panel content.
   */
  function handleBackdropClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === dialogRef.current) {
      onClose();
    }
  }

  return (
    // The native <dialog> renders with role="dialog" and is a recognised
    // interactive element, so click + keyboard handlers are valid here.
    <dialog
      ref={dialogRef}
      aria-modal="true"
      aria-labelledby={titleId}
      className={styles.backdrop}
      data-testid="modal-backdrop"
      onClick={handleBackdropClick}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          // Stop the event from reaching the global document-level shortcut
          // handler so it does not also act on the Escape (e.g. blurring the
          // trigger that onClose re-focuses).
          e.stopPropagation();
          onClose();
        }
      }}
      open
    >
      <div className={styles.dialog}>
        <div className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <button
            type="button"
            aria-label={closeLabel}
            className={styles.closeButton}
            onClick={onClose}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className={styles.body}>{children}</div>
      </div>
    </dialog>
  );
}
