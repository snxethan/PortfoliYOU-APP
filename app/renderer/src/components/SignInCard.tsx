import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Mail, Lock, AlertCircle, Loader2 } from "lucide-react";

import { useAuth } from "../providers/AuthProvider";
import { signInGoogle, emailSignIn, emailSignUp, logout } from "../lib/auth";

export default function SignInCard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setMsg(null);
    setIsGoogleLoading(true);
    try {
      await signInGoogle();
    } catch (error: unknown) {
      const e = error as { message?: string } | undefined;
      setMsg(e?.message || "Failed to sign in with Google");
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // If user closes the Google popup window, focus returns to our app; ensure button resets immediately
  useEffect(() => {
    const onFocus = () => setIsGoogleLoading(false);
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      // Clear local state and redirect to home/landing page
      navigate('/', { replace: true });
    } catch (error: unknown) {
      console.error('Failed to logout:', error);
    }
  };

  if (!user) {
    return (
      <div className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--fg-muted)]">Account</div>

        {/* Email sign-in (always visible when signed out) */}
        <div className="space-y-2">
          <div className="relative">
            <Mail size={14} className="absolute left-2 top-2.5 text-[color:var(--fg-muted)]" />
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="input pl-8"
            />
          </div>
          <div className="relative">
            <Lock size={14} className="absolute left-2 top-2.5 text-[color:var(--fg-muted)]" />
            <input
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="Password"
              type="password"
              className="input pl-8"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                setMsg(null);
                try { await emailSignIn(email, pw); } catch (e: unknown) { const ex = e as { message?: string } | undefined; setMsg(ex?.message || 'Failed to sign in'); }
              }}
              className="btn btn-outline flex-1"
            >
              Sign in
            </button>
            <button
              onClick={async () => {
                setMsg(null);
                try { await emailSignUp(email, pw); setMsg("Verification email sent."); }
                catch (e: unknown) { const ex = e as { message?: string } | undefined; setMsg(ex?.message || 'Failed to sign up'); }
              }}
              className="btn btn-outline flex-1"
            >
              Create
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-2 text-[color:var(--fg-muted)]">
          <div className="h-px flex-1 bg-[color:var(--border)]" />
          <span className="text-[10px] font-semibold tracking-wider">OR</span>
          <div className="h-px flex-1 bg-[color:var(--border)]" />
        </div>

        {/* Google below with higher-contrast text */}
        <button
          onClick={handleGoogleSignIn}
          disabled={isGoogleLoading}
          className="btn btn-google w-full flex items-center justify-center gap-2"
        >
          {isGoogleLoading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Signing in...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </>
          )}
        </button>

        {msg && (
          <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-md p-2">
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
            <span>{msg}</span>
          </div>
        )}
      </div>
    );
  }

  const verified = user.emailVerified ?? false;
  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--fg-muted)]">Account</div>
      <ClickableAccountCard
        email={user.email ?? user.uid}
        onClick={() => {
          // Navigate first, then trigger highlight after the Home page mounts
          navigate('/', { replace: false });
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('py:highlight-account'));
          }, 100);
        }}
      />
      {!verified && (
        <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
          <span>Email not verified. Check inbox before using cloud features.</span>
        </div>
      )}
      <button 
        onClick={handleLogout} 
        className="btn btn-ghost hover-accent w-full gap-2"
      >
        <LogOut size={14} />
        Sign out
      </button>
    </div>
  );
}

function ClickableAccountCard({ email, onClick }: { email: string; onClick: () => void; }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-xs w-full text-left leading-relaxed bg-[color:var(--bg)] border border-[color:var(--accent)] rounded-md p-3 hover:border-[color:var(--accent-600)] hover:bg-[color:var(--muted)]/60 hover-accent transition-colors"
      title="Go to account section"
    >
      <div className="font-medium text-[color:var(--fg)]">Logged in</div>
      <div className="text-[color:var(--fg-muted)] break-all mt-1">{email}</div>
    </button>
  );
}
