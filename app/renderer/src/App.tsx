import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Suspense, lazy, useEffect } from "react";

import Sidebar from "./components/Sidebar";
import PortfolioIsland from "./components/PortfolioIsland";
const HomePage = lazy(() => import("./pages/Home"));
const ModifyPage = lazy(() => import("./pages/Modify"));
const DeployPage = lazy(() => import("./pages/Deploy"));
import ProtectedRoute from "./components/ProtectedRoute";
import { ProjectsProvider, useProjects } from "./providers/ProjectsProvider";
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
      <ProjectsProvider>
        <SaveHotkeys />
        <div className="min-h-screen grid grid-cols-[15rem_1fr]">
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
                <Route 
                  path="/modify" 
                  element={
                    <ProtectedRoute>
                      <ModifyPage />
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