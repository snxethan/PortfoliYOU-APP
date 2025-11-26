import React from "react";
import { X, RotateCw } from 'lucide-react';

import FrameBar from "./FrameBar";

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
        <>
          <FrameBar />
          <div style={{ paddingTop: 36 }} className="fixed inset-0 flex items-center justify-center p-6">
            <div className="surface p-6 border border-[color:var(--border)] rounded-lg shadow-lg max-w-2xl w-full relative">
              {/* Top-right action icons */}
              <div style={{ position: 'absolute', right: 8, top: 8, display: 'flex', gap: 8 }}>
                <button
                  title="Reload"
                  className="btn btn-ghost p-2 w-9 h-9 inline-flex items-center justify-center rounded-md"
                  onClick={() => { try { window.location.reload(); } catch { /* ignore */ } }}
                >
                  <RotateCw size={16} />
                </button>
                <button
                  title="Close"
                  className="btn btn-ghost p-2 w-9 h-9 inline-flex items-center justify-center rounded-md"
                  onClick={() => { try { window.api?.windowClose?.(); } catch { /* ignore */ } }}
                >
                  <X size={16} />
                </button>
              </div>

              <h2 className="text-lg font-semibold mb-2">Something went wrong.</h2>
              <div>
                <div className="text-xs font-semibold">Error</div>
                <pre className="text-xs whitespace-pre-wrap text-[color:var(--fg-muted)]">{String(this.state.error)}</pre>
              </div>
              {this.state.componentStack && (
                <div className="mt-3">
                  <div className="text-xs font-semibold">Component stack</div>
                  <pre className="text-xs whitespace-pre-wrap text-[color:var(--fg-muted)]">{this.state.componentStack}</pre>
                </div>
              )}

              <div className="mt-4 flex gap-2">
                <button
                  className="btn btn-outline"
                  onClick={() => { try { window.api?.toggleDevTools?.(); } catch { /* ignore */ } }}
                >
                  Toggle DevTools
                </button>
              </div>
            </div>
          </div>
        </>
      );
    }
    return this.props.children;
  }
}
