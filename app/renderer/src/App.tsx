import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Suspense, lazy, useEffect } from "react";

import Sidebar from "./components/Sidebar";
import PortfolioIsland from "./components/PortfolioIsland";
const HomePage = lazy(() => import("./pages/Home"));
const EditorPage = lazy(() => import("./pages/Editor"));
const DeployPage = lazy(() => import("./pages/Deploy"));
import ProtectedRoute from "./components/auth/ProtectedRoute";
import { ProjectsProvider, useProjects } from "./providers/ProjectsProvider";
import { NotificationsProvider } from "./providers/NotificationsProvider";
import NotificationsUI from "./components/Notifications";
import ErrorBoundary from "./components/ErrorBoundary";
import { useAuth } from "./providers/AuthProvider";


export default function App() {
  const { loading } = useAuth();

  // Show spinner while checking initial auth state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[color:var(--bg)]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[color:var(--border)] border-t-[color:var(--primary)] rounded-full animate-spin"></div>
          <p className="text-sm text-[color:var(--fg-muted)]">Initializing...</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <NotificationsProvider>
          <ProjectsProvider>
            <SaveHotkeys />
            <NotificationsUI />
            <div className="min-h-screen grid grid-cols-[var(--sidebar-w,15rem)_1fr]">
              <Sidebar />
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

// Tiny component to reroute legacy /modify to /editor without importing Navigate inline in JSX.
function LegacyModifyRedirect() { return <Navigate to="/editor" replace />; }