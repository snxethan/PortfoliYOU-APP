import { useProjects } from "../providers/ProjectsProvider";

export default function DeployPage() {
	const { selectedProject } = useProjects();
	return (
		<div className="p-6 space-y-6">
			{!selectedProject && (
				<div className="surface p-4 border border-[color:var(--border)] text-sm text-[color:var(--fg-muted)]">
					No portfolio selected. Go to Home and open one.
				</div>
			)}
			<section className="surface p-5">
				<h2 className="section-title mb-2">Deploy {selectedProject ? `· ${selectedProject.name}` : ""}</h2>
				<p className="section-subtitle">Pick a method. Configure once. Reuse later.</p>
				<div className="mt-4 grid md:grid-cols-3 gap-3">
					<button className="surface p-4 text-left hover-darker focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]">
						<div className="text-sm font-semibold">Local serve + LAN</div>
						<div className="text-xs text-[color:var(--fg-muted)]">One-click local server</div>
					</button>
					<button className="surface p-4 text-left hover-darker focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]">
						<div className="text-sm font-semibold">Quick share tunnel</div>
						<div className="text-xs text-[color:var(--fg-muted)]">Temporary public URL</div>
					</button>
					<button className="surface p-4 text-left hover-darker focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]">
						<div className="text-sm font-semibold">GitHub Pages</div>
						<div className="text-xs text-[color:var(--fg-muted)]">Push to gh-pages</div>
					</button>
				</div>
			</section>
		</div>
	);
}