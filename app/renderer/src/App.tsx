import { HashRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Suspense, lazy, useEffect, useState, useCallback, useRef } from "react";

import { startPreviewServer } from "./lib/previewServer";
import { captureGlobalStyleSnapshot } from "./lib/styleSnapshot";
import { appendPreviewLog, setPreviewState } from "./lib/previewInterop";
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
import { getWidgetThemeSnapshot, themeSnapshotToCss } from "./widgets/theme";
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
      <HashRouter>
        <NotificationsProvider>
          <ProjectsProvider>
            <AssetsProvider>
              <PortfolioSettingsProvider>
                <SaveHotkeys />
                <GlobalPreviewStarter />
                <GlobalZoomControls />
                <NotificationsUI />
                <div className="min-h-screen bg-[color:var(--bg)]" style={{ paddingTop: 'var(--frame-bar-h, 36px)' }}>
                  <FrameBar />
                  <Sidebar />
                  <div
                    style={{ marginLeft: 'var(--sidebar-w, 15rem)' }}
                    className="min-h-screen flex flex-col px-8 pb-12 pt-6 transition-[margin-left] duration-200 min-w-0"
                  >
                    <PortfolioIslandWrapper />
                    <main className="flex-1 min-w-0">
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
              </PortfolioSettingsProvider>
            </AssetsProvider>
          </ProjectsProvider>
        </NotificationsProvider>
      </HashRouter>
    </ErrorBoundary>
  );
}

function SaveHotkeys() {
  const { selectedProjectId, selectedProject, saveProject, saveCloudProjectNow } = useProjects();
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const s = e.key.toLowerCase() === 's';
      const mod = e.ctrlKey || e.metaKey;
      if (mod && s) {
        e.preventDefault();
        if (selectedProjectId) {
          const isCloudProject = selectedProject && (selectedProject.storage ?? 'local') === 'cloud';
          if (isCloudProject && !e.shiftKey) {
            void saveCloudProjectNow(selectedProjectId);
          } else {
            saveProject(selectedProjectId, { saveAs: e.shiftKey });
          }
        }
      }
    }
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true } as EventListenerOptions);
  }, [selectedProjectId, selectedProject, saveProject, saveCloudProjectNow]);
  return null;
}

const MIN_APP_ZOOM = 0.8;
const MAX_APP_ZOOM = 1.6;

