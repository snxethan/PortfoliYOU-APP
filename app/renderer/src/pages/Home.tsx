import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
//

import AccountSettingsModal from "../components/modals/AccountSettingsModal";
import Dashboard from "../components/home/Dashboard";
import NotificationsCenter from "../components/notifications/NotificationsCenter";
import QuickstartPanel from "../components/home/QuickstartPanel";
import ProjectsList from "../components/home/ProjectsList";
import CloudProjectsList from "../components/home/CloudProjectsList";
import AccountDashboard from "../components/home/AccountDashboard";
import type { LocalProject } from "../components/home/ProjectsList";
import { useAuth } from "../providers/AuthProvider";
import { useProjects } from "../providers/ProjectsProvider";
// CTA is now shown via a popup from the sidebar Account section when not signed in
import { useNotifications } from "../providers/NotificationsProvider";
import type { NotificationType } from "../providers/NotificationsProvider";
import { useCloudSettings } from "../providers/CloudSettingsProvider";


export default function HomePage() {
	const { user } = useAuth();
	const { projects, hasAny, importProject, exportProject, createProjectWithSave, selectProject, renameProject, deleteProject, saveProject, selectedProjectId, cloudMaxProjects, cloudMaxStorageMB, cloudBytesUsed, cloudProjectsCount, listCloudProjects, getCloudObjectInfoByCloudId, reconcileCloudLinks } = useProjects();
	const { notifications, dismiss, clearAll } = useNotifications();
	const { openCloud } = useCloudSettings();
	const navigate = useNavigate();
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
	}, [user, projects.map(p => p._cloudId ? p._cloudId : '').join(',')]);
	const [notificationsOpen, setNotificationsOpen] = useState(false);
	const unseenCount = useMemo(() => notifications.length, [notifications.length]);

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

	// Legacy notification logic removed; unified notifications come from NotificationsProvider

	// Unified layout below handles both empty and non-empty states.

	// recent computed above to keep hook order stable

	return (
		<div className="p-6 space-y-6">
			<Dashboard onToggleNotifications={() => setNotificationsOpen(v => !v)} notifBadge={unseenCount} notificationsOpen={notificationsOpen} />

			{/* Centered CTA under title is now shown inside Dashboard; no extra CTA block here */}
			{/* Notification center area on Home for managing/dismissing persistent notifications */}
			{notificationsOpen && (
				<NotificationsCenter
					notifications={notifications as Array<{ id: string; type: NotificationType; title?: string; message: string; createdAt: number | string }>}
					onDismiss={dismiss}
					onClearAll={clearAll}
				/>
			)}

			{/* 2nd section: portfolios (local + cloud) and account */}
			{/* Portfolios section */}
			<section>
				<div id="py-list" ref={listRef} className={`surface p-5 border border-[color:var(--border)] rounded-md ${pulseList ? 'highlight-pulse' : ''}`}>
					<h3 className="font-semibold mb-3 text-center uppercase tracking-wide">PORTFOLIO DASHBOARD</h3>
					{/* Inline create/import sub-section */}
					<div id="py-quickstart" ref={quickstartRef} className={`${pulseQuickstart ? 'highlight-pulse' : ''}`}>
						<QuickstartPanel
							onCreate={createProjectWithSave}
							onImport={importProject}
							onSelectProject={(id) => selectProject(id)}
						/>
					</div>

					{/* Local portfolios list */}
					<ProjectsList
						projects={recent as unknown as LocalProject[]}
						selectedProjectId={selectedProjectId}
						hoverLinkedId={hoverLinkedId}
						userSignedIn={!!user}
						onSelect={(id) => selectProject(id)}
						onRename={(id, name) => renameProject(id, name)}
						onDelete={(id, opts) => deleteProject(id, opts)}
						onExport={(id) => exportProject(id)}
						onSaveAs={(id) => saveProject(id, { saveAs: true })}
						onOpenFileLocation={async (filePath) => { if (window.api?.showItemInFolder) await window.api.showItemInFolder({ filePath }); }}
						onOpenEditor={(id) => { selectProject(id); navigate('/editor'); }}
						onOpenDeploy={(id) => { selectProject(id); navigate('/deploy'); }}
						onOpenCloud={(id) => openCloud({ projectId: id })}
					/>

					{/* Cloud portfolios list */}
					{user && (
						<CloudProjectsList
							userSignedIn={!!user}
							cloudProjects={cloudProjects}
							cloudInfo={cloudInfo}
							localProjects={projects.map(p => ({ id: p.id, _cloudId: (p as unknown as { _cloudId?: string })._cloudId }))}
							selectedProjectId={selectedProjectId}
							hoverLinkedId={hoverLinkedId}
							setHoverLinkedId={setHoverLinkedId}
							onRefresh={async () => {
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
							}}
							onSelectLocal={(id) => selectProject(id)}
							onOpenCloud={(t) => openCloud(t)}
						/>
					)}
				</div>
			</section>

			{/* Account panel – show only when signed in */}
			{user && (
				<section>
					<div id="py-account" ref={accountRef}>
						<div className="surface p-0">
							<></>
						</div>
						{/* Account dashboard extracted */}
						<div className="surface p-0">
							<AccountDashboard
								userDisplay={(user?.email ?? user?.uid) as string}
								usageMB={(((cloudBytesUsed && cloudBytesUsed > 0 ? cloudBytesUsed : Object.values(cloudInfo).reduce((a, b) => a + (b.sizeBytes || 0), 0)) / (1024 * 1024)).toFixed(2))}
								maxStorageMB={String(cloudMaxStorageMB || 1024)}
								projectCount={(cloudProjectsCount && cloudProjectsCount > 0 ? cloudProjectsCount : cloudRemoteCount)}
								projectQuota={cloudQuota}
								onOpenSettings={() => setAccountOpen(true)}
								highlight={pulseAccount}
							/>
						</div>
					</div>
				</section>
			)}

			{/* Cloud settings managed globally by CloudSettingsProvider */}

			{/* Account settings modal */}
			{user && accountOpen && (
				<AccountSettingsModal open={accountOpen} onClose={() => setAccountOpen(false)} />
			)}
		</div>
	);
}

// Removed older one-off toast component; now handled by global Notifications stack
// CloudOnlySettingsModal merged into CloudSettingsModal