import { useMemo } from "react";
import { useAuth } from "../providers/AuthProvider";
import { useProjects } from "../providers/ProjectsProvider";
import { Trash2, Play, Edit3, UploadCloud, Info, Cloud, Shield, Zap } from "lucide-react";

function PromoBar() {
	return (
		<div className="surface px-4 py-3 flex items-center gap-3">
			<div className="text-sm font-medium">🚀 PortfoliYOU — build and deploy your portfolio fast</div>
			<div className="ml-auto flex items-center gap-2 text-sm">
				<a className="btn btn-ghost px-2 py-1" href="https://portfoliyou.snxethan.dev" target="_blank" rel="noreferrer">Website</a>
				<a className="btn btn-ghost px-2 py-1" href="https://portfoliyou.snxethan.dev/about" target="_blank" rel="noreferrer">FAQ</a>
				<a className="btn btn-ghost px-2 py-1" href="https://portfoliyou.snxethan.dev/changelog" target="_blank" rel="noreferrer">Changelog</a>
			</div>
		</div>
	);
}

function NotificationBar() {
	return (
		<div className="surface px-4 py-3 flex items-center gap-2">
			<Info size={16} className="text-[color:var(--primary)]"/>
			<span className="text-sm">Tips: Use <span className="font-mono">Ctrl+S</span> to save. Preview breakpoints in Modify.</span>
			<span className="ml-auto badge-live">Status · Ready</span>
		</div>
	);
}

function QuickstartBar({ onCreate, onImport, highlight = false }: { onCreate: () => void; onImport: () => void; highlight?: boolean }) {
	return (
		<section className={`surface p-5 ${highlight ? 'outline outline-2 outline-[color:var(--accent)]' : ''}`}>
			<div className="flex flex-col md:flex-row md:items-center gap-3">
				<div className="flex-1">
					<h3 className="text-base font-semibold">Quickstart</h3>
					<p className="text-sm text-[color:var(--fg-muted)]">Create a new portfolio or import an existing .portfoliyou file.</p>
				</div>
				<div className="flex gap-2">
					<button className="btn btn-primary" onClick={onCreate}>New portfolio</button>
					<button className="btn btn-outline" onClick={onImport}>Import .portfoliyou</button>
				</div>
			</div>
		</section>
	);
}

export default function HomePage() {
	const { user } = useAuth();
	const { projects, hasAny, addProject, importProject } = useProjects();

	// Empty state: highlight Quickstart and guide to sign in
	if (!hasAny) {
		return (
			<div className="p-6 space-y-6">
				<PromoBar />
				<NotificationBar />
				<QuickstartBar onCreate={() => addProject()} onImport={() => importProject()} highlight />

				<section className="surface p-5">
					<h3 className="font-semibold mb-3 flex items-center gap-2">
						<Cloud size={18} className="text-[color:var(--primary)]" />
						Enable Cloud Sync (optional)
					</h3>
					<div className="space-y-3 text-sm text-[color:var(--fg-muted)]">
						<div className="flex items-start gap-2">
							<Shield size={16} className="mt-0.5 text-[color:var(--primary)]" />
							<div>
								<div className="font-medium text-[color:var(--fg)]">Secure Backups</div>
								<div>Never lose your work with automatic cloud backups</div>
							</div>
						</div>
						<div className="flex items-start gap-2">
							<Zap size={16} className="mt-0.5 text-[color:var(--primary)]" />
							<div>
								<div className="font-medium text-[color:var(--fg)]">Easy Deployment</div>
								<div>Deploy to the web with one click</div>
							</div>
						</div>
					</div>
					<div className="mt-4 p-3 bg-[color:var(--muted)] border border-[color:var(--border)] rounded-md">
						<p className="text-xs text-[color:var(--fg-muted)]">👈 Sign in using the sidebar to unlock cloud features</p>
					</div>
				</section>
			</div>
		);
	}

	const recent = useMemo(() => projects.slice(0, 6), [projects]);

	return (
		<div className="p-6 space-y-6">
			<PromoBar />
			<NotificationBar />
			<QuickstartBar onCreate={() => addProject()} onImport={() => importProject()} />

			{/* 1st section: PY intro + FAQs */}
			<section className="surface p-5">
				<h2 className="text-lg font-semibold mb-2">Welcome</h2>
				<p className="text-sm text-[color:var(--fg-muted)]">Build locally. Connect for sync. Deploy when ready.</p>
				<details className="mt-3">
					<summary className="cursor-pointer text-sm text-[color:var(--primary)]">FAQs</summary>
					<ul className="mt-2 list-disc pl-5 text-sm text-[color:var(--fg-muted)] space-y-1">
						<li>Local projects never require an account.</li>
						<li>Connecting enables cloud backups and one cloud project slot.</li>
						<li>You can export a static site or use GitHub Pages.</li>
					</ul>
				</details>
			</section>

			{/* 2nd section: recent projects + account */}
			<section className="grid md:grid-cols-2 gap-6">
				<div className="surface p-5">
					<h3 className="font-semibold mb-3">Recent projects</h3>
					{recent.length === 0 ? (
						<div className="text-sm text-[color:var(--fg-muted)]">No recent items.</div>
					) : (
						<ul className="divide-y divide-[color:var(--border)]">
							{recent.map(p => (
								<li key={p.id} className="py-2 flex items-center justify-between gap-3">
									<div>
										<div className="text-sm font-medium">{p.name}</div>
										<div className="text-xs text-[color:var(--fg-muted)]">Updated {new Date(p.updatedAt).toLocaleString()}</div>
									</div>
									<div className="flex gap-1">
										<button className="btn btn-ghost text-xs" title="Open"><Play size={14}/></button>
										<button className="btn btn-ghost text-xs" title="Modify"><Edit3 size={14}/></button>
										<button className="btn btn-ghost text-xs" title="Deploy"><UploadCloud size={14}/></button>
										<button className="btn btn-ghost text-xs" title="Delete"><Trash2 size={14}/></button>
									</div>
								</li>
							))}
						</ul>
					)}
				</div>

				{/* Account panel */}
				<div className="surface p-5">
					<h3 className="font-semibold mb-3">Account</h3>
					{!user ? (
						<div className="space-y-3">
							<p className="text-sm text-[color:var(--fg-muted)]">You are not connected. Sign in to enable sync and cloud backups.</p>
							<div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
								<div className="flex items-center gap-2 mb-2">
									<Cloud size={20} className="text-blue-600" />
									<div className="font-medium text-blue-900">Connect Your Account</div>
								</div>
								<p className="text-xs text-blue-700 mb-3">
									Access cloud features including automatic backups, cross-device sync, and one-click deployment.
								</p>
								<div className="flex items-center gap-2 text-xs text-blue-600 bg-white/50 rounded px-3 py-2">
									<span>👈</span>
									<span>Use the sidebar to sign in with Google or email</span>
								</div>
							</div>
						</div>
					) : (
						<>
							<div className="text-sm">Signed in as <span className="font-mono">{user.email ?? user.uid}</span></div>
							<div className="mt-3 grid grid-cols-2 gap-3 text-sm">
								<div className="surface p-3">
									<div className="text-xs text-[color:var(--fg-muted)]">Cloud usage</div>
									<div className="mt-1 font-semibold">0.0 / 0.5 GB</div>
								</div>
								<div className="surface p-3">
									<div className="text-xs text-[color:var(--fg-muted)]">Cloud projects</div>
									<div className="mt-1 font-semibold">0 / 1</div>
								</div>
							</div>
						</>
					)}
				</div>
			</section>
		</div>
	);
}