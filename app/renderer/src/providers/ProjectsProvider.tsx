import '../types/electron.d.ts';
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, getDoc, getDocs, setDoc, serverTimestamp, query, where, orderBy } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { ref as storageRef, uploadBytes, getDownloadURL, getMetadata, getBytes } from "firebase/storage";
import JSZip from "jszip";

import { idbGet, idbPut, computeHash, stores, AssetMeta } from "../lib/assetsStore";
import { auth, db, storage } from "../lib/firebase";
import { sanitizeVideoProps } from "../../../shared/widgets/videoProps";
import type { VideoWidgetProps } from "../../../shared/widgets/videoProps";
import type { Theme, ThemePatch } from "../themes/types";
import { THEME_PRESETS, DEFAULT_THEME_PRESET_ID, getPresetById } from "../themes/presets";
import { createThemeFromPreset as createThemeFromPresetUtil, mergeTheme } from "../themes/utils";

import { useNotifications } from "./NotificationsProvider";

type ZipEntry = {
	async(type: 'arraybuffer'): Promise<ArrayBuffer>;
	async(type: 'string'): Promise<string>;
	dir: boolean;
	name: string;
};

export type Page = {
	pageId: string;
	title: string;
	order: number;
	widgets: string[];
	starter?: boolean;
	backgroundColor?: string | null;
	breakpoints: { desktop: boolean; tablet: boolean; mobile: boolean };
	schemaVersion: number;
	createdAt: string;
	updatedAt: string;
};

export type Widget = {
	widgetId: string;
	type: string;
	slot: string;
	order: number;
	props: unknown;
	layout: unknown;
	schemaVersion: number;
	createdAt: string;
	updatedAt: string;
};

export type PortfolioMeta = {
	siteTitle: string;
	tagline?: string | null;
	description?: string | null;
	author?: string | null;
	websiteUrl?: string | null;
	iconEmoji?: string | null;
	iconImageUrl?: string | null;
	socialImageUrl?: string | null;
};

export type Project = {
	id: string;
	ownerUid?: string;
	name: string;
	description?: string;
	portfolioMeta?: PortfolioMeta;
	activeThemeId: string;
	pageOrder: string[];
	limits: { maxPages: number; maxAssetsMB: number };
	status: { deployed: boolean; lastDeployAt: string | null; deployType: string | null };
	schemaVersion: number;
	createdAt: string;
	updatedAt: string;
	themes: Record<string, Theme>;
	pages: Record<string, Page>;
	widgets: Record<string, Widget>;
};

// Local-only metadata (file path, sync state, etc.)
export type LocalProject = Project & {
	_filePath?: string; // not exported; only for local persistence
	_synced?: boolean;  // placeholder for cloud sync indicator
	_cloudId?: string; // firestore document id for cloud copy
};

function sanitizeVideoWidgetProps(widget: Widget): Widget {
	const rawProps = (widget?.props || {}) as Partial<VideoWidgetProps>;
	const safeProps = sanitizeVideoProps(rawProps);
	return { ...widget, props: safeProps };
}

function sanitizeProjectVideoWidgets(project: LocalProject): LocalProject {
	if (!project || typeof project !== 'object') return project;
	const widgets = project.widgets;
	if (!widgets || typeof widgets !== 'object') return project;
	let sanitized: Record<string, Widget> | null = null;
	for (const [widgetId, widget] of Object.entries(widgets)) {
		if (!widget || typeof widget !== 'object') continue;
		if (widget.type !== 'video') continue;
		if (!sanitized) sanitized = { ...widgets } as Record<string, Widget>;
		sanitized[widgetId] = sanitizeVideoWidgetProps(widget as Widget);
	}
	if (!sanitized) return project;
	return { ...project, widgets: sanitized };
}

const themePresetFallback = getPresetById(DEFAULT_THEME_PRESET_ID) || THEME_PRESETS[0];

function hydrateThemeCandidate(raw: Partial<Theme> | undefined, nameHint: string): Theme {
	const base = createThemeFromPresetUtil(themePresetFallback, {
		themeId: raw?.themeId,
		name: raw?.name || nameHint,
		origin: raw?.origin || 'custom',
		createdAt: raw?.createdAt,
	});
	const merged = mergeTheme(base, { colors: raw?.colors, typography: raw?.typography, name: raw?.name }) as Theme;
	return {
		...merged,
		createdAt: raw?.createdAt || base.createdAt,
		updatedAt: raw?.updatedAt || merged.updatedAt,
		schemaVersion: typeof raw?.schemaVersion === 'number' ? raw.schemaVersion : merged.schemaVersion,
		origin: raw?.origin || merged.origin,
	};
}

function ensureProjectThemes(project: LocalProject): LocalProject {
	const themesMap = (project.themes && typeof project.themes === 'object') ? project.themes as Record<string, Partial<Theme>> : {};
	const nextThemes: Record<string, Theme> = {};
	let activeId = project.activeThemeId;
	for (const [themeId, raw] of Object.entries(themesMap)) {
		if (!raw) continue;
		const hydrated = hydrateThemeCandidate({ ...raw, themeId }, project.name || 'Theme');
		nextThemes[hydrated.themeId] = hydrated;
		if (hydrated.themeId === activeId) {
			activeId = hydrated.themeId;
		}
	}
	if (!activeId || !nextThemes[activeId]) {
		const fallback = createThemeFromPresetUtil(themePresetFallback, { name: project.name ? `${project.name} Theme` : 'Portfolio Theme' });
		nextThemes[fallback.themeId] = fallback;
		activeId = fallback.themeId;
	}
	return { ...project, themes: nextThemes, activeThemeId: activeId } as LocalProject;
}

function ensurePortfolioMeta(project: LocalProject): LocalProject {
	const name = normalizeProjectName(project?.name);
	const metaSource = project.portfolioMeta || ({ siteTitle: name } as PortfolioMeta);
	const hydrated = hydratePortfolioMeta(metaSource, name);
	return { ...project, name: hydrated.siteTitle, portfolioMeta: hydrated, description: hydrated.description || '' } as LocalProject;
}

function sanitizeProjectsList(projects: LocalProject[]): LocalProject[] {
	return projects.map((proj) => ensurePortfolioMeta(ensureProjectThemes(sanitizeProjectVideoWidgets(proj))));
}

type ProjectsCtx = {
	projects: LocalProject[];
	hasAny: boolean;
	cloudMaxProjects: number;
	cloudMaxStorageMB: number;
	cloudBytesUsed: number;
	cloudProjectsCount: number;
	addProject: (name?: string) => Project;
	importProject: (file?: File) => Promise<Project>;
	createProjectWithSave: (input: string | { name: string; metadata?: Partial<PortfolioMeta> }) => Promise<LocalProject | null>;
	updateProjectMetadata: (projectId: string, payload: { name?: string; metadata?: Partial<PortfolioMeta> }) => Promise<void>;
	selectProject: (projectId: string) => void;
	selectedProjectId: string | null;
	selectedProject: LocalProject | null;
	clearAll: () => void;
	exportProject: (projectId: string) => Promise<void>;
	renameProject: (projectId: string, newName: string) => Promise<void>;
	deleteProject: (projectId: string, opts?: { deleteFile?: boolean }) => Promise<void>;
	syncProject: (projectId: string) => Promise<void>;
	unsyncProject: (projectId: string) => Promise<void>;
	saveProject: (projectId: string, opts?: { saveAs?: boolean }) => Promise<void>;
	deleteCloudProject: (projectId: string) => Promise<void>;
	listCloudProjects: () => Promise<Array<{ id: string; name: string; updatedAt: string; storagePath: string }>>;
	importProjectFromCloud: (cloudId: string) => Promise<LocalProject | null>;
	importProjectFromCloudLocalOnly: (cloudId: string) => Promise<LocalProject | null>;
	getCloudObjectInfo: (projectId: string) => Promise<{ storagePath: string; sizeBytes: number; updatedAt: string } | null>;
	getCloudObjectInfoByCloudId: (cloudId: string) => Promise<{ storagePath: string; sizeBytes: number; updatedAt: string } | null>;
	renameCloudProject: (cloudId: string, newName: string) => Promise<boolean>;
	deleteCloudProjectByCloudId: (cloudId: string) => Promise<boolean>;
	saving: boolean;
	lastSavedAt: string | null;
	setProjectFilePath: (projectId: string, newPath: string) => void;
	clearSelection: () => void;
	autosaveEnabled: boolean;
	setAutosaveEnabled: (v: boolean) => void;
	reconcileCloudLinks: (knownCloudIds: string[]) => void;
	// Pages
	createPage: (projectId: string, title?: string) => string | null;
	renamePage: (projectId: string, pageId: string, newTitle: string) => void;
	deletePage: (projectId: string, pageId: string) => void;
	setPageStarter: (projectId: string, pageId: string, starter: boolean) => void;
	setPageBackground: (projectId: string, pageId: string, color?: string | null) => void;
	// Page widgets
	getPageItems: (projectId: string, pageId: string) => Array<{
		id: string; x: number; y: number; w: number; h: number; z: number;
		title?: string; type?: string; props?: unknown; schemaVersion?: number; pinned?: boolean; locked?: boolean;
	}>;
	setPageItems: (projectId: string, pageId: string, items: Array<{
		id: string; x: number; y: number; w: number; h: number; z: number;
		title?: string; type?: string; props?: unknown; schemaVersion?: number; pinned?: boolean; locked?: boolean;
	}>) => void;
	activeTheme: Theme | null;
	setActiveTheme: (projectId: string, themeId: string) => void;
	createThemeFromPreset: (projectId: string, presetId: string, opts?: { activate?: boolean; name?: string }) => Theme | null;
	duplicateTheme: (projectId: string, sourceThemeId: string, opts?: { activate?: boolean }) => Theme | null;
	updateTheme: (projectId: string, themeId: string, patch: ThemePatch) => void;
	deleteTheme: (projectId: string, themeId: string) => void;
};

const Ctx = createContext<ProjectsCtx | null>(null);

function readStore(): LocalProject[] {
	try {
		const raw = JSON.parse(localStorage.getItem("py.projects") || "[]");
		if (!Array.isArray(raw)) return [];
		return sanitizeProjectsList(raw as LocalProject[]);
	} catch { return []; }
}
type IdleHandle = number;
let pendingStoreWrite: IdleHandle | null = null;
let queuedStorePayload: LocalProject[] | null = null;
function flushQueuedStore() {
	const payload = queuedStorePayload;
	queuedStorePayload = null;
	if (!payload) return;
	try {
		localStorage.setItem("py.projects", JSON.stringify(payload));
	} catch {
		/* ignore storage failures */
	}
}
function writeStore(list: LocalProject[]) {
	queuedStorePayload = list;
	if (pendingStoreWrite !== null) return;
	const schedule = () => {
		pendingStoreWrite = null;
		flushQueuedStore();
	};
	if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
		pendingStoreWrite = window.requestIdleCallback(schedule, { timeout: 400 }) as unknown as IdleHandle;
	} else {
		pendingStoreWrite = window.setTimeout(schedule, 0) as unknown as IdleHandle;
	}
}
function readSelected(): string | null { try { return JSON.parse(localStorage.getItem("py.selectedProjectId") || "null"); } catch { return null; } }
function writeSelected(id: string | null) { localStorage.setItem("py.selectedProjectId", JSON.stringify(id)); }

