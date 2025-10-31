import { Cloud, CheckCircle } from "lucide-react";

import { useAuth } from "../providers/AuthProvider";

export function AuthCta() {
  const { user } = useAuth();
  
  if (user) {
    return (
      <div className="surface p-3">
        <div className="flex items-center gap-2 text-sm text-green-700">
          <CheckCircle size={16} />
          <span>Cloud sync enabled</span>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent('py:highlight-account'))}
      className="w-full text-center surface p-3 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-md hover:border-[color:var(--accent)] hover:bg-white transition-colors"
      title="Open account section in sidebar"
      aria-label="Enable cloud sync: open account section in sidebar"
    >
      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center gap-2">
          <Cloud size={18} className="text-blue-600" />
          <div className="text-sm font-semibold text-blue-900 whitespace-normal leading-snug">
            Sign in to unlock cloud features
          </div>
        </div>
        <div className="text-xs text-blue-700 max-w-full whitespace-normal break-words leading-snug">
          Enable cloud backups and never lose your work. Sign in to your account to sync projects across devices and access them from anywhere.
        </div>
  
      </div>
    </button>
  );
}