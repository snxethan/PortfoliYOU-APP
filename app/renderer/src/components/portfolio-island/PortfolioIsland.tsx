import { useNavigate, useLocation } from "react-router-dom";
import React, { useMemo, useState, useCallback } from "react";
import { Cloud, UploadCloud, X, Save, FolderOpen, Pin, PinOff, Palette, Settings, Play, Square, ExternalLink, Eye, RefreshCw, SlidersHorizontal, Bell, BellDot, Minimize2, Expand } from "lucide-react";

import { useAuth } from "../../providers/AuthProvider";
import { useProjects } from "../../providers/ProjectsProvider";
import { usePortfolioSettings } from "../../providers/PortfolioSettingsProvider";
import { useNotifications } from "../../providers/NotificationsProvider";
import { getPreviewState } from "../../lib/previewInterop";

export default function PortfolioIsland(): React.ReactElement | null {
  const { user } = useAuth();
  const { selectedProject, selectedProjectId, saving, lastSavedAt, saveProject, saveCloudProjectNow, clearSelection, autosaveEnabled, setAutosaveEnabled, syncProject } = useProjects();
  const { notifications, add: notify } = useNotifications();
  const { openSettings } = usePortfolioSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const pendingHighlightRef = React.useRef(false);
  const selectedProjectCloudId = selectedProject?._cloudId ?? selectedProjectId ?? (selectedProject as any)?.id ?? null;
  const isCloudLinked = !!(selectedProject?._synced || selectedProject?._cloudId || selectedProject?.storage === 'cloud');
  const isCloudProject = isCloudLinked;
  const [animKey, setAnimKey] = React.useState(0);
  const [pinned, setPinned] = useState<boolean>(() => {
    try { return localStorage.getItem('py_island_pin') === '1'; } catch { return false; }
  });
  const [pinAnimation, setPinAnimation] = useState<'none' | 'bounce'>('none');
  const [opacity, setOpacity] = useState<number>(() => {
    try {
      const v = Number(localStorage.getItem('py_island_opacity'));
      if (!v || !Number.isFinite(v)) return 0.95;
      return Math.min(1, Math.max(0.25, v));
    } catch { return 0.95; }
  });
  const [compactMode, setCompactMode] = useState<boolean>(() => {
    try { return localStorage.getItem('py_island_compact') === '1'; } catch { return false; }
  });
  const [syncingProjectId, setSyncingProjectId] = useState<string | null>(null);
  const syncingSelected = syncingProjectId === selectedProjectId;
  const savedText = useMemo(() => lastSavedAt ? new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null, [lastSavedAt]);
  const hasSelection = !!selectedProjectCloudId;
  // When on the Home page with no selected portfolio, keep the island mounted
  // but visually hide it to avoid changing hook order during quick selection changes.
  const shouldVisuallyHide = location.pathname === '/' && !hasSelection;

  // Trigger animation on route change
  React.useEffect(() => {
    if (!shouldVisuallyHide) {
      setAnimKey(prev => prev + 1);
    }
  }, [location.pathname, shouldVisuallyHide]);

  // When pinned, keep the island positioned beneath the fixed FrameBar (36px / top-9)
  const containerClass = `${pinned ? 'sticky top-9' : 'relative'} px-4 pt-4`;
  const containerStyle = useMemo(() => ({ zIndex: pinned ? 1200 : 900 }), [pinned]);
  // Match quick-settings/editor styles: header labels use 10px, content/actions use 12px
  const labelClass = "text-[10px] uppercase tracking-wide text-[color:var(--fg-muted)]";
  const segmentClass = `${compactMode ? 'portfolio-island__segment portfolio-island__segment--compact' : 'portfolio-island__segment'} text-[12px] border border-[color:var(--border)] bg-[color:var(--surface)]/95 min-w-0`;
  const actionBtnClass = "portfolio-island__segment-action btn btn-ghost btn-xs flex items-center gap-1 text-[11px]";
  const primaryActionClass = "portfolio-island__segment-action btn btn-accent btn-xs flex items-center gap-2 text-[11px] font-semibold shadow-md shadow-[color:var(--accent)]/25";
  const dangerActionClass = "portfolio-island__segment-action btn btn-danger btn-xs flex items-center gap-2 text-[11px] font-semibold";
  const iconButtonBase = "btn btn-ghost px-3 py-2 inline-flex items-center justify-center rounded-md text-[color:var(--fg-muted)] whitespace-nowrap";
  const shouldShowLabels = !compactMode;
  const renderLabel = (text: string) => shouldShowLabels ? <span>{text}</span> : <span className="sr-only">{text}</span>;
  const statusChip = (
    <div className="portfolio-island__status-chip inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-[color:var(--border)] bg-[color:var(--muted)]/30 text-[11px] font-semibold text-[color:var(--fg-muted)] w-full sm:w-auto justify-center text-center whitespace-normal break-words min-w-0">
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
  const sliderProgress = Math.max(0, Math.min(100, Math.round(((pct - 25) / 75) * 100)));
  const sliderStyle = useMemo(() => {
    return ({ ['--slider-progress' as unknown as string]: `${sliderProgress}%` } as unknown) as React.CSSProperties;
  }, [sliderProgress]);
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
    <div
      key={animKey}
      className={`portfolio-island ${containerClass} ${shouldVisuallyHide ? 'opacity-0 pointer-events-none h-0 overflow-hidden' : ''}`}
      style={{ ...containerStyle, animation: shouldVisuallyHide ? undefined : 'py-pop 0.4s ease-out' }}
    >
      <div
        className={`portfolio-island__surface surface relative border border-[color:var(--border)] rounded-2xl ${compactMode ? 'px-3 pt-4 pb-4 sm:pt-5 sm:pb-6 lg:pb-5 sm:pr-5' : 'px-4 pt-5 pb-5 sm:pt-6 sm:pb-6 lg:pb-5 sm:pr-6'} shadow-lg bg-[color:var(--surface)]/85 transition-all duration-300 ease-in-out w-full overflow-x-hidden ${hasSelection ? 'ring-2 ring-[color:var(--accent)]/45 ring-offset-2 ring-offset-[color:var(--bg,transparent)]' : 'ring-2 ring-[color:var(--accent)]/25 ring-offset-2 ring-offset-[color:var(--bg,transparent)]'} ${compactMode ? 'portfolio-island__surface--compact' : ''}`}
        style={islandStyle}
      >
        <div className="portfolio-island__row mt-1 flex flex-wrap w-full gap-2 items-stretch sm:items-start">
          <div className="portfolio-island__project-card flex flex-1 flex-col gap-2 min-w-0">
            <div className="portfolio-island__project-row">
              <div
                role="button"
                tabIndex={0}
                aria-label={selectedProject ? `View ${selectedProject.name} in portfolios list` : 'View portfolios list'}
                className="portfolio-island__project-button rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)]/70 px-4 py-2 shadow-sm hover:border-[color:var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)] transition"
                onClick={handleGoToList}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleGoToList();
                  }
                }}
              >
                <div className="portfolio-island__project-meta flex flex-col min-w-0">
                  <span className="text-base font-semibold leading-tight break-words">
                    {selectedProject ? selectedProject.name : 'No Portfolio Selected'}
                  </span>
                  <span className="text-xs text-[color:var(--fg-muted)] break-words">{selectedProject?.description}</span>
                </div>
                <div className="portfolio-island__project-actions flex flex-wrap items-center gap-1 mt-2">
                  {statusChip}
                  <button
                    type="button"
                    className={`${iconButtonBase} ${!compactMode ? 'gap-1.5' : ''}`}
                    disabled={!hasSelection}
                    title="Portfolio settings"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenSettings('portfolio');
                    }}
                  >
                    <Settings size={16} />
                    {!compactMode && <span className="text-xs">Settings</span>}
                  </button>
                  <button
                    type="button"
                    className={`${iconButtonBase} ${!compactMode ? 'gap-1.5' : ''}`}
                    disabled={!hasSelection}
                    title="Theme settings"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenSettings('theme');
                    }}
                  >
                    <Palette size={16} />
                    {!compactMode && <span className="text-xs">Theme</span>}
                  </button>
                  <button
                    type="button"
                    className={`${iconButtonBase} ${!compactMode ? 'gap-1.5' : ''} ${isCloudLinked ? 'border border-[color:var(--accent)]/40 bg-[color:var(--accent)]/10 text-[color:var(--accent)] shadow-sm' : ''}`}
                    disabled={!hasSelection}
                    title={isCloudLinked ? 'Cloud portfolio' : 'Not in cloud'}
                    aria-pressed={isCloudLinked}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenSettings('cloud');
                    }}
                  >
                    <Cloud size={16} />
                    {!compactMode && <span className="text-xs">Cloud</span>}
                  </button>
                  <button
                    type="button"
                    className={`${iconButtonBase} ${!compactMode ? 'gap-1.5' : ''} relative`}
                    title="Notifications"
                    aria-label="Notifications"
                    onClick={(e) => {
                      e.stopPropagation();
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
                      <span className="portfolio-island__badge inline-flex items-center justify-center" aria-label={`${notifications.length} unread notifications`}>
                        {notifications.length}
                      </span>
                    )}
                    {!compactMode && <span className="text-xs">Notifications</span>}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="portfolio-island__toolbar flex flex-1 sm:flex-[0_0_auto] flex-wrap items-center gap-2 w-full sm:w-auto justify-end min-w-0">
            {pinned && (
              <div className="portfolio-island__controls-slider flex flex-1 items-center gap-2 px-2 min-w-0">
                <label className="text-[10px] text-[color:var(--fg-muted)] whitespace-nowrap">Opacity</label>
                <input
                  aria-label="Portfolio island opacity"
                  title="Adjust portfolio island opacity"
                  type="range"
                  min={25}
                  max={100}
                  step={5}
                  value={pct}
                  className="accent-range flex-1 min-w-0"
                  style={sliderStyle}
                  onChange={(e) => {
                    const raw = Number((e.target as HTMLInputElement).value);
                    const next = Math.min(100, Math.max(25, raw)) / 100;
                    setOpacity(next);
                    try { localStorage.setItem('py_island_opacity', String(next)); } catch { /* ignore */ }
                  }}
                />
                <div className="text-[11px] text-[color:var(--fg-muted)]">{Math.round(opacity * 100)}%</div>
              </div>
            )}
            <button
              type="button"
              className={`${iconButtonBase} ${!compactMode ? 'gap-1.5' : ''}`}
              title={pinned ? "Unpin island from top" : "Pin island to top"}
              aria-pressed={pinned}
              style={{ animation: pinAnimation === 'bounce' ? 'py-bounce 0.4s ease-in-out' : undefined }}
              onClick={() => {
                setPinned(prev => {
                  const next = !prev;
                  try { localStorage.setItem('py_island_pin', next ? '1' : '0'); } catch { /* ignore */ }
                  setPinAnimation('bounce');
                  setTimeout(() => setPinAnimation('none'), 400);
                  return next;
                });
              }}
            >
              {pinned ? <Pin size={16} /> : <PinOff size={16} />}
              {!compactMode && <span className="text-xs">{pinned ? 'Unpin' : 'Pin'}</span>}
            </button>
            <button
              type="button"
              className={`${iconButtonBase} ${!compactMode ? 'gap-1.5' : ''}`}
              title={compactMode ? 'Expand island layout' : 'Compact island layout'}
              aria-pressed={compactMode}
              onClick={() => {
                setCompactMode(prev => {
                  const next = !prev;
                  try { localStorage.setItem('py_island_compact', next ? '1' : '0'); } catch { /* ignore */ }
                  return next;
                });
              }}
            >
              {compactMode ? <Expand size={16} /> : <Minimize2 size={16} />}
              {!compactMode && <span className="text-xs">Compact</span>}
            </button>
            <button
              type="button"
              className={`${iconButtonBase} ${!compactMode ? 'gap-1.5' : ''}`}
              disabled={!hasSelection}
              title="Close current portfolio"
              onClick={() => {
                try { window.dispatchEvent(new CustomEvent('py:preview-stop-request', { detail: { projectId: selectedProjectCloudId } })); } catch { /* ignore */ }
                clearSelection();
                navigate('/');
              }}
            >
              <X size={16} />
              {!compactMode && <span className="text-xs">Close</span>}
            </button>
          </div>
        </div>

        <div className="mt-1.5 portfolio-island__row flex flex-wrap items-stretch gap-1 w-full">
          {/* Preview section: now grouped with Compile & Files */}
          <div className={segmentClass}>
            <div className="portfolio-island__segment-label">
              <span className={labelClass}>Preview</span>
            </div>
            <div className="portfolio-island__segment-actions min-w-0">
              {previewRunningState ? (
                <>
                  <button
                    type="button"
                    title="Stop preview (handled by Deployer)"
                    aria-label="Stop preview"
                    className={dangerActionClass}
                    style={{ animation: 'py-fade-in 0.2s ease-out' }}
                    onClick={() => {
                      try { window.dispatchEvent(new CustomEvent('py:preview-stop-request', { detail: { projectId: selectedProjectCloudId } })); } catch { /* ignore */ }
                    }}
                  >
                    <Square size={14} className="text-[color:var(--danger)]" aria-hidden="true" />
                    {renderLabel('Stop')}
                  </button>

                  {previewLocalState && (
                    <>
                      <button
                        type="button"
                        title="Reload preview (rebuild + restart)"
                        aria-label="Reload preview"
                        className={actionBtnClass}
                        style={{ animation: 'py-fade-in 0.2s ease-out' }}
                        onClick={() => {
                          if (!hasSelection) return;
                          notify({ type: 'info', message: 'Reloading preview…', persistent: false });
                          navigate('/deploy');
                          try { window.dispatchEvent(new CustomEvent('py:preview-reload-request', { detail: { projectId: selectedProjectCloudId } })); } catch { /* ignore */ }
                        }}
                      >
                        <RefreshCw size={14} />
                        {renderLabel('Reload')}
                      </button>
                      <a
                        title="Open preview in browser"
                        aria-label="Open preview"
                        href={previewLocalState || undefined}
                        target="_blank"
                        rel="noreferrer"
                        className={actionBtnClass}
                        style={{ animation: 'py-fade-in 0.2s ease-out' }}
                        onClick={async (e) => {
                          try {
                            e.preventDefault();
                            if (!previewLocalState) return;
                            await (window as any).api?.openExternal?.({ url: previewLocalState });
                          } catch { /* ignore */ }
                        }}
                      >
                        <Eye size={14} />
                        {renderLabel('Open')}
                      </a>
                      {previewLanState ? (
                        <a title="Open LAN preview" aria-label="Open LAN preview" href={previewLanState} target="_blank" rel="noreferrer" className={actionBtnClass} style={{ animation: 'py-fade-in 0.2s ease-out' }}>
                          <ExternalLink size={14} />
                          {renderLabel('Open LAN')}
                        </a>
                      ) : (
                        <button type="button" title="Open LAN preview (not available)" aria-label="Open LAN preview" className={actionBtnClass} disabled style={{ animation: 'py-fade-in 0.2s ease-out' }}>
                          <ExternalLink size={14} />
                          {renderLabel('Open LAN')}
                        </button>
                      )}
                    </>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  title="Start local preview"
                  aria-label="Start preview"
                  className={primaryActionClass}
                  style={{ animation: 'py-fade-in 0.2s ease-out' }}
                  disabled={!hasSelection}
                  onClick={async () => {
                    if (!hasSelection) return;
                    window.dispatchEvent(new CustomEvent('py:preview-start-request', { detail: { projectId: selectedProjectCloudId } }));
                    navigate('/deploy');
                  }}
                >
                  <Play size={14} />
                  {renderLabel('Start')}
                </button>
              )}
              <button
                type="button"
                title="Preview settings"
                aria-label="Preview settings"
                className={actionBtnClass}
                disabled={!hasSelection}
                onClick={() => handleOpenSettings('preview')}
              >
                <SlidersHorizontal size={14} />
                {renderLabel('Preview Settings')}
              </button>
            </div>
          </div>

          {/* Compile section: holds export and build settings */}
          <div className={segmentClass}>
            <div className="portfolio-island__segment-label">
              <span className={labelClass}>Compile</span>
            </div>
            <div className="portfolio-island__segment-actions min-w-0">
              <button
                type="button"
                className={primaryActionClass}
                disabled={!hasSelection}
                onClick={() => {
                  if (!hasSelection) return;
                  window.dispatchEvent(new CustomEvent('py:export-request', { detail: { projectId: selectedProjectCloudId } }));
                  navigate('/deploy');
                }}
                title="Export project"
              >
                <ExternalLink size={14} />
                {renderLabel('Export')}
              </button>
              <button
                type="button"
                className={actionBtnClass}
                disabled={!hasSelection}
                onClick={() => openSettings({ projectId: selectedProjectId || (selectedProject as any)?.id, section: 'build' })}
                title="Build settings"
              >
                <SlidersHorizontal size={14} />
                {renderLabel('Build Settings')}
              </button>
            </div>
          </div>

          <div className={segmentClass}>
            <div className="portfolio-island__segment-label">
              <span className={labelClass}>Files</span>
            </div>
            <div className="portfolio-island__segment-actions min-w-0">
              {user && !isCloudProject && (
                <button
                  type="button"
                  className={primaryActionClass}
                  disabled={!hasSelection || syncingSelected}
                  onClick={async () => {
                    if (!selectedProjectId) return;
                    setSyncingProjectId(selectedProjectId);
                    try { await syncProject(selectedProjectId); }
                    finally { setSyncingProjectId(null); }
                  }}
                  title={user ? 'Sync this project to the cloud' : 'Sign in to sync to cloud'}
                >
                  {syncingSelected ? (
                    <span className="w-3 h-3 border-2 border-[color:var(--border)] border-t-transparent rounded-full animate-spin" aria-hidden="true"></span>
                  ) : (
                    <UploadCloud size={14} />
                  )}
                  {renderLabel(syncingSelected ? 'Syncing…' : 'Sync to cloud')}
                </button>
              )}
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
                {renderLabel('Open')}
              </button>

              <button
                type="button"
                className={actionBtnClass}
                disabled={!hasSelection}
                onClick={() => {
                  if (!selectedProjectId) return;
                  if (isCloudProject) {
                    void saveCloudProjectNow(selectedProjectId);
                  } else {
                    void saveProject(selectedProjectId);
                  }
                }}
                title={isCloudProject ? 'Save to cloud' : 'Save project'}
              >
                <Save size={14} />
                {renderLabel(isCloudProject ? 'Sync' : 'Save')}
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
                {renderLabel('Autosave')}
              </button>
              <button
                type="button"
                className={actionBtnClass}
                disabled={!hasSelection}
                onClick={() => { if (selectedProjectId) openSettings({ projectId: selectedProjectId, section: 'saving' }); }}
                title="Save settings"
              >
                <SlidersHorizontal size={14} />
                {renderLabel('Save settings')}
              </button>
            </div>
          </div>
        </div>

        {!hasSelection && (
          <p className="mt-2 text-xs text-[color:var(--fg-muted)]">
            Pick a portfolio from Home to enable the quick-launch controls.
          </p>
        )}
      </div>
    </div>
  );
}