// Local revision history helpers (per-project; capped to 5 entries)
type RevisionEntry = { savedAt: string; data: LocalProject };
function revisionsKey(projectId: string) { return `py.revisions.${projectId}`; }
function readRevisions(projectId: string): RevisionEntry[] {
	try { return JSON.parse(localStorage.getItem(revisionsKey(projectId)) || "[]"); } catch { return []; }
}
function pushRevisionSnapshot(proj: LocalProject) {
	try {
		const key = revisionsKey(proj.id);
		const existing: RevisionEntry[] = readRevisions(proj.id);
		// Avoid duplicate snapshots with same updatedAt
		const last = existing[0];
		if (last && last.data.updatedAt === proj.updatedAt) return;
		const clean = sanitizeProjectVideoWidgets(proj);
		const snapshot: RevisionEntry = { savedAt: new Date().toISOString(), data: { ...clean, _filePath: undefined, _synced: undefined } as LocalProject };
		const next = [snapshot, ...existing].slice(0, 5);
		localStorage.setItem(key, JSON.stringify(next));
	} catch { /* ignore */ }
}


export function ProjectsProvider({ children }: { children: React.ReactNode }) {
	const [projects, setProjects] = useState<LocalProject[]>([]);
	const { add: notify } = useNotifications();
	const [autosaveEnabled, setAutosaveEnabled] = useState<boolean>(() => {
		try { return localStorage.getItem('py_autosave_enabled') !== '0'; } catch { return true; }
	});
	const [selectedProjectId, setSelectedProjectId] = useState<string | null>(readSelected());
	useEffect(() => { setProjects(readStore()); }, []);
	const [saving, setSaving] = useState(false);
	const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
	const [cloudMaxProjects, setCloudMaxProjects] = useState<number>(1);
	const [cloudBytesUsed, setCloudBytesUsed] = useState<number>(0);
	const [cloudProjectsCount, setCloudProjectsCount] = useState<number>(0);
	const [cloudMaxStorageMB, setCloudMaxStorageMB] = useState<number>(1024);

	// One-time bump: increase existing projects' page limit to 10 if lower
	const bumpedRef = useRef(false);
	useEffect(() => {
		if (bumpedRef.current) return;
		if (!projects || projects.length === 0) return;
		let changed = false;
		const next = projects.map(p => {
			const current = (p.limits && typeof p.limits.maxPages === 'number') ? p.limits.maxPages : 0;
			if (current < 10) {
				const limits = { maxPages: 10, maxAssetsMB: (p.limits && typeof p.limits.maxAssetsMB === 'number') ? p.limits.maxAssetsMB : 500 };
				changed = true;
				return { ...p, limits, updatedAt: now() } as LocalProject;
			}
			return p;
		});
		if (changed) { setProjects(next); writeStore(next); }
		bumpedRef.current = true;
	}, [projects]);

	// Load cloud limit when user is available (best-effort)
	useEffect(() => {
		const unsub = onAuthStateChanged(auth, async (user) => {
			if (!user) {
				// On sign-out, reset cloud limits/counters and strip cloud linkage from local projects
				setCloudMaxProjects(1);
				setCloudMaxStorageMB(1024);
				setCloudBytesUsed(0);
				setCloudProjectsCount(0);
				setProjects(prev => {
					const next = prev.map(p => {
						const q = { ...p } as LocalProject;
						if (q._cloudId) delete q._cloudId;
						if (q._synced) q._synced = false;
						return q;
					});
					writeStore(next);
					return next;
				});
				return;
			}
			try {
				const uref = doc(db, 'users', user.uid);
				const snap = await getDoc(uref);
				const data = snap.exists() ? (snap.data() as Record<string, unknown>) : undefined;
				const plan = data && typeof data['plan'] === 'object' && data['plan'] !== null ? (data['plan'] as Record<string, unknown>) : undefined;
				const settings = data && typeof data['settings'] === 'object' && data['settings'] !== null ? (data['settings'] as Record<string, unknown>) : undefined;
				const counters = data && typeof data['counters'] === 'object' && data['counters'] !== null ? (data['counters'] as Record<string, unknown>) : undefined;
				const limitVal = (typeof plan?.['maxCloudProjects'] === 'number' ? (plan!['maxCloudProjects'] as number) : undefined)
					?? (typeof settings?.['maxCloudProjects'] === 'number' ? (settings!['maxCloudProjects'] as number) : undefined)
					?? 1;
				const n = typeof limitVal === 'number' && limitVal > 0 ? limitVal : 1;
				setCloudMaxProjects(n);

				// Read max storage (in MB) from user settings/plan; default to 1024MB if missing
				const storageMBVal = (typeof plan?.['maxStorageMB'] === 'number' ? (plan!['maxStorageMB'] as number) : undefined)
					?? (typeof settings?.['maxStorageMB'] === 'number' ? (settings!['maxStorageMB'] as number) : undefined)
					?? 1024;
				const storageMB = typeof storageMBVal === 'number' && storageMBVal > 0 ? storageMBVal : 1024;
				setCloudMaxStorageMB(storageMB);
				const used = typeof counters?.['cloudBytesUsed'] === 'number' ? (counters!['cloudBytesUsed'] as number) : 0;
				const cnt = typeof counters?.['cloudProjects'] === 'number' ? (counters!['cloudProjects'] as number) : 0;
				setCloudBytesUsed(used);
				setCloudProjectsCount(cnt);
			} catch { setCloudMaxProjects(1); setCloudMaxStorageMB(1024); }
		});
		return () => unsub();
	}, []);

	// Helper to get current timestamp
	const now = () => new Date().toISOString();

	// Helper: serialize project + referenced assets into a zip (base64)
	const buildArchiveBase64 = async (proj: LocalProject) => {
		const sanitizedProject = sanitizeProjectVideoWidgets(proj);
		const zip = new JSZip();
		const payload: { _format: string; _version: number; exportedAt: string; project: LocalProject } = {
			_format: "portfoliyou",
			_version: 2,
			exportedAt: now(),
			project: { ...sanitizedProject },
		};
		delete (payload.project as LocalProject)._filePath;
		delete (payload.project as LocalProject)._synced;

		// Collect referenced asset hashes from widgets (props.src can be asset://hash or assets/...)
		const hashes = new Set<string>();
		const collectAssetHash = (value?: string | null) => {
			if (!value || typeof value !== 'string') return;
			if (!value.startsWith('asset://')) return;
			const h = value.slice('asset://'.length);
			if (h) hashes.add(h);
		};
		for (const w of Object.values(sanitizedProject.widgets || {})) {
			try {
				const p = (w.props || {}) as Record<string, unknown>;
				const src = typeof p['src'] === 'string' ? (p['src'] as string) : '';
				if (src.startsWith('asset://')) hashes.add(src.slice('asset://'.length));
			} catch { /* ignore */ }
		}
		collectAssetHash(sanitizedProject.portfolioMeta?.iconImageUrl || null);
		collectAssetHash(sanitizedProject.portfolioMeta?.socialImageUrl || null);

		// Emit separate JSON files for better performance and modularity
		const projectForArchive: LocalProject = JSON.parse(JSON.stringify(payload.project));
		for (const w of Object.values(projectForArchive.widgets || {})) {
			try {
				const p = (w.props || {}) as Record<string, unknown>;
				const src = typeof p['src'] === 'string' ? (p['src'] as string) : '';
				if (src.startsWith('asset://')) {
					const h = src.slice('asset://'.length);
					(p as Record<string, unknown>)['src'] = `assets/${h}`;
				}
			} catch { /* ignore */ }
		}
		if (projectForArchive.portfolioMeta) {
			const meta = projectForArchive.portfolioMeta as PortfolioMeta;
			if (typeof meta.iconImageUrl === 'string' && meta.iconImageUrl.startsWith('asset://')) {
				const h = meta.iconImageUrl.slice('asset://'.length);
				meta.iconImageUrl = h ? `assets/${h}` : meta.iconImageUrl;
			}
			if (typeof meta.socialImageUrl === 'string' && meta.socialImageUrl.startsWith('asset://')) {
				const h = meta.socialImageUrl.slice('asset://'.length);
				meta.socialImageUrl = h ? `assets/${h}` : meta.socialImageUrl;
			}
		}

		// Break project into multiple JSON files for better performance and offload to worker
		const { pages, widgets, themes, ...projectMeta } = projectForArchive;

		// Prepare assets as transferable ArrayBuffers
		const assetList: Array<{ hash: string; buffer: ArrayBuffer; meta?: AssetMeta }> = [];
		for (const h of hashes) {
			try {
				const blob = await idbGet<Blob>(stores.STORE_BLOBS, h);
				if (!blob) continue;
				const ab = await blob.arrayBuffer();
				const meta = await idbGet<AssetMeta>(stores.STORE_META, h);
				assetList.push({ hash: h, buffer: ab, meta });
			} catch { /* ignore */ }
		}

		// Use a dedicated worker for heavy JSON + ZIP work when available
		if (typeof Worker !== 'undefined') {
			try {
				const worker = new Worker(new URL('../workers/saveWorker.ts', import.meta.url), { type: 'module' });
				const payload = { _format: 'portfoliyou', _version: 2, exportedAt: now() };
				const msg = { type: 'serialize', payload, projectMeta, pages, widgets, themes, assets: assetList };
				const base64 = await new Promise<string>((resolve, reject) => {
					const timeout = setTimeout(() => {
						worker.terminate();
						reject(new Error('worker-timeout'));
					}, 60_000);
					worker.onmessage = (e) => {
						const d = e.data;
						clearTimeout(timeout);
						worker.terminate();
						if (d && d.type === 'success') resolve(d.base64);
						else reject(new Error(d?.error || 'worker-error'));
					};
					worker.onerror = (err) => {
						clearTimeout(timeout);
						worker.terminate();
						reject(err instanceof Error ? err : new Error('worker-failure'));
					};
					// Post message; transfer buffers to avoid copy
					try {
						const transfer = assetList.map(a => a.buffer) as Transferable[];
						(worker as Worker).postMessage(msg, transfer);
					} catch (err) {
						worker.terminate();
						reject(err);
					}
				});
				return base64;
			} catch {
				// fallback to in-thread path below
			}
		}

		// Fallback: perform in main thread with yielding
		zip.file('project-meta.json', JSON.stringify({ ...payload, project: projectMeta }, null, 2));
		await new Promise(resolve => setTimeout(resolve, 0));
		zip.file('pages.json', JSON.stringify(pages, null, 2));
		await new Promise(resolve => setTimeout(resolve, 0));
		zip.file('widgets.json', JSON.stringify(widgets, null, 2));
		await new Promise(resolve => setTimeout(resolve, 0));
		zip.file('themes.json', JSON.stringify(themes, null, 2));
		await new Promise(resolve => setTimeout(resolve, 0));

		// Add assets folder with chunked loading to prevent UI blocking
		if (hashes.size > 0) {
			const folder = zip.folder('assets');
			const hashArray = Array.from(hashes);
			// Process assets in chunks to yield control to UI thread
			const chunkSize = 5;
			for (let i = 0; i < hashArray.length; i += chunkSize) {
				const chunk = hashArray.slice(i, i + chunkSize);
				await Promise.all(chunk.map(async (h) => {
					try {
						const blob = await idbGet<Blob>(stores.STORE_BLOBS, h);
						if (!blob) return;
						// Yield control briefly to prevent blocking
						await new Promise(resolve => setTimeout(resolve, 0));
						const ab = await blob.arrayBuffer();
						folder?.file(h, ab);
						// Optionally include sidecar meta json
						const meta = await idbGet<AssetMeta>(stores.STORE_META, h);
						if (meta) folder?.file(`${h}.meta.json`, JSON.stringify(meta));
					} catch { /* ignore */ }
				}));
				// Yield control between chunks
				await new Promise(resolve => setTimeout(resolve, 0));
			}
		}
		// Yield before final ZIP generation
		await new Promise(resolve => setTimeout(resolve, 0));
		const base64 = await zip.generateAsync({ type: 'base64' });
		return base64;
	};

	// Helper: parse archive (ArrayBuffer) and load assets into local store; returns LocalProject
	const importFromArchive = async (buf: ArrayBuffer): Promise<LocalProject> => {
		const zip = await JSZip.loadAsync(buf);
		let project: LocalProject;

		// Check for new multi-file format first
		const metaEntry = zip.file('project-meta.json');
		const pagesEntry = zip.file('pages.json');
		const widgetsEntry = zip.file('widgets.json');
		const themesEntry = zip.file('themes.json');

		if (metaEntry && pagesEntry && widgetsEntry && themesEntry) {
			// New format: separate files
			const metaText = await metaEntry.async('string');
			const pagesText = await pagesEntry.async('string');
			const widgetsText = await widgetsEntry.async('string');
			const themesText = await themesEntry.async('string');

			let metaParsed: unknown;
			let pagesParsed: unknown;
			let widgetsParsed: unknown;
			let themesParsed: unknown;

			try {
				metaParsed = JSON.parse(metaText);
				pagesParsed = JSON.parse(pagesText);
				widgetsParsed = JSON.parse(widgetsText);
				themesParsed = JSON.parse(themesText);
			} catch {
				throw new Error('invalid-project-json');
			}

			// Unwrap meta wrapper
			let metaRaw: unknown = metaParsed;
			if (typeof metaRaw === 'object' && metaRaw !== null) {
				const r = metaRaw as Record<string, unknown>;
				if (r['_format'] === 'portfoliyou' && typeof r['project'] === 'object' && r['project'] !== null) metaRaw = r['project'];
			}

			project = {
				...migrateProjectSchema(metaRaw),
				pages: pagesParsed as Record<string, Page>,
				widgets: widgetsParsed as Record<string, Widget>,
				themes: themesParsed as Record<string, Theme>,
			} as LocalProject;
		} else {
			// Fallback to old single-file format
			const projEntry = zip.file('project.json');
			if (!projEntry) throw new Error('missing-project-json');
			const text = await projEntry.async('string');
			let parsed: unknown;
			try { parsed = JSON.parse(text); } catch { throw new Error('invalid-project-json'); }
			// Unwrap wrapper
			let raw: unknown = parsed;
			if (typeof raw === 'object' && raw !== null) {
				const r = raw as Record<string, unknown>;
				if (r['_format'] === 'portfoliyou' && typeof r['project'] === 'object' && r['project'] !== null) raw = r['project'];
			}
			project = migrateProjectSchema(raw);
		}
		// Import assets: any files under assets/ are stored and src rewritten to asset://hash
		// First, compute available filenames in assets/
		const assetsFolder = zip.folder('assets');
		const files: Array<{ name: string; file: ZipEntry }> = [];
		if (assetsFolder) {
			assetsFolder.forEach((relPath: string, f: ZipEntry) => {
				if (f.dir) return;
				// Skip sidecar meta
				if (relPath.endsWith('.meta.json')) return;
				files.push({ name: relPath, file: f });
			});
		}
		// Load and store
		const nameToHash = new Map<string, string>();
		for (const { name, file } of files) {
			try {
				const ab = await file.async('arraybuffer');
				const blob = new Blob([ab]);
				const hash = await computeHash(blob);
				nameToHash.set(name, hash);
				// Store blob and meta if not exists
				const existing = await idbGet(stores.STORE_META, hash);
				if (!existing) {
					const metaSidecar = assetsFolder?.file(`${name}.meta.json`);
					let meta: AssetMeta | undefined;
					if (metaSidecar) {
						try { meta = JSON.parse(await metaSidecar.async('string')) as AssetMeta; } catch { meta = undefined; }
					}
					const fullMeta: AssetMeta = meta ?? {
						hash,
						name,
						type: 'application/octet-stream',
						size: ab.byteLength,
						createdAt: new Date().toISOString(),
					};
					await idbPut(stores.STORE_BLOBS, hash, blob);
					await idbPut(stores.STORE_META, hash, fullMeta);
				}
			} catch { /* ignore single asset failures */ }
		}
		// Rewrite src from assets/<name> to asset://hash
		const out: LocalProject = { ...project } as LocalProject;
		for (const w of Object.values(out.widgets || {})) {
			try {
				const p = (w.props || {}) as Record<string, unknown>;
				const src = typeof p['src'] === 'string' ? (p['src'] as string) : '';
				if (src.startsWith('assets/')) {
					const name = src.slice('assets/'.length);
					const h = nameToHash.get(name) || nameToHash.get(src) /* sometimes include nested path */;
					if (h) (p as Record<string, unknown>)['src'] = `asset://${h}`;
				}
			} catch { /* ignore */ }
		}
		if (out.portfolioMeta) {
			const meta = { ...out.portfolioMeta } as PortfolioMeta;
			let changed = false;
			if (typeof meta.iconImageUrl === 'string' && meta.iconImageUrl.startsWith('assets/')) {
				const name = meta.iconImageUrl.slice('assets/'.length);
				const h = nameToHash.get(name) || nameToHash.get(meta.iconImageUrl);
				if (h) {
					meta.iconImageUrl = `asset://${h}`;
					changed = true;
				}
			}
			if (typeof meta.socialImageUrl === 'string' && meta.socialImageUrl.startsWith('assets/')) {
				const name = meta.socialImageUrl.slice('assets/'.length);
				const h = nameToHash.get(name) || nameToHash.get(meta.socialImageUrl);
				if (h) {
					meta.socialImageUrl = `asset://${h}`;
					changed = true;
				}
			}
			if (changed) {
				out.portfolioMeta = meta;
			}
		}
		return out;
	};

	const selected = useMemo(() => projects.find(p => p.id === selectedProjectId) || null, [projects, selectedProjectId]);
	const selectedTheme = useMemo(() => selected ? (selected.themes?.[selected.activeThemeId] ?? null) : null, [selected]);

	const api = useMemo<ProjectsCtx>(() => {
		// Default theme seeded from preset
		const preset = themePresetFallback;
		const defaultTheme: Theme = createThemeFromPresetUtil(preset, { themeId: "theme_default_light", name: preset.name });

		// Default page
		const defaultPage: Page = {
			pageId: "page_home",
			title: "Home",
			order: 0,
			widgets: [],
			backgroundColor: null,
			breakpoints: { desktop: true, tablet: true, mobile: true },
			schemaVersion: 1,
			createdAt: now(),
			updatedAt: now(),
		};

		const saveMetadata = async (projectId: string, payload: { name?: string; metadata?: Partial<PortfolioMeta> }) => {
			const idx = projects.findIndex(p => p.id === projectId); if (idx < 0) return;
			const existing = projects[idx];
			const requestedName = payload.name ?? payload.metadata?.siteTitle ?? existing.name;
			const normalizedName = normalizeProjectName(requestedName || existing.name, existing.name);
			const mergedSource: Partial<PortfolioMeta> = { ...(existing.portfolioMeta || { siteTitle: existing.name }), ...(payload.metadata || {}) };
			mergedSource.siteTitle = mergedSource.siteTitle ?? normalizedName;
			const hydrated = hydratePortfolioMeta(mergedSource, normalizedName);
			// Preserve any additional metadata keys (e.g. buildSettings) that hydratePortfolioMeta
			// doesn't explicitly include. We trim/normalize core fields via `hydrated`, then
			// merge through any other keys from the merged source so we don't drop nested data.
			const extraMeta = { ...(mergedSource as any) } as Record<string, any>;
			delete extraMeta.siteTitle; delete extraMeta.tagline; delete extraMeta.description; delete extraMeta.author; delete extraMeta.websiteUrl; delete extraMeta.iconEmoji; delete extraMeta.iconImageUrl; delete extraMeta.socialImageUrl;
			const finalMeta = { ...hydrated, ...extraMeta } as PortfolioMeta & Record<string, any>;
			const updated: LocalProject = {
				...existing,
				name: hydrated.siteTitle,
				description: hydrated.description || existing.description || "",
				portfolioMeta: finalMeta,
				updatedAt: now(),
			} as LocalProject;
			let nextList = [...projects];
			nextList[idx] = updated;
			setProjects(nextList); writeStore(nextList);
			const nameChanged = existing.name !== updated.name;
			if (nameChanged && existing._filePath && window.api?.renameFile) {
				const sanitize = (s: string) => s.replace(/[\\/:*?"<>|]/g, "_").trim() || "project";
				const from = existing._filePath;
				const sepIndex = Math.max(from.lastIndexOf('\\'), from.lastIndexOf('/'));
				const dir = sepIndex >= 0 ? from.slice(0, sepIndex) : '';
				const sep = sepIndex >= 0 ? from[sepIndex] : (from.includes('/') ? '/' : '\\');
				const desiredBase = `${sanitize(updated.name)}.portfoliyou`;
				const to = dir ? `${dir}${sep}${desiredBase}` : desiredBase;
				try {
					const res = await window.api.renameFile({ fromPath: from, toPath: to });
					if (res.ok) {
						const withPath = { ...updated, _filePath: to } as LocalProject;
						nextList = [...nextList];
						nextList[idx] = withPath;
						setProjects(nextList); writeStore(nextList);
						return withPath;
					} else {
						window.dispatchEvent(new CustomEvent('py:notify', { detail: { type: 'warn', message: 'File rename failed; name changed only.' } }));
					}
				} catch {
					window.dispatchEvent(new CustomEvent('py:notify', { detail: { type: 'warn', message: 'File rename failed; name changed only.' } }));
				}
			}
			return updated;
		};


		return {
			projects,
			hasAny: projects.length > 0,
			cloudMaxProjects,
			cloudMaxStorageMB,
			cloudBytesUsed,
			cloudProjectsCount,
			saving,
			lastSavedAt,
			setProjectFilePath: (projectId: string, newPath: string) => {
				const idx = projects.findIndex(p => p.id === projectId); if (idx < 0) return;
				const updated = { ...projects[idx], _filePath: newPath } as LocalProject;
				const next = [...projects]; next[idx] = updated; setProjects(next); writeStore(next);
			},
			setPageStarter: (projectId: string, pageId: string, starter: boolean) => {
				const idx = projects.findIndex(p => p.id === projectId); if (idx < 0) return;
				const proj = projects[idx];
				if (!proj.pages[pageId]) return;
				const nextPages = { ...proj.pages } as Record<string, Page>;
				let changed = false;
				if (starter) {
					// set only selected page as starter, unset others
					for (const k of Object.keys(nextPages)) {
						const was = Boolean(nextPages[k]?.starter);
						const nowVal = (k === pageId);
						if (was !== nowVal) { changed = true; }
						nextPages[k] = { ...nextPages[k], starter: nowVal } as Page;
					}
				} else {
					// unset only the selected page
					const was = Boolean(nextPages[pageId]?.starter);
					if (was) { nextPages[pageId] = { ...nextPages[pageId], starter: false } as Page; changed = true; }
				}
				if (changed) {
					const nextProj: LocalProject = { ...proj, pages: nextPages, updatedAt: now() } as LocalProject;
					const next = [...projects]; next[idx] = nextProj; setProjects(next); writeStore(next);
				}
			},
			setPageBackground: (projectId: string, pageId: string, color?: string | null) => {
				const idx = projects.findIndex(p => p.id === projectId); if (idx < 0) return;
				const proj = projects[idx];
				const page = proj.pages[pageId]; if (!page) return;
				const normalized = typeof color === 'string' ? color.trim() : '';
				const nextColor = normalized ? normalized : null;
				if (page.backgroundColor === nextColor) return;
				const updatedPage: Page = { ...page, backgroundColor: nextColor, updatedAt: now() };
				const nextProj: LocalProject = { ...proj, pages: { ...proj.pages, [pageId]: updatedPage }, updatedAt: now() } as LocalProject;
				const next = [...projects]; next[idx] = nextProj; setProjects(next); writeStore(next);
			},
			createPage: (projectId: string, title?: string) => {
				const idx = projects.findIndex(p => p.id === projectId); if (idx < 0) return null;
				const proj = projects[idx];
				const isCloud = !!proj._cloudId;
				const current = proj.pageOrder?.length ?? 0;
				if (isCloud && current >= 10) {
					window.dispatchEvent(new CustomEvent('py:notify', { detail: { type: 'warn', message: 'Cloud projects can have up to 10 pages. Delete a page to add another.' } }));
					return null;
				}
				const pid = `page_${crypto.randomUUID()}`;
				const order = current;
				const page: Page = {
					pageId: pid,
					title: (title && title.trim()) || `Page ${order + 1}`,
					starter: false,
					order,
					widgets: [],
					backgroundColor: null,
					breakpoints: { desktop: true, tablet: true, mobile: true },
					schemaVersion: 1,
					createdAt: now(),
					updatedAt: now(),
				};
				const nextProj: LocalProject = {
					...proj,
					pageOrder: [...proj.pageOrder, pid],
					pages: { ...proj.pages, [pid]: page },
					updatedAt: now(),
				} as LocalProject;
				const next = [...projects]; next[idx] = nextProj; setProjects(next); writeStore(next);
				if (!isCloud) {
					notify({ type: 'info', message: 'Adding more pages increases your project file size.', title: nextProj.name, persistent: false });
				}
				notify({ type: 'success', message: `Page "${page.title}" created`, title: nextProj.name, persistent: false });
				return pid;
			},
			renamePage: (projectId: string, pageId: string, newTitle: string) => {
				const idx = projects.findIndex(p => p.id === projectId); if (idx < 0) return;
				const proj = projects[idx];
				const page = proj.pages[pageId]; if (!page) return;
				const updatedPage: Page = { ...page, title: (newTitle || '').trim() || page.title, updatedAt: now() };
				const nextProj: LocalProject = { ...proj, pages: { ...proj.pages, [pageId]: updatedPage }, updatedAt: now() } as LocalProject;
				const next = [...projects]; next[idx] = nextProj; setProjects(next); writeStore(next);
				notify({ type: 'success', message: `Page renamed to "${updatedPage.title}"`, title: nextProj.name, persistent: false });
			},
			deletePage: (projectId: string, pageId: string) => {
				const idx = projects.findIndex(p => p.id === projectId); if (idx < 0) return;
				const proj = projects[idx];
				if ((proj.pageOrder?.length ?? 0) <= 1) {
					notify({ type: 'warn', message: 'A portfolio needs at least one page.', title: proj.name, persistent: false });
					return;
				}
				if (!proj.pages[pageId]) return;
				const removedTitle = proj.pages[pageId]?.title || 'Untitled';
				const nextOrder = proj.pageOrder.filter(id => id !== pageId);
				const nextPages = { ...proj.pages } as Record<string, Page>;
				// Remove page and clean up references
				const wasStarter = Boolean(nextPages[pageId]?.starter);
				delete nextPages[pageId];
				// Re-number order field for consistency
				const renumbered = nextOrder.map((id, i) => ({ ...nextPages[id], order: i, updatedAt: now() }));
				for (const p of renumbered) { nextPages[p.pageId] = p; }
				// Remove orphan widgets that are no longer referenced by any page
				const stillReferenced = new Set<string>();
				for (const pid of nextOrder) { for (const wid of (nextPages[pid].widgets || [])) stillReferenced.add(wid); }
				const nextWidgets: Record<string, Widget> = {};
				for (const [wid, w] of Object.entries(proj.widgets)) {
					if (stillReferenced.has(wid)) nextWidgets[wid] = w;
				}
				const nextProj: LocalProject = { ...proj, pageOrder: nextOrder, pages: nextPages, widgets: nextWidgets, updatedAt: now() } as LocalProject;
				// If the deleted page was the starter, pick a fallback (first remaining) to be the starter
				if (wasStarter) {
					if (nextOrder.length > 0) {
						const first = nextOrder[0];
						for (const k of Object.keys(nextPages)) { nextPages[k] = { ...nextPages[k], starter: (k === first) } as Page; }
						(nextProj.pages as Record<string, Page>) = nextPages;
					}
				}
				const next = [...projects]; next[idx] = nextProj; setProjects(next); writeStore(next);
				notify({ type: 'info', message: `Page "${removedTitle}" deleted`, title: proj.name, persistent: false });
			},
			addProject: (name = "Untitled Portfolio") => {
				const id = crypto.randomUUID();
				const meta = hydratePortfolioMeta({ siteTitle: name }, name);
				const p: LocalProject = {
					id,
					name: meta.siteTitle,
					description: meta.description || "",
					portfolioMeta: meta,
					activeThemeId: defaultTheme.themeId,
					pageOrder: [defaultPage.pageId],
					limits: { maxPages: 10, maxAssetsMB: 500 },
					status: { deployed: false, lastDeployAt: null, deployType: null },
					schemaVersion: 1,
					createdAt: now(),
					updatedAt: now(),
					themes: { [defaultTheme.themeId]: defaultTheme },
					pages: { [defaultPage.pageId]: { ...defaultPage, starter: true } },
					widgets: {},
				};
				const next = [p, ...projects];
				setProjects(next); writeStore(next);
				localStorage.setItem("py.hasAnyProject", "1");
				return p;
			},
			createProjectWithSave: async (input: string | { name: string; metadata?: Partial<PortfolioMeta> }) => {
				const rawName = typeof input === 'string' ? input : input?.name;
				const base = normalizeProjectName(rawName, "Untitled Portfolio");
				const metadata = hydratePortfolioMeta((typeof input === 'string' ? { siteTitle: base } : (input?.metadata || { siteTitle: base })) as Partial<PortfolioMeta>, base);
				const safeStem = (metadata.siteTitle || base || "Portfolio").replace(/[\\/:*?"<>|]/g, "_") || "Portfolio";
				// Construct project object
				const id = crypto.randomUUID();
				const p: LocalProject = {
					id,
					name: metadata.siteTitle,
					description: metadata.description || "",
					portfolioMeta: metadata,
					activeThemeId: defaultTheme.themeId,
					pageOrder: [defaultPage.pageId],
					limits: { maxPages: 10, maxAssetsMB: 500 },
					status: { deployed: false, lastDeployAt: null, deployType: null },
					schemaVersion: 1,
					createdAt: now(),
					updatedAt: now(),
					themes: { [defaultTheme.themeId]: defaultTheme },
					pages: { [defaultPage.pageId]: defaultPage },
					widgets: {},
				};
				const base64 = await buildArchiveBase64(p);
				if (window.api?.saveFile) {
					// Prefer binary save for archive
					const res = await (window.api.saveFileBytes ? window.api.saveFileBytes({ defaultPath: `${safeStem}.portfoliyou`, dataBase64: base64 }) : window.api.saveFile({ defaultPath: `${safeStem}.portfoliyou`, data: base64, encoding: 'base64' }));
					if (res.canceled || !res.filePath) return null;
					p._filePath = res.filePath;
					const next = [p, ...projects];
					setProjects(next); writeStore(next);
					localStorage.setItem("py.hasAnyProject", "1");
					setSelectedProjectId(p.id); writeSelected(p.id);
					return p;
				} else {
					// Browser fallback download of zip
					const u8 = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
					const blob = new Blob([u8], { type: "application/zip" });
					const url = URL.createObjectURL(blob);
					const a = document.createElement("a"); a.href = url; a.download = `${safeStem}.portfoliyou`;
					document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
					const next = [p, ...projects];
					setProjects(next); writeStore(next);
					setSelectedProjectId(p.id); writeSelected(p.id);
					return p;
				}
			},
			updateProjectMetadata: async (projectId: string, payload: { name?: string; metadata?: Partial<PortfolioMeta> }) => {
				await saveMetadata(projectId, payload);
			},
			importProject: async (file) => {
				// Read file, validate, migrate if needed
				let imported: LocalProject | null = null;
				let importedFilePath: string | undefined;
				if (file) {
					const buf = await file.arrayBuffer();
					const u8 = new Uint8Array(buf);
					const isZip = u8.length > 4 && u8[0] === 0x50 && u8[1] === 0x4b; // PK
					if (isZip) {
						try { imported = await importFromArchive(buf); } catch { imported = null; }
					} else {
						try {
							const text = new TextDecoder('utf-8').decode(u8);
							const data = JSON.parse(text);
							imported = migrateProjectSchema(data);
						} catch { imported = null; }
					}
				} else if (window.api?.openFileDialog) {
					// Prefer binary bytes for archive
					if (window.api.openFileDialogBytes) {
						const res = await window.api.openFileDialogBytes({ filters: [{ name: "PortfoliYOU", extensions: ["portfoliyou", "zip", "json"] }] });
						if (!res.canceled && (res.dataBase64 || res.data)) {
							try {
								if (res.dataBase64) {
									const u8 = Uint8Array.from(atob(res.dataBase64 as string), c => c.charCodeAt(0));
									const buf = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
									imported = await importFromArchive(buf);
								} else if (res.data) {
									const data = JSON.parse(res.data as string);
									imported = migrateProjectSchema(data);
								}
								if (res.filePath) { imported!._filePath = res.filePath; importedFilePath = res.filePath; }
							} catch { imported = null; }
						}
					} else {
						const res = await window.api.openFileDialog({ filters: [{ name: "PortfoliYOU", extensions: ["portfoliyou", "json"] }] });
						if (!res.canceled && res.data) {
							try {
								const data = JSON.parse(res.data);
								imported = migrateProjectSchema(data);
								if (res.filePath) { imported._filePath = res.filePath; importedFilePath = res.filePath; }
							} catch { imported = null; }
						}
					}
				}

				// If we got a valid import, deduplicate by file path and by id
				if (imported) {
					imported = ensurePortfolioMeta(imported as LocalProject);
					// Prefer dedupe by path when available
					if (importedFilePath) {
						const existingByPath = projects.find(p => p._filePath === importedFilePath);
						if (existingByPath) {
							return existingByPath;
						}
					}
					// Dedupe by project id
					const existingByIdIdx = projects.findIndex(p => p.id === imported!.id);
					if (existingByIdIdx >= 0) {
						const existing = projects[existingByIdIdx];
						// If the existing one has no file path but import had one, attach it
						if (!existing._filePath && importedFilePath) {
							const updated = { ...existing, _filePath: importedFilePath } as LocalProject;
							const next = [...projects]; next[existingByIdIdx] = updated; setProjects(next); writeStore(next);
							return updated;
						}
						return existing;
					}
				}
				if (!imported) {
					// User canceled or file invalid; do nothing
					return null as unknown as Project;
				}
				const next = [imported, ...projects];
				setProjects(next); writeStore(next);
				localStorage.setItem("py.hasAnyProject", "1");
				return imported;
			},
			selectProject: (projectId: string) => { setSelectedProjectId(projectId); writeSelected(projectId); },
			selectedProjectId,
			selectedProject: selected,
			activeTheme: selectedTheme,
			clearAll: () => {
				setProjects([]);
				localStorage.removeItem("py.projects");
				localStorage.removeItem("py.hasAnyProject");
				setSelectedProjectId(null); writeSelected(null);
			},
			clearSelection: () => { setSelectedProjectId(null); writeSelected(null); },
			reconcileCloudLinks: (knownCloudIds: string[]) => {
				const setIds = new Set(knownCloudIds);
				let changed = false;
				const next = projects.map(p => {
					if (p._cloudId && !setIds.has(p._cloudId)) {
						changed = true;
						const q = { ...p, _cloudId: undefined, _synced: false } as LocalProject;
						return q;
					}
					return p;
				});
				if (changed) { setProjects(next); writeStore(next); }
			},
			autosaveEnabled,
			setAutosaveEnabled: (v: boolean) => { try { localStorage.setItem('py_autosave_enabled', v ? '1' : '0'); } catch { /* noop */ } setAutosaveEnabled(v); try { notify({ type: 'info', message: v ? 'Autosave enabled' : 'Autosave disabled', persistent: false }); } catch { /* ignore */ } },
			getPageItems: (projectId: string, pageId: string) => {
				const proj = projects.find(p => p.id === projectId); if (!proj) return [];
				const page = proj.pages[pageId]; if (!page) return [];
				const ids = page.widgets || [];
				const out: Array<{ id: string; x: number; y: number; w: number; h: number; z: number; title?: string; type?: string; props?: unknown; schemaVersion?: number; pinned?: boolean; locked?: boolean; }> = [];
				for (const wid of ids) {
					const w = proj.widgets[wid]; if (!w) continue;
					type LayoutLike = Partial<{ x: number | string; y: number | string; w: number | string; h: number | string; z: number | string; title: string; pinned: boolean; locked: boolean }>;
					const layout = (w.layout ?? {}) as LayoutLike;
					out.push({
						id: w.widgetId,
						x: Number(layout.x ?? 0),
						y: Number(layout.y ?? 0),
						w: Number(layout.w ?? 1),
						h: Number(layout.h ?? 1),
						z: Number(layout.z ?? 0),
						title: layout.title || undefined,
						type: w.type || undefined,
						props: w.props,
						schemaVersion: typeof w.schemaVersion === 'number' ? w.schemaVersion : 1,
						pinned: Boolean(layout.pinned),
						locked: Boolean(layout.locked),
					});
				}
				// Ensure stable z ordering
				out.sort((a, b) => a.z - b.z);
				return out;
			},
			setPageItems: (projectId: string, pageId: string, items) => {
				const idx = projects.findIndex(p => p.id === projectId); if (idx < 0) return;
				const proj = projects[idx];
				const page = proj.pages[pageId]; if (!page) return;
				const nowStr = now();
				// Update or create widgets for this page
				const nextWidgets: Record<string, Widget> = { ...proj.widgets };
				for (let i = 0; i < items.length; i++) {
					const it = items[i];
					const existing = nextWidgets[it.id];
					const createdAt = existing?.createdAt || nowStr;
					const schemaVersion = typeof it.schemaVersion === 'number' ? it.schemaVersion : (typeof existing?.schemaVersion === 'number' ? existing?.schemaVersion : 1);
					nextWidgets[it.id] = {
						widgetId: it.id,
						type: it.type || existing?.type || 'custom',
						slot: existing?.slot || 'default',
						order: i,
						props: it.props ?? existing?.props ?? {},
						layout: {
							x: it.x, y: it.y, w: it.w, h: it.h, z: it.z,
							pinned: !!it.pinned, locked: !!it.locked, title: it.title ?? ((existing?.layout as { title?: string } | undefined)?.title) ?? undefined,
						},
						schemaVersion,
						createdAt,
						updatedAt: nowStr,
					} as Widget;
				}
				// Page widgets list in the order provided
				const updatedPage: Page = { ...page, widgets: items.map(it => it.id), order: page.order, updatedAt: nowStr };
				// Remove orphan widgets not referenced by any page
				const referenced = new Set<string>();
				// include current page changes
				for (const id of updatedPage.widgets) referenced.add(id);
				// include other pages
				for (const pid of proj.pageOrder) {
					if (pid === pageId) continue;
					const pg = proj.pages[pid];
					for (const id of (pg.widgets || [])) referenced.add(id);
				}
				const compactWidgets: Record<string, Widget> = {};
				for (const [wid, w] of Object.entries(nextWidgets)) {
					if (referenced.has(wid)) compactWidgets[wid] = w;
				}
				const nextProj: LocalProject = {
					...proj,
					pages: { ...proj.pages, [pageId]: updatedPage },
					widgets: compactWidgets,
					updatedAt: nowStr,
				} as LocalProject;
				const next = [...projects]; next[idx] = nextProj; setProjects(next); writeStore(next);
			},
			setActiveTheme: (projectId: string, themeId: string) => {
				const idx = projects.findIndex(p => p.id === projectId); if (idx < 0) return;
				const proj = projects[idx];
				if (!proj.themes?.[themeId]) return;
				if (proj.activeThemeId === themeId) return;
				const nextProj: LocalProject = { ...proj, activeThemeId: themeId, updatedAt: now() } as LocalProject;
				const next = [...projects]; next[idx] = nextProj; setProjects(next); writeStore(next);
			},
			createThemeFromPreset: (projectId: string, presetId: string, opts) => {
				const idx = projects.findIndex(p => p.id === projectId); if (idx < 0) return null;
				const proj = projects[idx];
				const preset = getPresetById(presetId) || themePresetFallback;
				const created = createThemeFromPresetUtil(preset, { name: opts?.name || preset.name, origin: 'preset' });
				const nextThemes = { ...proj.themes, [created.themeId]: created } as Record<string, Theme>;
				const nextProj: LocalProject = {
					...proj,
					themes: nextThemes,
					activeThemeId: opts?.activate ? created.themeId : proj.activeThemeId,
					updatedAt: now(),
				} as LocalProject;
				const hydrated = ensureProjectThemes(nextProj);
				const next = [...projects]; next[idx] = hydrated; setProjects(next); writeStore(next);
				return hydrated.themes[created.themeId];
			},
			duplicateTheme: (projectId: string, sourceThemeId: string, opts) => {
				const idx = projects.findIndex(p => p.id === projectId); if (idx < 0) return null;
				const proj = projects[idx];
				const source = proj.themes?.[sourceThemeId]; if (!source) return null;
				const copyName = `${source.name} Copy`;
				const seed = createThemeFromPresetUtil(themePresetFallback, { name: copyName, origin: 'custom' });
				const duplicate = { ...mergeTheme(seed, { colors: source.colors, typography: source.typography, name: copyName, origin: 'custom' }), createdAt: now(), updatedAt: now() } as Theme;
				const nextThemes = { ...proj.themes, [duplicate.themeId]: duplicate } as Record<string, Theme>;
				const nextProj: LocalProject = {
					...proj,
					themes: nextThemes,
					activeThemeId: opts?.activate ? duplicate.themeId : proj.activeThemeId,
					updatedAt: now(),
				} as LocalProject;
				const next = [...projects]; next[idx] = nextProj; setProjects(next); writeStore(next);
				return duplicate;
			},
			updateTheme: (projectId: string, themeId: string, patch: ThemePatch) => {
				const idx = projects.findIndex(p => p.id === projectId); if (idx < 0) return;
				const proj = projects[idx];
				const current = proj.themes?.[themeId]; if (!current) return;
				const updated = mergeTheme(current, patch);
				const nextThemes = { ...proj.themes, [themeId]: updated } as Record<string, Theme>;
				const nextProj: LocalProject = { ...proj, themes: nextThemes, updatedAt: now() } as LocalProject;
				const next = [...projects]; next[idx] = nextProj; setProjects(next); writeStore(next);
			},
			deleteTheme: (projectId: string, themeId: string) => {
				const idx = projects.findIndex(p => p.id === projectId); if (idx < 0) return;
				const proj = projects[idx];
				const keys = Object.keys(proj.themes || {});
				if (keys.length <= 1) {
					try { notify({ type: 'warn', message: 'Keep at least one theme in your portfolio.', title: proj.name, persistent: false }); } catch { /* noop */ }
					return;
				}
				if (!proj.themes?.[themeId]) return;
				const nextThemes = { ...proj.themes } as Record<string, Theme>;
				delete nextThemes[themeId];
				let nextActive = proj.activeThemeId;
				if (nextActive === themeId) {
					const fallbackId = Object.keys(nextThemes)[0];
					nextActive = fallbackId;
				}
				const nextProj: LocalProject = { ...proj, themes: nextThemes, activeThemeId: nextActive, updatedAt: now() } as LocalProject;
				const hydrated = ensureProjectThemes(nextProj);
				const next = [...projects]; next[idx] = hydrated; setProjects(next); writeStore(next);
			},
			exportProject: async (projectId: string) => {
				const proj = projects.find(p => p.id === projectId);
				if (!proj) return;
				const base64 = await buildArchiveBase64(proj);
				if (window.api?.saveFile) {
					if (window.api.saveFileBytes) await window.api.saveFileBytes({ defaultPath: `${proj.name || "project"}.portfoliyou`, dataBase64: base64 });
					else await window.api.saveFile({ defaultPath: `${proj.name || "project"}.portfoliyou`, data: base64, encoding: 'base64' });
				} else {
					// Browser fallback: trigger download of zip
					const u8 = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
					const blob = new Blob([u8], { type: "application/zip" });
					const url = URL.createObjectURL(blob);
					const a = document.createElement("a");
					a.href = url; a.download = `${proj.name || "project"}.portfoliyou`;
					document.body.appendChild(a); a.click(); a.remove();
					URL.revokeObjectURL(url);
				}
			},
			syncProject: async (projectId: string) => {
				const user = auth.currentUser; if (!user) { window.dispatchEvent(new CustomEvent('py:notify', { detail: { type: 'error', message: 'Sign in to sync to cloud.' } })); return; }
				const idx = projects.findIndex(p => p.id === projectId); if (idx < 0) return;
				// Use backend-enforced limit via callable; do not create directly client-side
				let proj = projects[idx];
				// Prepare cloud payload handled inline below
				// Build archive from prepared payload
				const trimmed = ((): LocalProject => {
					const over = (proj.pageOrder?.length || 0) > 10;
					const keep = over ? proj.pageOrder.slice(0, 10) : (proj.pageOrder || []);
					const nextPages: Record<string, Page> = {};
					const referenced = new Set<string>();
					for (let i = 0; i < keep.length; i++) {
						const id = keep[i];
						const pg = proj.pages[id];
						if (pg) {
							nextPages[id] = { ...pg, order: i };
							for (const wid of (pg.widgets || [])) referenced.add(wid);
						}
					}
					const nextWidgets: Record<string, Widget> = {};
					for (const wid of referenced) { if (proj.widgets[wid]) nextWidgets[wid] = proj.widgets[wid]; }
					return { ...proj, pageOrder: keep, pages: nextPages, widgets: nextWidgets, updatedAt: now() } as LocalProject;
				})();
				const base64 = await buildArchiveBase64(trimmed);
				// Determine cloud doc in top-level 'projects'
				let cloudId = proj._cloudId;

				// If not linked (e.g., after sign-out), try to locate existing cloud doc by localProjectId
				if (!cloudId) {
					try {
						const q1 = query(collection(db, 'projects'), where('ownerUid', '==', user.uid), where('localProjectId', '==', proj.id), orderBy('updatedAt', 'desc'));
						const s1 = await getDocs(q1);
						if (s1.docs.length > 0) {
							cloudId = s1.docs[0].id;
						}
					} catch { /* ignore */ }
				}
				// If an old/invalid cloud link exists (not server-created or wrong owner), drop it and recreate
				if (cloudId) {
					try {
						const dref = doc(db, 'projects', cloudId);
						const ds = await getDoc(dref);
						const v = ds.exists() ? (ds.data() as Record<string, unknown>) : null;
						const invalid = !v || v.ownerUid !== user.uid || v.serverCreated !== true;
						if (invalid) {
							// Try to delete old cloud copy via callable (ignore errors if not owner)
							try {
								const del = httpsCallable<{ projectId: string }, { ok: boolean }>(getFunctions(undefined, 'us-central1'), 'deleteProject');
								await del({ projectId: cloudId });
							} catch { /* keep local unlink only */ }
							cloudId = undefined;
						}
					} catch {
						// If we cannot verify, fall back to creating a new one
						cloudId = undefined;
					}
				}
				if (!cloudId) {
					try {
						const fn = httpsCallable<{ name?: string }, { id: string }>(getFunctions(undefined, 'us-central1'), 'createProject');
						const res = await fn({ name: proj.name });
						cloudId = (res.data as { id?: string })?.id;
						if (!cloudId) throw new Error('No project id returned from server.');
					} catch (err: unknown) {
						const e = err as { code?: string; message?: string } | undefined;
						const code = e?.code || e?.message || 'unknown';
						// If plan limit is reached, try to reuse an existing server-created doc owned by the user
						if (code === 'failed-precondition') {
							try {
								const user = auth.currentUser!;
								const q = query(collection(db, 'projects'), where('ownerUid', '==', user.uid), orderBy('updatedAt', 'desc'));
								const snap = await getDocs(q);
								const reuse = snap.docs.find(d => {
									const v = d.data() as Record<string, unknown>;
									return v['serverCreated'] === true;
								}) || snap.docs[0];
								if (reuse) {
									cloudId = reuse.id;
								} else {
									window.dispatchEvent(new CustomEvent('py:notify', { detail: { type: 'error', message: 'Cloud project limit reached. Delete or unlink a cloud project to continue.' } }));
									return;
								}
							} catch {
								window.dispatchEvent(new CustomEvent('py:notify', { detail: { type: 'error', message: 'Cloud project limit reached. Manage your cloud projects or upgrade your plan.' } }));
								return;
							}
						} else {
							const msg = `Failed to create cloud project${e?.message ? `: ${e.message}` : ''}`;
							window.dispatchEvent(new CustomEvent('py:notify', { detail: { type: 'error', message: msg } }));
							return;
						}
					}
				}

				// Wait briefly for the server-created doc to be visible, then verify before uploading
				let verified = false; let attempts = 0;
				while (!verified && attempts < 10) {
					const ds = await getDoc(doc(db, 'projects', cloudId!));
					if (ds.exists()) {
						const v = ds.data() as { ownerUid?: string; serverCreated?: boolean };
						if (v && v.ownerUid === user.uid && v.serverCreated === true) { verified = true; break; }
					}
					await new Promise(r => setTimeout(r, 300));
					attempts++;
					// If re-linking to an existing cloud doc, allow user to choose sync direction
					{
						const alreadyLinked = !!projects[idx]._cloudId;
						if (!alreadyLinked) {
							try {
								const dref = doc(db, 'projects', cloudId!);
								const ds = await getDoc(dref);
								if (ds.exists()) {
									// Ask direction: OK = overwrite cloud with local; Cancel = overwrite local with cloud
									const overwriteCloud = window.confirm('Re-link cloud project found. Overwrite cloud with local copy? Click Cancel to load cloud into local instead.');
									if (!overwriteCloud) {
										// Download cloud payload and replace local (preserve _filePath)
										try {
											const meta = ds.data() as Record<string, unknown>;
											const path: string = typeof meta.storagePath === 'string' ? (meta.storagePath as string) : `users/${user.uid}/projects/${cloudId}/project.portfoliyou`;
											let imported: LocalProject;
											try {
												const bytes = await getBytes(storageRef(storage, path));
												const text = new TextDecoder('utf-8').decode(bytes);
												imported = migrateProjectSchema(JSON.parse(text));
											} catch {
												try {
													const url = await getDownloadURL(storageRef(storage, path));
													let text: string;
													if (window.api?.fetchText) {
														const res = await window.api.fetchText({ url });
														if (!res || !res.ok) throw new Error('Download failed');
														text = res.text as string;
													} else {
														const resp = await fetch(url);
														text = await resp.text();
													}
													imported = migrateProjectSchema(JSON.parse(text));
												} catch {
													// If download also fails (likely CORS), fall through to upload path
													throw new Error('download-failed');
												}
											}
											const keepPath = projects[idx]._filePath;
											const merged: LocalProject = { ...(imported as LocalProject), _filePath: keepPath, _cloudId: cloudId!, _synced: true } as LocalProject;
											const next = [...projects]; next[idx] = merged; setProjects(next); writeStore(next);
											window.dispatchEvent(new CustomEvent('py:notify', { detail: { type: 'success', message: 'Loaded cloud copy into local project.' } }));
											return;
										} catch { /* fall through to upload */ }
									}
								}
							} catch { /* ignore */ }
						}
					}

					// Link the verified cloudId locally immediately so subsequent attempts reuse it
				}

				if (!verified) {
					// Roll back newly-created cloud doc so it doesn't consume quota
					// Note: do not automatically delete here; keeping the doc lets us reuse
					// the same cloudId on the next attempt without hitting the quota ceiling.
					window.dispatchEvent(new CustomEvent('py:notify', { detail: { type: 'error', message: 'Cloud project not ready. Please try again.' } }));
					return;
				}

				// Link the verified cloudId locally immediately so subsequent attempts reuse it
				// even if the upload fails (avoids running into the per-plan create limit).
				{
					const linked = { ...proj, _cloudId: cloudId } as LocalProject;
					const next = [...projects]; next[idx] = linked; setProjects(next); writeStore(next);
				}

				// Determine storage path from server doc when available; fall back to convention
				let path = `users/${user.uid}/projects/${cloudId}/project.portfoliyou`;
				try {
					const ds = await getDoc(doc(db, 'projects', cloudId));
					if (ds.exists()) {
						const v = ds.data() as Record<string, unknown>;
						if (typeof v?.storagePath === 'string') path = v.storagePath as string;
						// Last-write-wins conflict handling: if cloud is newer than local, load cloud into local and abort upload
						let serverUpdatedAtStr = '';
						const u = (v as Record<string, unknown>)['updatedAt'] as unknown;
						if (u && typeof (u as { toDate?: () => Date }).toDate === 'function') serverUpdatedAtStr = (u as { toDate: () => Date }).toDate().toISOString();
						else if (typeof u === 'string') serverUpdatedAtStr = u as string;
						if (serverUpdatedAtStr && proj.updatedAt && serverUpdatedAtStr.localeCompare(proj.updatedAt) > 0) {
							// Cloud wins — fetch cloud payload and replace local; preserve _filePath and linkage
							try {
								let imported: LocalProject;
								try {
									const bytes = await getBytes(storageRef(storage, path));
									const text = new TextDecoder('utf-8').decode(bytes);
									imported = migrateProjectSchema(JSON.parse(text));
								} catch {
									const url = await getDownloadURL(storageRef(storage, path));
									let text: string;
									if (window.api?.fetchText) {
										const res = await window.api.fetchText({ url });
										if (!res || !res.ok) throw new Error('Download failed');
										text = res.text as string;
									} else {
										const resp = await fetch(url);
										text = await resp.text();
									}
									imported = migrateProjectSchema(JSON.parse(text));
								}
								// Preserve file path and cloud link; push local revision before overwriting
								pushRevisionSnapshot(proj);
								const keepPath = projects[idx]._filePath;
								const merged: LocalProject = { ...(imported as LocalProject), _filePath: keepPath, _cloudId: cloudId!, _synced: true } as LocalProject;
								const next = [...projects]; next[idx] = merged; setProjects(next); writeStore(next);
								window.dispatchEvent(new CustomEvent('py:notify', { detail: { type: 'info', message: 'Loaded newer cloud version (last-write-wins).' } }));
								return;
							} catch {
								// If conflict resolution fails to download, fall through to upload local copy as best-effort
							}
						}
					}
				} catch { /* ignore lookup failure; use fallback */ }
				const sref = storageRef(storage, path);
				try {
					// Surface immediate feedback so it doesn't feel like "nothing happens"
					window.dispatchEvent(new CustomEvent('py:notify', { detail: { type: 'info', message: 'Uploading project to cloud…' } }));
					// upload target details intentionally not logged in production builds
					// Use Blob upload for reliability across environments (Electron/web)
					const u8 = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
					const blob = new Blob([u8], { type: 'application/zip' });
					let attempt = 0; let lastErr: unknown = null;
					while (attempt < 2) {
						try {
							await uploadBytes(sref, blob, { contentType: 'application/zip', cacheControl: 'no-cache' });
							lastErr = null; break;
						} catch (e) {
							lastErr = e; attempt++;
							// Small backoff; handle transient propagation of serverCreated or auth
							await new Promise(r => setTimeout(r, 250));
						}
					}
					if (lastErr) throw lastErr;

					// Update doc with storage path and metadata
					await setDoc(doc(db, 'projects', cloudId), {
						ownerUid: user.uid,
						name: proj.name,
						description: proj.description || '',
						activeThemeId: proj.activeThemeId,
						pageOrder: proj.pageOrder,
						limits: proj.limits,
						status: proj.status,
						schemaVersion: proj.schemaVersion || 1,
						localProjectId: proj.id,
						updatedAt: serverTimestamp(),
						storagePath: path,
					}, { merge: true });
				} catch (err: unknown) {
					const e = err as { code?: string; message?: string } | undefined;
					const code = e?.code || 'unknown';
					const message = (code === 'storage/unauthorized' || code === 'permission-denied')
						? `Cloud write blocked by rules (code=${code}). Check Storage rules and project doc prerequisites. Path: ${path}`
						: (e?.message || 'Failed to sync to cloud.');
					// Helpful console log for debugging without opening the notification center
					// suppress detailed errors in production builds to avoid leaking internal paths
					const persistent = code === 'failed-precondition' || code === 'permission-denied' || code === 'storage/unauthorized';
					window.dispatchEvent(new CustomEvent('py:notify', { detail: { type: 'error', message: persistent ? (message + ' Unlink another cloud project to continue.') : message, persistent } }));
					// Do not delete the cloud doc here; keeping it allows retry without hitting plan limit
					// Users can unlink from the Cloud settings if they prefer to remove it.
					return;
				}
				// Update local flags
				// Update local flags and revision history
				proj = { ...proj, _synced: true, _cloudId: cloudId, updatedAt: now() } as LocalProject;
				pushRevisionSnapshot(proj);
				const next = [...projects]; next[idx] = proj; setProjects(next); writeStore(next);

				// Kick off a size refresh to update user counters on the backend (best-effort)
				try {
					const fn = httpsCallable<{ projectId: string }, { ok: boolean; sizeBytes: number }>(getFunctions(undefined, 'us-central1'), 'updateProjectSize');
					await fn({ projectId: cloudId });
				} catch (e) { void e; }
				window.dispatchEvent(new CustomEvent('py:notify', { detail: { type: 'success', message: 'Project synced to cloud.' } }));
			},
			unsyncProject: async (projectId: string) => {
				const user = auth.currentUser; if (!user) { window.dispatchEvent(new CustomEvent('py:notify', { detail: { type: 'error', message: 'Sign in to unlink from cloud.' } })); return; }
				const idx = projects.findIndex(p => p.id === projectId); if (idx < 0) return;
				const proj = projects[idx]; if (!proj._cloudId) return;
				// Non-destructive unlink: keep the cloud copy, just detach locally
				const updated = { ...proj, _synced: false, _cloudId: undefined, updatedAt: now() } as LocalProject;
				const next = [...projects]; next[idx] = updated; setProjects(next); writeStore(next);
				window.dispatchEvent(new CustomEvent('py:notify', { detail: { type: 'success', message: 'Unlinked from cloud. Cloud copy preserved.' } }));
			},
			deleteCloudProject: async (projectId: string) => {
				const user = auth.currentUser; if (!user) { window.dispatchEvent(new CustomEvent('py:notify', { detail: { type: 'error', message: 'Sign in to manage cloud.' } })); return; }
				const idx = projects.findIndex(p => p.id === projectId); if (idx < 0) return;
				const proj = projects[idx];
				const cloudId = proj._cloudId; if (!cloudId) return;
				try {
					const fn = httpsCallable<{ projectId: string }, { ok: boolean }>(getFunctions(undefined, 'us-central1'), 'deleteProject');
					await fn({ projectId: cloudId });
				} catch (err: unknown) {
					const ex = err as { code?: string } | undefined;
					const msg = ex?.code === 'permission-denied' ? 'Not allowed to delete cloud project.' : 'Failed to delete cloud project.';
					window.dispatchEvent(new CustomEvent('py:notify', { detail: { type: 'error', message: msg } }));
					return;
				}
				// Update local flags
				const updated = { ...proj, _synced: false, _cloudId: undefined, updatedAt: now() } as LocalProject;
				const next = [...projects]; next[idx] = updated; setProjects(next); writeStore(next);
				window.dispatchEvent(new CustomEvent('py:notify', { detail: { type: 'success', message: 'Deleted cloud copy.' } }));
			},
			listCloudProjects: async () => {
				const user = auth.currentUser; if (!user) return [];
				const colRef = collection(db, 'projects');
				type DocLike = { id: string; data: () => Record<string, unknown> };
				const mapDoc = (d: DocLike) => {
					const v = d.data();
					let updatedStr = now();
					const u = v['updatedAt'];
					if (u) {
						if (typeof u === 'string') updatedStr = u;
						else if (typeof (u as { toDate?: () => Date }).toDate === 'function') updatedStr = (u as { toDate: () => Date }).toDate().toISOString();
					}
					const nm = typeof v['name'] === 'string' ? (v['name'] as string) : 'Untitled';
					const sp = typeof v['storagePath'] === 'string' ? (v['storagePath'] as string) : `users/${user.uid}/projects/${d.id}/project.portfoliyou`;
					return { id: d.id, name: nm, updatedAt: updatedStr, storagePath: sp };
				};
				try {
					// Prefer ordered list; if an index is missing, fall back below
					const q1 = query(colRef, where('ownerUid', '==', user.uid), orderBy('updatedAt', 'desc'));
					const snap1 = await getDocs(q1);
					return snap1.docs.map(mapDoc);
				} catch {
					// silent fallback when ordered query fails (index missing)
					const q2 = query(colRef, where('ownerUid', '==', user.uid));
					const snap2 = await getDocs(q2);
					// Manual sort by updatedAt desc when we can parse it
					const arr = snap2.docs.map(mapDoc);
					arr.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
					return arr;
				}
			},
			getCloudObjectInfo: async (projectId: string) => {
				const user = auth.currentUser; if (!user) return null;
				const local = projects.find(p => p.id === projectId);
				const cloudId = local?._cloudId;
				if (!cloudId) return null;
				const dref = doc(db, 'projects', cloudId);
				const ds = await getDoc(dref); if (!ds.exists()) return null;
				const meta = ds.data() as Record<string, unknown>;
				const path: string = typeof meta.storagePath === 'string' ? (meta.storagePath as string) : `users/${user.uid}/projects/${cloudId}/project.portfoliyou`;
				try {
					const md = await getMetadata(storageRef(storage, path));
					const sizeBytes = typeof md.size === 'number' ? md.size : 0;
					const updatedAt = (md.updated as string) || (md.timeCreated as string) || now();
					return { storagePath: path, sizeBytes, updatedAt };
				} catch {
					return { storagePath: path, sizeBytes: 0, updatedAt: now() };
				}
			},
			getCloudObjectInfoByCloudId: async (cloudId: string) => {
				const user = auth.currentUser; if (!user) return null;
				const dref = doc(db, 'projects', cloudId);
				const ds = await getDoc(dref); if (!ds.exists()) return null;
				const meta = ds.data() as Record<string, unknown>;
				const path: string = typeof meta.storagePath === 'string' ? (meta.storagePath as string) : `users/${user.uid}/projects/${cloudId}/project.portfoliyou`;
				try {
					const md = await getMetadata(storageRef(storage, path));
					const sizeBytes = typeof md.size === 'number' ? md.size : 0;
					const updatedAt = (md.updated as string) || (md.timeCreated as string) || now();
					return { storagePath: path, sizeBytes, updatedAt };
				} catch {
					return { storagePath: path, sizeBytes: 0, updatedAt: now() };
				}
			},
			renameCloudProject: async (cloudId: string, newName: string) => {
				const user = auth.currentUser; if (!user) return false;
				try {
					await setDoc(doc(db, 'projects', cloudId), { name: newName, updatedAt: serverTimestamp() }, { merge: true });
					return true;
				} catch { return false; }
			},
			deleteCloudProjectByCloudId: async (cloudId: string) => {
				const user = auth.currentUser; if (!user) return false;
				try {
					const fn = httpsCallable<{ projectId: string }, { ok: boolean }>(getFunctions(undefined, 'us-central1'), 'deleteProject');
					await fn({ projectId: cloudId });
					return true;
				} catch { return false; }
			},
			importProjectFromCloudLocalOnly: async (cloudId: string) => {
				const user = auth.currentUser; if (!user) return null as unknown as LocalProject;
				const dref = doc(db, 'projects', cloudId);
				const ds = await getDoc(dref); if (!ds.exists()) return null as unknown as LocalProject;
				const meta = ds.data() as Record<string, unknown>;
				const path: string = typeof meta.storagePath === 'string' ? (meta.storagePath as string) : `users/${user.uid}/projects/${cloudId}/project.portfoliyou`;
				let imported: LocalProject;
				try {
					const bytes = await getBytes(storageRef(storage, path));
					// Detect archive by magic 'PK'
					const head = new Uint8Array(bytes);
					if (head && head.byteLength > 4 && head[0] === 0x50 && head[1] === 0x4b) {
						imported = await importFromArchive(bytes);
					} else {
						const text = new TextDecoder('utf-8').decode(bytes);
						imported = migrateProjectSchema(JSON.parse(text));
					}
				} catch {
					try {
						const url = await getDownloadURL(storageRef(storage, path));
						const resp = await fetch(url);
						const buf = await resp.arrayBuffer();
						const u8 = new Uint8Array(buf);
						if (u8 && u8.byteLength > 4 && u8[0] === 0x50 && u8[1] === 0x4b) {
							imported = await importFromArchive(buf);
						} else {
							const text = new TextDecoder('utf-8').decode(u8);
							imported = migrateProjectSchema(JSON.parse(text));
						}
					} catch {
						window.dispatchEvent(new CustomEvent('py:notify', { detail: { type: 'error', message: 'Failed to download cloud project. If this is a dev build, configure Storage CORS for http://localhost:5173 or try again.', persistent: false } }));
						return null as unknown as LocalProject;
					}
				}
				// Ensure no cloud linkage
				(imported as LocalProject)._cloudId = undefined;
				(imported as LocalProject)._synced = false;
				// Dedupe by id
				const existingIdx = projects.findIndex(p => p.id === imported.id);
				if (existingIdx >= 0) {
					const merged = { ...projects[existingIdx], ...imported, _cloudId: undefined, _synced: false } as LocalProject;
					const next = [...projects]; next[existingIdx] = merged; setProjects(next); writeStore(next);
					return merged;
				}
				const next = [imported as LocalProject, ...projects];
				setProjects(next); writeStore(next);
				localStorage.setItem("py.hasAnyProject", "1");
				return imported as LocalProject;
			},
			importProjectFromCloud: async (cloudId: string) => {
				const user = auth.currentUser; if (!user) return null as unknown as LocalProject;
				const dref = doc(db, 'projects', cloudId);
				const ds = await getDoc(dref); if (!ds.exists()) return null as unknown as LocalProject;
				const meta = ds.data() as Record<string, unknown>;
				const path: string = typeof meta.storagePath === 'string' ? (meta.storagePath as string) : `users/${user.uid}/projects/${cloudId}/project.portfoliyou`;
				let imported: LocalProject;
				try {
					// Prefer direct bytes via SDK to avoid any fetch/CORS quirks
					const bytes = await getBytes(storageRef(storage, path));
					const head = new Uint8Array(bytes);
					if (head && head.byteLength > 4 && head[0] === 0x50 && head[1] === 0x4b) {
						imported = await importFromArchive(bytes);
					} else {
						const text = new TextDecoder('utf-8').decode(bytes);
						imported = migrateProjectSchema(JSON.parse(text));
					}
				} catch {
					// Fallback to download URL + fetch (use main-process fetch when available to bypass CORS in dev)
					try {
						const url = await getDownloadURL(storageRef(storage, path));
						const resp = await fetch(url);
						const buf = await resp.arrayBuffer();
						const u8 = new Uint8Array(buf);
						if (u8 && u8.byteLength > 4 && u8[0] === 0x50 && u8[1] === 0x4b) {
							imported = await importFromArchive(buf);
						} else {
							const text = new TextDecoder('utf-8').decode(u8);
							imported = migrateProjectSchema(JSON.parse(text));
						}
					} catch {
						window.dispatchEvent(new CustomEvent('py:notify', { detail: { type: 'error', message: 'Failed to import cloud project (CORS). Configure Storage CORS for http://localhost:5173, or try Import local-only.', persistent: false } }));
						return null as unknown as LocalProject;
					}
				}
				// Attach cloud link
				(imported as LocalProject)._cloudId = cloudId;
				(imported as LocalProject)._synced = true;
				// Dedupe by id
				const existingIdx = projects.findIndex(p => p.id === imported.id);
				if (existingIdx >= 0) {
					const merged = { ...projects[existingIdx], ...imported } as LocalProject;
					const next = [...projects]; next[existingIdx] = merged; setProjects(next); writeStore(next);
					return merged;
				}
				const next = [imported as LocalProject, ...projects];
				setProjects(next); writeStore(next);
				localStorage.setItem("py.hasAnyProject", "1");
				return imported as LocalProject;
			},
			saveProject: async (projectId: string, opts?: { saveAs?: boolean }) => {
				const idx = projects.findIndex(p => p.id === projectId); if (idx < 0) return;
				let proj = projects[idx];
				if (!window.api) return; // only in Electron
				const needsSaveAs = !!(opts?.saveAs || !proj._filePath);
				// Do not show saving spinner while the OS Save dialog is open; set it only during actual disk write
				if (needsSaveAs && window.api.saveFile) {
					try {
						const base64 = await buildArchiveBase64(proj);
						const res = window.api.saveFileBytes ? await window.api.saveFileBytes({ defaultPath: `${proj.name || 'project'}.portfoliyou`, dataBase64: base64 }) : await window.api.saveFile({ defaultPath: `${proj.name || 'project'}.portfoliyou`, data: base64, encoding: 'base64' });
						if (res.canceled || !res.filePath) return; // user canceled: no spinner to reset
						proj = { ...proj, _filePath: res.filePath };
						const next = [...projects]; next[idx] = proj; setProjects(next); writeStore(next);
						// Notify user that Save As completed (file chosen & written)
						try { notify({ type: 'success', message: 'Saved to disk', title: proj.name, persistent: false }); } catch { /* ignore */ }
					} catch {
						// ignore and fall through; write step below is gated by _filePath
					}
				}
				if (proj._filePath && window.api.writeFile) {
					setSaving(true);
					try {
						pushRevisionSnapshot(proj);
						const base64 = await buildArchiveBase64(proj);
						if (window.api.writeFileBytes) await window.api.writeFileBytes({ filePath: proj._filePath, dataBase64: base64 });
						else await window.api.writeFile({ filePath: proj._filePath, data: base64, encoding: 'base64' });
						setLastSavedAt(now());
						try { notify({ type: 'success', message: 'Saved to disk', title: proj.name, persistent: false }); } catch { /* ignore */ }
					} catch {
						try { notify({ type: 'error', message: 'Failed to save file', title: proj.name, persistent: false }); } catch { /* ignore */ }
						// swallow to avoid UI disruption; notification system can be added later
					} finally {
						setSaving(false);
					}
				}
			},
			renameProject: async (projectId: string, newName: string) => {
				const finalName = normalizeProjectName(newName, "Portfolio");
				await saveMetadata(projectId, { name: finalName, metadata: { siteTitle: finalName } });
				try { notify({ type: 'success', message: `Project renamed to "${finalName}"`, title: finalName, persistent: false }); } catch { /* noop */ }
			},
			deleteProject: async (projectId: string, opts?: { deleteFile?: boolean }) => {
				// Do not delete cloud copies when removing a local project
				const p = projects.find(x => x.id === projectId);
				const next = projects.filter(x => x.id !== projectId);
				setProjects(next); writeStore(next);
				notify({ type: 'success', message: `Project "${p?.name || projectId}" deleted`, title: p?.name, persistent: false });
				if (selectedProjectId === projectId) { setSelectedProjectId(null); writeSelected(null); }
				if (opts?.deleteFile && p?._filePath && window.api?.deleteFile) {
					await window.api.deleteFile({ filePath: p._filePath });
				}
			},
		};
	}, [projects, selectedProjectId, saving, lastSavedAt, cloudMaxProjects, cloudBytesUsed, cloudProjectsCount, autosaveEnabled, notify, selected, selectedTheme]);

	// Auto-save to file for projects that have a _filePath
	const prevTimesRef = useRef<Record<string, string>>({});
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	useEffect(() => {
		if (!window.api?.writeFile) return; // only in Electron
		if (!autosaveEnabled) return; // respect user toggle
		if (debounceRef.current) clearTimeout(debounceRef.current);
		debounceRef.current = setTimeout(async () => {
			const prev = prevTimesRef.current;
			const tasks: Array<Promise<unknown>> = [];
			for (const p of projects) {
				if (!p._filePath) continue;
				const prevUpdatedAt = prev[p.id];
				if (p.updatedAt && p.updatedAt !== prevUpdatedAt) {
					const base64 = await buildArchiveBase64(p);
					pushRevisionSnapshot(p);
					if (window.api!.writeFileBytes) tasks.push(window.api!.writeFileBytes({ filePath: p._filePath, dataBase64: base64 }));
					else tasks.push(window.api!.writeFile({ filePath: p._filePath, data: base64, encoding: 'base64' }));
				}
				// update snapshot
				prev[p.id] = p.updatedAt;
			}
			if (tasks.length) {
				try { setSaving(true); await Promise.all(tasks); setLastSavedAt(now()); try { notify({ type: 'success', message: 'Saved to disk', title: tasks.length > 1 ? `${tasks.length} projects` : undefined, persistent: false }); } catch { /* ignore */ } } catch { /* swallow to avoid UI disruption */ } finally { setSaving(false); }
			}
		}, 2000);
		return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
	}, [projects]);

	// Periodic autosave every 30s to ensure disk persistence and revision snapshots
	const periodicSavedRef = useRef<Record<string, string>>({});
	useEffect(() => {
		if (!window.api?.writeFile) return; // only in Electron
		if (!autosaveEnabled) return; // respect user toggle
		const timer = setInterval(async () => {
			const prev = periodicSavedRef.current;
			const tasks: Array<Promise<unknown>> = [];
			for (const p of projects) {
				if (!p._filePath) continue;
				const prevUpdatedAt = prev[p.id];
				if (p.updatedAt && p.updatedAt !== prevUpdatedAt) {
					pushRevisionSnapshot(p);
					const base64 = await buildArchiveBase64(p);
					if (window.api!.writeFileBytes) tasks.push(window.api!.writeFileBytes({ filePath: p._filePath, dataBase64: base64 }));
					else tasks.push(window.api!.writeFile({ filePath: p._filePath, data: base64, encoding: 'base64' }));
					prev[p.id] = p.updatedAt;
				}
			}
			if (tasks.length) {
				try { setSaving(true); await Promise.all(tasks); setLastSavedAt(now()); try { notify({ type: 'success', message: 'Saved to disk', title: tasks.length > 1 ? `${tasks.length} projects` : undefined, persistent: false }); } catch { /* ignore */ } } catch { /* ignore */ } finally { setSaving(false); }
			}
		}, 30_000);
		return () => clearInterval(timer);
	}, [projects]);

	// Migration utility
	function migrateProjectSchema(input: unknown): LocalProject {
		// Unwrap exported wrapper
		let raw: unknown = input;
		if (typeof raw === 'object' && raw !== null) {
			const r = raw as Record<string, unknown>;
			if (r['_format'] === 'portfoliyou' && typeof r['project'] === 'object' && r['project'] !== null) {
				raw = r['project'];
			}
		}
		// Start with a shallow clone if possible
		let obj: Record<string, unknown> = {};
		if (typeof raw === 'object' && raw !== null) obj = { ...(raw as Record<string, unknown>) };

		// Minimal structural defaults
		if (typeof obj['id'] !== 'string') obj['id'] = crypto.randomUUID();
		if (typeof obj['name'] !== 'string') obj['name'] = "Imported Portfolio";
		if (typeof obj['createdAt'] !== 'string') obj['createdAt'] = now();
		if (typeof obj['updatedAt'] !== 'string') obj['updatedAt'] = now();
		if (typeof obj['schemaVersion'] !== 'number' || (obj['schemaVersion'] as number) < 1) {
			obj['schemaVersion'] = 1;
		}
		if (!Array.isArray(obj['pageOrder'])) obj['pageOrder'] = [];
		if (typeof obj['limits'] !== 'object' || obj['limits'] === null) obj['limits'] = { maxPages: 10, maxAssetsMB: 500 };
		if (typeof obj['status'] !== 'object' || obj['status'] === null) obj['status'] = { deployed: false, lastDeployAt: null, deployType: null };
		if (typeof obj['themes'] !== 'object' || obj['themes'] === null) obj['themes'] = {};
		if (typeof obj['pages'] !== 'object' || obj['pages'] === null) obj['pages'] = {};
		else {
			const pages = obj['pages'] as Record<string, Record<string, unknown>>;
			const nextPages: Record<string, Record<string, unknown>> = {};
			for (const [pid, raw] of Object.entries(pages)) {
				if (!raw || typeof raw !== 'object') {
					nextPages[pid] = raw as Record<string, unknown>;
					continue;
				}
				const bgValue = typeof raw['backgroundColor'] === 'string' ? raw['backgroundColor'] as string : null;
				const trimmed = bgValue ? bgValue.trim() : '';
				nextPages[pid] = {
					...raw,
					backgroundColor: trimmed ? trimmed : null,
				};
			}
			obj['pages'] = nextPages;
		}
		if (typeof obj['widgets'] !== 'object' || obj['widgets'] === null) obj['widgets'] = {};
		else {
			const widgets = obj['widgets'] as Record<string, Widget>;
			const nextWidgets: Record<string, Widget> = {};
			for (const [wid, widget] of Object.entries(widgets)) {
				if (!widget || typeof widget !== 'object') {
					nextWidgets[wid] = widget as Widget;
					continue;
				}
				if (typeof widget.schemaVersion !== 'number' || widget.schemaVersion < 1) {
					nextWidgets[wid] = { ...widget, schemaVersion: 1 } as Widget;
				} else {
					nextWidgets[wid] = widget;
				}
			}
			obj['widgets'] = nextWidgets;
		}
		const migrated = ensurePortfolioMeta(sanitizeProjectVideoWidgets(obj as LocalProject));
		migrated.updatedAt = now();
		return migrated;
	}

	return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}


export function useProjects() {
	const v = useContext(Ctx); if (!v) throw new Error("useProjects outside provider"); return v;
}

const MAX_NAME_LENGTH = 80;
const MAX_SHORT_FIELD = 160;
const MAX_LONG_FIELD = 600;

const trimField = (value?: string | null, max = MAX_SHORT_FIELD) => {
	if (typeof value !== 'string') return undefined;
	const trimmed = value.trim();
	if (!trimmed) return undefined;
	return trimmed.slice(0, max);
};

const normalizeProjectName = (value?: string, fallback = "Untitled Portfolio") => {
	const trimmed = typeof value === 'string' ? value.trim() : '';
	const next = trimmed ? trimmed.slice(0, MAX_NAME_LENGTH) : fallback;
	return next || fallback;
};

function hydratePortfolioMeta(raw: Partial<PortfolioMeta> | undefined, fallbackName: string): PortfolioMeta {
	return {
		siteTitle: normalizeProjectName(raw?.siteTitle, fallbackName),
		tagline: trimField(raw?.tagline, MAX_SHORT_FIELD) || null,
		description: trimField(raw?.description, MAX_LONG_FIELD) || null,
		author: trimField(raw?.author, MAX_SHORT_FIELD) || null,
		websiteUrl: trimField(raw?.websiteUrl, 200) || null,
		iconEmoji: trimField(raw?.iconEmoji, 16) || null,
		iconImageUrl: trimField(raw?.iconImageUrl, 400) || null,
		socialImageUrl: trimField(raw?.socialImageUrl, 400) || null,
	};
}