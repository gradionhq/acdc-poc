import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react';
import { X } from 'lucide-react';
import styles from './Modal.module.css';

export interface ModalRenderProps {
  /** The DOM id assigned to the dialog's accessible label (its heading). */
  readonly titleId: string;
}

export interface ModalProps {
  /** Accessible dialog heading, shown in the default header and used as the dialog's label. */
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
  /** Overrides the testid on the dismissable backdrop. Defaults to "modal-backdrop". */
  readonly backdropTestId?: string;
  /**
   * Custom header content rendered in place of the default title + close
   * button. Receives the `titleId` so the supplied heading can wire up
   * `aria-labelledby`. When provided, the default close button is not rendered;
   * the consumer is responsible for any dismiss affordance inside the body.
   */
  readonly renderHeader?: (props: ModalRenderProps) => ReactNode;
  /** Extra class applied to the dialog panel, composed with the base panel style. */
  readonly panelClassName?: string;
  /** When false, the default body wrapper padding is omitted. Defaults to true. */
  readonly padBody?: boolean;
}

const FOCUSABLE_SELECTOR = 'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])';

/**
 * Accessible modal dialog primitive implementing the ARIA APG modal pattern.
 *
 * Renders an overlay containing the dialog panel. The panel carries
 * `role="dialog"` + `aria-modal` semantics and `aria-labelledby` pointing at
 * the heading. The dismissable backdrop is a real `<button>` so its click
 * handler lives on an interactive element. Provides:
 * - Focus moved into the dialog on open (initialFocusRef or first focusable).
 * - A focus trap: Tab/Shift+Tab cycle within the dialog panel.
 * - Escape closes (handled at the document level; the event is stopped so it
 *   does not also reach global shortcut handlers).
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
  backdropTestId = 'modal-backdrop',
  renderHeader,
  panelClassName,
  padBody = true,
}: ModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  // Move focus into the dialog when it opens. Prefer the caller-provided target;
  // otherwise focus the first focusable element.
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    if (initialFocusRef?.current) {
      initialFocusRef.current.focus();
      return;
    }
    panel.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();
  }, [initialFocusRef]);

  // Trap Tab/Shift+Tab focus within the dialog and close on Escape. Both are
  // handled at the document level so the dialog panel stays a non-interactive
  // container with no event listeners of its own.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const panel = panelRef.current;
      if (!panel) return;
      if (e.key === 'Escape') {
        // Stop the event from reaching the global document-level shortcut
        // handler so it does not also act on the Escape (e.g. blurring the
        // trigger that onClose re-focuses).
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusable = panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
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
  }, [onClose]);

  const panelClass = panelClassName ? `${styles.dialog} ${panelClassName}` : styles.dialog;

  return (
    <div className={styles.overlay}>
      {/*
        The dismissable backdrop is a real interactive control rather than a
        non-interactive <div> with a click handler, so it can be activated by
        pointer and keyboard alike.
      */}
      <button
        type="button"
        aria-label="Dismiss dialog by clicking the overlay"
        className={styles.backdrop}
        data-testid={backdropTestId}
        tabIndex={-1}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={panelClass}
      >
        {renderHeader ? (
          renderHeader({ titleId })
        ) : (
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
        )}
        <div className={padBody ? styles.body : undefined}>{children}</div>
      </div>
    </div>
  );
}
