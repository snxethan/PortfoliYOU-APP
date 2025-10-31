import React from "react";

type Props = { children: React.ReactNode };
type State = { hasError: boolean; error?: unknown; componentStack?: string };

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: unknown) {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error("UI ErrorBoundary caught", error, info);
  this.setState({ componentStack: info?.componentStack || undefined });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6">
          <div className="surface p-4 border border-[color:var(--border)] rounded space-y-3">
            <h2 className="text-lg font-semibold mb-2">Something went wrong.</h2>
            <div>
              <div className="text-xs font-semibold">Error</div>
              <pre className="text-xs whitespace-pre-wrap text-[color:var(--fg-muted)]">{String(this.state.error)}</pre>
            </div>
            {this.state.componentStack && (
              <div>
                <div className="text-xs font-semibold">Component stack</div>
                <pre className="text-xs whitespace-pre-wrap text-[color:var(--fg-muted)]">{this.state.componentStack}</pre>
              </div>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
