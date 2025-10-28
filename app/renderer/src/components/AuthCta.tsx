import { useAuth } from "../providers/AuthProvider";
import { Cloud, CheckCircle } from "lucide-react";

export function AuthCta() {
  const { user } = useAuth();
  
  if (user) {
    return (
      <div className="surface p-4">
        <div className="flex items-center gap-2 text-sm text-green-700">
          <CheckCircle size={16} />
          <span>Cloud sync enabled</span>
        </div>
      </div>
    );
  }

  return (
    <div className="surface p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200">
      <div className="flex items-center gap-2 mb-2">
        <Cloud size={18} className="text-blue-600" />
        <div className="text-sm font-medium text-blue-900">Enable cloud sync</div>
      </div>
      <p className="text-xs text-blue-700 mb-3">
        Sign in to unlock cloud backups and deployment features.
      </p>
      <div className="flex items-center gap-2 text-xs text-blue-600 bg-white/50 rounded px-3 py-2">
        <span>👈</span>
        <span>Sign in using the sidebar</span>
      </div>
    </div>
  );
}