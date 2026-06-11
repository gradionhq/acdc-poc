import type { Toast } from './useToast';

interface Props {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}

export function ToastContainer({ toasts, onDismiss }: Props) {
  if (toasts.length === 0) return null;

  return (
    <div aria-live="polite" aria-label="Notifications" className="toast-container">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          aria-label={t.message}
          className={`toast toast--${t.kind}`}
          data-testid="toast"
        >
          <span className="toast__message">{t.message}</span>
          <button
            aria-label={`Dismiss notification: ${t.message}`}
            className="toast__dismiss"
            onClick={() => onDismiss(t.id)}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
