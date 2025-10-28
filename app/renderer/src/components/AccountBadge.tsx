import { useAuth } from "../providers/AuthProvider";

export default function AccountBadge() {
  const { user } = useAuth();
  if (!user) return <div className="opacity-70">Not signed in</div>;
  return (
    <div className="text-xs leading-tight">
      <div className="font-semibold">Logged-in</div>
      <div className="opacity-70 break-all">{user.email ?? user.uid}</div>
    </div>
  );
}
