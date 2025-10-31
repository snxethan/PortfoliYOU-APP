import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Trash2, Edit3, UploadCloud, Cloud, Download, CheckCircle2, X, Plus, FolderUp, FolderOpen, Wrench, Bell, BellDot, RefreshCcw, Settings as SettingsIcon, Shield, HelpCircle } from "lucide-react";

import { useAuth } from "../providers/AuthProvider";
import { useProjects } from "../providers/ProjectsProvider";
import { AuthCta } from "../components/AuthCta";

// Dashboard section combining welcome, links, and notifications
function Dashboard({
	onToggleNotifications,
	notifBadge,
	notificationsOpen,
	loggedIn,
}: {
	onToggleNotifications: () => void;
	notifBadge: number;
	notificationsOpen: boolean;
	loggedIn: boolean;
}) {
	return (
		<section className="surface p-5">
			<div className="grid grid-cols-3 items-center gap-3">
				{/* Left: notification button and website button */}
				<div className="flex items-center gap-2">
					<button
						onClick={onToggleNotifications}
						className={`btn btn-ghost relative w-10 h-10 p-0 ${notificationsOpen ? 'border-[color:var(--accent-600)]' : ''}`}
						aria-label="Notifications"
						title="Notifications"
					>
						{notifBadge > 0 ? <BellDot size={18} /> : <Bell size={18} />}
						{notifBadge > 0 && (
							<span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-4 h-4 px-1 text-[10px] rounded-full bg-[color:var(--accent)] text-black border border-[color:var(--accent-700)]">{notifBadge}</span>
						)}
					</button>
					<a className="btn btn-ghost px-2 py-1" href="https://portfoliyou.snxethan.dev/changelog" target="_blank" rel="noreferrer">Changelog</a>
				</div>
				{/* Center: icon + tagline */}
				<div className="text-center">
					<div className="flex flex-col items-center w-full">
						{/* Placeholder for icon/image */}
						<div className="w-10 h-10 rounded-full bg-[color:var(--accent)]/20 border border-[color:var(--accent)] mb-1" />
						<h2 className="text-xl font-semibold tracking-wide uppercase">Portfoli-YOU</h2>
						<p className="text-sm text-[color:var(--fg-muted)]">A portfolio for you, by you</p>
						{!loggedIn && (
							<div className="mt-3 w-full max-w-xl mx-auto px-2">
								<AuthCta />
							</div>
						)}
					</div>
				</div>
				{/* Right: website & FAQs */}
				<div className="flex items-center justify-end gap-2 text-sm">
					<a className="btn btn-ghost px-2 py-1" href="https://portfoliyou.snxethan.dev" target="_blank" rel="noreferrer">Website</a>
					<a className="btn btn-ghost px-2 py-1" href="https://portfoliyou.snxethan.dev/faq" target="_blank" rel="noreferrer">FAQs</a>
				</div>
			</div>
		</section>
	);
}

type QuickstartMode = 'default' | 'create' | 'import';

