import { Navigate } from "react-router-dom";

import { useAuth } from "../providers/AuthProvider";
import { useProjects } from "../providers/ProjectsProvider";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { loading } = useAuth();
  const { hasAny } = useProjects();

  if (loading) {
    // Show spinner while checking auth state
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[color:var(--border)] border-t-[color:var(--primary)] rounded-full animate-spin"></div>
          <p className="text-sm text-[color:var(--fg-muted)]">Loading...</p>
        </div>
      </div>
    );
  }

  if (!hasAny) {
    // Redirect to home if no project exists (regardless of auth state)
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
