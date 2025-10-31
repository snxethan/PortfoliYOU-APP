import { useAuth } from "../providers/AuthProvider";

export default function AccountBadge() {
  const { user } = useAuth();
  if (!user) return <div className="opacity-70">Not Logged in</div>;
  return (
    <div className="text-xs leading-tight inline-flex items-center gap-2">
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-[color:var(--accent-600)] bg-[color:var(--muted)]">
        <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--accent)]"/>
        <span className="font-semibold">Logged in</span>
      </span>
      <span className="opacity-70 break-all">{user.email ?? user.uid}</span>
    </div>
  );
}
