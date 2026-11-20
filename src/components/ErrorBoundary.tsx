import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  error: Error | null;
}

/** Last-resort catch so a rendering bug shows a calm message instead of a blank screen. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) console.error(error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg p-6">
        <div className="card max-w-md text-center" role="alert">
          <h1 className="text-xl">Something went wrong on this screen</h1>
          <p className="mt-2 text-muted">Your saved data is safe. Reloading usually fixes this.</p>
          <button
            type="button"
            className="mt-5 inline-flex min-h-11 items-center rounded-input bg-accent-strong px-4 font-medium text-accent-fg hover:bg-accent-hover"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
