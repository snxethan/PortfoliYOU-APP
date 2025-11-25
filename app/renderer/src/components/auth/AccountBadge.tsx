import { useAuth } from "../../providers/AuthProvider";

export default function AccountBadge({ onClick }: { onClick?: () => void }) {
  const { user } = useAuth();
  if (!user) return <div className="opacity-70">Not logged in</div>;
  const label = user.email ?? user.uid;
  const initial = label ? label.charAt(0).toUpperCase() : 'U';
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-3 text-sm text-[color:var(--fg)] hover:bg-[color:var(--muted)]/40 rounded-md px-2 py-1 transition">
      <div className="w-7 h-7 rounded-full bg-[color:var(--muted)]/30 border border-[color:var(--border)] flex items-center justify-center text-xs font-semibold">
        {initial}
      </div>
      <div className="text-left">
        <div className="font-medium text-sm leading-tight">Logged in</div>
        <div className="text-[12px] text-[color:var(--fg-muted)] truncate max-w-[12rem]">{label}</div>
      </div>
    </button>
  );
}
