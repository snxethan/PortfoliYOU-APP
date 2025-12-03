import { useEffect, useMemo, useRef, useState } from "react";
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


export default function HomePage() {
	const { user } = useAuth();
	const { projects, hasAny, importProject, selectProject, deleteProject, deleteCloudProjectByCloudId, saveProject, selectedProjectId, cloudMaxProjects, cloudMaxStorageMB, cloudBytesUsed, cloudProjectsCount } = useProjects();
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
	const projectCountStat = useMemo(() => cloudProjectsCount || cloudRemoteCount, [cloudProjectsCount, cloudRemoteCount]);
	const [notificationsOpen, setNotificationsOpen] = useState(false);
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

	useEffect(() => {
		const handler = (e: any) => {
			try { setNotificationsOpen(v => !v); } catch { /* ignore */ }
		};
		window.addEventListener('py:toggle-notifications', handler as EventListener);
		return () => window.removeEventListener('py:toggle-notifications', handler as EventListener);
	}, []);

	// Also respond to highlight requests specifically for notifications (from other UI)
	useEffect(() => {
		const onHighlight = (e: any) => {
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

	return (
		<div className="home-content space-y-6">
			<Dashboard onToggleNotifications={() => setNotificationsOpen(v => !v)} notifBadge={unseenCount} notificationsOpen={notificationsOpen} />

			{/* Centered CTA under title is now shown inside Dashboard; no extra CTA block here */}
			{/* Notification center area on Home for managing/dismissing persistent notifications */}
			{notificationsOpen && (
				<div className={`relative surface border border-[color:var(--border)] rounded-2xl p-4 shadow-lg bg-[color:var(--surface)]/85 ${notificationsPulse ? 'highlight-pulse' : ''}`}>
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
				<div id="py-list" ref={listRef} className={`surface border border-[color:var(--border)] rounded-2xl p-6 shadow-lg shadow-black/20 portfolio-workspace ${pulseList ? 'highlight-pulse' : ''}`}>
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
					<div id="py-account" ref={accountRef}>
						<AccountDashboard
							userDisplay={(user?.email ?? user?.uid) as string}
							usageMB={usageMb}
							maxStorageMB={String(cloudMaxStorageMB || 1024)}
							projectCount={projectCountStat}
							projectQuota={cloudQuota}
							onOpenSettings={() => setAccountOpen(true)}
							highlight={pulseAccount}
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