export default function HomePage() {
	const { user } = useAuth();
	const { projects, hasAny, importProject, exportProject, createProjectWithSave, selectProject, renameProject, deleteProject, syncProject, unsyncProject, saveProject, selectedProjectId, cloudMaxProjects, cloudBytesUsed, cloudProjectsCount, listCloudProjects, importProjectFromCloud, importProjectFromCloudLocalOnly, getCloudObjectInfo, getCloudObjectInfoByCloudId, renameCloudProject, deleteCloudProjectByCloudId, saving, lastSavedAt, reconcileCloudLinks } = useProjects();
	const navigate = useNavigate();
	const [qsMode, setQsMode] = useState<QuickstartMode>('default');
	const [nameDraft, setNameDraft] = useState('');
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editDraft, setEditDraft] = useState('');
	const [cloudOpen, setCloudOpen] = useState(false);
	const [cloudTarget, setCloudTarget] = useState<string | null>(null); // local project id
	const [cloudTargetCloudId, setCloudTargetCloudId] = useState<string | null>(null); // cloud-only id
	const [cloudProjects, setCloudProjects] = useState<Array<{ id: string; name: string; updatedAt: string; storagePath: string }>>([]);
	const [cloudInfo, setCloudInfo] = useState<Record<string, { storagePath: string; sizeBytes: number; updatedAt: string }>>({});
	const [hoverLinkedId, setHoverLinkedId] = useState<string | null>(null);
	const [accountOpen, setAccountOpen] = useState(false);

	// No popup state needed; CTA is an inline centered section shown only when logged out

	// Important: avoid conditional hook calls; compute recent without hooks
	const recent = projects.slice(0, 6);
	const [cloudRemoteCount, setCloudRemoteCount] = useState(0);
	const cloudQuota = cloudMaxProjects;

	useEffect(() => {
		let alive = true;
		const fetchCloud = async () => {
			if (!user) { if (alive) { setCloudRemoteCount(0); setCloudProjects([]); setCloudInfo({}); } return; }
			try {
				const list = await listCloudProjects();
				if (!alive) return;
				setCloudRemoteCount(list.length);
				setCloudProjects(list);
				// Reconcile local link flags with actual cloud state
				reconcileCloudLinks(list.map(x => x.id));
				const infoMap: Record<string, { storagePath: string; sizeBytes: number; updatedAt: string }> = {};
				for (const item of list) {
					try {
						const inf = await getCloudObjectInfoByCloudId(item.id);
						if (inf) infoMap[item.id] = inf;
					} catch { /* ignore */ }
				}
				if (alive) setCloudInfo(infoMap);
			} catch { /* ignore */ }
		};
		fetchCloud();
		// periodic refresh every 60s when signed in
		const interval = setInterval(() => { if (user) fetchCloud(); }, 60000);
		return () => { alive = false; clearInterval(interval); };
	}, [user, projects.map(p => p._cloudId ? p._cloudId : '').join(','), cloudOpen]);
	type Notif = { id: string; type: 'info' | 'success' | 'warn' | 'error'; message: string; time: string; persistent?: boolean; durationMs?: number };
	const [notifs, setNotifs] = useState<Notif[]>([]);
	const [notificationsOpen, setNotificationsOpen] = useState(false);
	const unseenCount = useMemo(() => notifs.length, [notifs.length]);

	// Highlight + scroll interop
	const [pulseList, setPulseList] = useState(false);
	const [pulseQuickstart, setPulseQuickstart] = useState(false);
	const [pulseAccount, setPulseAccount] = useState(false);
	const listRef = useRef<HTMLDivElement | null>(null);
	const quickstartRef = useRef<HTMLDivElement | null>(null);
	const accountRef = useRef<HTMLDivElement | null>(null);
	useEffect(() => {
		const onReq = () => {
			if (hasAny && recent.length > 0) {
				setPulseList(true);
				listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
				setTimeout(() => setPulseList(false), 2400);
			} else {
				setPulseQuickstart(true);
				quickstartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
				setTimeout(() => setPulseQuickstart(false), 2400);
			}
		};
		const onAccount = () => {
			setPulseAccount(true);
			accountRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
			setTimeout(() => setPulseAccount(false), 2400);
		};
		window.addEventListener('py:highlight-request', onReq);
		window.addEventListener('py:highlight-account', onAccount);
		return () => {
			window.removeEventListener('py:highlight-request', onReq);
			window.removeEventListener('py:highlight-account', onAccount);
		};
	}, [hasAny, recent.length]);

	// Notification event listener: window.dispatchEvent(new CustomEvent('py:notify', { detail: { type, message, persistent?: boolean, durationMs?: number } }))
	useEffect(() => {
		const onNotify = (e: Event) => {
			const ce = e as CustomEvent<{ type?: 'info' | 'success' | 'warn' | 'error'; message?: string; persistent?: boolean; durationMs?: number }>;
			const type = ce.detail?.type ?? 'info';
			const message = ce.detail?.message || '';
			const persistent = ce.detail?.persistent ?? false;
			const durationMs = ce.detail?.durationMs ?? 4000;
			setNotifs(prev => [{ id: crypto.randomUUID(), type, message, time: new Date().toISOString(), persistent, durationMs }, ...prev].slice(0, 50));
		};
		window.addEventListener('py:notify', onNotify);
		return () => window.removeEventListener('py:notify', onNotify);
	}, []);

	// Auto-dismiss newest notification even when center is closed (transient toast behavior)
	useEffect(() => {
		if (notificationsOpen) return; // center handles auto-advance when open
		if (notifs.length === 0) return;
		const current = notifs[0];
		if (current.persistent) return; // keep persistent items until user opens center
		const t = setTimeout(() => {
			setNotifs(prev => prev.filter(n => n.id !== current.id));
		}, Math.max(1200, current.durationMs ?? 4000));
		return () => clearTimeout(t);
	}, [notifs, notificationsOpen]);

	// Auto-advance timed notifications when center is open and dropdown closed
	const [activeNotifId, setActiveNotifId] = useState<string | null>(null);
	useEffect(() => {
		if (!notificationsOpen) return;
		const current = notifs.find(n => !n.persistent) || notifs[0];
		if (!current) { setActiveNotifId(null); return; }
		setActiveNotifId(current.id);
		if (current.persistent) return; // don't auto-remove
		const t = setTimeout(() => {
			setNotifs(prev => prev.filter(n => n.id !== current.id));
		}, Math.max(1200, current.durationMs ?? 4000));
		return () => clearTimeout(t);
	}, [notifs, notificationsOpen]);

	// Global event to open Cloud Settings from Header quick action
	useEffect(() => {
		const onOpenCloud = (e: Event) => {
			const ce = e as CustomEvent<{ projectId?: string }>;
			const pid = ce.detail?.projectId || selectedProjectId || projects[0]?.id;
			if (!pid) return;
			setCloudTarget(pid);
			setCloudOpen(true);
		};
		window.addEventListener('py:openCloudSettings', onOpenCloud);
		return () => window.removeEventListener('py:openCloudSettings', onOpenCloud);
	}, [selectedProjectId, projects]);

	// Unified layout below handles both empty and non-empty states.

	// recent computed above to keep hook order stable

	return (
		<div className="p-6 space-y-6">
			<Dashboard onToggleNotifications={() => setNotificationsOpen(v => !v)} notifBadge={unseenCount} notificationsOpen={notificationsOpen} loggedIn={!!user} />

			{/* Centered CTA under title is now shown inside Dashboard; no extra CTA block here */}
			{/* Lightweight toast for latest notification when center is closed */}
			{!notificationsOpen && notifs[0] && (
				<div className="fixed bottom-4 right-4 z-50 max-w-sm">
					<FadingNotification notif={{ id: notifs[0].id, type: notifs[0].type, message: notifs[0].message }} />
				</div>
			)}
			{/* Notification center area within the PortfoliYOU section */}
			{notificationsOpen && (
				<div className="surface p-3 border border-[color:var(--accent)] rounded-md">
					<div className="text-xs font-semibold uppercase tracking-wide">Notifications</div>
					<div className="mt-2">
						{(() => {
							if (!activeNotifId) return null;
							const active = notifs.find(n => n.id === activeNotifId);
							return active ? (
								<FadingNotification key={activeNotifId} notif={{ id: active.id, type: active.type, message: active.message }} />
							) : null;
						})()}
						{!activeNotifId && notifs.length === 0 && (
							<div className="text-xs text-[color:var(--fg-muted)]">No notifications.</div>
						)}
					</div>
				</div>
			)}

			{/* 2nd section: portfolios (local + cloud) and account */}
			{/* Portfolios section */}
			<section>
				<div id="py-list" ref={listRef} className={`surface p-5 border border-[color:var(--border)] rounded-md ${pulseList ? 'highlight-pulse' : ''}`}>
					<h3 className="font-semibold mb-3 text-center uppercase tracking-wide">YOUR PORTFOLIOS</h3>
					{/* Inline create/import sub-section */}
					<div id="py-quickstart" ref={quickstartRef} className={`${pulseQuickstart ? 'highlight-pulse' : ''} bg-[color:var(--bg)] border border-[color:var(--border)] rounded-md p-3 mb-4 max-w-xl mx-auto`}>
						{qsMode === 'create' ? (
							<div className="flex flex-col sm:flex-row items-start gap-3">
								<input autoFocus className="input w-full sm:w-80" placeholder="Portfolio name" value={nameDraft} onChange={e => setNameDraft(e.target.value)} />
								<div className="flex items-center gap-2">
									<button className="btn btn-primary" onClick={async () => { const p = await createProjectWithSave(nameDraft.trim()); if (p) { selectProject(p.id); } setNameDraft(''); setQsMode('default'); }} disabled={!nameDraft.trim()}>Create</button>
									<button className="btn btn-outline" onClick={() => setQsMode('default')}><X size={14}/> Cancel</button>
								</div>
							</div>
						) : (
									<div className="flex items-center gap-4 justify-center py-1">
										<button className="btn btn-outline" onClick={() => setQsMode('create')}><Plus size={14} className="mr-1"/> Create new Portfolio</button>
								<button className="btn btn-outline" onClick={async () => { const p = await importProject(); if (p?.id) selectProject(p.id); }}><FolderUp size={14} className="mr-1"/> Import Existing Portfolio</button>
							</div>
						)}
					</div>

					{/* Local portfolios list */}
					<div className="surface p-3 border border-[color:var(--border)] rounded-md">
						<div className="text-xs font-semibold uppercase tracking-wide mb-2">YOUR LOCAL PORTFOLIOS</div>
						{recent.length === 0 ? (
							<div className="text-sm text-[color:var(--fg-muted)]">No recent items.</div>
						) : (
							<ul className="divide-y divide-[color:var(--border)]">
								{recent.map(p => (
									<li
										key={p.id}
										className={`py-2 px-2 rounded cursor-pointer flex items-center justify-between gap-3 border ${(selectedProjectId === p.id || hoverLinkedId === p.id) ? 'border-[color:var(--accent)] bg-[color:var(--accent)]/10' : 'border-transparent'} hover-darker`}
										onClick={() => selectProject(p.id)}
										title={p._filePath || ''}
									>
										<div className="min-w-0">
											{editingId === p.id ? (
												<div className="flex items-center gap-2">
													<input className="input w-64" value={editDraft} onChange={e => setEditDraft(e.target.value)} onClick={(e) => e.stopPropagation()} />
													<button className="btn btn-primary btn-xs" onClick={async (e) => { e.stopPropagation(); const v = editDraft.trim(); if (v) await renameProject(p.id, v); setEditingId(null); }}><CheckCircle2 size={14}/></button>
													<button className="btn btn-outline btn-xs" onClick={(e) => { e.stopPropagation(); setEditingId(null); }}><X size={14}/></button>
												</div>
											) : (
												<>
													<div className="text-sm font-medium truncate flex items-center gap-1" title={p.name}>
														<span className="truncate">{p.name}</span>
														{p._synced && <span className="inline-flex" aria-label="Cloud project"><Cloud size={12} className="text-[color:var(--accent)]"/></span>}
														<button className="btn btn-ghost text-xs px-1" title="Rename" onClick={(e) => { e.stopPropagation(); setEditingId(p.id); setEditDraft(p.name); }}><Edit3 size={12}/></button>
														{selectedProjectId === p.id && (
															<span className="ml-2 inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full bg-[color:var(--accent)] text-black border border-[color:var(--accent-700)]">Selected</span>
														)}
													</div>
													<div className="text-xs text-[color:var(--fg-muted)]">Updated {new Date(p.updatedAt).toLocaleString()}</div>
												</>
											)}
										</div>
										<div className="flex gap-1">
											<button className="btn btn-ghost text-xs" title="Export" onClick={(e) => { e.stopPropagation(); exportProject(p.id); }}><Download size={14}/></button>
											{!p._filePath ? (
												<button className="btn btn-ghost text-xs" title="Save As…" onClick={async (e) => { e.stopPropagation(); await saveProject(p.id, { saveAs: true }); }}><FolderUp size={14}/></button>
											) : (
												<button className="btn btn-ghost text-xs" title="Open file location" onClick={async (e) => { e.stopPropagation(); if (window.api?.showItemInFolder) await window.api.showItemInFolder({ filePath: p._filePath! }); }}><FolderOpen size={14}/></button>
											)}
											<button className="btn btn-ghost text-xs bg-[color:var(--muted)]/60 hover:bg-[color:var(--muted)]" title="Modify" onClick={(e) => { e.stopPropagation(); selectProject(p.id); navigate('/modify'); }}><Wrench size={14}/></button>
											<button className="btn btn-ghost text-xs bg-[color:var(--muted)]/60 hover:bg-[color:var(--muted)]" title="Deploy" onClick={(e) => { e.stopPropagation(); selectProject(p.id); navigate('/deploy'); }}><UploadCloud size={14}/></button>
											{user && (
												<button
													className={`btn btn-ghost text-xs ${p._synced ? 'cloud-linked' : ''}`}
													title="Cloud settings"
													onClick={(e) => { e.stopPropagation(); setCloudTarget(p.id); setCloudTargetCloudId(null); setCloudOpen(true); }}
												>
													<Cloud size={14} className={p._synced ? 'cloud-linked-icon' : ''}/>
												</button>
											)}
											<button className="btn btn-ghost text-xs" title="Delete" onClick={async (e) => {
												e.stopPropagation();
												const confirmDelete = window.confirm(`Delete "${p.name}" from the list${p._filePath ? ' (file can optionally be removed next)' : ''}?`);
												if (!confirmDelete) return;
												let deleteFile = false;
												if (p._filePath) {
													deleteFile = window.confirm('Also delete the .portfoliyou file from disk? This cannot be undone.');
												}
												await deleteProject(p.id, { deleteFile });
											}}><Trash2 size={14}/></button>
										</div>
									</li>
								))}
							</ul>
						)}
					</div>

					{/* Cloud portfolios list */}
					{user && (
						<div className="mt-6 surface p-3 border border-[color:var(--border)] rounded-md bg-[color:var(--muted)]/40">
							<div className="flex items-center justify-between mb-2">
								<div className="text-xs font-semibold uppercase tracking-wide">YOUR CLOUD PORTFOLIOS</div>
								<button className="btn btn-ghost btn-xs" title="Refresh cloud" onClick={async () => {
									try {
										const list = await listCloudProjects();
										setCloudRemoteCount(list.length);
										setCloudProjects(list);
										reconcileCloudLinks(list.map(x => x.id));
										const infoMap: Record<string, { storagePath: string; sizeBytes: number; updatedAt: string }> = {};
										for (const item of list) {
											try { const inf = await getCloudObjectInfoByCloudId(item.id); if (inf) infoMap[item.id] = inf; } catch { /* ignore */ }
										}
										setCloudInfo(infoMap);
									} catch { /* ignore */ }
								}}><RefreshCcw size={14}/></button>
							</div>
							{cloudProjects.length === 0 ? (
								<div className="text-xs text-[color:var(--fg-muted)]">No cloud portfolios yet.</div>
							) : (
								<ul className="divide-y divide-[color:var(--border)]">
									{cloudProjects.map(cp => {
										const linked = projects.find(p => p._cloudId === cp.id);
										const isSelectedCloud = !!linked && (linked.id === selectedProjectId || hoverLinkedId === linked.id);
										return (
											<li
												key={cp.id}
												className={`py-2 px-2 rounded flex items-center justify-between gap-3 border ${isSelectedCloud ? 'border-[color:var(--accent)] bg-[color:var(--accent)]/10' : 'border-transparent'} hover-darker`}
												onMouseEnter={() => setHoverLinkedId(linked?.id || null)}
												onMouseLeave={() => setHoverLinkedId(null)}
												onClick={() => { if (linked) selectProject(linked.id); }}
											>
											<div className="min-w-0">
												<div className="text-sm font-medium truncate flex items-center gap-2">
													<span className="truncate">{cp.name}</span>
													{isSelectedCloud && (
														<span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full bg-[color:var(--accent)] text-black border border-[color:var(--accent-700)]">Selected</span>
													)}
												</div>
												<div className="text-xs text-[color:var(--fg-muted)]">Updated {new Date(cp.updatedAt).toLocaleString()} {linked ? '· Linked' : '· Not linked'} · {(cloudInfo[cp.id]?.sizeBytes ? (cloudInfo[cp.id].sizeBytes / (1024*1024)).toFixed(3) + ' MB' : '0.000 MB')}</div>
											</div>
											<div className="flex items-center gap-2 text-xs">
												<button
													className={`btn btn-ghost btn-xs ${linked ? 'cloud-linked' : ''}`}
													title="Cloud settings"
													onClick={(e) => {
														e.stopPropagation();
														if (linked) { setCloudTarget(linked.id); setCloudTargetCloudId(null); setCloudOpen(true); }
														else { setCloudTarget(null); setCloudTargetCloudId(cp.id); setCloudOpen(true); }
													}}
												>
													<Cloud size={14} className={linked ? 'cloud-linked-icon' : ''}/>
												</button>
											</div>
										</li>
									);
								})}
								</ul>
							)}
						</div>
					)}
				</div>
			</section>

			{/* Account panel – show only when signed in */}
			{user && (
				<section>
								<div id="py-account" ref={accountRef} className={`surface p-5 ${pulseAccount ? 'highlight-pulse' : ''}`}>
									<div className="flex items-center justify-between mb-3">
										<h3 className="font-semibold text-center flex-1 uppercase tracking-wide">Account</h3>
										<button className="btn btn-ghost btn-xs" title="Account settings" onClick={() => setAccountOpen(true)}>
											<SettingsIcon size={14} />
										</button>
									</div>
						<div className="text-sm text-center "><span className="font-mono">{user?.email ?? user?.uid}</span></div>
						<div className="mt-3 grid grid-cols-2 gap-3 text-sm">
							<div className="surface p-3 bg-[color:var(--muted)]/40 border border-[color:var(--border)] rounded-md">
								<div className="text-xs text-[color:var(--fg-muted)]">Cloud usage</div>
								<div className="mt-1 font-semibold">{((cloudBytesUsed && cloudBytesUsed > 0 ? cloudBytesUsed : Object.values(cloudInfo).reduce((a, b) => a + (b.sizeBytes || 0), 0)) / (1024*1024)).toFixed(2)} / 512.00 MB</div>
							</div>
							<div className="surface p-3 bg-[color:var(--muted)]/40 border border-[color:var(--border)] rounded-md">
								<div className="text-xs text-[color:var(--fg-muted)]">Cloud projects</div>
									<div className="mt-1 font-semibold">{(cloudProjectsCount && cloudProjectsCount > 0 ? cloudProjectsCount : cloudRemoteCount)} / {cloudQuota}</div>
							</div>
						</div>
					</div>
				</section>
			)}

					{/* Cloud settings modals */}
					{cloudOpen && cloudTarget && !cloudTargetCloudId && (() => {
						const proj = projects.find(p => p.id === cloudTarget)!;
						const cloudId = proj._cloudId;
						return (
							<CloudSettingsModal
								open={cloudOpen}
								onClose={() => setCloudOpen(false)}
								mode="linked"
								titleName={proj.name}
								statusText={proj._synced ? 'Linked to cloud' : 'Not linked'}
								saving={saving}
								lastSavedAt={lastSavedAt}
								actions={{
									refreshInfo: async () => await getCloudObjectInfo(proj.id),
									sync: async () => { await syncProject(proj.id); setTimeout(() => { const p2 = projects.find(x => x.id === proj.id); if (p2?._synced) setCloudOpen(false); }, 250); },
									unlinkKeepCloud: cloudId ? async () => { await unsyncProject(proj.id); } : undefined,
									saveToDisk: async () => { await saveProject(proj.id); },
									importLocalCopy: cloudId ? async () => {
										const p = await importProjectFromCloudLocalOnly(cloudId);
										if (p?.id) { selectProject(p.id); setCloudOpen(false); }
									} : undefined,
									renameCloud: cloudId ? async (next: string) => {
										const ok = await renameCloudProject(cloudId!, next);
										if (ok) setCloudProjects(prev => prev.map(x => x.id === cloudId ? { ...x, name: next } : x));
										return ok;
									} : undefined,
									deleteCloud: cloudId ? async () => {
										const ok = await deleteCloudProjectByCloudId(cloudId!);
										if (ok) { setCloudProjects(prev => prev.filter(x => x.id !== cloudId)); setCloudInfo(prev => { const { [cloudId!]: removed, ...rest } = prev; void removed; return rest; }); }
										return ok;
									} : undefined,
								}}
							/>
						);
					})()}
					{cloudOpen && cloudTargetCloudId && !cloudTarget && (() => {
						const cid = cloudTargetCloudId;
						const cname = cloudProjects.find(c => c.id === cid)?.name || 'Cloud project';
						return (
							<CloudSettingsModal
								open={cloudOpen}
								onClose={() => setCloudOpen(false)}
								mode="cloud"
								titleName={cname}
								statusText={'Not linked'}
								actions={{
									refreshInfo: async () => await getCloudObjectInfoByCloudId(cid),
									importAndLink: async () => {
										const p = await importProjectFromCloud(cid);
										if (p?.id) { selectProject(p.id); setCloudOpen(false); }
									},
									importLocalOnly: async () => {
										const p = await importProjectFromCloudLocalOnly(cid);
										if (p?.id) { selectProject(p.id); setCloudOpen(false); }
									},
									renameCloud: async (next: string) => {
										const ok = await renameCloudProject(cid, next);
										if (ok) setCloudProjects(prev => prev.map(x => x.id === cid ? { ...x, name: next } : x));
										return ok;
									},
									deleteCloud: async () => {
										const ok = await deleteCloudProjectByCloudId(cid);
										if (ok) { setCloudProjects(prev => prev.filter(x => x.id !== cid)); setCloudInfo(prev => { const { [cid]: removed, ...rest } = prev; void removed; return rest; }); }
										return ok;
									},
								}}
							/>
						);
					})()}

					{/* Account settings modal */}
					{user && accountOpen && (
						<AccountSettingsModal open={accountOpen} onClose={() => setAccountOpen(false)} />
					)}
		</div>
	);
}

