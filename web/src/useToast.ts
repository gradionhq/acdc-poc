import { useCallback, useRef, useState } from 'react';

export type ToastKind = 'success' | 'error';

export interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
}

const AUTO_DISMISS_MS = 4000;

export interface UseToastResult {
  toasts: Toast[];
  addToast: (message: string, kind: ToastKind) => void;
  dismissToast: (id: number) => void;
}

export function useToast(): UseToastResult {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (message: string, kind: ToastKind) => {
      const id = ++nextId.current;
      setToasts((prev) => [...prev, { id, message, kind }]);
      setTimeout(() => {
        dismissToast(id);
      }, AUTO_DISMISS_MS);
    },
    [dismissToast],
  );

  return { toasts, addToast, dismissToast };
}
