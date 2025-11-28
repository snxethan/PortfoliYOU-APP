import { useNavigate, useLocation } from "react-router-dom";
import React, { useMemo, useState, useCallback } from "react";
import { Cloud, UploadCloud, Wrench, X, Save, FolderOpen, Pin, PinOff, Palette, Settings2, Play, Square, Copy, ExternalLink, Eye } from "lucide-react";

import { useAuth } from "../../providers/AuthProvider";
import { useProjects } from "../../providers/ProjectsProvider";
import { usePortfolioSettings } from "../../providers/PortfolioSettingsProvider";

export default function PortfolioIsland(): JSX.Element | null {
  const { user } = useAuth();
  const { selectedProject, selectedProjectId, saving, lastSavedAt, saveProject, clearSelection, autosaveEnabled, setAutosaveEnabled } = useProjects();
  const { openSettings } = usePortfolioSettings();
  const navigate = useNavigate();
  const location = useLocation();
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
  const hasSelection = !!selectedProjectId;
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
    const handler = (e: any) => {
      try {
        const d = e?.detail || {};
        setPreviewRunningState(!!d.running);
        setPreviewLocalState(d.localUrl || null);
        if (d.lanUrl && !d.lanUrl.startsWith('http://127.') && !d.lanUrl.startsWith('http://localhost')) setPreviewLanState(d.lanUrl);
        else setPreviewLanState(null);
      } catch { /* ignore */ }
    };
    window.addEventListener('py:preview:state', handler as EventListener);
    return () => window.removeEventListener('py:preview:state', handler as EventListener);
  }, []);

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

  const handleOpenSettings = useCallback((section: 'portfolio' | 'theme' | 'cloud') => {
    if (selectedProjectId) openSettings({ projectId: selectedProjectId, section });
  }, [openSettings, selectedProjectId]);

  const handleNavigate = useCallback((to: string) => {
    if (selectedProjectId) navigate(to);
  }, [navigate, selectedProjectId]);

  return (
    <div className={`portfolio-island ${containerClass} ${shouldVisuallyHide ? 'opacity-0 pointer-events-none h-0 overflow-hidden' : ''}`}>
      <div
        className={`surface border border-[color:var(--border)] rounded-2xl px-3 py-3 shadow-lg bg-[color:var(--surface)]/80 transition ${hasSelection ? 'ring-2 ring-[color:var(--accent)]/50 ring-offset-2 ring-offset-[color:var(--bg,transparent)]' : ''}`}
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

          <span className="hidden sm:inline-block w-px h-6 bg-[color:var(--border)]" aria-hidden="true"></span>

          {statusChip}

          <div className={segmentClass}>
            <span className={labelClass}>Preview</span>
            {!previewRunningState ? (
              <button
                type="button"
                title="Start local preview"
                aria-label="Start preview"
                className="btn btn-accent btn-sm flex items-center gap-2 text-[12px] font-semibold shadow-lg shadow-[color:var(--accent)]/25"
                disabled={!hasSelection}
                onClick={async () => {
                  if (!hasSelection) return;
                  window.dispatchEvent(new CustomEvent('py:preview-start-request'));
                  navigate('/deploy');
                }}
              >
                <Play size={14} />
                <span>Start</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  title="Stop preview (handled by Deployer)"
                  aria-label="Stop preview"
                  className="btn btn-danger btn-sm flex items-center gap-2 text-[12px] font-semibold"
                  onClick={() => {
                    try { window.dispatchEvent(new CustomEvent('py:preview-stop-request')); } catch { /* ignore */ }
                  }}
                >
                  <Square size={14} className="text-[color:var(--danger)]" aria-hidden="true" />
                  <span>Stop</span>
                </button>

                {previewLocalState && (
                  <>
                    <a title="Open preview in browser" aria-label="Open preview" href={previewLocalState} target="_blank" rel="noreferrer" className={actionBtnClass}>
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
                  <input
                    aria-label="Portfolio island opacity"
                    title="Adjust portfolio island opacity"
                    type="range"
                    min={25}
                    max={100}
                    step={5}
                    value={pct}
                    className="island-opacity-slider w-28"
                    onChange={(e) => {
                      const raw = Number((e.target as HTMLInputElement).value);
                      const next = Math.min(100, Math.max(25, raw)) / 100;
                      setOpacity(next);
                      try { localStorage.setItem('py_island_opacity', String(next)); } catch { /* ignore */ }
                    }}
                    style={{
                      backgroundImage: `linear-gradient(90deg, var(--accent), var(--accent))`,
                      backgroundSize: `${pct}% 100%`,
                      backgroundRepeat: 'no-repeat',
                      backgroundColor: 'color-mix(in oklab, var(--surface) 85%, transparent)'
                    }}
                  />
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
                  try { window.dispatchEvent(new CustomEvent('py:preview-stop-request')); } catch { /* ignore */ }
                  clearSelection();
                  navigate('/');
                }}
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className={segmentClass}>
            <span className={labelClass}>Configure</span>
            <button
              type="button"
              className={actionBtnClass}
              disabled={!hasSelection}
              onClick={() => handleOpenSettings('portfolio')}
              title="Open portfolio settings"
            >
              <Settings2 size={14} />
              Settings
            </button>
            <button
              type="button"
              className={actionBtnClass}
              disabled={!hasSelection}
              onClick={() => handleOpenSettings('theme')}
              title="Open theme section"
            >
              <Palette size={14} />
              Theme
            </button>
            {user && (
              <button
                type="button"
                className={`${actionBtnClass} ${selectedProject?._synced ? 'text-[color:var(--accent)]' : ''}`}
                disabled={!hasSelection}
                onClick={() => handleOpenSettings('cloud')}
                title="Open cloud settings"
              >
                <Cloud size={14} />
                Cloud
              </button>
            )}
          </div>

          <div className={segmentClass}>
            <span className={labelClass}>Workspace</span>
            <button
              type="button"
              className={actionBtnClass}
              disabled={!hasSelection}
              onClick={() => handleNavigate('/editor')}
              title="Open editor workspace"
            >
              <Wrench size={14} />
              EDITOR
            </button>
            <button
              type="button"
              className={actionBtnClass}
              disabled={!hasSelection}
              onClick={() => handleNavigate('/deploy')}
              title="Open deploy workspace"
            >
              <ExternalLink size={14} />
              DEPLOY
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
              className="btn btn-accent btn-sm flex items-center gap-2 text-[12px] font-semibold shadow-lg shadow-[color:var(--accent)]/25"
              disabled={!hasSelection}
              onClick={() => {
                if (!hasSelection) return;
                // request export and navigate to Deploy
                window.dispatchEvent(new CustomEvent('py:export-request'));
                navigate('/deploy');
              }}
              title="Export project"
            >
              <ExternalLink size={14} />
              Export
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
          </div>
        </div>

        {!hasSelection && (
          <p className="mt-3 text-xs text-[color:var(--fg-muted)]">
            Pick a portfolio from Home to enable the quick-launch controls.
          </p>
        )}
      </div>
    </div>
  );
}