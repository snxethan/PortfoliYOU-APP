import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { Home, Wrench, UploadCloud, ChevronLeft, ChevronRight, Sun, Moon } from "lucide-react";

import { useProjects } from "../providers/ProjectsProvider";

import SignInCard from "./auth/SignInCard";

export default function Sidebar() {
	const base = "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-[color:var(--fg)] border border-transparent hover:bg-[color:var(--muted)]/60 hover:border-[color:var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]";
	const { selectedProjectId } = useProjects();
	const [pulseAccount, setPulseAccount] = useState(false);
	const [collapsed, setCollapsed] = useState<boolean>(() => {
		try { return localStorage.getItem('py_sidebar_collapsed') === '1'; } catch (e) { void e; return false; }
	});
	const [theme, setTheme] = useState<'dark'|'light'>(() => {
		try { return (localStorage.getItem('py_theme') as 'dark'|'light') || 'dark'; } catch { return 'dark'; }
	});

	useEffect(() => {
		const w = collapsed ? '2.75rem' : '15rem';
		try { localStorage.setItem('py_sidebar_collapsed', collapsed ? '1' : '0'); } catch (e) { void e; }
		document.documentElement.style.setProperty('--sidebar-w', w);
		window.dispatchEvent(new CustomEvent('py:sidebar-collapsed', { detail: { collapsed } }));
	}, [collapsed]);

	useEffect(() => {
		try { localStorage.setItem('py_theme', theme); } catch (e) { void e; }
		document.documentElement.setAttribute('data-theme', theme);
	}, [theme]);

	useEffect(() => {
		const onPulse = () => {
			setPulseAccount(true);
			setTimeout(() => setPulseAccount(false), 2000);
		};
		window.addEventListener('py:highlight-account', onPulse);
		return () => window.removeEventListener('py:highlight-account', onPulse);
	}, []);
	return (
		<aside className="h-screen sticky top-0 p-3 space-y-2 border-r border-[color:var(--border)] bg-[color:var(--muted)] flex flex-col overflow-hidden"
			style={{ width: 'var(--sidebar-w,15rem)' }}
		>
			<div className="flex items-center justify-between">
				{!collapsed && (
					<div className="px-2 py-1 text-xs uppercase tracking-wide text-[color:var(--fg-muted)]">DASHBOARD</div>
				)}
				<div className="flex items-center gap-1">
					{!collapsed && (
						<button
							className="btn btn-ghost btn-xs p-1"
							onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
							title={theme === 'dark' ? 'Switch to Light mode' : 'Switch to Dark mode'}
						>
							{theme === 'dark' ? <Sun size={14}/> : <Moon size={14}/>}
						</button>
					)}
					<button
						className="btn btn-ghost btn-xs p-1"
						onClick={() => setCollapsed(v => !v)}
						title={collapsed ? 'Expand' : 'Collapse'}
					>
						{collapsed ? <ChevronRight size={14}/> : <ChevronLeft size={14}/>} 
					</button>
				</div>
			</div>

			{!collapsed && (
				<NavLink to="/" end className={({isActive}) => `${base} ${isActive ? 'nav-active' : ''}`}>
					<Home size={16}/> Home
				</NavLink>
			)}
			{selectedProjectId && (
				<>
					{!collapsed && (
						<>
							<NavLink to="/editor" className={({isActive}) => `${base} ${isActive ? 'nav-active' : ''}`}>
								<Wrench size={16}/> Editor 
							</NavLink>
							<NavLink to="/deploy" className={({isActive}) => `${base} ${isActive ? 'nav-active' : ''}`}>
								<UploadCloud size={16}/> Deploy 
							</NavLink>
						</>
					)}
				</>
			)}

			<div className={`mt-auto pt-4 border-t border-[color:var(--border)] ${pulseAccount ? 'highlight-pulse' : ''}`}>
				{!collapsed && <SignInCard />}
			</div>
		</aside>
	);
}