import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Cloud, UploadCloud, Wrench, X, Save, FolderOpen, Edit3, Pin, PinOff } from "lucide-react";

import { useAuth } from "../../providers/AuthProvider";
import { useProjects } from "../../providers/ProjectsProvider";

export default function PortfolioIsland() {
  const { user } = useAuth();
  const { selectedProject, selectedProjectId, saving, lastSavedAt, saveProject, clearSelection, renameProject, autosaveEnabled, setAutosaveEnabled } = useProjects();
  const navigate = useNavigate();
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [pinned, setPinned] = useState<boolean>(() => {
    try { return localStorage.getItem('py_island_pin') === '1'; } catch { return false; }
  });
  const savedText = lastSavedAt
    ? new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;
  const hasSelection = !!selectedProjectId;
  const containerClass = (pinned ? "sticky top-0 z-[9999] " : "") + "px-4 pt-4";

  return (
    <div className={containerClass}>
      <header className="header-island">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {editingTitle ? (
              <form className="flex items-center gap-2" onSubmit={async (e) => { e.preventDefault(); if (!selectedProjectId) return; const v = titleDraft.trim(); if (v) { await renameProject(selectedProjectId, v); setEditingTitle(false); } }}>
                <input
                  autoFocus
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Escape') setEditingTitle(false); }}
                  className="input w-64"
                  placeholder="Portfolio name"
                />
                <button
                  type="submit"
                  className="btn btn-primary btn-xs"
                  disabled={!selectedProjectId || !titleDraft.trim()}
                >
                  Save
                </button>
                <button type="button" className="btn btn-outline btn-xs" onClick={() => setEditingTitle(false)}>Cancel</button>
              </form>
            ) : (
              <button
                type="button"
                className="island-title text-left"
                title="Go to portfolios list"
                onClick={() => {
                  navigate('/');
                  setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('py:highlight-request'));
                  }, 50);
                }}
              >
                <span className="font-semibold truncate">{selectedProject ? selectedProject.name : 'No Portfolio Selected'}</span>
              </button>
            )}

            {/* Inline actions to the right of the title */}
            {hasSelection && (
              <div className="flex items-center gap-1">
                {!editingTitle && (
                  <button
                    className="btn btn-ghost"
                    disabled={!selectedProjectId}
                    title="Rename portfolio"
                    onClick={() => {
                      setTitleDraft(selectedProject?.name ?? '');
                      setEditingTitle(true);
                    }}
                  >
                    <Edit3 size={16} />
                    <span className="ml-1 hidden sm:inline">Rename</span>
                  </button>
                )}
                {/* Export button removed per request; Open moved to right group */}
              </div>
            )}
          </div>

          <div className="hidden md:flex items-center gap-3">
            {hasSelection ? (
              <div className="text-xs sm:text-sm text-[color:var(--fg-muted)] flex items-center">
                {saving ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="w-3 h-3 border-2 border-[color:var(--border)] border-t-[color:var(--primary)] rounded-full animate-spin"></span>
                    Saving…
                  </span>
                ) : savedText ? (
                  <span className="badge-live">Saved {savedText}</span>
                ) : (
                  <span className="badge-live">● Portfolio ready</span>
                )}
              </div>
            ) : (
              <div />
            )}

            {/* Right actions: Pin is always visible; Close disabled when no selection */}
            <div className="ml-1 flex items-center gap-1">
              <button
                className="btn btn-ghost"
                title={pinned ? "Unpin island from top" : "Pin island to top"}
                aria-pressed={pinned}
                onClick={() => setPinned(p => { const next = !p; try { localStorage.setItem('py_island_pin', next ? '1' : '0'); } catch { void 0; } return next; })}
              >
                {pinned ? <Pin size={16} /> : <PinOff size={16} />}
                <span className="ml-1 hidden sm:inline">{pinned ? 'Pinned' : 'Pin'}</span>
              </button>
              <button
                className="btn btn-ghost"
                disabled={!selectedProjectId}
                title="Close current portfolio"
                onClick={() => { clearSelection(); navigate('/'); }}
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          {/* Left quick actions */}
          <div className="flex items-center gap-2">
            <button
              className="btn btn-ghost"
              disabled={!selectedProjectId}
              onClick={() => selectedProjectId && navigate('/editor')}
              title="Open Editor (no shortcut)"
            >
              <Wrench size={16} className="mr-1" /> Editor
            </button>
            <button
              className="btn btn-ghost"
              disabled={!selectedProjectId}
              onClick={() => selectedProjectId && navigate('/deploy')}
              title="Deploy selected portfolio (no shortcut)"
            >
              <UploadCloud size={16} className="mr-1" /> Deploy
            </button>
            {user && (
              <button
                className={`btn btn-ghost ${selectedProject?._synced ? 'cloud-linked' : ''}`}
                disabled={!selectedProjectId}
                onClick={() => {
                  if (!selectedProjectId) return;
                  window.dispatchEvent(new CustomEvent('py:openCloudSettings', { detail: { projectId: selectedProjectId } }));
                }}
                title="Manage Cloud settings"
              >
                <Cloud size={16} className="mr-1" /> Cloud
              </button>
            )}
          </div>

          {/* Right quick actions (Open / Save / Save As) */}
          {hasSelection ? (
            <div className="flex items-center gap-2">
              <button
                className="btn btn-ghost"
                disabled={!selectedProject?._filePath}
                onClick={async () => {
                  if (selectedProject?._filePath && window.api?.showItemInFolder) {
                    await window.api.showItemInFolder({ filePath: selectedProject._filePath });
                  }
                }}
                title="Open file location"
              >
                <FolderOpen size={16} className="mr-1" /> Open
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => selectedProjectId && saveProject(selectedProjectId)}
                title="Save (Ctrl+S)"
              >
                <Save size={16} className="mr-1" /> Save
              </button>
              <button
                className={`btn btn-ghost ${autosaveEnabled ? 'active' : ''}`}
                title={autosaveEnabled ? 'Autosave enabled' : 'Autosave disabled'}
                aria-pressed={!!autosaveEnabled}
                aria-label={autosaveEnabled ? 'Autosave enabled' : 'Autosave disabled'}
                onClick={() => setAutosaveEnabled(!autosaveEnabled)}
              >
                <span className="relative inline-flex items-center">
                  <Save size={16} className="mr-1" />
                  {!autosaveEnabled && (
                    <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className="w-4/5 h-[2px] bg-current rotate-45 origin-center"></span>
                    </span>
                  )}
                </span>
                <span className="hidden sm:inline">Autosave</span>
              </button>
            </div>
          ) : <div />}
        </div>
      </header>
    </div>
  );
}