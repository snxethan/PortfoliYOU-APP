import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useProjects } from "../providers/ProjectsProvider";

export default function DeployPage() {
	const { selectedProject } = useProjects();
	const [status, setStatus] = useState<"online" | "offline" | "unknown">("unknown");
	const [lastDeployed, setLastDeployed] = useState<string | null>(null);
	const [previewAvailable, setPreviewAvailable] = useState(false);
	const [exporting, setExporting] = useState(false);
	const [includeAssets, setIncludeAssets] = useState(true);

	useEffect(() => {
		// UI-only placeholder: pretend we check status
		setStatus("unknown");
		setPreviewAvailable(false);
	}, [selectedProject]);

	if (!selectedProject) {
		return (
			<div className="p-6">
				<div className="surface p-4 border border-[color:var(--border)] text-sm text-[color:var(--fg-muted)]">
					No portfolio selected. Go to Home and open one.
				</div>
			</div>
		);
	}

	return (
		<div className="p-6 space-y-6">
			{/* Preview / Status Section */}
			<section className="surface border border-[color:var(--border)] rounded-2xl p-6 shadow-lg shadow-black/20">
				<h2 className="section-title">Portfolio Preview & Status</h2>
				<div className="mt-4 grid md:grid-cols-2 gap-4">
					<div>
						{previewAvailable ? (
							<div className="border rounded overflow-hidden">
								<div className="bg-[color:var(--bg-muted)] p-2 text-xs text-[color:var(--fg-muted)]">Preview (sandbox)</div>
								<div style={{ height: 300 }}>
									<iframe title="live-preview" srcDoc={"<!-- live preview placeholder -->"} className="w-full h-full" />
								</div>
							</div>
						) : (
							<div className="surface p-4 border border-[color:var(--border)] text-sm text-[color:var(--fg-muted)]">Live preview is not available for this project.</div>
						)}
					</div>

					<div className="surface p-4">
						<div className="flex items-start justify-between">
							<div className="flex items-center space-x-3">
								<StatusBadge status={status} large />
								<div>
									<div className="text-sm">{status === "unknown" ? "Unknown" : status === "online" ? "Online" : "Offline"}</div>
									<div className="text-xs text-[color:var(--fg-muted)]">{lastDeployed ? `Last deployed ${lastDeployed}` : "No recent deployments"}</div>
								</div>
							</div>
							<div className="ml-2">
								<button className="btn btn-accent">Refresh</button>
							</div>
						</div>

						<div className="mt-4">
							<button className="btn btn-accent" disabled={!previewAvailable}>Open Preview</button>
						</div>
					</div>
				</div>
			</section>

			{/* Compile / Export Section */}
			<section className="surface border border-[color:var(--border)] rounded-2xl p-6 shadow-lg shadow-black/20">
				<h2 className="section-title">Export your portfolio</h2>
				<div className="mt-4 space-y-3">
					<CollapsibleBlock storageKey="py_export_zip_open" title={"Static ZIP Export"} subtitle={"Create a downloadable ZIP of your portfolio (HTML, CSS, and uploaded assets) you can host anywhere."}>
						<div>
							<label className="flex items-center space-x-2">
								<input type="checkbox" checked={includeAssets} onChange={() => setIncludeAssets((s) => !s)} />
								<span className="text-[color:var(--fg-muted)]">Include uploaded assets</span>
							</label>
							<div className="mt-3 flex items-center space-x-2">
								<button className="btn btn-accent" disabled={exporting} onClick={() => { setExporting(true); setTimeout(() => setExporting(false), 1200); }}>
									{exporting ? "Preparing…" : "Export ZIP"}
								</button>
								<div className="text-xs text-[color:var(--fg-muted)]">You will be able to download the ZIP when ready.</div>
							</div>
						</div>
					</CollapsibleBlock>

					<CollapsibleBlock storageKey="py_export_buildopts_open" title={"Build Options"} subtitle={"Adjust build settings such as base path, minification, and asset handling."}>
						<div className="text-sm text-[color:var(--fg-muted)]">Toggle options that affect how the static site is generated. These settings change filenames, base paths, and whether assets are included in the ZIP.</div>
					</CollapsibleBlock>
				</div>
			</section>

			{/* Deployment Section */}
			<section className="surface border border-[color:var(--border)] rounded-2xl p-6 shadow-lg shadow-black/20">
				<h2 className="section-title">Publish your portfolio</h2>
				<div className="mt-4 space-y-3">
					{/* Collapsible subsections — mimic modal pattern */}
					<CollapsibleBlock storageKey="py_deploy_github_open" title="Publish to GitHub Pages" subtitle={<span className="text-xs text-[color:var(--fg-muted)]">Publish a static build by pushing the site to a <code className="font-mono">gh-pages</code> branch.</span>}>
						<div className="mt-2">
							<div className="text-sm mb-2">Quickly publish your static export to GitHub Pages. We'll guide you through connecting a repository and creating a <code className="font-mono">gh-pages</code> branch.</div>
							<div className="flex items-center gap-2">
								<button className="btn btn-accent">Connect & Publish</button>
								<button className="btn">Learn more</button>
							</div>
							<div className="mt-3 text-xs text-[color:var(--fg-muted)]">Tip: If you prefer, download the ZIP and enable Pages for your repository manually.</div>
						</div>
					</CollapsibleBlock>

					<CollapsibleBlock storageKey="py_deploy_providers_open" title="Hosted Platforms" subtitle={<span className="text-xs text-[color:var(--fg-muted)]">Deploy using services like Vercel or Netlify, which build from your repo.</span>}>
						<div className="mt-2">
							<div className="flex items-center gap-2">
								<button className="btn btn-accent">Deploy to Vercel</button>
								<button className="btn btn-accent">Deploy to Netlify</button>
							</div>
							<div className="mt-3 text-xs text-[color:var(--fg-muted)]">Tip: These platforms can build directly from your Git repo and offer continuous deployment on push.</div>
						</div>
					</CollapsibleBlock>

					<CollapsibleBlock storageKey="py_deploy_manual_open" title="Manual Deployment & Tips" subtitle={<span className="text-xs text-[color:var(--fg-muted)]">Instructions for using the exported ZIP or deploying via CLI.</span>}>
						<div className="mt-2">
							<div className="text-xs font-mono bg-[color:var(--bg-muted)] p-2 rounded">npm run build:export</div>
							<div className="mt-2 text-sm">Download the ZIP produced by the Export step, then upload the contents to your host or provider. If you use Git, push the static files to a <code className="font-mono">gh-pages</code> branch or connect your repo to a hosting provider for automatic builds.</div>
							<div className="mt-2 text-xs text-[color:var(--fg-muted)]">If you're unsure where to host: GitHub Pages, Vercel, Netlify, and many traditional hosts support static sites.</div>
						</div>
					</CollapsibleBlock>
				</div>
			</section>
		</div>
	);
}

