import { useEffect, useState, useRef } from "react";
import { ChevronDown, ChevronRight, Plus, Play, Square, Copy, ExternalLink, X, Eye, RefreshCw, SlidersHorizontal } from "lucide-react";
import { useProjects } from "../providers/ProjectsProvider";
import { startPreviewServer } from "../lib/previewServer";
import { captureGlobalStyleSnapshot } from "../lib/styleSnapshot";
import { usePortfolioSettings } from "../providers/PortfolioSettingsProvider";
import { useAssets } from "../providers/AssetsProvider";
import { useNavigate } from 'react-router-dom';
import { getWidgetThemeSnapshot, themeSnapshotToCss } from "../widgets/theme";
import { appendPreviewLog, clearPreviewLog, getPreviewLog, getPreviewState, setPreviewState } from "../lib/previewInterop";

async function blobToBase64(blob: Blob): Promise<string> {
	return await new Promise((resolve, reject) => {
		try {
			const reader = new FileReader();
			reader.onerror = () => reject(reader.error || new Error('Failed to read asset'));
			reader.onloadend = () => {
				const result = reader.result;
				if (typeof result !== 'string') {
					reject(new Error('Unexpected asset reader result'));
					return;
				}
				const idx = result.indexOf(',');
				resolve(idx >= 0 ? result.slice(idx + 1) : result);
			};
			reader.readAsDataURL(blob);
		} catch (err) {
			reject(err instanceof Error ? err : new Error(String(err)));
		}
	});
}

