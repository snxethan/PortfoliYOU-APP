import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
//

import AccountSettingsModal from "../components/modals/AccountSettingsModal";
import Dashboard from "../components/home/Dashboard";
import NotificationsCenter from "../components/notifications/NotificationsCenter";
import QuickstartPanel from "../components/home/QuickstartPanel";
import ProjectsList from "../components/home/ProjectsList";
import AccountDashboard from "../components/home/AccountDashboard";
import type { LocalProject } from "../components/home/ProjectsList";
import { useAuth } from "../providers/AuthProvider";
import { useProjects } from "../providers/ProjectsProvider";
// CTA is now shown via a popup from the sidebar Account section when not signed in
import { useNotifications } from "../providers/NotificationsProvider";
import { usePortfolioSettings } from "../providers/PortfolioSettingsProvider";
import { auth } from "../lib/firebase";


export default function HomePage() {
	const { user } = useAuth();
	const { projects, hasAny, importProject, selectProject, deleteProject, deleteCloudProjectByCloudId, saveProject, selectedProjectId, cloudMaxProjects, cloudMaxStorageMB, cloudBytesUsed, cloudProjectsCount, recomputeCloudStorageUsage, getCloudProjectTotalSizeByCloudId } = useProjects();
	const { notifications, dismiss, clearAll } = useNotifications();
	const { openSettings, openCreate } = usePortfolioSettings();
	const navigate = useNavigate();
	const cloudPortfolioList = useMemo(() => projects.filter(p => (p as unknown as { storage?: string; _cloudId?: string }).storage === 'cloud' || Boolean((p as unknown as { _cloudId?: string })._cloudId)), [projects]);
	const [accountOpen, setAccountOpen] = useState(false);

	// No popup state needed; CTA is an inline centered section shown only when logged out

	// Important: avoid conditional hook calls; compute recent without hooks
	const recent = projects.slice(0, 6);
	const cloudRemoteCount = useMemo(() => cloudPortfolioList.length, [cloudPortfolioList]);
	const cloudQuota = cloudMaxProjects;
	const usageMb = useMemo(() => ((cloudBytesUsed || 0) / (1024 * 1024)).toFixed(2), [cloudBytesUsed]);
	const [usageMbStr, setUsageMbStr] = useState(usageMb);
	useEffect(() => { setUsageMbStr(usageMb); }, [usageMb]);
	const usagePercent = useMemo(() => {
		if (!cloudMaxStorageMB || cloudMaxStorageMB <= 0) return 0;
		const bytes = cloudMaxStorageMB * 1024 * 1024;
		return Math.min(100, Math.round(((cloudBytesUsed || 0) / bytes) * 100));
	}, [cloudBytesUsed, cloudMaxStorageMB]);
	const projectCountStat = useMemo(() => cloudProjectsCount || cloudRemoteCount, [cloudProjectsCount, cloudRemoteCount]);
	const [notificationsOpen, setNotificationsOpen] = useState(false);
	const [usageRefreshing, setUsageRefreshing] = useState(false);
	const [projectSizes, setProjectSizes] = useState<Record<string, number>>({});
	const unseenCount = useMemo(() => notifications.length, [notifications.length]);
	const [notificationsPulse, setNotificationsPulse] = useState(false);

	useEffect(() => {
		let t: number | null = null;
		if (notificationsOpen) {
			setNotificationsPulse(true);
			t = window.setTimeout(() => setNotificationsPulse(false), 1600);
		}
		return () => { if (t) { clearTimeout(t); } };
	}, [notificationsOpen]);

	// Ensure usage is accurate on mount (and when user changes)
	const recomputeProjectSizes = useCallback(async () => {
		const map: Record<string, number> = {};
		const entries = cloudPortfolioList.slice(0, 5);
		for (const p of entries) {
			const cloudId = (p as any)._cloudId;
			if (!cloudId) { map[p.id] = 0; continue; }
			try { map[p.id] = await getCloudProjectTotalSizeByCloudId(cloudId); } catch { map[p.id] = 0; }
		}
		setProjectSizes(map);
	}, [cloudPortfolioList, getCloudProjectTotalSizeByCloudId]);

	useEffect(() => {
		let mounted = true;
		const run = async () => {
			if (!user) return;
			setUsageRefreshing(true);
			try {
				await recomputeCloudStorageUsage();
				if (mounted) await recomputeProjectSizes();
			} catch (err) {
				console.warn('Failed to recompute cloud storage usage on home mount', err);
			} finally {
				if (mounted) setUsageRefreshing(false);
			}
		};
		void run();
		return () => { mounted = false; };
	}, [user, recomputeCloudStorageUsage, recomputeProjectSizes]);

	useEffect(() => {
		const handler = (_e: any) => {
			try { setNotificationsOpen(v => !v); } catch { /* ignore */ }
		};
		window.addEventListener('py:toggle-notifications', handler as EventListener);
		return () => window.removeEventListener('py:toggle-notifications', handler as EventListener);
	}, []);

	// Also respond to highlight requests specifically for notifications (from other UI)
	useEffect(() => {
		const onHighlight = (_e: any) => {
			try {
				// ensure the center is open, then pulse
				setNotificationsOpen(true);
				setNotificationsPulse(true);
				window.setTimeout(() => setNotificationsPulse(false), 1600);
			} catch { /* ignore */ }
		};
		window.addEventListener('py:highlight-notifications', onHighlight as EventListener);
		return () => window.removeEventListener('py:highlight-notifications', onHighlight as EventListener);
	}, []);

	// Highlight + scroll interop
	const [pulseList, setPulseList] = useState(false);
	const [pulseQuickstart, setPulseQuickstart] = useState(false);
	const [pulseAccount, setPulseAccount] = useState(false);
	const listRef = useRef<HTMLDivElement | null>(null);
	const quickstartRef = useRef<HTMLDivElement | null>(null);
	const accountRef = useRef<HTMLDivElement | null>(null);
	useEffect(() => {
		// timers to track active hide timeouts so we can restart pulses reliably
		const timers: Record<string, number | null> = { list: null, quick: null, acc: null };
		function clearTimer(key: string) {
			const v = timers[key];
			if (typeof v === 'number') { clearTimeout(v); timers[key] = null; }
		}
		const triggerPulse = (setter: (v: boolean) => void, key: 'list' | 'quick' | 'acc', duration = 1600) => {
			// clear any pending hide timer
			clearTimer(key);
			// restart animation by turning it off then on in next frame
			setter(false);
			requestAnimationFrame(() => {
				setter(true);
				timers[key] = window.setTimeout(() => { setter(false); timers[key] = null; }, duration);
			});
		};

		const onReq = () => {
			if (hasAny && recent.length > 0) {
				listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
				triggerPulse(setPulseList, 'list');
			} else {
				quickstartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
				triggerPulse(setPulseQuickstart, 'quick');
			}
		};
		const onAccount = (ev: Event) => {
			const detail = (ev as CustomEvent | undefined)?.detail as unknown;
			// If event originated from Home itself, ignore to avoid double-highlighting
			if (detail && typeof (detail as Record<string, unknown>).origin === 'string' && (detail as Record<string, unknown>).origin === 'home') return;
			accountRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
			triggerPulse(setPulseAccount, 'acc');
		};

		window.addEventListener('py:highlight-request', onReq);
		window.addEventListener('py:highlight-account', onAccount);
		return () => {
			window.removeEventListener('py:highlight-request', onReq);
			window.removeEventListener('py:highlight-account', onAccount);
			// clear timers
			clearTimer('list'); clearTimer('quick'); clearTimer('acc');
		};
	}, [hasAny, recent.length]);


	// Unified layout below handles both empty and non-empty states.

	// recent computed above to keep hook order stable

	const handleRefreshUsage = async () => {
		setUsageRefreshing(true);
		try {
			await recomputeCloudStorageUsage();
			await recomputeProjectSizes();
		} catch (err) {
			console.warn('Failed to recompute usage', err);
		} finally {
			setUsageRefreshing(false);
		}
	};

	const handleOpenProjectFromAccount = (id: string) => {
		try { selectProject(id); } catch { /* ignore */ }
		listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
		// pulse the list
		setPulseList(true);
		window.setTimeout(() => setPulseList(false), 1600);
	};

	// refresh usage when cloud projects count changes
	useEffect(() => {
		try {
			if (user && cloudPortfolioList.length > 0) {
				void recomputeCloudStorageUsage();
				void recomputeProjectSizes();
			}
		} catch { }
	}, [cloudPortfolioList.length, user, recomputeCloudStorageUsage, recomputeProjectSizes]);

	return (
		<div className="home-content space-y-6">
			<Dashboard onToggleNotifications={() => setNotificationsOpen(v => !v)} notifBadge={unseenCount} notificationsOpen={notificationsOpen} />

			{/* Centered CTA under title is now shown inside Dashboard; no extra CTA block here */}
			{/* Notification center area on Home for managing/dismissing persistent notifications */}
			{notificationsOpen && (
				<div className={`relative surface border border-[color:var(--border)] rounded-2xl p-4 shadow-lg shadow-black/20 bg-[color:var(--surface)]/85 ${notificationsPulse ? 'highlight-pulse' : ''}`} style={{ animation: 'py-pop 0.3s ease-out' }}>
					<NotificationsCenter
						notifications={notifications}
						onDismiss={dismiss}
						onClearAll={clearAll}
					/>
				</div>
			)}

			{/* 2nd section: portfolios (local + cloud) and account */}
			{/* Portfolios section */}
			<section>
				<div id="py-list" ref={listRef} className={`surface border border-[color:var(--border)] rounded-2xl p-6 shadow-lg shadow-black/20 portfolio-workspace ${pulseList ? 'highlight-pulse' : ''}`} style={{ animation: 'py-pop 0.4s ease-out' }}>
					<div className="flex flex-col gap-1">
						<p className="section-title">Portfolio workspace</p>
						<p className="text-sm text-[color:var(--fg-muted)]">Create, manage, and load your portfolios in a single workspace.</p>
					</div>
					<div id="py-quickstart" ref={quickstartRef} className={`${pulseQuickstart ? 'highlight-pulse' : ''}`}>
						<QuickstartPanel
							onOpenCreate={() => openCreate()}
							onImport={importProject}
							onSelectProject={(id) => selectProject(id)}
						/>
					</div>
					<ProjectsList
						projects={recent as unknown as LocalProject[]}
						selectedProjectId={selectedProjectId}
						userSignedIn={!!user}
						onSelect={(id) => selectProject(id)}
						onDelete={(id, opts) => deleteProject(id, opts)}
						onDeleteCloud={async (cloudId) => { await deleteCloudProjectByCloudId(cloudId); }}
						onSaveAs={(id) => saveProject(id, { saveAs: true })}
						onOpenFileLocation={async (filePath) => { if (window.api?.showItemInFolder) await window.api.showItemInFolder({ filePath }); }}
						onOpenEditor={(id) => { selectProject(id); navigate('/editor'); }}
						onOpenDeploy={(id) => { selectProject(id); navigate('/deploy'); }}
						onOpenSettings={(id, section) => openSettings({ projectId: id, section })}
					/>
				</div>
			</section>

			{/* Account panel – show only when signed in */}
			{user && (
				<section>
					<div id="py-account" ref={accountRef} className={`${pulseAccount ? 'highlight-pulse' : ''}`}>
						<AccountDashboard
							userDisplay={(user?.email ?? user?.uid) as string}
							usageMB={usageMbStr}
							cloudBytesUsed={cloudBytesUsed}
							maxStorageMB={String(cloudMaxStorageMB || 1024)}
							usagePercent={usagePercent}
							projectCount={projectCountStat}
							projectQuota={cloudQuota}
							onOpenSettings={() => setAccountOpen(true)}
							onRefresh={() => void handleRefreshUsage()}
							refreshing={usageRefreshing}
							cloudProjects={cloudPortfolioList.map(p => ({ id: p.id, name: p.name, updatedAt: p.updatedAt, pageCount: p.pageOrder?.length || Object.keys(p.pages || {}).length }))}
							projectSizes={projectSizes}
							onSelectProject={(id) => handleOpenProjectFromAccount(id)}
							selectedProjectId={selectedProjectId}
							linkedProviders={auth.currentUser?.providerData || []}
						/>
					</div>
				</section>
			)}

			{/* Portfolio settings modal mounted globally */}

			{/* Account settings modal */}
			{user && accountOpen && (
				<AccountSettingsModal open={accountOpen} onClose={() => setAccountOpen(false)} />
			)}
		</div>
	);
}