function CloudSettingsModal({
	open,
	onClose,
	mode,
	titleName,
	statusText,
	actions,
	saving,
	lastSavedAt,
}: {
	open: boolean;
	onClose: () => void;
	mode: 'linked' | 'cloud';
	titleName: string;
	statusText: string;
	saving?: boolean;
	lastSavedAt?: string | null;
	actions: {
		// shared
		refreshInfo: () => Promise<{ storagePath: string; sizeBytes: number; updatedAt: string } | null>;
		renameCloud?: (newName: string) => Promise<boolean>;
		deleteCloud?: () => Promise<boolean>;
		importLocalCopy?: () => Promise<void>;
		// linked
		sync?: () => Promise<void>;
		unlinkKeepCloud?: () => Promise<void>;
		saveToDisk?: () => Promise<void>;
		// cloud-only
		importAndLink?: () => Promise<void>;
		importLocalOnly?: () => Promise<void>;
	};
}) {
	if (!open) return null;
	const [info, setInfo] = useState<{ storagePath: string; sizeBytes: number; updatedAt: string } | null>(null);
	const [loadingInfo, setLoadingInfo] = useState(false);
	useEffect(() => {
		// Auto-load cloud details when modal opens
		let alive = true;
		const load = async () => {
			if (!open) return;
			setLoadingInfo(true);
			try {
				const v = await actions.refreshInfo();
				if (alive) setInfo(v);
			} catch {
				// ignore
			} finally {
				if (alive) setLoadingInfo(false);
			}
		};
		load();
		return () => { alive = false; };
	}, [open]);
	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
			onClick={onClose}
			onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
			tabIndex={-1}
		>
			<div className="surface p-5 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
				<h4 className="text-base font-semibold mb-2">Cloud settings</h4>
				<div className="text-sm mb-2">
					<div>Project: <span className="font-medium">{titleName}</span></div>
					<div>Status: <span className="text-[color:var(--fg-muted)]">{statusText}</span></div>
				</div>
				{mode === 'linked' && (
					<div className="text-xs mb-3 text-[color:var(--fg-muted)]">
						Autosave: Enabled for files {saving ? '(saving...)' : lastSavedAt ? `· Last saved ${new Date(lastSavedAt).toLocaleTimeString()}` : ''}
					</div>
				)}
				<div className="flex flex-col gap-2">
					{/* Actions block with bordered dark-ish background */}
					<div className="bg-[color:var(--muted)]/40 border border-[color:var(--border)] rounded-md p-3">
					{mode === 'linked' ? (
						<>
							<div className="grid grid-cols-2 gap-2">
								<button className="btn btn-outline btn-sm" onClick={actions.sync} title="Sync to cloud"><UploadCloud size={14} className="mr-1"/> Sync</button>
								{actions.unlinkKeepCloud && (
									<button className="btn btn-outline btn-sm" onClick={actions.unlinkKeepCloud} title="Unlink from cloud"><X size={14} className="mr-1"/> Unlink</button>
								)}
								<button className="btn btn-ghost btn-sm" onClick={actions.saveToDisk} title="Save to file"><Download size={14} className="mr-1"/> Save file</button>
								{actions.importLocalCopy && (
									<button className="btn btn-ghost btn-sm" onClick={actions.importLocalCopy} title="Import a separate local copy"><Download size={14} className="mr-1"/> Import cloud copy</button>
								)}
							</div>
							<div className="flex gap-2 mt-1">
								{actions.renameCloud && (
									<button className="btn btn-ghost btn-sm" onClick={async () => {
										const rename = actions.renameCloud; if (!rename) return;
										const next = prompt('Rename cloud portfolio', titleName);
										if (next && next.trim() && next.trim() !== titleName) await rename(next.trim());
									}} title="Rename cloud portfolio"><Edit3 size={14} className="mr-1"/> Rename</button>
								)}
								{actions.deleteCloud && (
									<button className="btn px-2 py-1 text-white bg-red-600 hover:bg-red-700 border-red-700 btn-sm" onClick={async () => { const del = actions.deleteCloud; if (del && confirm('Delete cloud copy? This cannot be undone.')) await del(); }} title="Delete cloud copy"><Trash2 size={14} className="mr-1"/> Delete cloud</button>
								)}
							</div>
						</>
					) : (
						<>
							<div className="grid grid-cols-2 gap-2">
								{actions.importAndLink && (
									<button className="btn btn-outline btn-sm" onClick={actions.importAndLink} title="Import and link to cloud"><Download size={14} className="mr-1"/> Import & link</button>
								)}
								{actions.importLocalOnly && (
									<button className="btn btn-outline btn-sm" onClick={actions.importLocalOnly} title="Import as local-only"><Download size={14} className="mr-1"/> Import local-only</button>
								)}
							</div>
							<div className="flex gap-2 mt-1">
								{actions.renameCloud && (
									<button className="btn btn-ghost btn-sm" onClick={async () => {
										const rename = actions.renameCloud; if (!rename) return;
										const next = prompt('Rename cloud portfolio', titleName);
										if (next && next.trim() && next.trim() !== titleName) await rename(next.trim());
									}} title="Rename cloud portfolio"><Edit3 size={14} className="mr-1"/> Rename</button>
								)}
								{actions.deleteCloud && (
									<button className="btn px-2 py-1 text-white bg-red-600 hover:bg-red-700 border-red-700 btn-sm" onClick={async () => { const del = actions.deleteCloud; if (del && confirm('Delete cloud portfolio?')) await del(); }} title="Delete cloud portfolio"><Trash2 size={14} className="mr-1"/> Delete</button>
								)}
							</div>
						</>
					)}
					</div>
					<div className="mt-2 p-3 border border-[color:var(--border)] rounded text-xs bg-[color:var(--muted)]/40">
						<div className="flex items-center justify-between">
							<div className="font-semibold">Cloud details</div>
							<button className="btn btn-ghost btn-xs" title="Refresh" onClick={async () => { setLoadingInfo(true); try { const v = await actions.refreshInfo(); setInfo(v); } finally { setLoadingInfo(false); } }}><RefreshCcw size={12}/></button>
						</div>
						{loadingInfo ? (
							<div className="text-[color:var(--fg-muted)]">Loading…</div>
						) : info ? (
							<div className="mt-1 space-y-1">
								<div><span className="text-[color:var(--fg-muted)]">Path:</span> <span className="font-mono break-all">{info.storagePath}</span></div>
								<div><span className="text-[color:var(--fg-muted)]">Size:</span> {(info.sizeBytes / (1024 * 1024)).toFixed(3)} MB</div>
								<div><span className="text-[color:var(--fg-muted)]">Updated:</span> {new Date(info.updatedAt).toLocaleString()}</div>
							</div>
						) : (
							<div className="text-[color:var(--fg-muted)]">Click Refresh to fetch object details.</div>
						)}
					</div>
				</div>
				<div className="mt-4 text-right">
					<button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
				</div>
			</div>
		</div>
	);
}