function StatusBadge({ status, large }: { status: "online" | "offline" | "unknown"; large?: boolean }) {
	const size = large ? "w-5 h-5" : "w-3 h-3";
	const common = `rounded-full ${size} inline-block`;
	if (status === "online") {
		return <span className={`${common} bg-[color:var(--success)]`} aria-label="online" />;
	}
	if (status === "offline") {
		return <span className={`${common} bg-[color:var(--danger)]`} aria-label="offline" />;
	}
	return <span className={`${common} bg-[color:var(--fg-muted)]`} aria-label="unknown" />;
}

function CollapsibleBlock({ storageKey, title, subtitle, children }: { storageKey: string; title: React.ReactNode; subtitle?: React.ReactNode; children?: React.ReactNode }) {
	const [open, setOpen] = useState<boolean>(() => {
		try { return localStorage.getItem(storageKey) === '1'; } catch { return true; }
	});
	function toggle() {
		setOpen(prev => { const next = !prev; try { localStorage.setItem(storageKey, next ? '1' : '0'); } catch { /* noop */ } return next; });
	}

	return (
		<div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]/90 overflow-hidden">
			<button className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left" onClick={toggle} title={open ? 'Collapse' : 'Expand'} aria-expanded={open}>
				<div className="flex items-center gap-3">
					{open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
					<div>
						<p className="text-sm uppercase text-[color:var(--fg-muted)]">{title}</p>
						{subtitle && <div className="text-xs text-[color:var(--fg-muted)] mt-0.5">{subtitle}</div>}
					</div>
				</div>
				<div />
			</button>
			{open && (
				<div className="p-4 border-t border-[color:var(--border)]">
					{children}
				</div>
			)}
		</div>
	);
}
