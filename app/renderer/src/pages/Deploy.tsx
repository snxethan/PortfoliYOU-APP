import { useEffect, useState, useRef } from "react";
import { ChevronDown, ChevronRight, Plus, Settings, Play, Square, Copy, ExternalLink, X, Eye } from "lucide-react";
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
		setBuildLog((prev) => {
			// Prefix each log line with a short timestamp for clarity
			const ts = new Date();
			const hh = String(ts.getHours()).padStart(2, '0');
			const mm = String(ts.getMinutes()).padStart(2, '0');
			const ss = String(ts.getSeconds()).padStart(2, '0');
			const formatted = `[${hh}:${mm}:${ss}] ${line}`;
			const next = [...prev, formatted];
			try {
				// keep a global buffer so other routes can pick up logs when they mount
				const g = (window as any).__py_preview_log = (window as any).__py_preview_log || [];
				g.push(line);
				// NOTE: do NOT re-dispatch 'py:preview:log' here — that causes a feedback loop
			} catch { /* ignore */ }

			// Also persist technical logs to disk via the main process
			try {
				void (window as any).api?.appendLog?.({ line });
			} catch { /* ignore */ }
			return next;
		});
	}

	useEffect(() => {
		if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
	}, [buildLog]);

	const navigate = useNavigate();
	const [status, setStatus] = useState<"online" | "offline" | "unknown">("unknown");
	const [lastDeployed, setLastDeployed] = useState<string | null>(null);
	const [previewAvailable, setPreviewAvailable] = useState(false);
	const [previewRunning, setPreviewRunning] = useState(false);
	const [previewLocalUrl, setPreviewLocalUrl] = useState<string | null>(null);
	const [previewLanUrl, setPreviewLanUrl] = useState<string | null>(null);
	const [previewStarting, setPreviewStarting] = useState(false);
	const [exporting, setExporting] = useState(false);
	const [exportedFilePath, setExportedFilePath] = useState<string | null>(null);
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
		try {
			const candidate = deriveDirFromPath((selectedProject as any)?._filePath as string | undefined);
			if (candidate) setBasePath(candidate);
		} catch { /* ignore */ }
	}, [selectedProject]);

	// Sync includeAssets to portfolio metadata buildSettings when project changes
	useEffect(() => {
		try {
			const b = !!((selectedProject as any)?.portfolioMeta?.buildSettings?.includeAssets);
			setIncludeAssets(b);
		} catch { /* ignore */ }
	}, [selectedProject]);

	useEffect(() => {
		// Listen for preview state updates from other UI (or after start/stop)
		const handler = (e: any) => {
			try {
				const d = e?.detail || {};
				setPreviewRunning(!!d.running);
				setPreviewLocalUrl(d.localUrl || null);
				// Only set LAN when it's not a loopback
				if (d.lanUrl && !d.lanUrl.startsWith('http://127.') && !d.lanUrl.startsWith('http://localhost')) setPreviewLanUrl(d.lanUrl);
				else setPreviewLanUrl(null);
			} catch { /* ignore */ }
		};
		window.addEventListener('py:preview:state', handler as EventListener);
		// On mount, hydrate from a global preview state/log if present (for cases where preview started from other UI)
		try {
			const gs = (window as any).__py_preview_state;
			if (gs) {
				setPreviewRunning(!!gs.running);
				setPreviewLocalUrl(gs.localUrl || null);
				if (gs.lanUrl && !gs.lanUrl.startsWith('http://127.') && !gs.lanUrl.startsWith('http://localhost')) setPreviewLanUrl(gs.lanUrl);
			}
			const gl = (window as any).__py_preview_log;
			if (gl && Array.isArray(gl) && gl.length) setBuildLog([...gl]);
		} catch { /* ignore */ }
		return () => { window.removeEventListener('py:preview:state', handler as EventListener); };
	}, []);

	useEffect(() => {
		// Respond to start-request events from compact UI like PortfolioIsland
		const onRequest = (e: any) => {
			try { if (!previewRunning && !previewStarting) handleStartLocalPreview(); } catch { /* ignore */ }
		};
		window.addEventListener('py:preview-start-request', onRequest as EventListener);

		// Respond to export requests from compact UI
		const onExport = (e: any) => { try { void handleExportZip(); } catch { /* ignore */ } };
		window.addEventListener('py:export-request', onExport as EventListener);

		// Listen for live preview log lines (emitted by GlobalPreviewStarter)
		const onLog = (e: any) => {
			try {
				const d = e?.detail || {};
				// Ignore logs emitted by this Deploy instance to avoid duplication
				if (d.origin === 'deploy') return;
				if (d.line) appendLog(d.line);
			} catch { /* ignore */ }
		};
		window.addEventListener('py:preview:log', onLog as EventListener);

		// Respond to stop-request events from compact UI like PortfolioIsland
		const onStopRequest = (e: any) => { try { void handleStopLocalPreview(); } catch { /* ignore */ } };
		window.addEventListener('py:preview-stop-request', onStopRequest as EventListener);

		return () => {
			window.removeEventListener('py:preview-start-request', onRequest as EventListener);
			window.removeEventListener('py:export-request', onExport as EventListener);
			window.removeEventListener('py:preview:log', onLog as EventListener);
			window.removeEventListener('py:preview-stop-request', onStopRequest as EventListener);
		};
	}, [previewRunning, previewStarting]);

	if (!selectedProject) {
		return (
			<div className="p-6">
				<div className="surface p-4 border border-[color:var(--border)] text-sm text-[color:var(--fg-muted)]">No portfolio selected. Go to Home and open one.</div>
			</div>
		);
	}

	async function handleExportZip() {
		if (!selectedProject) return;
		setExporting(true);
		setBuildLog([]);
		setExportedFilePath(null);
		appendLog('Starting export...');
		try {
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
						} catch { /* ignore individual asset failures */ }
					}
				} catch { /* ignore asset read failures */ }
			}

			appendLog('Building static site...');
			const buildRes = await (window as any).api?.buildStaticSite?.({ project: selectedProject, assets: assetsBase64, useTempOutput: true });
			if (!buildRes || !buildRes.ok) {
				appendLog(' ❌ Build failed: ' + (buildRes?.error || 'unknown') + ' ❌');
				window.dispatchEvent(new CustomEvent('py:notify', { detail: { type: 'error', message: 'Export build failed: ' + (buildRes?.error || 'unknown'), persistent: false } }));
				return;
			}
			appendLog(`✅ Build succeeded: ${buildRes.path} ✅`);
			window.dispatchEvent(new CustomEvent('py:notify', { detail: { type: 'success', message: 'Build succeeded', persistent: false } }));

			// Try embedding into existing project package if possible, else fallback to ZIP
			try {
				const rawProjectPath = (selectedProject as any)?._filePath as string | undefined;
				let resolvedProjectFile: string | undefined = undefined;
				if (rawProjectPath && (window as any).api?.findProjectFile) {
					try {
						const found = await (window as any).api.findProjectFile({ path: rawProjectPath });
						if (found && found.ok && found.filePath) resolvedProjectFile = found.filePath;
					} catch { /* ignore */ }
				}

				let distDir = buildRes.path;
				const endsWithDist = (s: string) => s.endsWith('/dist-site') || s.endsWith('\\dist-site') || s.endsWith('dist-site');
				if (buildRes.path && !endsWithDist(buildRes.path)) distDir = (buildRes.path.replace(/\\/g, '/') + '/dist-site');

				if (resolvedProjectFile && (window as any).api?.embedDistIntoProject) {
					appendLog('Embedding into project file: ' + resolvedProjectFile);
					const embedRes = await (window as any).api.embedDistIntoProject({ projectFilePath: resolvedProjectFile, distDir, defaultName: `${selectedProject.name || 'project'}.portfoliyou` });
					if (embedRes && embedRes.ok) {
						appendLog('✅ Embedding complete: ' + embedRes.filePath + ' ✅');
						// Notify with a href to allow opening the file/folder from notifications
						window.dispatchEvent(new CustomEvent('py:notify', { detail: { type: 'success', message: 'Export embedded into project file', href: embedRes.filePath, ctaLabel: 'Open', persistent: false } }));
						// Continue to also compile & save a ZIP for user download (do NOT return here)
					}
				}

				appendLog('Preparing export folder for ZIP...');
				const exportRes = await (window as any).api?.buildExportFolder?.({ distDir: buildRes.path, projectName: (selectedProject && selectedProject.name) || (selectedProject && (selectedProject as any).title) || 'portfolio' });
				let zipSourceDir = buildRes.path;
				if (!exportRes || !exportRes.ok) {
					appendLog(' ⚠️ Export folder creation failed, falling back to raw build path: ' + (exportRes?.error || 'unknown'));
				} else {
					appendLog('✅ Export folder ready: ' + exportRes.path);
					zipSourceDir = exportRes.path;
				}

				appendLog('⚠️ Creating ZIP from export folder ⚠️');
				const zipRes = await (window as any).api?.zipDir?.({ dir: zipSourceDir });
				if (!zipRes || !zipRes.ok) {
					appendLog('❌ ZIP failed: ' + (zipRes?.error || 'unknown') + ' ❌');
					window.dispatchEvent(new CustomEvent('py:notify', { detail: { type: 'error', message: 'ZIP creation failed: ' + (zipRes?.error || 'unknown'), persistent: false } }));
					return;
				}
				const saveRes = await (window as any).api?.saveFileBytes?.({ defaultPath: `${selectedProject.name || 'portfolio'}.zip`, dataBase64: zipRes.dataBase64 });
				if (saveRes && saveRes.filePath) {
					appendLog('✅ ZIP saved: ' + saveRes.filePath + ' ✅');
					setExportedFilePath(saveRes.filePath);
					window.dispatchEvent(new CustomEvent('py:notify', { detail: { type: 'success', message: 'ZIP saved: ' + saveRes.filePath, href: saveRes.filePath, ctaLabel: 'Reveal', persistent: false } }));
				}
			} catch (e) { appendLog('❌ Export fallback failed: ' + (e instanceof Error ? e.message : String(e)) + ' ❌'); }
		} catch (e) {
			appendLog('❌ Export failed: ' + (e instanceof Error ? e.message : String(e)) + ' ❌');
			window.dispatchEvent(new CustomEvent('py:notify', { detail: { type: 'error', message: 'Export failed: ' + (e instanceof Error ? e.message : String(e)), persistent: false } }));
		} finally {
			setExporting(false);
		}
	}

	async function handleStartLocalPreview() {
		if (!selectedProject) return;
		setPreviewStarting(true);
		setBuildLog([]);
		setExportedFilePath(null);
		appendLog('Preparing local preview...');
		try { window.dispatchEvent(new CustomEvent('py:preview:log', { detail: { line: 'Preparing local preview...', origin: 'deploy' } })); } catch { }
		try {
			// Build static site into a temp output so we don't modify project folder
			appendLog('Building static site for preview...');
			try { window.dispatchEvent(new CustomEvent('py:preview:log', { detail: { line: 'Building static site for preview...', origin: 'deploy' } })); } catch { }
			window.dispatchEvent(new CustomEvent('py:notify', { detail: { type: 'info', message: 'Building static site for preview...', persistent: false } }));
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

			const buildRes = await (window as any).api?.buildStaticSite?.({ project: selectedProject, assets: assetsBase64, useTempOutput: true });
			if (!buildRes || !buildRes.ok) {
				appendLog(' ❌ Preview build failed: ' + (buildRes?.error || 'unknown') + ' ❌');
				try { window.dispatchEvent(new CustomEvent('py:preview:log', { detail: { line: ' ❌ Preview build failed: ' + (buildRes?.error || 'unknown') + ' ❌', origin: 'deploy' } })); } catch { }
				window.dispatchEvent(new CustomEvent('py:notify', { detail: { type: 'error', message: 'Preview build failed: ' + (buildRes?.error || 'unknown'), persistent: false } }));
				setPreviewStarting(false);
				return;
			}
			appendLog(`Preview build output: ${buildRes.path}`);
			try { window.dispatchEvent(new CustomEvent('py:preview:log', { detail: { line: `Preview build output: ${buildRes.path}`, origin: 'deploy' } })); } catch { }
			window.dispatchEvent(new CustomEvent('py:notify', { detail: { type: 'success', message: 'Preview build succeeded', persistent: false } }));

			appendLog('Starting local static server...');
			try { window.dispatchEvent(new CustomEvent('py:preview:log', { detail: { line: 'Starting local static server...', origin: 'deploy' } })); } catch { }
			const startRes = await (window as any).api?.previewStartServer?.({ distDir: buildRes.path });
			if (!startRes || !startRes.ok) {
				appendLog(' ❌ Failed to start preview server: ' + (startRes?.error || 'unknown') + ' ❌');
				try { window.dispatchEvent(new CustomEvent('py:preview:log', { detail: { line: ' ❌ Failed to start preview server: ' + (startRes?.error || 'unknown') + ' ❌', origin: 'deploy' } })); } catch { }
				window.dispatchEvent(new CustomEvent('py:notify', { detail: { type: 'error', message: 'Failed to start preview server: ' + (startRes?.error || 'unknown'), persistent: false } }));
				setPreviewStarting(false);
				return;
			}
			appendLog(`✅ Preview running: ${startRes.localUrl} (LAN: ${startRes.lanUrl})`);
			try { window.dispatchEvent(new CustomEvent('py:preview:log', { detail: { line: `✅ Preview running: ${startRes.localUrl} (LAN: ${startRes.lanUrl})`, origin: 'deploy' } })); } catch { }
			window.dispatchEvent(new CustomEvent('py:notify', { detail: { type: 'success', message: 'Local preview started', href: startRes.localUrl, ctaLabel: 'Open', persistent: false } }));
			setPreviewRunning(true);
			setPreviewLocalUrl(startRes.localUrl || null);
			if (startRes.lanUrl && !startRes.lanUrl.startsWith('http://127.') && !startRes.lanUrl.startsWith('http://localhost')) setPreviewLanUrl(startRes.lanUrl);

			// Persist global preview state and broadcast so other UI (PortfolioIsland) can reflect it
			try { (window as any).__py_preview_state = { running: true, localUrl: startRes.localUrl, lanUrl: startRes.lanUrl }; } catch { }
			window.dispatchEvent(new CustomEvent('py:preview:state', { detail: { running: true, localUrl: startRes.localUrl, lanUrl: startRes.lanUrl } }));
		} catch (e) {
			appendLog('❌ Local preview failed: ' + (e instanceof Error ? e.message : String(e)));
		} finally {
			setPreviewStarting(false);
		}
	}

	async function handleStopLocalPreview() {
		try {
			appendLog('Stopping local preview...');
			try { window.dispatchEvent(new CustomEvent('py:preview:log', { detail: { line: 'Stopping local preview...', origin: 'deploy' } })); } catch { }
			const res = await (window as any).api?.previewStopServer?.();
			if (!res || !res.ok) {
				appendLog(' ❌ Failed to stop preview: ' + (res?.error || 'unknown') + ' ❌');
				try { window.dispatchEvent(new CustomEvent('py:preview:log', { detail: { line: ' ❌ Failed to stop preview: ' + (res?.error || 'unknown') + ' ❌', origin: 'deploy' } })); } catch { }
				window.dispatchEvent(new CustomEvent('py:notify', { detail: { type: 'error', message: 'Failed to stop preview: ' + (res?.error || 'unknown'), persistent: false } }));
				return;
			}
			appendLog('✅ Preview stopped');
			try { window.dispatchEvent(new CustomEvent('py:preview:log', { detail: { line: '✅ Preview stopped', origin: 'deploy' } })); } catch { }
			window.dispatchEvent(new CustomEvent('py:notify', { detail: { type: 'info', message: 'Local preview stopped', persistent: false } }));
			setPreviewRunning(false);
			setPreviewLocalUrl(null);
			setPreviewLanUrl(null);
			try { (window as any).__py_preview_state = { running: false }; } catch { }
			window.dispatchEvent(new CustomEvent('py:preview:state', { detail: { running: false } }));
		} catch (e) { appendLog('❌ Failed to stop preview: ' + (e instanceof Error ? e.message : String(e))); }
	}

	return (
		<div className="p-6 space-y-6">
			<section className="surface border border-[color:var(--border)] rounded-2xl p-6 shadow-lg shadow-black/20">
				<div className="flex flex-col gap-1">
					<p className="section-title">Portfolio Deployer workspace</p>
					<p className="text-sm text-[color:var(--fg-muted)]">Preview, build and export your portfolio in a single workspace.</p>
				</div>
				<div className="mt-4 space-y-4">
					{/* 1) Build Log (non-collapsible) */}
					<div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]/90 p-4 relative">
						<div className="flex items-start justify-between">
							<div>
								<p className="text-xs uppercase tracking-wide text-[color:var(--fg-muted)]">Deployment Log</p>
								<p className="text-sm text-[color:var(--fg-muted)]">Live output from build, preview and export operations (timestamps shown).</p>
							</div>
							<div className="flex items-center gap-2">
								<button
									type="button"
									className="btn btn-ghost btn-xs p-1 flex items-center gap-1"
									title="Copy build log"
									onClick={async () => {
										try {
											const text = buildLog.join('\n');
											if ((window as any).api?.clipboardWrite) {
												await (window as any).api.clipboardWrite({ text });
											} else if (navigator.clipboard && navigator.clipboard.writeText) {
												await navigator.clipboard.writeText(text);
											} else {
												// fallback: create temporary textarea
												const ta = document.createElement('textarea');
												ta.value = text;
												document.body.appendChild(ta);
												ta.select();
												document.execCommand('copy');
												ta.remove();
											}
											window.dispatchEvent(new CustomEvent('py:notify', { detail: { type: 'success', message: 'Logs copied to clipboard', persistent: false } }));
										} catch { window.dispatchEvent(new CustomEvent('py:notify', { detail: { type: 'warn', message: 'Could not copy logs', persistent: false } })); }
									}}
								>
									<Copy size={14} />
								</button>
								<button
									type="button"
									className="btn btn-ghost btn-xs p-1 flex items-center gap-1"
									title="Clear deployment log"
									onClick={() => { setBuildLog([]); window.dispatchEvent(new CustomEvent('py:notify', { detail: { type: 'info', message: 'Deployment log cleared', persistent: false } })); }}
								>
									<X size={14} />
								</button>
							</div>
						</div>
						<div className="mt-3">
							{buildLog.length ? (
								<div ref={logRef} className="rounded font-mono text-sm p-3 overflow-auto mt-0 border" style={{ background: '#050505', color: 'var(--accent)', minHeight: '8rem', maxHeight: '20rem', whiteSpace: 'pre-wrap', borderColor: '#222' }}>
									{buildLog.map((line, idx) => {
										const isError = /❌|failed|error/i.test(line);
										const isSuccess = /✅|succeeded|success/i.test(line);
										const isWarn = /⚠️|warning|warn/i.test(line);
										const colorClass = isError ? 'text-red-400' : isSuccess ? 'text-emerald-400' : isWarn ? 'text-yellow-300' : 'text-[color:var(--accent)]';
										return (
											<div key={idx} className={`whitespace-pre-wrap ${colorClass}`} style={{ padding: '1px 0' }}>{line}</div>
										);
									})}
								</div>
							) : (
								<div className="rounded font-mono text-sm p-4 mt-0 border" style={{ background: '#050505', color: 'var(--fg-muted)', minHeight: '8rem', maxHeight: '20rem', whiteSpace: 'pre-wrap', borderColor: '#222' }}>No deployment output yet. Start an export or preview to see live logs here.</div>
							)}
						</div>
					</div>

					{/* 2) Local Preview (quickstart style) */}
					<div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]/90 p-4">
						<p className="text-xs uppercase tracking-wide text-[color:var(--fg-muted)]">Local Preview</p>
						<p className="text-sm text-[color:var(--fg-muted)]">Start a local static server to preview your compiled site on this machine or your LAN.</p>
						<div className="mt-4">
							<div className="border border-[color:var(--border)] rounded-md bg-[color:var(--surface)]/80 p-3">
								{!previewRunning ? (
									<div className="flex flex-col sm:flex-row items-center justify-center gap-3 text-center">
										<button className="btn btn-accent w-full sm:w-auto gap-2 text-base font-semibold shadow-lg shadow-[color:var(--accent)]/25" onClick={() => handleStartLocalPreview()} disabled={previewStarting || exporting} title="Start local preview">
											<Play size={16} /> <span>Start</span>
										</button>
									</div>
								) : (
									<div className="flex flex-col sm:flex-row items-center justify-center gap-3 text-center">
										<button className="btn btn-danger w-full sm:w-auto gap-2 text-base font-semibold" onClick={() => handleStopLocalPreview()} title="Stop preview">
											<Square size={16} className="text-[color:var(--danger)]" aria-hidden="true" /> <span>Stop</span>
										</button>
										<div className="flex items-center gap-2">
											{previewLocalUrl && (
												<a className="btn btn-ghost w-full sm:w-auto gap-2 text-base flex items-center justify-center" href={previewLocalUrl} target="_blank" rel="noreferrer" title="Open preview in browser" onClick={() => window.dispatchEvent(new CustomEvent('py:notify', { detail: { type: 'info', message: 'Opening preview in browser', persistent: false } }))}>
													<Eye size={16} /> <span>Open</span>
												</a>
											)}
											{previewLocalUrl && (
												<button className="btn btn-ghost w-full sm:w-auto gap-2 text-base flex items-center justify-center" onClick={() => (window as any).api?.clipboardWrite?.({ text: previewLocalUrl })} title="Copy local URL">
													<Copy size={16} /> <span>Copy</span>
												</button>
											)}
											{previewLanUrl && (
												<a className="btn btn-ghost w-full sm:w-auto gap-2 text-base flex items-center justify-center" href={previewLanUrl} target="_blank" rel="noreferrer" title="Open LAN preview" onClick={() => window.dispatchEvent(new CustomEvent('py:notify', { detail: { type: 'info', message: 'Opening LAN preview in browser', persistent: false } }))}>
													<ExternalLink size={16} /> <span>Open LAN</span>
												</a>
											)}
											{previewLanUrl && (
												<button className="btn btn-ghost w-full sm:w-auto gap-2 text-base flex items-center justify-center" onClick={() => (window as any).api?.clipboardWrite?.({ text: previewLanUrl })} title="Copy LAN URL">
													<Copy size={16} /> <span>Copy LAN</span>
												</button>
											)}
										</div>
									</div>
								)}
							</div>
						</div>
					</div>

					{/* 3) Compiling */}
					<div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]/90 p-4">
						<p className="text-xs uppercase tracking-wide text-[color:var(--fg-muted)]">Compiling</p>
						<p className="text-sm text-[color:var(--fg-muted)]">Export and configure build settings for this portfolio.</p>
						<div className="mt-4">
							<div className="flex flex-col sm:flex-row items-center justify-center gap-3">
								<div className="flex items-center gap-2">
									<button
										className="btn btn-accent w-full sm:w-auto gap-2 text-base font-semibold shadow-lg shadow-[color:var(--accent)]/25"
										onClick={handleExportZip}
										disabled={exporting}
									>
										<ExternalLink size={16} /> <span>{exporting ? 'Exporting…' : 'Export'}</span>
									</button>
									{exportedFilePath && (
										<button
											type="button"
											className="btn btn-ghost btn-sm p-2 flex items-center gap-2"
											onClick={async () => {
												try {
													if ((window as any).api?.showItemInFolder) {
														await (window as any).api.showItemInFolder({ filePath: exportedFilePath });
													} else if ((window as any).api?.openPath) {
														await (window as any).api.openPath({ path: exportedFilePath });
													} else {
														// fallback: open via file:// URL
														window.open('file://' + exportedFilePath);
													}
												} catch { /* ignore */ }
											}}
											title="Reveal Exported ZIP in folder"
										>
											<ExternalLink size={14} /> <span className="hidden sm:inline text-sm">Open Folder</span>
										</button>
									)}
									<button
										type="button"
										className="btn btn-ghost btn-xs p-2 flex items-center gap-2"
										title={selectedProject || selectedProjectId ? 'Build settings' : 'Open a project to modify build settings'}
										disabled={!selectedProject && !selectedProjectId}
										onClick={() => openSettings({ projectId: selectedProjectId || (selectedProject as any)?.id, section: 'build' })}
									>
										<Settings size={16} />
										<span className="text-sm hidden sm:inline">Build settings</span>
									</button>
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>

			<section className="surface border border-[color:var(--border)] rounded-2xl p-6 shadow-lg shadow-black/20">
				<div className="flex flex-col gap-1">
					<p className="section-title">PORTFOLIO PUBLISHER</p>
					<p className="text-sm text-[color:var(--fg-muted)]">Publish your portfolio to various platforms and services.</p>
				</div>
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
