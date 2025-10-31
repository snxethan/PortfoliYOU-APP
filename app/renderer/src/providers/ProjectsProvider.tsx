import '../types/electron.d.ts';
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, getDoc, getDocs, setDoc, serverTimestamp, query, where, orderBy } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { ref as storageRef, uploadBytes, getDownloadURL, getMetadata, getBytes } from "firebase/storage";

import { auth, db, storage } from "../lib/firebase";

export type Theme = {
	themeId: string;
	name: string;
	colors: { primary: string; secondary: string; bg: string; fg: string };
	typography: { heading: string; body: string; scale: number };
	schemaVersion: number;
	createdAt: string;
	updatedAt: string;
};

export type Page = {
	pageId: string;
	title: string;
	order: number;
	widgets: string[];
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

export type Project = {
	id: string;
	ownerUid?: string;
	name: string;
	description?: string;
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

type ProjectsCtx = {
	projects: LocalProject[];
	hasAny: boolean;
	cloudMaxProjects: number;
	cloudBytesUsed: number;
	cloudProjectsCount: number;
	addProject: (name?: string) => Project;
	importProject: (file?: File) => Promise<Project>;
	createProjectWithSave: (name: string) => Promise<LocalProject | null>;
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
	reconcileCloudLinks: (knownCloudIds: string[]) => void;
};

const Ctx = createContext<ProjectsCtx | null>(null);

function readStore(): LocalProject[] {
	try { return JSON.parse(localStorage.getItem("py.projects") || "[]"); } catch { return []; }
}
function writeStore(list: LocalProject[]) { localStorage.setItem("py.projects", JSON.stringify(list)); }
function readSelected(): string | null { try { return JSON.parse(localStorage.getItem("py.selectedProjectId") || "null"); } catch { return null; } }
function writeSelected(id: string | null) { localStorage.setItem("py.selectedProjectId", JSON.stringify(id)); }


export function ProjectsProvider({ children }: { children: React.ReactNode }) {
	const [projects, setProjects] = useState<LocalProject[]>([]);
	const [selectedProjectId, setSelectedProjectId] = useState<string | null>(readSelected());
	useEffect(() => { setProjects(readStore()); }, []);
	const [saving, setSaving] = useState(false);
	const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
	const [cloudMaxProjects, setCloudMaxProjects] = useState<number>(1);
	const [cloudBytesUsed, setCloudBytesUsed] = useState<number>(0);
	const [cloudProjectsCount, setCloudProjectsCount] = useState<number>(0);

	// Load cloud limit when user is available (best-effort)
	useEffect(() => {
		const unsub = onAuthStateChanged(auth, async (user) => {
				if (!user) {
					// On sign-out, reset cloud limits/counters and strip cloud linkage from local projects
					setCloudMaxProjects(1);
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
                const used = typeof counters?.['cloudBytesUsed'] === 'number' ? (counters!['cloudBytesUsed'] as number) : 0;
                const cnt = typeof counters?.['cloudProjects'] === 'number' ? (counters!['cloudProjects'] as number) : 0;
                setCloudBytesUsed(used);
                setCloudProjectsCount(cnt);
			} catch { setCloudMaxProjects(1); }
		});
		return () => unsub();
	}, []);

	// Helper to get current timestamp
	const now = () => new Date().toISOString();

	// Helper to serialize a project for file persistence
	const buildExportPayload = (proj: LocalProject) => {
		const payload: { _format: string; _version: number; exportedAt: string; project: LocalProject; assets: unknown[] } = {
			_format: "portfoliyou",
			_version: 1,
			exportedAt: now(),
			project: { ...proj },
			assets: [],
		};
		delete payload.project._filePath;
		delete payload.project._synced;
		return JSON.stringify(payload, null, 2);
	};

	const api = useMemo<ProjectsCtx>(() => {
		// Default theme
		const defaultTheme: Theme = {
			themeId: "theme_default_light",
			name: "Light Default",
			colors: { primary: "#2b6cb0", secondary: "#1a202c", bg: "#ffffff", fg: "#111827" },
			typography: { heading: "Inter", body: "Inter", scale: 1.0 },
			schemaVersion: 1,
			createdAt: now(),
			updatedAt: now(),
		};

		// Default page
		const defaultPage: Page = {
			pageId: "page_home",
			title: "Home",
			order: 0,
			widgets: [],
			breakpoints: { desktop: true, tablet: true, mobile: true },
			schemaVersion: 1,
			createdAt: now(),
			updatedAt: now(),
		};



			return {
			projects,
			hasAny: projects.length > 0,
			cloudMaxProjects,
				cloudBytesUsed,
				cloudProjectsCount,
				saving,
				lastSavedAt,
			setProjectFilePath: (projectId: string, newPath: string) => {
				const idx = projects.findIndex(p => p.id === projectId); if (idx < 0) return;
				const updated = { ...projects[idx], _filePath: newPath } as LocalProject;
				const next = [...projects]; next[idx] = updated; setProjects(next); writeStore(next);
			},
		addProject: (name = "Untitled Portfolio") => {
			const id = crypto.randomUUID();
				const p: LocalProject = {
				id,
				name,
				description: "",
				activeThemeId: defaultTheme.themeId,
				pageOrder: [defaultPage.pageId],
				limits: { maxPages: 2, maxAssetsMB: 500 },
				status: { deployed: false, lastDeployAt: null, deployType: null },
				schemaVersion: 1,
				createdAt: now(),
				updatedAt: now(),
				themes: { [defaultTheme.themeId]: defaultTheme },
				pages: { [defaultPage.pageId]: defaultPage },
				widgets: {},
			};
			const next = [p, ...projects];
			setProjects(next); writeStore(next);
			localStorage.setItem("py.hasAnyProject", "1");
			return p;
		},
			createProjectWithSave: async (name: string) => {
				const base = (name || "Untitled Portfolio").trim();
				// Construct project object
				const id = crypto.randomUUID();
				const p: LocalProject = {
					id,
					name: base,
					description: "",
					activeThemeId: defaultTheme.themeId,
					pageOrder: [defaultPage.pageId],
					limits: { maxPages: 2, maxAssetsMB: 500 },
					status: { deployed: false, lastDeployAt: null, deployType: null },
					schemaVersion: 1,
					createdAt: now(),
					updatedAt: now(),
					themes: { [defaultTheme.themeId]: defaultTheme },
					pages: { [defaultPage.pageId]: defaultPage },
					widgets: {},
				};
				const data = buildExportPayload(p);
				if (window.api?.saveFile) {
					const res = await window.api.saveFile({ defaultPath: `${base}.portfoliyou`, data });
					if (res.canceled || !res.filePath) return null;
					p._filePath = res.filePath;
					const next = [p, ...projects];
					setProjects(next); writeStore(next);
					localStorage.setItem("py.hasAnyProject", "1");
					setSelectedProjectId(p.id); writeSelected(p.id);
					return p;
				} else {
					// Browser fallback download
					const blob = new Blob([data], { type: "application/json" });
					const url = URL.createObjectURL(blob);
					const a = document.createElement("a"); a.href = url; a.download = `${base}.portfoliyou`;
					document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
					const next = [p, ...projects];
					setProjects(next); writeStore(next);
					setSelectedProjectId(p.id); writeSelected(p.id);
					return p;
				}
			},
		importProject: async (file) => {
			// Read file, validate, migrate if needed
				let imported: LocalProject | null = null;
				let importedFilePath: string | undefined;
			if (file) {
				const text = await file.text();
				try {
						const data = JSON.parse(text);
					// Validate schemaVersion and migrate if needed
					imported = migrateProjectSchema(data);
				} catch {
					// fallback: invalid file
					imported = null;
				}
			} else if (window.api?.openFileDialog) {
				const res = await window.api.openFileDialog({ filters: [{ name: "PortfoliYOU", extensions: ["portfoliyou", "json"] }] });
				if (!res.canceled && res.data) {
					try {
						const data = JSON.parse(res.data);
						imported = migrateProjectSchema(data);
							if (res.filePath) { imported._filePath = res.filePath; importedFilePath = res.filePath; }
					} catch {
						imported = null;
					}
				}
			}

			// If we got a valid import, deduplicate by file path and by id
			if (imported) {
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
			selectedProject: projects.find(p => p.id === selectedProjectId) || null,
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
		exportProject: async (projectId: string) => {
				const proj = projects.find(p => p.id === projectId);
			if (!proj) return;
			// Export format: wrap with metadata for validation
				const json = buildExportPayload(proj);
			if (window.api?.saveFile) {
				await window.api.saveFile({ defaultPath: `${proj.name || "project"}.portfoliyou`, data: json });
			} else {
				// Browser fallback: trigger download
				const blob = new Blob([json], { type: "application/json" });
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
				const data = buildExportPayload(proj);
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
						}
					} catch { /* ignore lookup failure; use fallback */ }
				const sref = storageRef(storage, path);
				try {
					// Surface immediate feedback so it doesn't feel like "nothing happens"
					window.dispatchEvent(new CustomEvent('py:notify', { detail: { type: 'info', message: 'Uploading project to cloud…' } }));
					// upload target details intentionally not logged in production builds
					// Use Blob upload for reliability across environments (Electron/web)
					const blob = new Blob([data], { type: 'application/json; charset=utf-8' });
					let attempt = 0; let lastErr: unknown = null;
					while (attempt < 2) {
						try {
							await uploadBytes(sref, blob, { contentType: 'application/json; charset=utf-8', cacheControl: 'no-cache' });
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
				proj = { ...proj, _synced: true, _cloudId: cloudId, updatedAt: now() } as LocalProject;
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
					const text = new TextDecoder('utf-8').decode(bytes);
					imported = migrateProjectSchema(JSON.parse(text));
				} catch {
					// Fallback to download URL + fetch (use main-process fetch when available to bypass CORS in dev)
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
						const res = await window.api.saveFile({ defaultPath: `${proj.name || 'project'}.portfoliyou`, data: buildExportPayload(proj) });
						if (res.canceled || !res.filePath) return; // user canceled: no spinner to reset
						proj = { ...proj, _filePath: res.filePath };
						const next = [...projects]; next[idx] = proj; setProjects(next); writeStore(next);
					} catch {
						// ignore and fall through; write step below is gated by _filePath
					}
				}
				if (proj._filePath && window.api.writeFile) {
					setSaving(true);
					try {
						await window.api.writeFile({ filePath: proj._filePath, data: buildExportPayload(proj) });
						setLastSavedAt(now());
					} catch {
						// swallow to avoid UI disruption; notification system can be added later
					} finally {
						setSaving(false);
					}
				}
			},
			renameProject: async (projectId: string, newName: string) => {
				const idx = projects.findIndex(p => p.id === projectId); if (idx < 0) return;
				let proj = projects[idx];
				// Update name in memory first
				proj = { ...proj, name: newName, updatedAt: now() } as LocalProject;
				let next = [...projects]; next[idx] = proj; setProjects(next); writeStore(next);
				// If there is a bound file, try to rename it to match newName
				if (proj._filePath && window.api?.renameFile) {
					// sanitize filename
					const sanitize = (s: string) => s.replace(/[\\/:*?"<>|]/g, "_").trim() || "project";
					const from = proj._filePath;
					const sepIndex = Math.max(from.lastIndexOf('\\'), from.lastIndexOf('/'));
					const dir = sepIndex >= 0 ? from.slice(0, sepIndex) : '';
					const sep = sepIndex >= 0 ? from[sepIndex] : (from.includes('/') ? '/' : '\\');
					const desiredBase = `${sanitize(newName)}.portfoliyou`;
					const to = dir ? `${dir}${sep}${desiredBase}` : desiredBase;
					try {
						const res = await window.api.renameFile({ fromPath: from, toPath: to });
						if (res.ok) {
							const updatedPath = { ...proj, _filePath: to } as LocalProject;
							next = [...projects]; next[idx] = updatedPath; setProjects(next); writeStore(next);
						} else {
							// Surface a small notification if rename fails
							window.dispatchEvent(new CustomEvent('py:notify', { detail: { type: 'warn', message: 'File rename failed; name changed only.' } }));
						}
					} catch {
						window.dispatchEvent(new CustomEvent('py:notify', { detail: { type: 'warn', message: 'File rename failed; name changed only.' } }));
					}
				}
			},
			deleteProject: async (projectId: string, opts?: { deleteFile?: boolean }) => {
				// Do not delete cloud copies when removing a local project
				const p = projects.find(x => x.id === projectId);
				const next = projects.filter(x => x.id !== projectId);
				setProjects(next); writeStore(next);
				if (selectedProjectId === projectId) { setSelectedProjectId(null); writeSelected(null); }
				if (opts?.deleteFile && p?._filePath && window.api?.deleteFile) {
					await window.api.deleteFile({ filePath: p._filePath });
				}
			},
	};
	}, [projects, selectedProjectId, saving, lastSavedAt, cloudMaxProjects, cloudBytesUsed, cloudProjectsCount]);

	// Auto-save to file for projects that have a _filePath
	const prevTimesRef = useRef<Record<string, string>>({});
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	useEffect(() => {
		if (!window.api?.writeFile) return; // only in Electron
		if (debounceRef.current) clearTimeout(debounceRef.current);
		debounceRef.current = setTimeout(async () => {
			const prev = prevTimesRef.current;
			const tasks: Array<Promise<unknown>> = [];
			for (const p of projects) {
				if (!p._filePath) continue;
				const prevUpdatedAt = prev[p.id];
				if (p.updatedAt && p.updatedAt !== prevUpdatedAt) {
					const data = buildExportPayload(p);
					tasks.push(window.api!.writeFile({ filePath: p._filePath, data }));
				}
				// update snapshot
				prev[p.id] = p.updatedAt;
			}
			if (tasks.length) {
				try { setSaving(true); await Promise.all(tasks); setLastSavedAt(now()); } catch { /* swallow to avoid UI disruption */ } finally { setSaving(false); }
			}
		}, 400);
		return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
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
		if (typeof obj['limits'] !== 'object' || obj['limits'] === null) obj['limits'] = { maxPages: 2, maxAssetsMB: 500 };
		if (typeof obj['status'] !== 'object' || obj['status'] === null) obj['status'] = { deployed: false, lastDeployAt: null, deployType: null };
		if (typeof obj['themes'] !== 'object' || obj['themes'] === null) obj['themes'] = {};
		if (typeof obj['pages'] !== 'object' || obj['pages'] === null) obj['pages'] = {};
		if (typeof obj['widgets'] !== 'object' || obj['widgets'] === null) obj['widgets'] = {};
		obj['updatedAt'] = now();
		return obj as LocalProject;
	}

	return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}


export function useProjects() {
const v = useContext(Ctx); if (!v) throw new Error("useProjects outside provider"); return v;
}