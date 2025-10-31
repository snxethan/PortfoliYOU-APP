import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { Home, Wrench, UploadCloud } from "lucide-react";

import { useProjects } from "../providers/ProjectsProvider";

import SignInCard from "./SignInCard";

export default function Sidebar() {
	const base = "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-[color:var(--fg)] border border-transparent hover:bg-[color:var(--muted)]/60 hover:border-[color:var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]";
	const { selectedProjectId } = useProjects();
	const [pulseAccount, setPulseAccount] = useState(false);

	useEffect(() => {
		const onPulse = () => {
			setPulseAccount(true);
			setTimeout(() => setPulseAccount(false), 2000);
		};
		window.addEventListener('py:highlight-account', onPulse);
		return () => window.removeEventListener('py:highlight-account', onPulse);
	}, []);
	return (
		<aside className="w-60 h-screen sticky top-0 p-3 space-y-2 border-r border-[color:var(--border)] bg-[color:var(--muted)] flex flex-col">
			<div className="px-2 py-1 text-xs uppercase tracking-wide text-[color:var(--fg-muted)]">DASHBOARD</div>

			<NavLink to="/" end className={({isActive}) => `${base} ${isActive ? 'nav-active' : ''}`}>
				<Home size={16}/> Home
			</NavLink>
			{selectedProjectId && (
				<>
					<NavLink to="/modify" className={({isActive}) => `${base} ${isActive ? 'nav-active' : ''}`}>
						<Wrench size={16}/> Modify 
					</NavLink>
					<NavLink to="/deploy" className={({isActive}) => `${base} ${isActive ? 'nav-active' : ''}`}>
						<UploadCloud size={16}/> Deploy 
					</NavLink>
				</>
			)}

			<div className={`mt-auto pt-4 border-t border-[color:var(--border)] ${pulseAccount ? 'highlight-pulse' : ''}`}>
				<SignInCard />
			</div>
		</aside>
	);
}