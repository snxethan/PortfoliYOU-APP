import { useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import { Cloud, UploadCloud, Wrench, X, Save, FolderOpen, Pin, PinOff, Palette, Settings2 } from "lucide-react";

import { useAuth } from "../../providers/AuthProvider";
import { useProjects } from "../../providers/ProjectsProvider";
import { usePortfolioSettings } from "../../providers/PortfolioSettingsProvider";

export default function PortfolioIsland() {
  const { user } = useAuth();
  const { selectedProject, selectedProjectId, saving, lastSavedAt, saveProject, clearSelection, autosaveEnabled, setAutosaveEnabled } = useProjects();
  const { openSettings } = usePortfolioSettings();
  const navigate = useNavigate();
  const [pinned, setPinned] = useState<boolean>(() => {
    try { return localStorage.getItem('py_island_pin') === '1'; } catch { return false; }
  });
  const savedText = useMemo(() => lastSavedAt ? new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null, [lastSavedAt]);
  const hasSelection = !!selectedProjectId;
  const containerClass = (pinned ? "sticky top-0 z-[9999] " : "") + "px-4 pt-4";
  const labelClass = "text-[11px] uppercase tracking-wide text-[color:var(--fg-muted)]";
  const segmentClass = "flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)]/60 px-3 py-1.5 shadow-sm flex-wrap";
  const actionBtnClass = "btn btn-ghost btn-sm flex items-center gap-1";
  const iconControlClass = "inline-flex items-center justify-center w-9 h-9 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)]/80 hover:bg-[color:var(--muted)]/40 transition disabled:opacity-40";

  const statusChip = (
    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[color:var(--border)] bg-[color:var(--muted)]/30 text-[11px] font-semibold text-[color:var(--fg-muted)]">
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

  return (
    <div className={containerClass}>
      <div className={`surface border border-[color:var(--border)] rounded-2xl px-3 py-3 shadow-lg bg-[color:var(--surface)]/80 transition ${hasSelection ? 'ring-2 ring-[color:var(--accent)]/50 ring-offset-2 ring-offset-[color:var(--bg,transparent)]' : ''}`}>
        <div className="flex flex-wrap items-center gap-2 w-full">
          <button
            type="button"
            className="flex min-w-[200px] max-w-full flex-col text-left rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)]/70 px-4 py-2 shadow-sm hover:border-[color:var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)] transition"
            title="Go to portfolios list"
            onClick={() => {
              navigate('/');
              setTimeout(() => { window.dispatchEvent(new CustomEvent('py:highlight-request')); }, 50);
            }}
          >
            <span className="text-base font-semibold leading-tight truncate">
              {selectedProject ? selectedProject.name : 'No Portfolio Selected'}
            </span>
          </button>

          <span className="hidden sm:inline-block w-px h-6 bg-[color:var(--border)]" aria-hidden="true"></span>

          {statusChip}

          {user && selectedProject?._synced && (
            <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-[color:var(--border)] bg-[color:var(--muted)]/30 text-[11px] text-[color:var(--accent)]">
              <Cloud size={12} />
              Cloud linked
            </div>
          )}
          <div className="flex flex-col items-end gap-2 ml-auto">
            <div className="flex items-center gap-1">
              <button
                type="button"
                className={iconControlClass}
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
                className={iconControlClass}
                disabled={!hasSelection}
                title="Close current portfolio"
                onClick={() => { clearSelection(); navigate('/'); }}
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
              onClick={() => selectedProjectId && openSettings({ projectId: selectedProjectId, section: 'portfolio' })}
            >
              <Settings2 size={14} />
              Settings
            </button>
            <button
              type="button"
              className={actionBtnClass}
              disabled={!hasSelection}
              onClick={() => selectedProjectId && openSettings({ projectId: selectedProjectId, section: 'theme' })}
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
                onClick={() => selectedProjectId && openSettings({ projectId: selectedProjectId, section: 'cloud' })}
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
              onClick={() => selectedProjectId && navigate('/editor')}
            >
              <Wrench size={14} />
              Editor
            </button>
            <button
              type="button"
              className={actionBtnClass}
              disabled={!hasSelection}
              onClick={() => selectedProjectId && navigate('/deploy')}
            >
              <UploadCloud size={14} />
              Deploy
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
            >
              <FolderOpen size={14} />
              Open
            </button>
            <button
              type="button"
              className={actionBtnClass}
              disabled={!hasSelection}
              onClick={() => selectedProjectId && saveProject(selectedProjectId)}
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