function PortfolioIslandWrapper() {
  // Show island when there's a selected project, even on home page
  // The island itself handles its visibility state
  return <PortfolioIsland />;
}

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
  const { selectedProject, selectedProjectId } = useProjects();
  const { list: assetList } = useAssets();
  const [starting, setStarting] = useState(false);
  const selectedProjectCloudId = selectedProject?._cloudId ?? selectedProjectId ?? selectedProject?.id ?? null;
  const location = useLocation();
  const isDeployRoute = location.pathname.startsWith('/deploy');
  const stopInFlight = useRef(false);
  const reloadInFlight = useRef(false);

  const startPreview = useCallback(async (reason: 'start' | 'reload' = 'start') => {
    if (!selectedProject || !selectedProjectCloudId) return;
    if (starting) return;
    setStarting(true);
    try {
      const toastMessage = reason === 'reload' ? 'Reloading preview build…' : 'Building preview...';
      window.dispatchEvent(new CustomEvent('py:notify', { detail: { type: 'info', message: toastMessage, persistent: false } }));
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

      const activeTheme = selectedProject?.themes?.[selectedProject.activeThemeId] ?? null;
      const [styleSnapshot, themeSnapshot] = await Promise.all([
        captureGlobalStyleSnapshot(),
        Promise.resolve(getWidgetThemeSnapshot(activeTheme))
      ]);
      console.info('App.GlobalPreviewStarter: building preview', { projectId: selectedProject?.id, reason });
      const buildStartTs = Date.now();
      const buildRes = await (window as any).api?.buildStaticSite?.({
        project: selectedProject,
        assets: assetsBase64,
        useTempOutput: true,
        globalCss: { tailwind: styleSnapshot.tailwindCss },
        themeCss: themeSnapshotToCss(themeSnapshot)
      });
      if (!buildRes || !buildRes.ok) {
        const err = 'Preview build failed: ' + (buildRes?.error || 'unknown');
        appendPreviewLog(selectedProjectCloudId, err);
        try { window.dispatchEvent(new CustomEvent('py:preview:log', { detail: { line: err, projectId: selectedProjectCloudId } })); } catch { }
        window.dispatchEvent(new CustomEvent('py:notify', { detail: { type: 'error', message: err, persistent: false } }));
        setStarting(false);
        return;
      }
      try {
        const msg = `Preview build output: ${buildRes.path}`;
        appendPreviewLog(selectedProjectCloudId, msg);
        window.dispatchEvent(new CustomEvent('py:preview:log', { detail: { line: msg, projectId: selectedProjectCloudId } }));
        console.info('App.GlobalPreviewStarter: preview build succeeded', { projectId: selectedProject?.id, buildPath: buildRes.path, durationMs: Date.now() - buildStartTs });
      } catch { }

      const meta = (selectedProject as any)?.portfolioMeta?.buildSettings || {};
      const previewMeta = (meta && meta.preview) || {};
      const hostOpt = previewMeta.host || meta.previewHost || undefined;
      const portVal = Number(previewMeta.port || meta.previewPort || 0) || 0;
      const startRes = await startPreviewServer(buildRes.path, hostOpt, portVal || undefined);
      if (!startRes || !startRes.ok) {
        const err = 'Failed to start preview server: ' + (startRes?.error || 'unknown');
        appendPreviewLog(selectedProjectCloudId, err);
        try { window.dispatchEvent(new CustomEvent('py:preview:log', { detail: { line: err, projectId: selectedProjectCloudId } })); } catch { }
        window.dispatchEvent(new CustomEvent('py:notify', { detail: { type: 'error', message: err, persistent: false } }));
        setStarting(false);
        return;
      }

      try {
        const msg = `Preview running: ${startRes.localUrl} (LAN: ${startRes.lanUrl})`;
        appendPreviewLog(selectedProjectCloudId, msg);
        window.dispatchEvent(new CustomEvent('py:preview:log', { detail: { line: msg, projectId: selectedProjectCloudId } }));
      } catch { }
      window.dispatchEvent(new CustomEvent('py:notify', { detail: { type: 'success', message: 'Local preview started', href: startRes.localUrl, ctaLabel: 'Open', persistent: false } }));
      setPreviewState(selectedProjectCloudId, { running: true, localUrl: startRes.localUrl, lanUrl: startRes.lanUrl });
      window.dispatchEvent(new CustomEvent('py:preview:state', { detail: { projectId: selectedProjectCloudId, running: true, localUrl: startRes.localUrl, lanUrl: startRes.lanUrl } }));
    } catch {
      window.dispatchEvent(new CustomEvent('py:notify', { detail: { type: 'error', message: 'Preview start failed', persistent: false } }));
    } finally {
      setStarting(false);
    }
  }, [assetList, selectedProject, selectedProjectCloudId, starting]);

  const stopPreview = useCallback(async () => {
    if (!selectedProjectCloudId) return false;
    const stoppingLine = 'Stopping local preview...';
    appendPreviewLog(selectedProjectCloudId, stoppingLine);
    try { window.dispatchEvent(new CustomEvent('py:preview:log', { detail: { line: stoppingLine, projectId: selectedProjectCloudId } })); } catch { }
    try {
      const res = await (window as any).api?.previewStopServer?.();
      if (!res || !res.ok) {
        const err = '❌ Failed to stop preview: ' + (res?.error || 'unknown');
        appendPreviewLog(selectedProjectCloudId, err);
        try { window.dispatchEvent(new CustomEvent('py:preview:log', { detail: { line: err, projectId: selectedProjectCloudId } })); } catch { }
        window.dispatchEvent(new CustomEvent('py:notify', { detail: { type: 'error', message: 'Failed to stop preview: ' + (res?.error || 'unknown'), persistent: false } }));
        return false;
      }
      const stoppedLine = '✅ Preview stopped';
      appendPreviewLog(selectedProjectCloudId, stoppedLine);
      try { window.dispatchEvent(new CustomEvent('py:preview:log', { detail: { line: stoppedLine, projectId: selectedProjectCloudId } })); } catch { }
      window.dispatchEvent(new CustomEvent('py:notify', { detail: { type: 'info', message: 'Local preview stopped', persistent: false } }));
      setPreviewState(selectedProjectCloudId, { running: false });
      window.dispatchEvent(new CustomEvent('py:preview:state', { detail: { projectId: selectedProjectCloudId, running: false } }));
      return true;
    } catch {
      const errMsg = '❌ Failed to stop preview.';
      appendPreviewLog(selectedProjectCloudId, errMsg);
      try { window.dispatchEvent(new CustomEvent('py:preview:log', { detail: { line: errMsg, projectId: selectedProjectCloudId } })); } catch { }
      window.dispatchEvent(new CustomEvent('py:notify', { detail: { type: 'error', message: errMsg, persistent: false } }));
      return false;
    }
  }, [selectedProjectCloudId]);

  useEffect(() => {
    if (isDeployRoute) return;
    let mounted = true;
    const handler = (e: any) => {
      if (!mounted) return;
      const requestedProjectId = e?.detail?.projectId;
      if (requestedProjectId && selectedProjectCloudId && requestedProjectId !== selectedProjectCloudId) return;
      void startPreview('start');
    };
    window.addEventListener('py:preview-start-request', handler as EventListener);
    return () => { mounted = false; window.removeEventListener('py:preview-start-request', handler as EventListener); };
  }, [isDeployRoute, selectedProjectCloudId, startPreview]);

  useEffect(() => {
    if (isDeployRoute) return;
    const handler = (e: any) => {
      if (!selectedProjectCloudId) return;
      const requestedProjectId = e?.detail?.projectId;
      if (requestedProjectId && requestedProjectId !== selectedProjectCloudId) return;
      if (stopInFlight.current) return;
      stopInFlight.current = true;
      void (async () => {
        await stopPreview();
      })().finally(() => { stopInFlight.current = false; });
    };
    window.addEventListener('py:preview-stop-request', handler as EventListener);
    return () => window.removeEventListener('py:preview-stop-request', handler as EventListener);
  }, [isDeployRoute, selectedProjectCloudId, stopPreview]);

  useEffect(() => {
    if (isDeployRoute) return;
    const handler = (e: any) => {
      if (!selectedProjectCloudId) return;
      const requestedProjectId = e?.detail?.projectId;
      if (requestedProjectId && requestedProjectId !== selectedProjectCloudId) return;
      if (reloadInFlight.current) return;
      reloadInFlight.current = true;
      void (async () => {
        const reloadLine = 'Reloading local preview...';
        appendPreviewLog(selectedProjectCloudId, reloadLine);
        try { window.dispatchEvent(new CustomEvent('py:preview:log', { detail: { line: reloadLine, projectId: selectedProjectCloudId } })); } catch { }
        window.dispatchEvent(new CustomEvent('py:notify', { detail: { type: 'info', message: 'Reloading preview…', persistent: false } }));
        const stopped = await stopPreview();
        if (stopped) {
          await new Promise((res) => setTimeout(res, 250));
          await startPreview('reload');
        }
      })().finally(() => { reloadInFlight.current = false; });
    };
    window.addEventListener('py:preview-reload-request', handler as EventListener);
    return () => window.removeEventListener('py:preview-reload-request', handler as EventListener);
  }, [isDeployRoute, selectedProjectCloudId, startPreview, stopPreview]);

  return null;
}

// Tiny component to reroute legacy /modify to /editor without importing Navigate inline in JSX.
function LegacyModifyRedirect() { return <Navigate to="/editor" replace />; }