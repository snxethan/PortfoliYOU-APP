import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { Home, Wrench, UploadCloud, ChevronsLeft, ChevronsRight, Sun, Moon, GripVertical } from "lucide-react";

import { useProjects } from "../providers/ProjectsProvider";

import SignInCard from "./auth/SignInCard";

export default function Sidebar() {
  // Use the same small label font/weight as page labels for sidebar tabs
  const base = "w-full flex items-center gap-2 px-3 py-2 rounded-md text-[11px] uppercase tracking-wide text-[color:var(--fg-muted)] border border-transparent hover:bg-[color:var(--muted)]/60 hover:border-[color:var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]";
  const { selectedProjectId } = useProjects();
  const [pulseAccount, setPulseAccount] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem('py_sidebar_collapsed') === '1'; } catch (e) { void e; return false; }
  });
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try { return Number(localStorage.getItem('py_sidebar_w')) || 240; } catch { return 240; }
  });
  const SIDEBAR_MIN = 160;
  const SIDEBAR_MAX = 520;
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try { return (localStorage.getItem('py_theme') as 'dark' | 'light') || 'dark'; } catch { return 'dark'; }
  });

  useEffect(() => {
    try { localStorage.setItem('py_sidebar_collapsed', collapsed ? '1' : '0'); } catch (e) { void e; }
    const w = collapsed ? '2.75rem' : `${Math.round(sidebarWidth)}px`;
    try { document.documentElement.style.setProperty('--sidebar-w', w); } catch { /* ignore */ }
    window.dispatchEvent(new CustomEvent('py:sidebar-collapsed', { detail: { collapsed } }));
  }, [collapsed, sidebarWidth]);

  useEffect(() => {
    try { localStorage.setItem('py_theme', theme); } catch (e) { void e; }
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    const timers: { acc: number | null } = { acc: null };
    const clearTimer = (k: 'acc') => { if (typeof timers[k] === 'number') { clearTimeout(timers[k] as number); timers[k] = null; } };
    const triggerPulse = (setter: (v: boolean) => void, key: 'acc', duration = 1600) => {
      clearTimer(key);
      setter(false);
      requestAnimationFrame(() => {
        setter(true);
        timers[key] = window.setTimeout(() => { setter(false); timers[key] = null; }, duration);
      });
    };
    const onPulse = (ev: Event) => {
      const detail = (ev as CustomEvent | undefined)?.detail as unknown;
      // If event originated from the sidebar itself, ignore to avoid double-highlighting
      if (detail && typeof (detail as Record<string, unknown>).origin === 'string' && (detail as Record<string, unknown>).origin === 'sidebar') return;
      triggerPulse(setPulseAccount, 'acc');
    };
    window.addEventListener('py:highlight-account', onPulse);
    return () => { window.removeEventListener('py:highlight-account', onPulse); clearTimer('acc'); };
  }, []);

  // Listen for external resize-start events and also start resize when user pointerdowns
  // near the right edge of the sidebar (so dragging from the content edge works).
  useEffect(() => {
    function beginResizeFromEvent(e: any) {
      try {
        const detail = e?.detail || {};
        const startX = typeof detail.startX === 'number' ? detail.startX : undefined;
        if (typeof startX === 'number') {
          if (collapsed) setCollapsed(false);
          const startW = sidebarWidth;
          const handleMove = (move: PointerEvent) => {
            const delta = move.clientX - startX;
            const next = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, startW + delta));
            setSidebarWidth(next);
            try { localStorage.setItem('py_sidebar_w', String(Math.round(next))); } catch { /* ignore */ }
          };
          const handleUp = () => {
            window.removeEventListener('pointermove', handleMove);
            window.removeEventListener('pointerup', handleUp);
          };
          window.addEventListener('pointermove', handleMove);
          window.addEventListener('pointerup', handleUp);
        }
      } catch { /* ignore */ }
    }
    window.addEventListener('py:sidebar-begin-resize', beginResizeFromEvent as EventListener);

    const THRESHOLD = 48; // px from sidebar right edge into the content area
    function onGlobalPointerDown(ev: PointerEvent) {
      try {
        if (ev.button !== 0) return; // only primary button
        const clientX = ev.clientX;
        const collapsedPx = 44; // approx 2.75rem
        const sidebarRight = collapsed ? collapsedPx : sidebarWidth;
        // if pointer is just to the right of the sidebar (within threshold), begin resize
        if (clientX >= sidebarRight && clientX <= sidebarRight + THRESHOLD) {
          if (collapsed) setCollapsed(false);
          const startX = clientX;
          const startW = collapsed ? Math.max(SIDEBAR_MIN, sidebarWidth) : sidebarWidth;
          const handleMove = (move: PointerEvent) => {
            const delta = move.clientX - startX;
            const next = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, startW + delta));
            setSidebarWidth(next);
            try { localStorage.setItem('py_sidebar_w', String(Math.round(next))); } catch { /* ignore */ }
          };
          const handleUp = () => {
            window.removeEventListener('pointermove', handleMove);
            window.removeEventListener('pointerup', handleUp);
          };
          window.addEventListener('pointermove', handleMove);
          window.addEventListener('pointerup', handleUp);
        }
      } catch { /* ignore */ }
    }
    window.addEventListener('pointerdown', onGlobalPointerDown as EventListener);

    return () => {
      window.removeEventListener('py:sidebar-begin-resize', beginResizeFromEvent as EventListener);
      window.removeEventListener('pointerdown', onGlobalPointerDown as EventListener);
    };
  }, [collapsed, sidebarWidth]);
  // zoomViewport removed — unused
  const sidebarWidthValue = collapsed ? '2.75rem' : `${Math.round(sidebarWidth)}px`;

  return (
    <aside
      className="fixed left-0 bottom-0 border-r border-[color:var(--border)] bg-[color:var(--muted)] flex flex-col transition-all duration-300 ease-in-out"
      style={{ width: sidebarWidthValue, zIndex: 90, top: 'calc(var(--frame-bar-h, 36px) + 1px)' }}
    >
      {!collapsed && (
        <div
          aria-hidden="true"
          className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize z-30 no-touch-action"
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            window.dispatchEvent(new CustomEvent('py:sidebar-begin-resize', { detail: { startX: e.clientX } }));
          }}
        />
      )}
      {/* Resize handle: visible only when sidebar is expanded. Centered grip for affordance. */}
      {!collapsed && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          className="absolute right-0 top-1/2 transform -translate-y-1/2 w-6 cursor-ew-resize z-40 no-touch-action flex items-center justify-center"
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const startX = e.clientX;
            const startW = sidebarWidth;
            const handleMove = (move: PointerEvent) => {
              const delta = move.clientX - startX;
              const next = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, startW + delta));
              setSidebarWidth(next);
              try { localStorage.setItem('py_sidebar_w', String(Math.round(next))); } catch { /* ignore */ }
            };
            const handleUp = () => {
              window.removeEventListener('pointermove', handleMove);
              window.removeEventListener('pointerup', handleUp);
            };
            window.addEventListener('pointermove', handleMove);
            window.addEventListener('pointerup', handleUp);
          }}
        >
          <div className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)]/80 p-0.5 shadow-sm">
            <GripVertical size={12} className="text-[color:var(--fg-muted)]" />
          </div>
        </div>
      )}
      <div className="flex flex-col h-full">
        <div className="flex-1 flex flex-col gap-2 overflow-y-auto p-3 pr-4" style={{ minHeight: 0 }}>
          <div className="flex items-center justify-between">
            {!collapsed && (
              <div className="px-2 py-1 text-xs uppercase tracking-wide text-[color:var(--fg-muted)]">APP DASHBOARD</div>
            )}
            <div className="flex items-center gap-1">
              {!collapsed && (
                <button
                  className="btn btn-ghost btn-xs p-1"
                  onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
                  title={theme === 'dark' ? 'Switch to Light mode' : 'Switch to Dark mode'}
                  aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                  {/* Show Sun when light mode is active, Moon when dark mode is active */}
                  {theme === 'light' ? <Sun size={14} /> : <Moon size={14} />}
                </button>
              )}
              <button
                className="btn btn-ghost btn-xs p-1"
                onClick={() => setCollapsed(v => !v)}
                title={collapsed ? 'Expand' : 'Collapse'}
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {!collapsed && (
                  <ChevronsLeft size={14} />)}
              </button>
            </div>
          </div>

          {!collapsed && (
            <NavLink to="/" end className={({ isActive }) => `${base} ${isActive ? 'nav-active' : ''}`}>
              <Home size={16} /> Home
            </NavLink>
          )}
          {selectedProjectId && !collapsed && (
            <>
              <NavLink to="/editor" className={({ isActive }) => `${base} ${isActive ? 'nav-active' : ''}`} data-testid="nav-editor">
                <Wrench size={16} /> Editor
              </NavLink>
              <NavLink to="/deploy" className={({ isActive }) => `${base} ${isActive ? 'nav-active' : ''}`}>
                <UploadCloud size={16} /> Deploy
              </NavLink>
            </>
          )}
        </div>

        <div className={`flex-shrink-0 p-3 pt-4 border-t border-[color:var(--border)] ${pulseAccount ? 'highlight-pulse' : ''}`}>
          {!collapsed && <SignInCard />}
        </div>
        {collapsed && (
          <div
            role="button"
            tabIndex={0}
            onClick={() => setCollapsed(false)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCollapsed(false); } }}
            className="absolute inset-0 flex items-center justify-center cursor-pointer z-20"
            title="Expand sidebar"
          >
            <ChevronsRight size={16} />
          </div>
        )}
      </div>
    </aside>
  );
}