function AccountSettingsModal({
	open,
	onClose,
}: { open: boolean; onClose: () => void }) {
	if (!open) return null;
	const openUrl = (url: string) => { try { window.open(url, '_blank', 'noopener,noreferrer'); } catch (e) { void e; } };
	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
			onClick={onClose}
			onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
			tabIndex={-1}
		>
			<div className="surface p-5 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
				<h4 className="text-base font-semibold mb-2">Account settings</h4>
				<div className="bg-[color:var(--muted)]/40 border border-[color:var(--border)] rounded-md p-3">
					<div className="grid grid-cols-2 gap-2">
						<button className="btn btn-outline btn-sm" title="Manage account" onClick={() => openUrl('https://portfoliyou.snxethan.dev/account')}>
							<SettingsIcon size={14} className="mr-1"/> Manage account
						</button>
						<button className="btn btn-ghost btn-sm" title="Privacy & Security" onClick={() => openUrl('https://portfoliyou.snxethan.dev/privacy')}>
							<Shield size={14} className="mr-1"/> Privacy & Security
						</button>
						<button className="btn btn-ghost btn-sm" title="Account FAQs" onClick={() => openUrl('https://portfoliyou.snxethan.dev/faq')}>
							<HelpCircle size={14} className="mr-1"/> Account FAQs
						</button>
						<button className="btn px-2 py-1 text-white bg-red-600 hover:bg-red-700 border-red-700 btn-sm" title="Delete account" onClick={() => openUrl('https://portfoliyou.snxethan.dev/account/delete')}>
							<Trash2 size={14} className="mr-1"/> Delete account
						</button>
					</div>
				</div>
				<div className="mt-4 text-right">
					<button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
				</div>
			</div>
		</div>
	);
}

function SeverityDot({ type }: { type: 'info' | 'success' | 'warn' | 'error' }) {
	const cls = type === 'success' ? 'bg-green-500' : type === 'warn' ? 'bg-yellow-500' : type === 'error' ? 'bg-red-500' : 'bg-[color:var(--primary)]';
	return <span className={`w-2 h-2 mt-1 rounded-full ${cls}`} />;
}

function FadingNotification({ notif }: { notif: { id: string; type: 'info' | 'success' | 'warn' | 'error'; message: string } }) {
	return (
		<div className="py-fade-in text-sm flex items-center gap-2 p-3 bg-[color:var(--muted)] border border-[color:var(--border)] rounded-md">
			<SeverityDot type={notif.type} />
			<span className="truncate">{notif.message}</span>
		</div>
	);
}

// CloudOnlySettingsModal merged into CloudSettingsModal