import type { ReactElement } from 'react';
import { CheckCircle2, XCircle, X } from 'lucide-react';
import type { Toast } from './useToast';

interface Props {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}

const KIND_ICONS: Record<Toast['kind'], ReactElement> = {
  success: (
    <CheckCircle2 size={16} aria-hidden="true" className="toast__icon toast__icon--success" />
  ),
  error: <XCircle size={16} aria-hidden="true" className="toast__icon toast__icon--error" />,
};

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
          {KIND_ICONS[t.kind]}
          <span className="toast__message">{t.message}</span>
          <button
            aria-label={`Dismiss notification: ${t.message}`}
            className="toast__dismiss"
            onClick={() => onDismiss(t.id)}
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}
