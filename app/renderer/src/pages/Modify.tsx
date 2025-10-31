import { useProjects } from "../providers/ProjectsProvider";

export default function ModifyPage() {
	const { selectedProject } = useProjects();
	return (
		<div className="p-6 space-y-6">
			{!selectedProject && (
				<div className="surface p-4 border border-[color:var(--border)] text-sm text-[color:var(--fg-muted)]">
					No portfolio selected. Go to Home and open one.
				</div>
			)}
			<section className="surface p-5">
				<h2 className="section-title mb-2">Editor shell {selectedProject ? `· ${selectedProject.name}` : ""}</h2>
				<p className="section-subtitle">Drag-and-drop area placeholder. Content panel placeholder.</p>
				<div className="mt-4 grid grid-cols-12 gap-3">
					<div className="col-span-9 h-64 rounded bg-[color:var(--bg)] border border-[color:var(--border)] flex items-center justify-center text-[color:var(--fg-muted)]">
						Canvas
					</div>
					<div className="col-span-3 h-64 rounded bg-[color:var(--bg)] border border-[color:var(--border)] p-3">
						<div className="text-sm font-medium mb-2">Content</div>
						<div className="text-xs text-[color:var(--fg-muted)]">Fields appear here.</div>
					</div>
				</div>
			</section>
		</div>
	);
}