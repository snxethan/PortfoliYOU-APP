import { NavLink } from "react-router-dom";
import SignInCard from "./SignInCard";
import { Home, Wrench, UploadCloud } from "lucide-react";
import { useProjects } from "../providers/ProjectsProvider";

export default function Sidebar() {
const base = "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-[color:var(--fg)] hover:bg-[color:var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--primary)]";
const { hasAny } = useProjects();
return (
<aside className="w-60 h-screen sticky top-0 p-3 space-y-2 border-r border-[color:var(--border)] bg-[color:var(--muted)] flex flex-col">
<div className="px-2 py-1 text-xs uppercase tracking-wide text-[color:var(--fg-muted)]">Portfoli-you</div>


<NavLink to="/" end className={({isActive}) => `${base} ${isActive ? 'nav-active' : ''}`}>
<Home size={16}/> Home
</NavLink>
{hasAny && (
<>
<NavLink to="/modify" className={({isActive}) => `${base} ${isActive ? 'nav-active' : ''}`}>
<Wrench size={16}/> Modify
</NavLink>
<NavLink to="/deploy" className={({isActive}) => `${base} ${isActive ? 'nav-active' : ''}`}>
<UploadCloud size={16}/> Deploy
</NavLink>
</>
)}


<div className="mt-auto pt-4 border-t border-[color:var(--border)]">
<SignInCard />
</div>
</aside>
);
}