export default function DeployPage() {
	const { selectedProject, selectedProjectId } = useProjects();
	const { openSettings } = usePortfolioSettings();
	const { list: assetList } = useAssets();
	const [buildLog, setBuildLog] = useState<string[]>([]);
	const logRef = useRef<HTMLDivElement | null>(null);
	const previewRef = useRef<HTMLDivElement | null>(null);
	const [pulsePreview, setPulsePreview] = useState(false);
	const selectedProjectCloudId = selectedProject?._cloudId ?? selectedProjectId ?? (selectedProject as any)?.id ?? null;

	function appendLog(line: string) {
		setBuildLog((prev) => {
			// Normalize emojis so they only appear at the start of the message
			function normalizeMessage(s: string) {
				let msg = String(s || '').trim();
				let emoji = '';
				if (msg.indexOf('✅') !== -1) { emoji = '✅'; msg = msg.replace(/✅/g, ''); }
				else if (msg.indexOf('❌') !== -1) { emoji = '❌'; msg = msg.replace(/❌/g, ''); }
				else if (msg.indexOf('⚠️') !== -1 || msg.indexOf('⚠') !== -1) { emoji = '⚠️'; msg = msg.replace(/⚠️|⚠/g, ''); }
				msg = msg.trim();
				return (emoji ? (emoji + ' ' + msg) : msg).trim();
			}

			const normalized = normalizeMessage(line);
			// Prefix each log line with a short timestamp for clarity
			const ts = new Date();
			const hh = String(ts.getHours()).padStart(2, '0');
			const mm = String(ts.getMinutes()).padStart(2, '0');
			const ss = String(ts.getSeconds()).padStart(2, '0');
			const formatted = `[${hh}:${mm}:${ss}] ${normalized}`;
			const next = [...prev, formatted];
			appendPreviewLog(selectedProjectCloudId, normalized);

			// Also persist technical logs to disk via the main process
			try {
				void (window as any).api?.appendLog?.({ line: normalized });
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
		const handler = (e: any) => {
			try {
				const d = e?.detail || {};
				const eventProjectId = d.projectId;
				if (eventProjectId && selectedProjectCloudId && eventProjectId !== selectedProjectCloudId) return;
				setPreviewRunning(!!d.running);
				setPreviewLocalUrl(d.localUrl || null);
				if (d.lanUrl && !d.lanUrl.startsWith('http://127.') && !d.lanUrl.startsWith('http://localhost')) setPreviewLanUrl(d.lanUrl);
				else setPreviewLanUrl(null);
			} catch { /* ignore */ }
		};
		window.addEventListener('py:preview:state', handler as EventListener);
		const snapshot = getPreviewState(selectedProjectCloudId);
		if (snapshot) {
			setPreviewRunning(!!snapshot.running);
			setPreviewLocalUrl(snapshot.localUrl || null);
			if (snapshot.lanUrl && !snapshot.lanUrl.startsWith('http://127.') && !snapshot.lanUrl.startsWith('http://localhost')) setPreviewLanUrl(snapshot.lanUrl);
			else setPreviewLanUrl(null);
		} else {
			setPreviewRunning(false);
			setPreviewLocalUrl(null);
			setPreviewLanUrl(null);
		}
		const storedLog = getPreviewLog(selectedProjectCloudId);
		if (storedLog.length) setBuildLog([...storedLog]);
		else setBuildLog([]);
		return () => { window.removeEventListener('py:preview:state', handler as EventListener); };
	}, [selectedProjectCloudId]);

	useEffect(() => {
		const matchesProject = (projectId?: string | null) => {
			if (!projectId || !selectedProjectCloudId) return true;
			return projectId === selectedProjectCloudId;
		};

		const onRequest = (e: any) => {
			try {
				const requestedId = e?.detail?.projectId;
				if (!matchesProject(requestedId)) return;
				if (!previewRunning && !previewStarting) handleStartLocalPreview();
			} catch { /* ignore */ }
		};
		window.addEventListener('py:preview-start-request', onRequest as EventListener);

		const onExport = (e: any) => {
			try {
				const requestedId = e?.detail?.projectId;
				if (!matchesProject(requestedId)) return;
				void handleExportZip();
			} catch { /* ignore */ }
		};
		window.addEventListener('py:export-request', onExport as EventListener);

		const onLog = (e: any) => {
			try {
				const d = e?.detail || {};
				if (d.origin === 'deploy') return;
				if (!matchesProject(d.projectId)) return;
				if (d.line) appendLog(d.line);
			} catch { /* ignore */ }
		};
		window.addEventListener('py:preview:log', onLog as EventListener);

		const onStopRequest = (e: any) => {
			try {
				const requestedId = e?.detail?.projectId;
				if (!matchesProject(requestedId)) return;
				void handleStopLocalPreview();
			} catch { /* ignore */ }
		};
		window.addEventListener('py:preview-stop-request', onStopRequest as EventListener);

		const onReloadRequest = (e: any) => {
			try {
				const requestedId = e?.detail?.projectId;
				if (!matchesProject(requestedId)) return;
				void handleReloadLocalPreview();
			} catch { /* ignore */ }
		};
		window.addEventListener('py:preview-reload-request', onReloadRequest as EventListener);

		const onHighlightPreview = () => {
			setPulsePreview(true);
			if (previewRef.current) {
				previewRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
			}
			setTimeout(() => setPulsePreview(false), 2000);
		};
		window.addEventListener('py:highlight-preview', onHighlightPreview as EventListener);

		return () => {
			window.removeEventListener('py:preview-start-request', onRequest as EventListener);
			window.removeEventListener('py:export-request', onExport as EventListener);
			window.removeEventListener('py:preview:log', onLog as EventListener);
			window.removeEventListener('py:preview-stop-request', onStopRequest as EventListener);
			window.removeEventListener('py:preview-reload-request', onReloadRequest as EventListener);
			window.removeEventListener('py:highlight-preview', onHighlightPreview as EventListener);
		};
	}, [previewRunning, previewStarting, selectedProjectCloudId]);


	async function handleReloadLocalPreview() {
		// Stop if running, then start a fresh preview (rebuild + restart)
		appendLog('Reloading local preview...');
		try { window.dispatchEvent(new CustomEvent('py:preview:log', { detail: { line: 'Reloading local preview...', origin: 'deploy', projectId: selectedProjectCloudId } })); } catch { }
		try {
			if (previewRunning) {
				await handleStopLocalPreview();
			}
			// small delay to ensure stop has fully completed
			await new Promise((res) => setTimeout(res, 250));
			await handleStartLocalPreview();
		} catch (e) {
			appendLog('❌ Reload failed: ' + (e instanceof Error ? e.message : String(e)));
		}

		return;
	}

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
		clearPreviewLog(selectedProjectCloudId);
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
							assetsBase64[asset.hash] = await blobToBase64(blob);
						} catch { /* ignore individual asset failures */ }
					}
				} catch { /* ignore asset read failures */ }
			}

			appendLog('Building static site...');
			const activeTheme = selectedProject?.themes?.[selectedProject.activeThemeId] ?? null;
			const [styleSnapshot, themeSnapshot] = await Promise.all([
				captureGlobalStyleSnapshot(),
				Promise.resolve(getWidgetThemeSnapshot(activeTheme))
			]);
			const buildRes = await (window as any).api?.buildStaticSite?.({
				project: selectedProject,
				assets: assetsBase64,
				useTempOutput: true,
				globalCss: { tailwind: styleSnapshot.tailwindCss },
				themeCss: themeSnapshotToCss(themeSnapshot)
			});
			if (!buildRes || !buildRes.ok) {
				appendLog('❌ Build failed: ' + (buildRes?.error || 'unknown'));
				window.dispatchEvent(new CustomEvent('py:notify', { detail: { type: 'error', message: 'Export build failed: ' + (buildRes?.error || 'unknown'), persistent: false } }));
				return;
			}
			appendLog(`✅ Build succeeded: ${buildRes.path}`);
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
						appendLog('✅ Embedding complete: ' + embedRes.filePath);
						// Notify with a href to allow opening the file/folder from notifications
						window.dispatchEvent(new CustomEvent('py:notify', { detail: { type: 'success', message: 'Export embedded into project file', href: embedRes.filePath, ctaLabel: 'Open', persistent: false } }));
						// Continue to also compile & save a ZIP for user download (do NOT return here)
					}
				}

				appendLog('Preparing export folder for ZIP...');
				const exportRes = await (window as any).api?.buildExportFolder?.({ distDir: buildRes.path, projectName: (selectedProject && selectedProject.name) || (selectedProject && (selectedProject as any).title) || 'portfolio' });
				let zipSourceDir = buildRes.path;
				if (!exportRes || !exportRes.ok) {
					appendLog('⚠️ Export folder creation failed, falling back to raw build path: ' + (exportRes?.error || 'unknown'));
				} else {
					appendLog('✅ Export folder ready: ' + exportRes.path);
					zipSourceDir = exportRes.path;
				}

				appendLog('⚠️ Creating ZIP from export folder');
				const zipRes = await (window as any).api?.zipDir?.({ dir: zipSourceDir });
				if (!zipRes || !zipRes.ok) {
					appendLog('❌ ZIP failed: ' + (zipRes?.error || 'unknown'));
					window.dispatchEvent(new CustomEvent('py:notify', { detail: { type: 'error', message: 'ZIP creation failed: ' + (zipRes?.error || 'unknown'), persistent: false } }));
					return;
				}
				const saveRes = await (window as any).api?.saveFileBytes?.({ defaultPath: `${selectedProject.name || 'portfolio'}.zip`, dataBase64: zipRes.dataBase64 });
				if (saveRes && saveRes.filePath) {
					appendLog('✅ ZIP saved: ' + saveRes.filePath);
					setExportedFilePath(saveRes.filePath);
					window.dispatchEvent(new CustomEvent('py:notify', { detail: { type: 'success', message: 'ZIP saved: ' + saveRes.filePath, href: saveRes.filePath, ctaLabel: 'Reveal', persistent: false } }));
				} else {
					// User likely cancelled the save dialog — reflect in the log
					appendLog('❌ Save cancelled');
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
		clearPreviewLog(selectedProjectCloudId);
		setExportedFilePath(null);
		appendLog('Preparing local preview...');
		try { window.dispatchEvent(new CustomEvent('py:preview:log', { detail: { line: 'Preparing local preview...', origin: 'deploy', projectId: selectedProjectCloudId } })); } catch { }
		try {
			// Build static site into a temp output so we don't modify project folder
			appendLog('Building static site for preview...');
			try { window.dispatchEvent(new CustomEvent('py:preview:log', { detail: { line: 'Building static site for preview...', origin: 'deploy', projectId: selectedProjectCloudId } })); } catch { }
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
							assetsBase64[asset.hash] = await blobToBase64(blob);
						} catch { /* ignore */ }
					}
				} catch { /* ignore */ }
			}

			const activeTheme = selectedProject?.themes?.[selectedProject.activeThemeId] ?? null;
			const [styleSnapshot, themeSnapshot] = await Promise.all([
				captureGlobalStyleSnapshot(),
				Promise.resolve(getWidgetThemeSnapshot(activeTheme))
			]);
			const buildRes = await (window as any).api?.buildStaticSite?.({
				project: selectedProject,
				assets: assetsBase64,
				useTempOutput: true,
				globalCss: { tailwind: styleSnapshot.tailwindCss },
				themeCss: themeSnapshotToCss(themeSnapshot)
			});
			if (!buildRes || !buildRes.ok) {
				appendLog(' ❌ Preview build failed: ' + (buildRes?.error || 'unknown') + ' ❌');
				try { window.dispatchEvent(new CustomEvent('py:preview:log', { detail: { line: ' ❌ Preview build failed: ' + (buildRes?.error || 'unknown') + ' ❌', origin: 'deploy', projectId: selectedProjectCloudId } })); } catch { }
				window.dispatchEvent(new CustomEvent('py:notify', { detail: { type: 'error', message: 'Preview build failed: ' + (buildRes?.error || 'unknown'), persistent: false } }));
				setPreviewStarting(false);
				return;
			}
			appendLog(`Preview build output: ${buildRes.path}`);
			try { window.dispatchEvent(new CustomEvent('py:preview:log', { detail: { line: `Preview build output: ${buildRes.path}`, origin: 'deploy', projectId: selectedProjectCloudId } })); } catch { }
			window.dispatchEvent(new CustomEvent('py:notify', { detail: { type: 'success', message: 'Preview build succeeded', persistent: false } }));

			appendLog('Starting local static server...');
			try { window.dispatchEvent(new CustomEvent('py:preview:log', { detail: { line: 'Starting local static server...', origin: 'deploy', projectId: selectedProjectCloudId } })); } catch { }
			// Read saved preview settings from project metadata (if present) and pass host/port through
			const meta = (selectedProject as any)?.portfolioMeta?.buildSettings || {};
			const previewMeta = (meta && meta.preview) || {};
			const hostOpt = previewMeta.host || meta.previewHost || undefined;
			const portVal = Number(previewMeta.port || meta.previewPort || 0) || 0;
			const startRes = await startPreviewServer(buildRes.path, hostOpt, portVal || undefined);
			if (!startRes || !startRes.ok) {
				appendLog(' ❌ Failed to start preview server: ' + (startRes?.error || 'unknown') + ' ❌');
				try { window.dispatchEvent(new CustomEvent('py:preview:log', { detail: { line: ' ❌ Failed to start preview server: ' + (startRes?.error || 'unknown') + ' ❌', origin: 'deploy', projectId: selectedProjectCloudId } })); } catch { }
				window.dispatchEvent(new CustomEvent('py:notify', { detail: { type: 'error', message: 'Failed to start preview server: ' + (startRes?.error || 'unknown'), persistent: false } }));
				setPreviewStarting(false);
				return;
			}
			appendLog(`✅ Preview running: ${startRes.localUrl} (LAN: ${startRes.lanUrl})`);
			try { window.dispatchEvent(new CustomEvent('py:preview:log', { detail: { line: `✅ Preview running: ${startRes.localUrl} (LAN: ${startRes.lanUrl})`, origin: 'deploy', projectId: selectedProjectCloudId } })); } catch { }
			window.dispatchEvent(new CustomEvent('py:notify', { detail: { type: 'success', message: 'Local preview started', href: startRes.localUrl, ctaLabel: 'Open', persistent: false } }));

			// Auto-open in browser when preview starts if project preview settings request it
			try {
				const meta = (selectedProject as any)?.portfolioMeta?.buildSettings || {};
				const previewMeta = (meta && meta.preview) || {};
				const openOnStart = !!(previewMeta.openOnStart || meta.previewOpenOnStart);
				if (openOnStart && startRes.localUrl) {
					try { await (window as any).api?.openExternal?.({ url: startRes.localUrl }); } catch { /* ignore */ }
				}
			} catch { /* ignore */ }
			setPreviewRunning(true);
			setPreviewLocalUrl(startRes.localUrl || null);
			if (startRes.lanUrl && !startRes.lanUrl.startsWith('http://127.') && !startRes.lanUrl.startsWith('http://localhost')) setPreviewLanUrl(startRes.lanUrl);

			// Persist global preview state and broadcast so other UI (PortfolioIsland) can reflect it
			setPreviewState(selectedProjectCloudId, { running: true, localUrl: startRes.localUrl, lanUrl: startRes.lanUrl });
			window.dispatchEvent(new CustomEvent('py:preview:state', { detail: { projectId: selectedProjectCloudId, running: true, localUrl: startRes.localUrl, lanUrl: startRes.lanUrl } }));
		} catch (e) {
			appendLog('❌ Local preview failed: ' + (e instanceof Error ? e.message : String(e)));
		} finally {
			setPreviewStarting(false);
		}
	}

	async function handleStopLocalPreview() {
		try {
			appendLog('Stopping local preview...');
			try { window.dispatchEvent(new CustomEvent('py:preview:log', { detail: { line: 'Stopping local preview...', origin: 'deploy', projectId: selectedProjectCloudId } })); } catch { }
			const res = await (window as any).api?.previewStopServer?.();
			if (!res || !res.ok) {
				appendLog(' ❌ Failed to stop preview: ' + (res?.error || 'unknown') + ' ❌');
				try { window.dispatchEvent(new CustomEvent('py:preview:log', { detail: { line: ' ❌ Failed to stop preview: ' + (res?.error || 'unknown') + ' ❌', origin: 'deploy', projectId: selectedProjectCloudId } })); } catch { }
				window.dispatchEvent(new CustomEvent('py:notify', { detail: { type: 'error', message: 'Failed to stop preview: ' + (res?.error || 'unknown'), persistent: false } }));
				return;
			}
			appendLog('✅ Preview stopped');
			try { window.dispatchEvent(new CustomEvent('py:preview:log', { detail: { line: '✅ Preview stopped', origin: 'deploy', projectId: selectedProjectCloudId } })); } catch { }
			window.dispatchEvent(new CustomEvent('py:notify', { detail: { type: 'info', message: 'Local preview stopped', persistent: false } }));
			setPreviewRunning(false);
			setPreviewLocalUrl(null);
			setPreviewLanUrl(null);
			setPreviewState(selectedProjectCloudId, { running: false });
			window.dispatchEvent(new CustomEvent('py:preview:state', { detail: { projectId: selectedProjectCloudId, running: false } }));
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
												const ta = document.createElement('textarea');
												ta.value = text;
												document.body.appendChild(ta);
												ta.select();
												document.execCommand('copy');
												ta.remove();
											}
											window.dispatchEvent(new CustomEvent('py:notify', { detail: { type: 'success', message: 'Logs copied to clipboard', persistent: false } }));
										} catch {
											window.dispatchEvent(new CustomEvent('py:notify', { detail: { type: 'warn', message: 'Could not copy logs', persistent: false } }));
										}
									}}
								>
									<Copy size={14} />
								</button>
								<button
									type="button"
									className="btn btn-ghost btn-xs p-1 flex items-center gap-1"
									title="Clear deployment log"
									onClick={() => {
										setBuildLog([]);
										clearPreviewLog(selectedProjectCloudId);
										window.dispatchEvent(new CustomEvent('py:notify', { detail: { type: 'info', message: 'Deployment log cleared', persistent: false } }));
									}}
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
					<div ref={previewRef} className={`rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]/90 p-4 ${pulsePreview ? 'highlight-pulse' : ''}`}>
						<p className="text-xs uppercase tracking-wide text-[color:var(--fg-muted)]">Local Preview</p>
						<p className="text-sm text-[color:var(--fg-muted)]">Start a local static server to preview your compiled site on this machine or your LAN.</p>
						<div className="mt-3">
							<div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)]/80 p-4">
								<div className="max-w-5xl mx-auto">
									{!previewRunning ? (
										<div className="flex flex-col sm:flex-row items-center justify-center gap-3 text-center">
											<div className="flex items-center gap-2">
												<button className="btn btn-accent w-full sm:w-auto gap-2 text-base font-semibold shadow-lg shadow-[color:var(--accent)]/25" onClick={() => handleStartLocalPreview()} disabled={previewStarting || exporting} title="Start local preview">
													<Play size={16} /> <span>Start Preview</span>
												</button>
											</div>
											<button
												className="btn btn-ghost w-full sm:w-auto gap-2 text-base flex items-center"
												onClick={() => openSettings({ projectId: selectedProjectId || (selectedProject as any)?.id, section: 'preview' })}
												disabled={!selectedProject && !selectedProjectId}
												title="Preview settings"
											>
												<SlidersHorizontal size={16} /> <span>Preview Settings</span>
											</button>
										</div>
									) : (
										<div className="flex flex-col sm:flex-row items-center justify-center gap-3 text-center">
											<button className="btn btn-danger w-full sm:w-auto gap-2 text-base font-semibold" onClick={() => handleStopLocalPreview()} title="Stop preview">
												<Square size={16} className="text-[color:var(--danger)]" aria-hidden="true" /> <span>Stop</span>
											</button>
											{previewLocalUrl && (
												<button className="btn btn-ghost w-full sm:w-auto gap-2 text-base flex items-center justify-center" onClick={() => handleReloadLocalPreview()} title="Reload preview (rebuild + restart)">
													<RefreshCw size={16} /> <span>Reload</span>
												</button>
											)}
											{previewLocalUrl && (
												<a
													className="btn btn-ghost w-full sm:w-auto gap-2 text-base flex items-center"
													href={previewLocalUrl}
													target="_blank"
													rel="noreferrer"
													title="Open preview in browser"
													onClick={async (e) => {
														e.preventDefault();
														try { await (window as any).api?.openExternal?.({ url: previewLocalUrl }); } catch { /* ignore */ }
														window.dispatchEvent(new CustomEvent('py:notify', { detail: { type: 'info', message: 'Opening preview in browser', persistent: false } }));
													}}
												>
													<Eye size={16} /> <span>Open</span>
												</a>
											)}
											{/* Preview settings moved up into the running controls (next to Reload) */}
											<button className="btn btn-ghost w-full sm:w-auto gap-2 text-base flex items-center" onClick={() => openSettings({ projectId: selectedProjectId || (selectedProject as any)?.id, section: 'preview' })} disabled={!selectedProject && !selectedProjectId} title="Preview settings">
												<SlidersHorizontal size={16} /> <span>Preview Settings</span>
											</button>
											{previewLocalUrl && (
												<button className="btn btn-ghost w-full sm:w-auto gap-2 text-base flex items-center" onClick={() => (window as any).api?.clipboardWrite?.({ text: previewLocalUrl })} title="Copy local URL">
													<Copy size={16} /> <span>Copy</span>
												</button>
											)}
											{previewLanUrl && (
												<a className="btn btn-ghost w-full sm:w-auto gap-2 text-base flex items-center" href={previewLanUrl} target="_blank" rel="noreferrer" title="Open LAN preview" onClick={() => window.dispatchEvent(new CustomEvent('py:notify', { detail: { type: 'info', message: 'Opening LAN preview in browser', persistent: false } }))}>
													<ExternalLink size={16} /> <span>Open LAN</span>
												</a>
											)}
											{previewLanUrl && (
												<button className="btn btn-ghost w-full sm:w-auto gap-2 text-base flex items-center" onClick={() => (window as any).api?.clipboardWrite?.({ text: previewLanUrl })} title="Copy LAN URL">
													<Copy size={16} /> <span>Copy LAN</span>
												</button>
											)}
										</div>
									)}
								</div>
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
										className="btn btn-accent w-full sm:w-auto gap-2 text-base font-semibold shadow-lg shadow-[color:var(--accent)]/25 flex items-center"
										onClick={handleExportZip}
										disabled={exporting}
									>
										<ExternalLink size={16} /> <span>{exporting ? 'Exporting…' : 'Export Portfolio'}</span>
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
								</div>
								{/* Build settings placed beside primary export control on larger screens */}
								<div className="mt-2 sm:mt-0 flex items-center gap-2 sm:ml-3">
									<button
										type="button"
										className="btn btn-ghost w-full sm:w-auto gap-2 text-base flex items-center justify-center"
										title={selectedProject || selectedProjectId ? 'Build settings' : 'Open a project to modify build settings'}
										disabled={!selectedProject && !selectedProjectId}
										onClick={() => openSettings({ projectId: selectedProjectId || (selectedProject as any)?.id, section: 'build' })}
									>
										<SlidersHorizontal size={16} />
										<span>Build Settings</span>
									</button>
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* Theme settings removed from Deploy page; moved into Editor workspace */}

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
