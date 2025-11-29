import React from "react";
import { X, RotateCw, Copy, Terminal } from 'lucide-react';

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
                  title="Copy error and stack"
                  className="btn btn-ghost p-2 w-9 h-9 inline-flex items-center justify-center rounded-md"
                  onClick={() => {
                    try {
                      const err = this.state.error;
                      let errText = '';
                      if (err instanceof Error) {
                        errText = `${err.name}: ${err.message}`;
                        if (err.stack) errText += `\n\n${err.stack}`;
                      } else {
                        errText = String(err);
                      }
                      const comp = this.state.componentStack ? `\n\nComponent stack:\n${this.state.componentStack}` : '';
                      const full = `${errText}${comp}`;
                      try { window.api?.clipboardWrite?.({ text: full }); } catch { navigator.clipboard?.writeText?.(full).catch(() => { }); }
                    } catch { /* ignore */ }
                  }}
                >
                  <Copy size={16} />
                </button>
                <button
                  title="Toggle DevTools"
                  className="btn btn-ghost p-2 w-9 h-9 inline-flex items-center justify-center rounded-md"
                  onClick={() => { try { window.api?.toggleDevTools?.(); } catch { /* ignore */ } }}
                >
                  <Terminal size={16} />
                </button>
                <button
                  title="Refresh Application"
                  className="btn btn-ghost p-2 w-9 h-9 inline-flex items-center justify-center rounded-md"
                  onClick={() => { try { window.location.reload(); } catch { /* ignore */ } }}
                >
                  <RotateCw size={16} />
                </button>
                <button
                  title="Close Application"
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
                <div className="mt-3 relative">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold">Component stack</div>
                    {/* Removed duplicate copy button here; top-right copy copies error + stack */}
                  </div>
                  <pre className="text-xs whitespace-pre-wrap text-[color:var(--fg-muted)] mt-2">{this.state.componentStack}</pre>
                </div>
              )}

              <div className="mt-4 flex gap-2" />
            </div>
          </div>
        </>
      );
    }
    return this.props.children;
  }
}
