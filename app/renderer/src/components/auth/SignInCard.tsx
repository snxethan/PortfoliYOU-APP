import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Mail, Lock, AlertCircle, Loader2, Info } from "lucide-react";

import { useAuth } from "../../providers/AuthProvider";
import { useNotifications } from "../../providers/NotificationsProvider";
import { signInGoogle, emailSignIn, emailSignUp, logout } from "../../lib/auth";

import { AuthCta } from "./AuthCta";

export default function SignInCard() {
  const { user } = useAuth();
  const { add } = useNotifications();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  // Popup state for CTA info (must be declared unconditionally)
  const [showInfo, setShowInfo] = useState(false);
  const popRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const [popStyle, setPopStyle] = useState<React.CSSProperties | undefined>(undefined);
  // Compute placement relative to the info button and clamp to viewport
  const placePopup = () => {
    const btn = btnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 8;
    const desiredWidth = Math.min(320, vw - margin * 2);
    // Try right side first
    let left = r.right + margin;
    if (left + desiredWidth > vw - margin) {
      // Try left side
      left = r.left - desiredWidth - margin;
    }
    if (left < margin) left = margin;
    // Prefer below; if not enough space, place above
    let top = r.bottom + margin;
    let maxHeight = Math.min(Math.round(vh * 0.7), vh - top - margin);
    if (maxHeight < 160) {
      // place above
      const idealTop = r.top - margin - Math.round(vh * 0.7);
      top = Math.max(margin, idealTop);
      maxHeight = Math.min(Math.round(vh * 0.7), r.top - margin - top);
    }
    if (maxHeight < 120) maxHeight = 120;
    setPopStyle({ position: 'fixed', top, left, width: desiredWidth, maxHeight, overflow: 'auto', zIndex: 50 });
  };

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!showInfo) return;
      const t = e.target as Node | null;
      if (popRef.current && popRef.current.contains(t)) return;
      if (btnRef.current && btnRef.current.contains(t)) return;
      setShowInfo(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [showInfo]);

  // Position and clamp the popup within the viewport when opened
  useEffect(() => {
    if (!showInfo) return;
    placePopup();
    window.addEventListener('resize', placePopup);
    window.addEventListener('scroll', placePopup, true);
    return () => { window.removeEventListener('resize', placePopup); window.removeEventListener('scroll', placePopup, true); };
  }, [showInfo]);

  const handleGoogleSignIn = async () => {
    setMsg(null);
    setIsGoogleLoading(true);
    try {
  await signInGoogle();
  add({ type: 'success', message: 'Signed in with Google.', persistent: true });
    } catch (error: unknown) {
      const e = error as { message?: string } | undefined;
      setMsg(e?.message || "Failed to sign in with Google");
      add({ type: 'error', message: e?.message || 'Failed to sign in with Google', persistent: true });
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
  add({ type: 'info', message: 'Signed out.', persistent: true });
    } catch (error: unknown) {
      console.error('Failed to logout:', error);
      const e = error as { message?: string } | undefined;
      add({ type: 'error', message: e?.message || 'Failed to sign out', persistent: true });
    }
  };

  if (!user) {
    return (
      <div className="space-y-3 relative">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--fg-muted)]">Account</div>
          <button
            ref={btnRef}
            className="btn btn-ghost btn-xs"
            title="About cloud & sign-in"
            onClick={() => {
              if (!showInfo) { placePopup(); setShowInfo(true); }
              else { setShowInfo(false); }
            }}
            aria-expanded={showInfo}
            aria-controls="py-auth-cta-pop"
          >
            <Info size={14} />
          </button>
        </div>
        {showInfo && popStyle && (
          <div id="py-auth-cta-pop" ref={popRef} style={popStyle} className="surface p-2 border border-[color:var(--accent)] shadow-xl">
            <AuthCta />
          </div>
        )}

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
                try { await emailSignIn(email, pw); add({ type: 'success', message: 'Signed in.', persistent: true }); }
                catch (e: unknown) { const ex = e as { message?: string } | undefined; setMsg(ex?.message || 'Failed to sign in'); add({ type: 'error', message: ex?.message || 'Failed to sign in', persistent: true }); }
              }}
              className="btn btn-outline flex-1"
            >
              Sign in
            </button>
            <button
              onClick={async () => {
                setMsg(null);
                try { await emailSignUp(email, pw); setMsg("Verification email sent."); add({ type: 'success', message: 'Account created. Verification email sent.', persistent: true }); }
                catch (e: unknown) { const ex = e as { message?: string } | undefined; setMsg(ex?.message || 'Failed to sign up'); add({ type: 'error', message: ex?.message || 'Failed to sign up', persistent: true }); }
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
