import { BrowserRouter, Routes, Route } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import HomePage from "./pages/Home";
import ModifyPage from "./pages/Modify";
import DeployPage from "./pages/Deploy";
import ProtectedRoute from "./components/ProtectedRoute";
import { ProjectsProvider } from "./providers/ProjectsProvider";
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
<BrowserRouter>
<ProjectsProvider>
<div className="min-h-screen grid grid-cols-[15rem_1fr]">
<Sidebar />
<div className="min-h-screen flex flex-col">
<Header />
<main className="flex-1">
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
</main>
</div>
</div>
</ProjectsProvider>
</BrowserRouter>
);
}