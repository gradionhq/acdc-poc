import { Component, type ErrorInfo, type ReactNode } from 'react';
import styles from './ErrorBoundary.module.css';
import { Button } from './Button';

interface Props {
  children: ReactNode;
  /**
   * Optional hook invoked whenever the boundary catches a render error.
   * Used to report the failure to the user (e.g. via a toast) and/or logging.
   */
  onError?: (error: Error, info: ErrorInfo) => void;
  /**
   * Reload handler for the recovery action. Defaults to a full page reload.
   * Injectable so tests can assert it is called without navigating jsdom.
   */
  onReload?: () => void;
}

interface State {
  hasError: boolean;
}

/**
 * Global error boundary. Catches render-time errors thrown by any descendant
 * and replaces the crashed subtree with a friendly, recoverable fallback that
 * offers a reload. Errors are also surfaced via the optional `onError` hook so
 * the app can report them (toast) and/or log them.
 *
 * Implemented as a class component because React only supports error
 * boundaries through the `getDerivedStateFromError` / `componentDidCatch`
 * lifecycle, which has no hooks equivalent.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info);
  }

  private readonly handleReload = (): void => {
    if (this.props.onReload) {
      this.props.onReload();
      return;
    }
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className={styles.fallback} role="alert">
          <div className={styles.panel}>
            <h1 className={styles.title}>Something went wrong</h1>
            <p className={styles.message}>
              An unexpected error interrupted the app. Reloading usually fixes it. If the problem
              keeps happening, please try again later.
            </p>
            <Button type="button" variant="primary" onClick={this.handleReload}>
              Reload the page
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
