import { useCallback, type ReactNode } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { ToastContainer } from '../ToastContainer';
import { useToast } from '../useToast';

interface Props {
  children: ReactNode;
}

/**
 * App-level wrapper around {@link ErrorBoundary} that reports caught render
 * errors via a toast. Owns its own toast instance (and container) so it works
 * standalone at the very top of the tree, independent of the toasts managed
 * inside `App`. Kept as a thin wrapper so the app entry (`main.tsx`) stays a
 * minimal one-line change.
 */
export function AppErrorBoundary({ children }: Props) {
  const { toasts, addToast, dismissToast } = useToast();

  const handleError = useCallback(
    (error: Error) => {
      addToast(`Something went wrong: ${error.message}`, 'error');
    },
    [addToast],
  );

  return (
    <>
      <ErrorBoundary onError={handleError}>{children}</ErrorBoundary>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
