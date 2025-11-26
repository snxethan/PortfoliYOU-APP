import { useEffect, useState, useRef } from "react";
import { ChevronDown, ChevronRight, Plus, Settings2 } from "lucide-react";
import { useProjects } from "../providers/ProjectsProvider";
import { usePortfolioSettings } from "../providers/PortfolioSettingsProvider";
import { useAssets } from "../providers/AssetsProvider";
import { useNavigate } from 'react-router-dom';

export default function DeployPage() {
	const { selectedProject, selectedProjectId } = useProjects();
	const { openSettings } = usePortfolioSettings();
	const { list: assetList } = useAssets();
	const [buildLog, setBuildLog] = useState<string[]>([]);
	const logRef = useRef<HTMLDivElement | null>(null);

	function appendLog(line: string) {
		setBuildLog((prev) => [...prev, line]);
	}

	useEffect(() => {
		if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
	}, [buildLog]);

	const navigate = useNavigate();
	const [status, setStatus] = useState<"online" | "offline" | "unknown">("unknown");
	const [lastDeployed, setLastDeployed] = useState<string | null>(null);
	const [previewAvailable, setPreviewAvailable] = useState(false);
	const [exporting, setExporting] = useState(false);
	const [includeAssets, setIncludeAssets] = useState(true);
	const [basePath, setBasePath] = useState<string | null>(null);

	function deriveDirFromPath(p?: string | null) {
		if (!p) return null;
		const idx1 = p.lastIndexOf('\\');
		const idx2 = p.lastIndexOf('/');
		const idx = Math.max(idx1, idx2);
		if (idx <= 0) return null;
		return p.slice(0, idx);
	}

	useEffect(() => {
		setStatus("unknown");
		setPreviewAvailable(false);
		try {
			const candidate = deriveDirFromPath((selectedProject as any)?._filePath as string | undefined);
			if (candidate) setBasePath(candidate);
		} catch { /* ignore */ }
	}, [selectedProject]);

	if (!selectedProject) {
		return (
			<div className="p-6">
				<div className="surface p-4 border border-[color:var(--border)] text-sm text-[color:var(--fg-muted)]">No portfolio selected. Go to Home and open one.</div>
			</div>
		);
	}

	async function handleExportZip() {
		if (!selectedProject) { setBuildLog(['❌ No project selected ❌']); return; }
		setExporting(true);
		try {
			setBuildLog([]);
			appendLog('Starting Portfoli-YOU export...');

			appendLog('1. Building static site...');
			const assetsBase64: Record<string, string> = {};
			if (includeAssets) {
				try {
					const mod = await import('../lib/assetsStore');
					const idbGet = mod.idbGet as (store: string, key: string) => Promise<Blob | undefined>;
					for (const asset of assetList) {
						if (!asset.hash) continue;
						try {
							const blob = await idbGet('blobs', asset.hash);
							if (!blob) continue;
							const ab = await (blob as Blob).arrayBuffer();
							const bytes = new Uint8Array(ab);
							let binary = '';
							const chunk = 0x8000;
							for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
							assetsBase64[asset.hash] = btoa(binary);
						} catch { /* ignore */ }
					}
				} catch { /* ignore */ }
			}

			// Resolve whether we have an existing .portfoliyou file to embed into.
			const rawProjectPath = (selectedProject as any)?._filePath as string | undefined;
			let resolvedProjectFile: string | undefined = undefined;
			if (rawProjectPath && (window as any).api?.findProjectFile) {
				try {
					const found = await (window as any).api.findProjectFile({ path: rawProjectPath });
					if (found && found.ok && found.filePath) resolvedProjectFile = found.filePath;
				} catch { /* ignore */ }
			}

			// If we will embed into an existing project file, build into a temp folder
			// so we don't create a `.portfoliyou` directory in the project folder.
			const outputDir = resolvedProjectFile ? undefined : (basePath || undefined);
			if (outputDir) appendLog(`Building into: ${outputDir}`);
			const buildRes = await (window as any).api?.buildStaticSite?.({ project: selectedProject, assets: assetsBase64, outputDir, useTempOutput: !!resolvedProjectFile });
			if (!buildRes || !buildRes.ok) { appendLog(' ❌ Build failed: ' + (buildRes?.error || 'unknown') + ' ❌'); return; }
			appendLog(`✅ Build succeeded: ${buildRes.path} ✅`);

			appendLog('2. Embedding build into project package...');
			try {
				const endsWithDist = (s: string) => s.endsWith('/dist-site') || s.endsWith('\\dist-site') || s.endsWith('dist-site');
				let distDir = buildRes.path;
				if (buildRes.path && !endsWithDist(buildRes.path)) distDir = (buildRes.path.replace(/\\/g, '/') + '/dist-site');

				const rawProjectPath = (selectedProject as any)?._filePath as string | undefined;
				let resolvedProjectFile: string | undefined = undefined;
				if (rawProjectPath && (window as any).api?.findProjectFile) {
					try {
						const found = await (window as any).api.findProjectFile({ path: rawProjectPath });
						if (found && found.ok && found.filePath) resolvedProjectFile = found.filePath;
					} catch { /* ignore */ }
				}
				let embedRes;
				if (resolvedProjectFile) {
					appendLog('Embedding into existing project file: ' + resolvedProjectFile);
					embedRes = await (window as any).api?.embedDistIntoProject?.({ projectFilePath: resolvedProjectFile, distDir, defaultName: `${selectedProject.name || 'project'}.portfoliyou` });
				} else if (rawProjectPath) {
					// We had a path but couldn't resolve an existing archive in it — prompt the user to pick or Save As
					appendLog('⚠️ No .portfoliyou found at project path; prompting Save As ⚠️');
					embedRes = await (window as any).api?.embedDistIntoProject?.({ distDir, defaultName: `${selectedProject.name || 'project'}.portfoliyou` });
				} else {
					appendLog('⚠️ No project file found; prompting Save As for new project package ⚠️');
					embedRes = await (window as any).api?.embedDistIntoProject?.({ distDir, defaultName: `${selectedProject.name || 'project'}.portfoliyou` });
				}

				if (!embedRes || !embedRes.ok) {
					appendLog('❌ Embedding failed: ' + (embedRes?.error || 'unknown') + ' ❌');
					appendLog('⚠️ Falling back to ZIP export ⚠️');
					const zipRes = await (window as any).api?.zipDir?.({ dir: buildRes.path });
					if (!zipRes || !zipRes.ok) { appendLog('❌ ZIP failed: ' + (zipRes?.error || 'unknown') + ' ❌'); return; }
					const saveRes = await (window as any).api?.saveFileBytes?.({ defaultPath: `${selectedProject.name || 'portfolio'}.zip`, dataBase64: zipRes.dataBase64 });
					if (saveRes && (saveRes.canceled === true || saveRes.ok === false)) appendLog(' ❌ Save failed ❌');
					else appendLog('✅ Export complete (ZIP). ✅');
					return;
				}

				appendLog('✅ Embedding complete: ' + embedRes.filePath + ' ✅');
				try {
					const sepIndex = Math.max((embedRes.filePath || '').lastIndexOf('\\'), (embedRes.filePath || '').lastIndexOf('/'));
					const folderToShow = sepIndex >= 0 ? (embedRes.filePath || '').slice(0, sepIndex) : (embedRes.filePath || '');
					// Only open the project folder automatically if we created a new project file
					// (i.e. there was no existing `.portfoliyou` to embed into). If we merely
					// embedded into the existing project file, avoid opening the project's
					// folder so the explorer doesn't pop up unexpectedly.
					if (!resolvedProjectFile) {
						if (folderToShow && (window as any).api?.openPath) { appendLog('Opening folder: ' + folderToShow); await (window as any).api.openPath({ path: folderToShow }); }
					} else {
						appendLog('Build successfully embedded into existing project file; not opening project folder.');
					}

					// Also create a ZIP for the user to save and prompt Save As
					try {
						appendLog('3. Compiling ZIP for user download...');
						const zipRes = await (window as any).api?.zipDir?.({ dir: buildRes.path });
						if (!zipRes || !zipRes.ok) {
							appendLog('❌ ZIP creation failed: ' + (zipRes?.error || 'unknown') + ' ❌');
						} else {
							appendLog('Saving ZIP...');
							const saveRes = await (window as any).api?.saveFileBytes?.({ defaultPath: `${selectedProject.name || 'portfolio'}.zip`, dataBase64: zipRes.dataBase64 });
							if (!saveRes) {
								appendLog('❌ Save dialog did not return a result ❌');
							} else if (saveRes.canceled) {
								appendLog('❌ ZIP save canceled by user ❌');
							} else if (saveRes.filePath) {
								appendLog('✅ ZIP saved: ' + saveRes.filePath + ' ✅');
								try {
									const sep = Math.max(saveRes.filePath.lastIndexOf('\\'), saveRes.filePath.lastIndexOf('/'));
									const zipFolder = sep >= 0 ? saveRes.filePath.slice(0, sep) : saveRes.filePath;
									if (zipFolder && (window as any).api?.openPath) await (window as any).api.openPath({ path: zipFolder });
								} catch { /* ignore */ }
							} else {
								appendLog('✅ ZIP save finished (no path returned) ✅');
							}
						}
					} catch (e) {
						appendLog('❌ ZIP save step failed: ' + (e instanceof Error ? e.message : String(e)) + ' ❌');
					}
				} catch { /* ignore */ }
			} catch (e) { appendLog('❌ Embedding failed: ' + (e instanceof Error ? e.message : String(e)) + ' ❌'); }
		} catch (e) { appendLog('❌ Export failed: ' + (e instanceof Error ? e.message : String(e)) + ' ❌'); }
		finally { setExporting(false); }
	}

	return (
		<div className="p-6 space-y-6">
			{/* <section className="surface border border-[color:var(--border)] rounded-2xl p-6 shadow-lg shadow-black/20">
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
			</section> */}

			<section className="surface border border-[color:var(--border)] rounded-2xl p-6 shadow-lg shadow-black/20">
				<h2 className="section-title">Export your portfolio</h2>
				<div className="mt-4 space-y-3">
					<div className="mb-4">
						<button className="btn btn-accent w-full sm:w-auto gap-2 text-base font-semibold shadow-lg shadow-[color:var(--accent)]/25" onClick={handleExportZip} disabled={exporting}>
							<Plus size={16} /> {exporting ? 'Exporting…' : 'Export ZIP'}
						</button>
						{buildLog.length ? (
							<div className="mt-3">
								<div ref={logRef} className="rounded font-mono text-sm p-3 overflow-auto border" style={{ background: (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? '#0b0b0b' : '#f6f7fb', color: (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? '#33ff77' : '#064e2a', minHeight: '6rem', maxHeight: '12rem', whiteSpace: 'pre-wrap', borderColor: (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? '#222' : '#e6e9ef' }}>
									{buildLog.map((line, idx) => (<div key={idx} className="whitespace-pre-wrap" style={{ padding: '1px 0' }}>{line}</div>))}
								</div>
							</div>
						) : null}
					</div>

					<CollapsibleBlock storageKey="py_export_buildopts_open" title={"Build Options"} subtitle={"Adjust build settings such as base path, minification, and asset handling."}>
						<div className="space-y-3">
							<label className="flex items-center space-x-2">
								<input type="checkbox" checked={includeAssets} onChange={() => setIncludeAssets((s) => !s)} />
								<span className="text-[color:var(--fg-muted)]">Include uploaded assets</span>
							</label>
							<div className="mt-2">
								<button type="button" className="btn btn-ghost btn-sm flex items-center gap-1 text-[11px]" disabled={!selectedProjectId} onClick={() => selectedProjectId && openSettings({ projectId: selectedProjectId, section: 'portfolio' })}>
									<Settings2 size={14} /> Portfolio Settings
								</button>
							</div>
						</div>
					</CollapsibleBlock>
				</div>
			</section>

			<section className="surface border border-[color:var(--border)] rounded-2xl p-6 shadow-lg shadow-black/20">
				<h2 className="section-title">Publish your portfolio</h2>
				<div className="mt-4 space-y-3">
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
	if (status === "online") return <span className={`${common} bg-[color:var(--success)]`} aria-label="online" />;
	if (status === "offline") return <span className={`${common} bg-[color:var(--danger)]`} aria-label="offline" />;
	return <span className={`${common} bg-[color:var(--fg-muted)]`} aria-label="unknown" />;
}

function CollapsibleBlock({ storageKey, title, subtitle, children }: { storageKey: string; title: React.ReactNode; subtitle?: React.ReactNode; children?: React.ReactNode }) {
	const [open, setOpen] = useState<boolean>(() => {
		try { return localStorage.getItem(storageKey) === '1'; } catch { return true; }
	});
	function toggle() { setOpen(prev => { const next = !prev; try { localStorage.setItem(storageKey, next ? '1' : '0'); } catch { /* noop */ } return next; }); }

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
