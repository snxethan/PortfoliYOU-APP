import React, { useMemo, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { unlink } from "firebase/auth";
import {
    AlertTriangle,
    ChevronDown,
    ChevronRight,
    Chrome,
    Cloud,
    Copy,
    Download,
    ExternalLink,
    Github,
    HardDrive,
    Link2,
    Loader2,
    RefreshCcw,
    Shield,
    Trash2,
    X
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { auth } from "../../lib/firebase";
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useAuth } from "../../providers/AuthProvider";
import { useNotifications } from "../../providers/NotificationsProvider";
import { useProjects } from "../../providers/ProjectsProvider";
import { useScrollLock } from "../../hooks/useScrollLock";

const ACCOUNT_PORTAL_BASE = "https://portfoliyou.snxethan.dev";
type SectionKey = "account" | "providers" | "cloud";
type CloudActionKind = "export" | "delete" | "copy";

type ProviderCard = {
    key: "google" | "github";
    providerId: string;
    label: string;
    description: string;
    linkPath: string;
    icon: LucideIcon;
};

const PROVIDERS: ProviderCard[] = [
    {
        key: "google",
        providerId: "google.com",
        label: "Google",
        description: "Link your Google identity for one-click sign-in across desktop and web.",
        linkPath: "/account/providers/google/link",
        icon: Chrome
    },
    {
        key: "github",
        providerId: "github.com",
        label: "GitHub",
        description: "Use your GitHub profile to authenticate and sync developer projects.",
        linkPath: "/account/providers/github/link",
        icon: Github
    }
];

const providerFriendlyNames: Record<string, string> = {
    password: "Email & password",
    "google.com": "Google",
    "github.com": "GitHub"
};

const formatDate = (value?: string | null) => {
    if (!value) return "—";
    try {
        return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
    } catch {
        return value;
    }
};

const formatBytes = (value?: number) => {
    if (!value || value <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
    const scaled = value / Math.pow(1024, exponent);
    const decimals = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
    return `${scaled.toFixed(decimals)} ${units[exponent]}`;
};

export default function AccountSettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
    useScrollLock(open);

    const { user } = useAuth();
    const { add: notify } = useNotifications();
    const {
        projects,
        exportProject,
        deleteCloudProjectByCloudId,
        importProjectFromCloudLocalOnly,
        cloudMaxProjects,
        cloudMaxStorageMB,
        cloudBytesUsed,
        cloudProjectsCount,
        recomputeCloudStorageUsage,
        getCloudProjectTotalSizeByCloudId,
    } = useProjects();
    const [refreshVersion, setRefreshVersion] = useState(0);
    const [linkingKey, setLinkingKey] = useState<string | null>(null);
    const [unlinkingKey, setUnlinkingKey] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [deletingAccount, setDeletingAccount] = useState(false);
    const [expandedSections, setExpandedSections] = useState<Record<SectionKey, boolean>>({
        account: true,
        providers: true,
        cloud: true
    });
    const [cloudAction, setCloudAction] = useState<{ id: string; kind: CloudActionKind } | null>(null);
    const deleteAccountUrl = `${ACCOUNT_PORTAL_BASE}/account/delete`;

    const currentUser = useMemo(() => auth.currentUser ?? user, [user, refreshVersion]);
    const providerData = useMemo(() => currentUser?.providerData || [], [currentUser]);
    const providerIds = useMemo(() => new Set(providerData.map((p) => p.providerId)), [providerData]);
    const totalProviders = providerData.length;
    const cloudProjects = useMemo(() => {
        return projects
            .filter((project) => (project.storage ?? "local") === "cloud")
            .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
    }, [projects]);
    const [projectSizes, setProjectSizes] = useState<Record<string, number>>({});
    // compute per-project sizes on change
    useEffect(() => {
        let mounted = true;
        const run = async () => {
            const next: Record<string, number> = {};
            // Use provider's function to compute per-cloud size (available from top-level destructure)
            for (const p of cloudProjects) {
                try {
                    const id = p._cloudId || p.id;
                    const size = await getCloudProjectTotalSizeByCloudId(id);
                    if (!mounted) return;
                    next[p.id] = size;
                } catch { /* ignore per-project */ }
            }
            if (mounted) setProjectSizes(next);
        };
        void run();
        return () => { mounted = false; };
    }, [cloudProjects, getCloudProjectTotalSizeByCloudId, refreshVersion]);
    const storageLimitBytes = Math.max(cloudMaxStorageMB || 0, 0) * 1024 * 1024;
    const storageUsagePercent = storageLimitBytes > 0 && cloudBytesUsed > 0 ? Math.min(100, Math.round((cloudBytesUsed / storageLimitBytes) * 100)) : 0;
    const storageUsageLabel = storageLimitBytes > 0 ? `${formatBytes(cloudBytesUsed)} / ${cloudMaxStorageMB} MB` : `${formatBytes(cloudBytesUsed)} used`;
    const normalizedProjectCap = cloudMaxProjects && cloudMaxProjects > 0 ? cloudMaxProjects : 0;
    const reachedProjectLimit = normalizedProjectCap > 0 && cloudProjectsCount >= normalizedProjectCap;
    const projectUsageLabel = normalizedProjectCap ? `${Math.min(cloudProjectsCount, normalizedProjectCap)} / ${normalizedProjectCap}` : `${cloudProjectsCount}`;
    const storageBarClass = storageUsagePercent >= 90 ? 'bg-red-400' : storageUsagePercent >= 50 ? 'bg-amber-400' : 'bg-[color:var(--accent)]';

    const toggleSection = (key: SectionKey) => setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
    const runCloudAction = async (id: string, kind: CloudActionKind, action: () => Promise<void>) => {
        setCloudAction({ id, kind });
        try {
            await action();
        } finally {
            setCloudAction((prev) => (prev && prev.id === id && prev.kind === kind ? null : prev));
        }
    };

    const handleCloudExport = async (projectId: string, projectName: string) => {
        try {
            await runCloudAction(projectId, "export", async () => {
                await exportProject(projectId);
            });
            notify({ type: "success", message: `Saved ${projectName || "portfolio"} locally.`, persistent: false });
        } catch {
            notify({ type: "error", message: `Couldn't export ${projectName || "portfolio"}.`, persistent: false });
        }
    };

    const handleCloudCopy = async (projectId: string, cloudId: string | undefined, projectName: string) => {
        if (!cloudId) {
            notify({ type: "error", message: "Cloud ID missing for this project.", persistent: false });
            return;
        }
        try {
            await runCloudAction(projectId, "copy", async () => {
                const result = await importProjectFromCloudLocalOnly(cloudId);
                if (!result) throw new Error("copy-failed");
            });
            notify({ type: "success", message: `${projectName || "Portfolio"} copied to local projects.`, persistent: false });
        } catch {
            notify({ type: "error", message: `Couldn't copy ${projectName || "portfolio"} locally.`, persistent: false });
        }
    };

    const handleCloudDelete = async (projectId: string, cloudId: string | undefined, projectName: string) => {
        if (!cloudId) {
            notify({ type: "error", message: "Cloud ID missing for this project.", persistent: false });
            return;
        }
        const confirmed = window.confirm(`Delete cloud portfolio "${projectName || "Untitled"}"? This cannot be undone.`);
        if (!confirmed) return;
        try {
            await runCloudAction(projectId, "delete", async () => {
                const ok = await deleteCloudProjectByCloudId(cloudId);
                if (!ok) throw new Error("delete-failed");
            });
            notify({ type: "success", message: `${projectName || "Portfolio"} removed from cloud.`, persistent: false });
        } catch {
            notify({ type: "error", message: `Couldn't delete ${projectName || "portfolio"}.`, persistent: false });
        }
    };

    if (!open) return null;

    const setSnapshot = () => setRefreshVersion((v) => v + 1);

    const openExternal = async (url: string) => {
        try {
            if (window.api?.openExternal) {
                await window.api.openExternal({ url });
            } else {
                window.open(url, "_blank", "noopener,noreferrer");
            }
        } catch {
            window.open(url, "_blank", "noopener,noreferrer");
        }
    };

    const buildProviderUrl = async (card: ProviderCard) => {
        const params = new URLSearchParams({ source: "desktop-app", provider: card.key });
        try {
            if (currentUser) {
                const token = await currentUser.getIdToken(true);
                if (token) params.set("token", token);
                params.set("uid", currentUser.uid);
            }
        } catch {
            /* ignore token failures */
        }
        return `${ACCOUNT_PORTAL_BASE}${card.linkPath}?${params.toString()}`;
    };

    const refreshProviders = async () => {
        if (!auth.currentUser) return;
        setRefreshing(true);
        try {
            await auth.currentUser.reload();
            setSnapshot();
            notify({ type: "success", message: "Linked accounts refreshed.", persistent: false });
        } catch {
            notify({ type: "error", message: "Failed to refresh account. Try again.", persistent: false });
        } finally {
            setRefreshing(false);
        }
    };

    const handleLinkProvider = async (card: ProviderCard) => {
        if (!currentUser) {
            notify({ type: "error", message: "Sign in to manage providers.", persistent: false });
            return;
        }
        setLinkingKey(card.key);
        try {
            const url = await buildProviderUrl(card);
            await openExternal(url);
            notify({ type: "info", title: `${card.label} linking`, message: "Finish the OAuth flow in your browser, then return and refresh status.", persistent: false });
        } catch {
            notify({ type: "error", message: `Couldn't open ${card.label} linking portal.`, persistent: false });
        } finally {
            setLinkingKey(null);
        }
    };

    const handleUnlinkProvider = async (card: ProviderCard) => {
        const activeUser = auth.currentUser;
        if (!activeUser) {
            notify({ type: "error", message: "Sign in to manage providers.", persistent: false });
            return;
        }
        if (!providerIds.has(card.providerId)) {
            notify({ type: "warning", message: `${card.label} is not currently linked.`, persistent: false });
            return;
        }
        if (providerData.length <= 1) {
            notify({ type: "warning", message: "Add another sign-in method before unlinking this one.", persistent: false });
            return;
        }
        setUnlinkingKey(card.key);
        try {
            await unlink(activeUser, card.providerId);
            await activeUser.reload();
            setSnapshot();
            notify({ type: "success", message: `${card.label} unlinked.`, persistent: false });
        } catch {
            notify({ type: "error", message: `Couldn't unlink ${card.label}.`, persistent: false });
        } finally {
            setUnlinkingKey(null);
        }
    };

    const handleDeleteAccount = async () => {
        if (!auth.currentUser) { notify({ type: 'error', message: 'Sign in to delete account.', persistent: false }); return; }
        const confirmed = window.confirm('Delete your account? This will permanently remove all portfolios, assets, and account data. This cannot be undone. Continue?');
        if (!confirmed) return;
        // Extra: require typed confirmation to avoid accidental deletes
        const typed = window.prompt('Type DELETE to confirm permanent deletion. This cannot be undone.');
        if (!typed || typed.trim().toUpperCase() !== 'DELETE') {
            notify({ type: 'warn', message: 'Account deletion cancelled: typed confirmation failed.', persistent: false });
            return;
        }
        setDeletingAccount(true);
        try {
            const fn = httpsCallable(getFunctions(undefined, 'us-central1'), 'deleteAccount');
            const res = await fn({});
            if (res?.data && (res.data as any).ok) {
                try { notify({ type: 'success', message: 'Account deleted. Signing out…', persistent: false }); } catch { }
                // Sign out locally and close modal
                try { await auth.signOut(); } catch { }
                onClose();
            } else {
                notify({ type: 'error', message: 'Failed to delete account.', persistent: false });
            }
        } catch (err) {
            console.error('delete account failed', err);
            notify({ type: 'error', message: 'Failed to delete account. Try again later.', persistent: false });
        } finally {
            setDeletingAccount(false);
        }
    };

    const renderSection = (key: SectionKey, title: string, status?: string, children?: React.ReactNode) => (
        <div className="border border-[color:var(--border)] rounded-md">
            <button
                type="button"
                className="w-full flex items-center justify-between px-3 py-2 text-left"
                onClick={() => toggleSection(key)}
            >
                <div className="flex items-center gap-2">
                    {expandedSections[key] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <span className="text-sm font-semibold uppercase tracking-wide">{title}</span>
                </div>
                {status && <span className="text-[10px] uppercase tracking-wide text-[color:var(--fg-muted)]">{status}</span>}
            </button>
            {expandedSections[key] && (
                <div className="border-t border-[color:var(--border)] bg-[color:var(--muted)]/20 p-4 space-y-3 animate-[py-fade-in_0.2s_ease-out]">
                    {children}
                </div>
            )}
        </div>
    );

    const renderAccountSection = () => {
        if (!currentUser) {
            return (
                <div className="rounded-2xl border border-dashed border-[color:var(--border)] p-4 text-sm text-[color:var(--fg-muted)]">
                    Sign in to view account metadata, manage security resources, and delete your profile.
                </div>
            );
        }
        const primaryProviderId = currentUser.providerData?.[0]?.providerId || "password";
        const primaryProvider = providerFriendlyNames[primaryProviderId] || primaryProviderId;
        const displayName = currentUser.displayName?.trim() || currentUser.email || "Signed-in user";
        const identityLabel = currentUser.email || currentUser.uid;
        const verified = currentUser.emailVerified;
        const verificationClass = verified ? "text-emerald-300" : "text-amber-200";
        return (
            <div className="space-y-3">
                <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)]/60 p-4 space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <p className="text-sm font-semibold">{displayName}</p>
                            <p className="text-xs text-[color:var(--fg-muted)]">{identityLabel}</p>
                        </div>
                        <span className={`text-xs font-semibold uppercase tracking-wide ${verificationClass}`}>
                            {verified ? "Verified" : "Unverified"}
                        </span>
                    </div>
                    {!verified && (
                        <div className="flex items-center gap-2 rounded-md border border-amber-200/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100">
                            <AlertTriangle size={14} />
                            <span>Verify your email to sync safely across desktop and web.</span>
                        </div>
                    )}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--fg-muted)]">
                        <span>Primary method:</span>
                        <span className="font-semibold text-[color:var(--fg)]">{primaryProvider}</span>
                        <span className="mx-2 h-3 w-px bg-[color:var(--border)]" aria-hidden="true"></span>
                        <span>{totalProviders} linked</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        <div className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface)]/60 p-3">
                            <p className="text-xs uppercase tracking-wide text-[color:var(--fg-muted)]">Created</p>
                            <p className="font-medium mt-1">{formatDate(currentUser.metadata?.creationTime)}</p>
                        </div>
                        <div className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface)]/60 p-3">
                            <p className="text-xs uppercase tracking-wide text-[color:var(--fg-muted)]">Last sign-in</p>
                            <p className="font-medium mt-1">{formatDate(currentUser.metadata?.lastSignInTime)}</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button className="btn btn-ghost btn-sm" disabled title="Coming soon">
                            <ExternalLink size={14} />
                            <span className="ml-2">Privacy FAQ</span>
                        </button>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--muted)]/20 p-4 space-y-2">
                        <p className="section-title">Security resources</p>
                        <p className="text-sm text-[color:var(--fg-muted)]">Review session history, retention policies, and best practices.</p>
                        <button className="btn btn-ghost btn-sm" disabled title="Coming soon">
                            <Shield size={14} />
                            <span className="ml-2">Privacy & security portal</span>
                        </button>
                    </div>
                    <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--muted)]/20 p-4 space-y-2">
                        <p className="section-title">Account help</p>
                        <p className="text-sm text-[color:var(--fg-muted)]">Browse FAQs for syncing, quotas, billing, and troubleshooting.</p>
                        <button className="btn btn-ghost btn-sm" disabled title="Coming soon">
                            <ExternalLink size={14} />
                            <span className="ml-2">Visit help center</span>
                        </button>
                    </div>
                </div>
                <div className="rounded-lg border border-red-500/40 bg-red-500/5 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-red-200">
                        <Trash2 size={16} />
                        <span>Delete account</span>
                    </div>
                    <p className="text-sm text-red-100">Permanently remove your account, synced portfolios, and cloud assets. This action cannot be undone.</p>
                    <button className="btn btn-error btn-sm" onClick={async () => { if (!deletingAccount) { await handleDeleteAccount(); } }} disabled={deletingAccount}>
                        {deletingAccount ? <Loader2 size={14} className="animate-spin" /> : 'Delete my account'}
                    </button>
                </div>
            </div>
        );
    };

    const renderProvidersSection = () => (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-[color:var(--fg-muted)]">Link OAuth providers for one-click sign-in across desktop and web.</p>
                <button className="btn btn-ghost btn-xs" onClick={refreshProviders} disabled={refreshing}>
                    {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
                    <span className="ml-2">Refresh</span>
                </button>
            </div>
            <div className="grid grid-cols-1 gap-3">
                {PROVIDERS.map((card) => {
                    const Icon = card.icon;
                    const isLinked = providerIds.has(card.providerId);
                    const linking = linkingKey === card.key;
                    const unlinking = unlinkingKey === card.key;
                    const isComingSoon = card.key === 'github';
                    return (
                        <div key={card.key} className={`rounded-lg border border-[color:var(--border)] p-4 space-y-3 ${isComingSoon ? 'bg-[color:var(--surface)]/30 opacity-60' : 'bg-[color:var(--surface)]/60'}`}>
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <div className="w-10 h-10 rounded-full bg-[color:var(--muted)]/40 border border-[color:var(--border)] flex items-center justify-center flex-shrink-0">
                                        <Icon size={18} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-semibold">{card.label}</p>
                                        <p className="text-xs text-[color:var(--fg-muted)]">{card.description}</p>
                                        {isLinked && (() => {
                                            const linkedAccount = providerData.find(p => p.providerId === card.providerId);
                                            return linkedAccount?.email || linkedAccount?.displayName ? (
                                                <p className="text-xs text-[color:var(--accent)] mt-1 truncate" title={linkedAccount.email || linkedAccount.displayName || ''}>
                                                    {linkedAccount.email || linkedAccount.displayName}
                                                </p>
                                            ) : null;
                                        })()}
                                    </div>
                                </div>
                                <span className={`text-xs font-semibold uppercase tracking-wide flex-shrink-0 ${isComingSoon ? "text-[color:var(--fg-muted)]" : isLinked ? "text-emerald-300" : "text-[color:var(--fg-muted)]"}`}>
                                    {isComingSoon ? "Coming Soon" : isLinked ? "Linked" : "Not linked"}
                                </span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {isComingSoon ? (
                                    <p className="text-xs text-[color:var(--fg-muted)]">OAuth integration coming soon</p>
                                ) : isLinked ? (
                                    <>
                                        <button className="btn btn-outline btn-sm" onClick={() => handleUnlinkProvider(card)} disabled={unlinking}>
                                            {unlinking ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                            <span className="ml-2">Unlink</span>
                                        </button>
                                        <button className="btn btn-ghost btn-sm" disabled title="Coming soon">
                                            <Link2 size={14} />
                                            <span className="ml-2">Manage in browser</span>
                                        </button>
                                    </>
                                ) : (
                                    <button className="btn btn-primary btn-sm" onClick={() => handleLinkProvider(card)} disabled={linking}>
                                        {linking ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
                                        <span className="ml-2">Link {card.label}</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );

    const renderCloudSection = () => {
        if (!user) {
            return (
                <div className="rounded-lg border border-dashed border-[color:var(--border)] p-4 text-sm text-[color:var(--fg-muted)]">
                    Sign in to view cloud usage, quotas, and synced portfolios.
                </div>
            );
        }
        return (
            <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)]/60 p-4 space-y-2">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="section-title">Cloud projects</p>
                                <p className="text-xl font-semibold">{projectUsageLabel}</p>
                            </div>
                            <Cloud size={20} />
                        </div>
                        <p className={`text-xs ${reachedProjectLimit ? "text-red-300" : "text-[color:var(--fg-muted)]"}`}>
                            {normalizedProjectCap ? (reachedProjectLimit ? "Limit reached" : `${normalizedProjectCap - cloudProjectsCount} slots remaining`) : "Unlimited plan"}
                        </p>
                    </div>
                    <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)]/60 p-4 space-y-2">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="section-title">Cloud usage</p>
                                <p className="text-xl font-semibold">{storageUsageLabel}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button className="btn btn-ghost btn-xs" onClick={async () => { setRefreshing(true); try { await recomputeCloudStorageUsage(); setRefreshVersion(v => v + 1); } finally { setRefreshing(false); } }} disabled={refreshing}>
                                    {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
                                </button>
                                <HardDrive size={20} />
                            </div>
                        </div>
                        {storageLimitBytes > 0 && (
                            <div className="h-2 rounded-full bg-[color:var(--border)]/60 overflow-hidden">
                                <div className={`h-full ${storageBarClass}`} style={{ width: `${storageUsagePercent}%` }}></div>
                            </div>
                        )}
                        <p className="text-xs text-[color:var(--fg-muted)]">Usage updates after each sync.</p>
                    </div>
                </div>
                <div className="space-y-3">
                    <p className="section-title">Cloud project list</p>
                    {cloudProjects.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-[color:var(--border)] p-4 text-sm text-[color:var(--fg-muted)]">
                            No cloud portfolios yet. Sync a local project from Portfolio Settings → Build to send it here.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {cloudProjects.map((project) => {
                                const projectName = project.name || "Untitled portfolio";
                                const cloudId = project._cloudId || project.id;
                                const isBusy = cloudAction?.id === project.id;
                                const isBusyKind = (kind: CloudActionKind) => isBusy && cloudAction?.kind === kind;
                                const pageCount = Array.isArray(project.pageOrder) && project.pageOrder.length > 0 ? project.pageOrder.length : Object.keys(project.pages || {}).length;
                                const totalBytes = projectSizes[project.id] || 0;
                                const totalLabel = formatBytes(totalBytes);
                                return (
                                    <div key={project.id} className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)]/60 p-4 space-y-3 hover-accent transition cursor-pointer">
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold">{projectName}</p>
                                                <p className="text-xs text-[color:var(--fg-muted)]">Updated {formatDate(project.updatedAt)}</p>
                                                <p className="text-xs text-[color:var(--fg-muted)]">Storage: {totalLabel}</p>
                                            </div>
                                            <span className="text-xs text-[color:var(--fg-muted)]">{pageCount} pages</span>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                className="btn btn-ghost btn-xs hover-accent transition"
                                                disabled={isBusy}
                                                onClick={() => handleCloudExport(project.id, projectName)}
                                            >
                                                {isBusyKind("export") ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                                                <span className="ml-2">{isBusyKind("export") ? "Saving…" : "Save file"}</span>
                                            </button>
                                            {/* Save local copy button removed — 'Save file' handles saving to local disk */}
                                            <button
                                                className="btn btn-ghost btn-xxs text-red-400 border border-red-500/40 hover:bg-red-500/10 hover-accent transition"
                                                disabled={isBusy}
                                                onClick={() => handleCloudDelete(project.id, cloudId, projectName)}
                                            >
                                                {isBusyKind("delete") ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                                <span>{isBusyKind("delete") ? "Deleting…" : "Delete"}</span>
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const accountStatus = currentUser ? (currentUser.emailVerified ? "Verified" : "Unverified") : "Sign in";
    const providersStatus = totalProviders > 0 ? `${totalProviders} linked` : "None linked";
    const cloudStatus = !user ? "Sign in" : `${cloudProjectsCount || 0} projects`;

    const content = (
        <div
            className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/60 backdrop-blur"
            onClick={onClose}
            onKeyDown={(e) => {
                if (e.key === "Escape") onClose();
            }}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
        >
            <div
                className="surface w-full max-w-2xl border border-[color:var(--border)] rounded-md shadow-2xl"
                style={{ animation: 'py-pop 0.25s ease-out' }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-4 py-3 border-b border-[color:var(--border)]">
                    <div>
                        <h2 className="text-lg font-semibold">Account settings</h2>
                        <p className="text-xs text-[color:var(--fg-muted)]">Align identity, providers, and cloud usage.</p>
                    </div>
                    <button className="btn btn-ghost btn-xs" onClick={onClose} aria-label="Close">
                        <X size={14} />
                    </button>
                </div>
                <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
                    {renderSection("account", "Account", accountStatus, renderAccountSection())}
                    {renderSection("providers", "Providers", providersStatus, renderProvidersSection())}
                    {renderSection("cloud", "Cloud", cloudStatus, renderCloudSection())}
                </div>
                <div className="flex items-center justify-end gap-3 px-4 py-3 border-t border-[color:var(--border)] bg-[color:var(--surface)]/80" aria-hidden="true"></div>
            </div>
        </div>
    );

    try {
        return createPortal(content, document.body);
    } catch {
        return content;
    }
}
