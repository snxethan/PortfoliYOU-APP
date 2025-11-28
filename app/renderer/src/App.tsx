import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Suspense, lazy, useEffect, useState, useCallback } from "react";

import Sidebar from "./components/Sidebar";
import PortfolioIsland from "./components/portfolio-island/PortfolioIsland";
import FrameBar from "./components/FrameBar";
const HomePage = lazy(() => import("./pages/Home"));
const EditorPage = lazy(() => import("./pages/Editor"));
const DeployPage = lazy(() => import("./pages/Deploy"));
import ProtectedRoute from "./components/auth/ProtectedRoute";
import { ProjectsProvider, useProjects } from "./providers/ProjectsProvider";
import { AssetsProvider, useAssets } from "./providers/AssetsProvider";
import { NotificationsProvider } from "./providers/NotificationsProvider";
import { PortfolioSettingsProvider } from "./providers/PortfolioSettingsProvider";
import NotificationsUI from "./components/notifications/Notifications";
import ErrorBoundary from "./components/ErrorBoundary";
import { useAuth } from "./providers/AuthProvider";
// Ensure widgets are registered globally so previews render on any route
import "./widgets/loader";


export default function App() {
  const { loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    document.body?.classList.remove('py-preload');
    const splash = document.getElementById('py-loader');
    if (!splash) return;
    splash.classList.add('py-loader--hidden');
    const timer = window.setTimeout(() => splash.remove(), 450);
    return () => window.clearTimeout(timer);
  }, [loading]);

  // Show spinner while checking initial auth state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[color:var(--bg)]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[color:var(--border)] border-t-[color:var(--primary)] rounded-full animate-spin"></div>
          <p className="text-sm text-[color:var(--fg-muted)]">A Portfolio for you, by you.</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <NotificationsProvider>
          <ProjectsProvider>
            <AssetsProvider>
              <PortfolioSettingsProvider>
                <SaveHotkeys />
                <GlobalPreviewStarter />
                <GlobalZoomControls />
                <NotificationsUI />
                <div className="min-h-screen" style={{ paddingTop: 36 }}>
                  <FrameBar />
                  <Sidebar />
                  <div style={{ marginLeft: 'var(--sidebar-w,15rem)' }} className="min-h-0">
                    <div className="min-h-screen flex flex-col">
                      <PortfolioIsland />
                      <main className="flex-1">
                        <Suspense fallback={
                          <div className="flex items-center justify-center py-16">
                            <div className="w-10 h-10 border-4 border-[color:var(--border)] border-t-[color:var(--primary)] rounded-full animate-spin" />
                          </div>
                        }>
                          <Routes>
                            <Route path="/" element={<HomePage />} />
                            {/* Backward-compat: redirect old Modify route to Editor */}
                            <Route path="/modify" element={<LegacyModifyRedirect />} />
                            <Route
                              path="/editor"
                              element={
                                <ProtectedRoute>
                                  <EditorPage />
                                </ProtectedRoute>
                              }
                            />
                            <Route
                              path="/deploy"
                              element={
                                <ProtectedRoute>
                                  <DeployPage />
                                </ProtectedRoute>
                              }
                            />
                          </Routes>
                        </Suspense>
                      </main>
                    </div>
                  </div>
                </div>
              </PortfolioSettingsProvider>
            </AssetsProvider>
          </ProjectsProvider>
        </NotificationsProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

function SaveHotkeys() {
  const { selectedProjectId, saveProject } = useProjects();
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const s = e.key.toLowerCase() === 's';
      const mod = e.ctrlKey || e.metaKey;
      if (mod && s) {
        e.preventDefault();
        if (selectedProjectId) {
          // Ctrl+Shift+S => Save As
          saveProject(selectedProjectId, { saveAs: e.shiftKey });
        }
      }
    }
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true } as EventListenerOptions);
  }, [selectedProjectId, saveProject]);
  return null;
}

const MIN_APP_ZOOM = 0.8;
const MAX_APP_ZOOM = 1.6;

function GlobalZoomControls() {
  const location = useLocation();
  const isEditorRoute = location.pathname.startsWith('/editor');
  const clamp = useCallback((value: number) => {
    if (!Number.isFinite(value)) return 1;
    return Math.min(MAX_APP_ZOOM, Math.max(MIN_APP_ZOOM, value));
  }, []);
  const [appZoom, setAppZoom] = useState(() => {
    try {
      const stored = Number(localStorage.getItem('py_app_zoom'));
      if (!stored) return 1;
      return clamp(stored);
    } catch {
      return 1;
    }
  });

  useEffect(() => {
    const value = clamp(appZoom);
    document.body?.style.setProperty('zoom', value.toString());
    document.documentElement?.style.setProperty('--py-app-zoom', value.toString());
    try { localStorage.setItem('py_app_zoom', value.toString()); } catch { /* ignore */ }
  }, [appZoom, clamp]);

  useEffect(() => {
    return () => {
      document.body?.style.removeProperty('zoom');
      document.documentElement?.style.removeProperty('--py-app-zoom');
    };
  }, []);

  const adjustZoom = useCallback((delta: number) => {
    setAppZoom(prev => clamp(Number((prev + delta).toFixed(3))));
  }, [clamp]);

  const resetZoom = useCallback(() => {
    setAppZoom(1);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl) return;
      const key = e.key;
      const isZoomIn = key === '+' || key === '=' || key === 'Add';
      const isZoomOut = key === '-' || key === '_' || key === 'Subtract';
      const isReset = key === '0' || key === ')' || key === 'Digit0';
      if (!isZoomIn && !isZoomOut && !isReset) return;
      if (isEditorRoute && !e.shiftKey) return; // canvas handles plain Ctrl combos
      e.preventDefault();
      e.stopPropagation();
      if (isZoomIn) adjustZoom(0.1);
      else if (isZoomOut) adjustZoom(-0.1);
      else if (isReset) resetZoom();
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [adjustZoom, resetZoom, isEditorRoute]);

  useEffect(() => {
    const handler = (e: WheelEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl) return;
      if (isEditorRoute && !e.shiftKey) return; // let editor canvas handle
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY;
      adjustZoom(delta > 0 ? -0.05 : 0.05);
    };
    const opts: AddEventListenerOptions = { passive: false, capture: true };
    window.addEventListener('wheel', handler, opts);
    return () => window.removeEventListener('wheel', handler, opts);
  }, [adjustZoom, isEditorRoute]);

  return null;
}

