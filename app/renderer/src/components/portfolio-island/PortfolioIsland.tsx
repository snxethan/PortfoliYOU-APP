import { useNavigate, useLocation } from "react-router-dom";
import React, { useMemo, useState, useCallback } from "react";
import { Cloud, UploadCloud, X, Save, FolderOpen, Pin, PinOff, Palette, Settings, Play, Square, Copy, ExternalLink, Eye, RefreshCw, SlidersHorizontal, Bell, BellDot } from "lucide-react";

import { useAuth } from "../../providers/AuthProvider";
import { useProjects } from "../../providers/ProjectsProvider";
import { usePortfolioSettings } from "../../providers/PortfolioSettingsProvider";
import { useNotifications } from "../../providers/NotificationsProvider";
import { getPreviewState } from "../../lib/previewInterop";

export default function PortfolioIsland(): JSX.Element | null {
  const { user } = useAuth();
  const { selectedProject, selectedProjectId, saving, lastSavedAt, saveProject, clearSelection, autosaveEnabled, setAutosaveEnabled } = useProjects();
  const { notifications, add: notify } = useNotifications();
  const { openSettings } = usePortfolioSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const pendingHighlightRef = React.useRef(false);
  const selectedProjectCloudId = selectedProject?._cloudId ?? selectedProjectId ?? (selectedProject as any)?.id ?? null;
  const [pinned, setPinned] = useState<boolean>(() => {
    try { return localStorage.getItem('py_island_pin') === '1'; } catch { return false; }
  });
  const [opacity, setOpacity] = useState<number>(() => {
    try {
      const v = Number(localStorage.getItem('py_island_opacity'));
      if (!v || !Number.isFinite(v)) return 0.95;
      return Math.min(1, Math.max(0.25, v));
    } catch { return 0.95; }
  });
  const savedText = useMemo(() => lastSavedAt ? new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null, [lastSavedAt]);
  const hasSelection = !!selectedProjectCloudId;
  // When on the Home page with no selected portfolio, keep the island mounted
  // but visually hide it to avoid changing hook order during quick selection changes.
  const shouldVisuallyHide = location.pathname === '/' && !hasSelection;
  // When pinned, keep the island positioned beneath the fixed FrameBar (36px / top-9)
  const containerClass = (pinned ? "sticky top-9 z-50 " : "") + "px-4 pt-4";
  // Match quick-settings/editor styles: header labels use 10px, content/actions use 12px
  const labelClass = "text-[10px] uppercase tracking-wide text-[color:var(--fg-muted)]";
  const segmentClass = "flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)]/60 px-3 py-1.5 shadow-sm flex-wrap text-[12px]";
  const actionBtnClass = "btn btn-ghost btn-sm flex items-center gap-1 text-[12px]";
  const statusChip = (
    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[color:var(--border)] bg-[color:var(--muted)]/30 text-[12px] font-semibold text-[color:var(--fg-muted)]">
      {saving ? (
        <>
          <span className="w-3 h-3 border-2 border-[color:var(--border)] border-t-[color:var(--accent)] rounded-full animate-spin"></span>
          Saving…
        </>
      ) : savedText ? (
        <>Saved {savedText}</>
      ) : (
        <>Ready to edit</>
      )}
    </div>
  );

  // Preview server state (updated via global event dispatched by Deploy page)
  const [previewRunningState, setPreviewRunningState] = useState(false);
  const [previewLocalState, setPreviewLocalState] = useState<string | null>(null);
  const [previewLanState, setPreviewLanState] = useState<string | null>(null);
  React.useEffect(() => {
    const applyState = (payload: { running?: boolean; localUrl?: string | null; lanUrl?: string | null }) => {
      setPreviewRunningState(!!payload.running);
      setPreviewLocalState(payload.localUrl || null);
      if (payload.lanUrl && !payload.lanUrl.startsWith('http://127.') && !payload.lanUrl.startsWith('http://localhost')) setPreviewLanState(payload.lanUrl);
      else setPreviewLanState(null);
    };
    const handler = (e: any) => {
      try {
        const d = e?.detail || {};
        const eventProjectId = d.projectId;
        if (eventProjectId && selectedProjectCloudId && eventProjectId !== selectedProjectCloudId) return;
        applyState(d);
      } catch { /* ignore */ }
    };
    window.addEventListener('py:preview:state', handler as EventListener);
    const snapshot = getPreviewState(selectedProjectCloudId);
    if (snapshot) applyState(snapshot);
    else applyState({ running: false, localUrl: null, lanUrl: null });
    return () => window.removeEventListener('py:preview:state', handler as EventListener);
  }, [selectedProjectCloudId]);

  const pct = Math.round(opacity * 100);
  const islandStyle = useMemo(() => {
    // CSS custom properties aren't part of React.CSSProperties' typed keys.
    // Cast via unknown to satisfy TypeScript while keeping values typed.
    return ({ ['--island-opacity']: String(opacity) } as unknown) as React.CSSProperties;
  }, [opacity]);

  const handleGoToList = useCallback(() => {
    navigate('/');
    setTimeout(() => { window.dispatchEvent(new CustomEvent('py:highlight-request')); }, 50);
  }, [navigate]);

  const handleOpenSettings = useCallback((section: 'portfolio' | 'theme' | 'cloud' | 'preview') => {
    if (selectedProjectId) openSettings({ projectId: selectedProjectId, section });
  }, [openSettings, selectedProjectId]);

  const handleNavigate = useCallback((to: string) => {
    if (selectedProjectId) navigate(to);
  }, [navigate, selectedProjectId]);

  const highlightNotifications = useCallback(() => {
    const fire = () => {
      try { window.dispatchEvent(new CustomEvent('py:highlight-notifications', { detail: { origin: 'island' } })); } catch { /* ignore */ }
    };
    // Fire twice to cover the short window before Home mounts after navigation
    window.setTimeout(fire, 80);
    window.setTimeout(fire, 240);
  }, []);

  React.useEffect(() => {
    if (pendingHighlightRef.current && location.pathname === '/') {
      highlightNotifications();
      pendingHighlightRef.current = false;
    }
  }, [location.pathname, highlightNotifications]);

  return (
    <div className={`portfolio-island ${containerClass} ${shouldVisuallyHide ? 'opacity-0 pointer-events-none h-0 overflow-hidden' : ''}`}>
      <div
        className={`surface relative border border-[color:var(--border)] rounded-2xl px-3 py-3 shadow-lg bg-[color:var(--surface)]/80 transition ${hasSelection ? 'ring-2 ring-[color:var(--accent)]/50 ring-offset-2 ring-offset-[color:var(--bg,transparent)]' : ''}`}
        style={islandStyle}
      >
        <div className="flex flex-wrap items-center gap-2 w-full">
          <button
            type="button"
            className="flex min-w-[200px] max-w-full flex-col text-left rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)]/70 px-4 py-2 shadow-sm hover:border-[color:var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)] transition"
            title="Go to portfolios list"
            onClick={handleGoToList}
          >
            <span className="text-base font-semibold leading-tight truncate">
              {selectedProject ? selectedProject.name : 'No Portfolio Selected'}
            </span>
          </button>

          {/* Compact controls next to project name: settings + theme (icon-only) */}
          <div className="ml-2 flex items-center gap-1">
            <button
              type="button"
              className={`btn btn-ghost p-2 w-9 h-9 inline-flex items-center justify-center rounded-md text-[color:var(--fg-muted)]`}
              disabled={!hasSelection}
              title="Portfolio settings"
              onClick={() => handleOpenSettings('portfolio')}
            >
              <Settings size={16} />
            </button>
            <button
              type="button"
              className={`btn btn-ghost p-2 w-9 h-9 inline-flex items-center justify-center rounded-md text-[color:var(--fg-muted)]`}
              disabled={!hasSelection}
              title="Theme settings"
              onClick={() => handleOpenSettings('theme')}
            >
              <Palette size={16} />
            </button>
          </div>

          <span className="hidden sm:inline-block w-px h-6 bg-[color:var(--border)]" aria-hidden="true"></span>

          <div className={segmentClass}>
            <span className={labelClass}>Preview</span>
            {!previewRunningState ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  title="Start local preview"
                  aria-label="Start preview"
                  className="btn btn-accent btn-sm flex items-center gap-2 text-[12px] font-semibold shadow-lg shadow-[color:var(--accent)]/25"
                  disabled={!hasSelection}
                  onClick={async () => {
                    if (!hasSelection) return;
                    window.dispatchEvent(new CustomEvent('py:preview-start-request', { detail: { projectId: selectedProjectCloudId } }));
                    navigate('/deploy');
                  }}
                >
                  <Play size={14} />
                  <span>Start</span>
                </button>
                <button
                  type="button"
                  title="Preview settings"
                  aria-label="Preview settings"
                  className={actionBtnClass + ' ml-auto'}
                  disabled={!hasSelection}
                  onClick={() => handleOpenSettings('preview')}
                >
                  <SlidersHorizontal size={14} />
                  <span>Preview Settings</span>
                </button>

              </div>
            ) : (
              <>
                <button
                  type="button"
                  title="Stop preview (handled by Deployer)"
                  aria-label="Stop preview"
                  className="btn btn-danger btn-sm flex items-center gap-2 text-[12px] font-semibold"
                  onClick={() => {
                    try { window.dispatchEvent(new CustomEvent('py:preview-stop-request', { detail: { projectId: selectedProjectCloudId } })); } catch { /* ignore */ }
                  }}
                >
                  <Square size={14} className="text-[color:var(--danger)]" aria-hidden="true" />
                  <span>Stop</span>
                </button>

                {previewLocalState && (
                  <>
                    <button
                      type="button"
                      title="Reload preview (rebuild + restart)"
                      aria-label="Reload preview"
                      className={actionBtnClass}
                      onClick={() => {
                        if (!hasSelection) return;
                        notify({ type: 'info', message: 'Reloading preview…', persistent: false });
                        navigate('/deploy');
                        try { window.dispatchEvent(new CustomEvent('py:preview-reload-request', { detail: { projectId: selectedProjectCloudId } })); } catch { /* ignore */ }
                      }}
                    >
                      <RefreshCw size={14} />
                      <span>Reload</span>
                    </button>
                    <a
                      title="Open preview in browser"
                      aria-label="Open preview"
                      href={previewLocalState || undefined}
                      target="_blank"
                      rel="noreferrer"
                      className={actionBtnClass}
                      onClick={async (e) => {
                        try {
                          e.preventDefault();
                          if (!previewLocalState) return;
                          await (window as any).api?.openExternal?.({ url: previewLocalState });
                        } catch { /* ignore */ }
                      }}
                    >
                      <Eye size={14} />
                      <span>Open</span>
                    </a>
                    {previewLanState ? (
                      <a title="Open LAN preview" aria-label="Open LAN preview" href={previewLanState} target="_blank" rel="noreferrer" className={actionBtnClass}>
                        <ExternalLink size={14} />
                        <span>Open LAN</span>
                      </a>
                    ) : (
                      <button type="button" title="Open LAN preview (not available)" aria-label="Open LAN preview" className={actionBtnClass} disabled>
                        <ExternalLink size={14} />
                        <span>Open LAN</span>
                      </button>
                    )}
                    {/* move preview settings to the far right of this segment */}
                    <button type="button" title="Preview settings" aria-label="Preview settings" className={actionBtnClass + ' ml-auto'} onClick={() => handleOpenSettings('preview')}>
                      <SlidersHorizontal size={14} />
                      <span>Preview Settings</span>
                    </button>
                  </>
                )}
              </>
            )}
          </div>

          {user && selectedProject?._synced && (
            <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-[color:var(--border)] bg-[color:var(--muted)]/30 text-[11px] text-[color:var(--accent)]">
              <Cloud size={12} />
              Cloud linked
            </div>
          )}
          <div className="flex flex-col items-end gap-2 ml-auto">
            <div className="flex items-center gap-1">
              {pinned && (
                <div className="flex items-center gap-2 px-2">
                  <label className="text-[10px] text-[color:var(--fg-muted)]">Opacity</label>
                  <div
                    className="island-opacity-slider-shell w-28"
                    style={{ ['--island-slider-fill' as unknown as string]: `${pct}%` } as React.CSSProperties}
                  >
                    <div className="island-opacity-slider-track">
                      <div className="island-opacity-slider-fill" />
                    </div>
                    <input
                      aria-label="Portfolio island opacity"
                      title="Adjust portfolio island opacity"
                      type="range"
                      min={25}
                      max={100}
                      step={5}
                      value={pct}
                      className="island-opacity-slider"
                      onChange={(e) => {
                        const raw = Number((e.target as HTMLInputElement).value);
                        const next = Math.min(100, Math.max(25, raw)) / 100;
                        setOpacity(next);
                        try { localStorage.setItem('py_island_opacity', String(next)); } catch { /* ignore */ }
                      }}
                    />
                  </div>
                  <div className="text-[11px] text-[color:var(--fg-muted)]">{Math.round(opacity * 100)}%</div>
                </div>
              )}
              <button
                type="button"
                className={`btn btn-ghost p-2 w-9 h-9 inline-flex items-center justify-center rounded-md text-[color:var(--fg-muted)]`}
                title={pinned ? "Unpin island from top" : "Pin island to top"}
                aria-pressed={pinned}
                onClick={() => setPinned(prev => {
                  const next = !prev;
                  try { localStorage.setItem('py_island_pin', next ? '1' : '0'); } catch { /* ignore */ }
                  return next;
                })}
              >
                {pinned ? <Pin size={16} /> : <PinOff size={16} />}
              </button>
              <button
                type="button"
                className={`btn btn-ghost p-2 w-9 h-9 inline-flex items-center justify-center rounded-md text-[color:var(--fg-muted)]`}
                disabled={!hasSelection}
                title="Close current portfolio"
                onClick={() => {
                  try { window.dispatchEvent(new CustomEvent('py:preview-stop-request', { detail: { projectId: selectedProjectCloudId } })); } catch { /* ignore */ }
                  clearSelection();
                  navigate('/');
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* saving / notification indicator moved to bottom-right */}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {/* Compile section: holds export and build settings */}
          <div className={segmentClass}>
            <span className={labelClass}>Compile</span>
            <button
              type="button"
              className="btn btn-accent btn-sm flex items-center gap-2 text-[12px] font-semibold shadow-lg shadow-[color:var(--accent)]/25"
              disabled={!hasSelection}
              onClick={() => {
                if (!hasSelection) return;
                window.dispatchEvent(new CustomEvent('py:export-request', { detail: { projectId: selectedProjectCloudId } }));
                navigate('/deploy');
              }}
              title="Export project"
            >
              <ExternalLink size={14} />
              Export
            </button>
            <button
              type="button"
              className={actionBtnClass + ' ml-auto'}
              disabled={!hasSelection}
              onClick={() => openSettings({ projectId: selectedProjectId || (selectedProject as any)?.id, section: 'build' })}
              title="Build settings"
            >
              <SlidersHorizontal size={14} />
              <span>Build Settings</span>
            </button>
          </div>

          <div className={segmentClass}>
            <span className={labelClass}>Files</span>
            <button
              type="button"
              className={actionBtnClass}
              disabled={!selectedProject?._filePath}
              onClick={async () => {
                if (selectedProject?._filePath && window.api?.showItemInFolder) {
                  await window.api.showItemInFolder({ filePath: selectedProject._filePath });
                }
              }}
              title="Open project folder"
            >
              <FolderOpen size={14} />
              Open
            </button>

            <button
              type="button"
              className={actionBtnClass}
              disabled={!hasSelection}
              onClick={() => selectedProjectId && saveProject(selectedProjectId)}
              title="Save project"
            >
              <Save size={14} />
              Save
            </button>
            <button
              type="button"
              className={`${actionBtnClass} relative ${autosaveEnabled ? '' : 'text-[color:var(--fg-muted)]'}`}
              disabled={!hasSelection}
              aria-pressed={autosaveEnabled}
              onClick={() => setAutosaveEnabled(!autosaveEnabled)}
              title={autosaveEnabled ? 'Disable autosave' : 'Enable autosave'}
            >
              <span className="relative inline-flex items-center justify-center">
                <Save size={14} />
                {!autosaveEnabled && (
                  <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="w-4/5 h-[2px] bg-current rotate-45 origin-center"></span>
                  </span>
                )}
              </span>
              Autosave
            </button>
            {/* Move Save settings to the far right of the Files segment */}
            <button
              type="button"
              className={actionBtnClass + ' ml-auto'}
              disabled={!hasSelection}
              onClick={() => { if (selectedProjectId) openSettings({ projectId: selectedProjectId, section: 'saving' }); }}
              title="Save settings"
            >
              <SlidersHorizontal size={14} />
              Save settings
            </button>
          </div>
        </div>

        {!hasSelection && (
          <p className="mt-3 text-xs text-[color:var(--fg-muted)]">
            Pick a portfolio from Home to enable the quick-launch controls.
          </p>
        )}
        {/* Bottom-right status indicator + notifications button */}
        <div className="absolute right-3 bottom-3 flex items-center gap-2">
          {statusChip}
          <button
            type="button"
            title="Notifications"
            aria-label="Notifications"
            className={`btn btn-ghost p-2 w-9 h-9 inline-flex items-center justify-center rounded-md text-[color:var(--fg-muted)] relative`}
            onClick={() => {
              try {
                if (location.pathname !== '/') {
                  pendingHighlightRef.current = true;
                  navigate('/');
                } else {
                  highlightNotifications();
                }
              } catch { /* ignore */ }
            }}
          >
            {notifications && notifications.length > 0 ? <BellDot size={16} /> : <Bell size={16} />}
            {notifications && notifications.length > 0 && (
              <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-4 h-4 px-1 text-[10px] rounded-full bg-[color:var(--accent)] text-black border border-[color:var(--accent-700)]">{notifications.length}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}