function GlobalPreviewStarter() {
  const { selectedProject } = useProjects();
  const { list: assetList } = useAssets();
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let mounted = true;
    const handler = async (e: any) => {
      if (!mounted) return;
      if (!selectedProject) return;
      if (starting) return;
      setStarting(true);
      try {
        // initialize global buffers
        try { (window as any).__py_preview_log = (window as any).__py_preview_log || []; } catch { /* ignore */ }
        try { (window as any).__py_preview_state = (window as any).__py_preview_state || { running: false }; } catch { /* ignore */ }
        window.dispatchEvent(new CustomEvent('py:notify', { detail: { type: 'info', message: 'Building preview...', persistent: false } }));
        const assetsBase64: Record<string, string> = {};
        if (assetList && assetList.length) {
          try {
            const mod = await import('./lib/assetsStore');
            const idbGet = (mod as any).idbGet as (store: string, key: string) => Promise<Blob | undefined>;
            for (const asset of assetList) {
              if (!asset.hash) continue;
              try {
                const blob = await idbGet('blobs', asset.hash);
                if (!blob) continue;
                const ab = await (blob as Blob).arrayBuffer();
                const bytes = new Uint8Array(ab);
                let binary = '';
                const chunk = 0x8000;
                for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
                assetsBase64[asset.hash] = btoa(binary);
              } catch { /* ignore asset error */ }
            }
          } catch { /* ignore assets read */ }
        }

        const buildRes = await (window as any).api?.buildStaticSite?.({ project: selectedProject, assets: assetsBase64, useTempOutput: true });
        if (!buildRes || !buildRes.ok) {
          const err = 'Preview build failed: ' + (buildRes?.error || 'unknown');
          try { (window as any).__py_preview_log.push(err); window.dispatchEvent(new CustomEvent('py:preview:log', { detail: { line: err } })); } catch { }
          window.dispatchEvent(new CustomEvent('py:notify', { detail: { type: 'error', message: err, persistent: false } }));
          setStarting(false);
          return;
        }
        try { const msg = `Preview build output: ${buildRes.path}`; (window as any).__py_preview_log.push(msg); window.dispatchEvent(new CustomEvent('py:preview:log', { detail: { line: msg } })); } catch { }

        const startRes = await (window as any).api?.previewStartServer?.({ distDir: buildRes.path });
        if (!startRes || !startRes.ok) {
          const err = 'Failed to start preview server: ' + (startRes?.error || 'unknown');
          try { (window as any).__py_preview_log.push(err); window.dispatchEvent(new CustomEvent('py:preview:log', { detail: { line: err } })); } catch { }
          window.dispatchEvent(new CustomEvent('py:notify', { detail: { type: 'error', message: err, persistent: false } }));
          setStarting(false);
          return;
        }

        try { const msg = `Preview running: ${startRes.localUrl} (LAN: ${startRes.lanUrl})`; (window as any).__py_preview_log.push(msg); window.dispatchEvent(new CustomEvent('py:preview:log', { detail: { line: msg } })); } catch { }
        window.dispatchEvent(new CustomEvent('py:notify', { detail: { type: 'success', message: 'Local preview started', href: startRes.localUrl, ctaLabel: 'Open', persistent: false } }));
        // persist and broadcast state for late-mounted UIs
        try { (window as any).__py_preview_state = { running: true, localUrl: startRes.localUrl, lanUrl: startRes.lanUrl }; } catch { }
        window.dispatchEvent(new CustomEvent('py:preview:state', { detail: { running: true, localUrl: startRes.localUrl, lanUrl: startRes.lanUrl } }));
      } catch (err) {
        window.dispatchEvent(new CustomEvent('py:notify', { detail: { type: 'error', message: 'Preview start failed', persistent: false } }));
      } finally {
        if (mounted) setStarting(false);
      }
    };

    window.addEventListener('py:preview-start-request', handler as EventListener);
    return () => { mounted = false; window.removeEventListener('py:preview-start-request', handler as EventListener); };
  }, [selectedProject, assetList, starting]);

  return null;
}

// Tiny component to reroute legacy /modify to /editor without importing Navigate inline in JSX.
function LegacyModifyRedirect() { return <Navigate to="/editor" replace />; }