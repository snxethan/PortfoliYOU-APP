import React from "react";
import { Settings as SettingsIcon, Chrome, Github, CheckCircle2, Loader2, RefreshCcw } from "lucide-react";

export default function AccountDashboard({
    userDisplay,
    usageMB,
    cloudBytesUsed,
    maxStorageMB,
    usagePercent = 0,
    onRefresh,
    refreshing = false,
    cloudProjects = [],
    projectSizes = {},
    onSelectProject,
    projectCount,
    projectQuota,
    onOpenSettings,
    linkedProviders,
    selectedProjectId,
}: {
    userDisplay: string;
    usageMB: string;
    cloudBytesUsed?: number;
    maxStorageMB: string;
    usagePercent?: number;
    onRefresh?: () => void;
    refreshing?: boolean;
    cloudProjects?: Array<{ id: string; name?: string; updatedAt?: string; pageCount?: number }>;
    projectSizes?: Record<string, number>;
    onSelectProject?: (id: string) => void;
    projectCount: number;
    projectQuota: number;
    onOpenSettings: () => void;
    linkedProviders?: Array<{ providerId: string; email?: string | null; displayName?: string | null }>;
    selectedProjectId?: string | null;
}) {
    const formatBytes = (value?: number) => {
        if (!value || value <= 0) return "0 B";
        const units = ["B", "KB", "MB", "GB", "TB"];
        const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
        const scaled = value / Math.pow(1024, exponent);
        const decimals = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
        return `${scaled.toFixed(decimals)} ${units[exponent]}`;
    };
    const formatDate = (value?: string | null) => {
        if (!value) return "—";
        try {
            return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
        } catch { return value; }
    };
    const providerIcons: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
        'google.com': Chrome,
        'github.com': Github,
    };

    const providerNames: Record<string, string> = {
        'google.com': 'Google',
        'github.com': 'GitHub',
        'password': 'Email',
    };

    const storageBarClass = usagePercent >= 90 ? 'bg-red-400' : usagePercent >= 50 ? 'bg-amber-400' : 'bg-[color:var(--accent)]';
    const displayUsage = cloudBytesUsed !== undefined ? formatBytes(cloudBytesUsed) : usageMB;
    const cloudProjectItems = cloudProjects.slice(0, 5).map((p) => {
        const isActive = selectedProjectId === p.id;
        return (
            <li key={p.id} onClick={() => { if (onSelectProject) onSelectProject(p.id); }} className={`rounded-xl border px-3 py-3 flex flex-col gap-3 transition cursor-pointer ${isActive ? 'border-[color:var(--accent)] bg-[color:var(--accent)]/5 shadow-lg shadow-[color:var(--accent)]/10' : 'border-[color:var(--border)] bg-[color:var(--muted)]/40 hover-accent'}`}>
                <button className="w-full text-left text-sm font-semibold text-[color:var(--fg)] truncate" onClick={(e) => { e.stopPropagation(); if (onSelectProject) onSelectProject(p.id); }}>
                    {p.name || '(Untitled)'}
                    <div className="text-xs text-[color:var(--fg-muted)] mt-1">Updated {formatDate(p.updatedAt)}</div>
                </button>
                <div className="flex items-center gap-3 text-xs text-[color:var(--fg-muted)]">
                    <div>{p.pageCount || '-'}</div>
                    <div>{projectSizes && projectSizes[p.id] !== undefined ? formatBytes(projectSizes[p.id]) : '-'}</div>
                </div>
            </li>
        );
    });

    return (
        <div className="surface border border-[color:var(--border)] rounded-2xl p-4 shadow-lg shadow-black/20 bg-[color:var(--surface)]/80 account-dashboard transition-all duration-300 ease-in-out" style={{ animation: 'py-pop 0.4s ease-out' }}>
            <div className="account-dashboard__header">
                <div className="account-dashboard__identity">
                    <div className="flex flex-col gap-1">
                        <p className="section-title">Account dashboard</p>
                        <p className="text-sm text-[color:var(--fg-muted)] leading-tight break-words">
                            <span className="font-medium text-[color:var(--fg)]">{userDisplay}</span>
                        </p>
                    </div>
                </div>
                <div className="account-dashboard__actions flex items-center gap-2">
                    <button className="btn btn-ghost btn-sm" onClick={onRefresh} disabled={!onRefresh || refreshing} title="Refresh cloud usage">
                        {refreshing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCcw size={12} />}
                    </button>
                    <button className="btn btn-sm shadow-sm account-dashboard__settings-btn" onClick={onOpenSettings} title="Open account settings">
                        <SettingsIcon size={14} />
                        <span className="ml-2">Account Settings</span>
                    </button>
                </div>
            </div>
            <div className="account-dashboard__stats">
                <div className="account-dashboard__stat">
                    <div className="flex items-center justify-between">
                        <div className="text-xs text-[color:var(--fg-muted)] uppercase tracking-wide">Cloud usage</div>
                        <div>
                            {/* <button className="btn btn-ghost btn-xs" onClick={onRefresh} disabled={!onRefresh || refreshing} title="Refresh cloud usage">
                                {refreshing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCcw size={12} />}
                            </button> */}
                        </div>
                    </div>
                    <div className="mt-2 text-lg font-semibold">{displayUsage} <span className="text-xs text-[color:var(--fg-muted)]">/ {maxStorageMB} MB</span></div>
                    <div className="h-2 rounded-full bg-[color:var(--border)]/60 overflow-hidden mt-2">
                        <div className={`h-full ${storageBarClass}`} style={{ width: `${usagePercent}%` }}></div>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                        <p className="text-xs text-[color:var(--fg-muted)]">Usage updates after each sync or refresh.</p>
                    </div>
                </div>
                <div className="account-dashboard__stat">
                    <div className="text-xs text-[color:var(--fg-muted)] uppercase tracking-wide">Cloud projects</div>
                    <div className="mt-2 text-lg font-semibold">{projectCount} <span className="text-xs text-[color:var(--fg-muted)]">/ {projectQuota}</span></div>
                    {cloudProjects && cloudProjects.length > 0 && (
                        <ul className="mt-3 space-y-2">
                            {cloudProjectItems}
                        </ul>
                    )}
                </div>
            </div>
            {linkedProviders && linkedProviders.length > 0 && (
                <div className="mt-4 border-t border-[color:var(--border)] pt-3">
                    <div className="text-xs text-[color:var(--fg-muted)] uppercase tracking-wide mb-2">Linked Providers</div>
                    <div className="flex flex-wrap gap-2">
                        {linkedProviders.map((provider) => {
                            const Icon = providerIcons[provider.providerId];
                            const name = providerNames[provider.providerId] || provider.providerId;
                            const label = provider.email || provider.displayName || name;
                            return (
                                <div
                                    key={provider.providerId}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)]/60 text-xs"
                                    title={label}
                                >
                                    {Icon && <Icon size={14} />}
                                    <span className="font-medium">{name}</span>
                                    <CheckCircle2 size={12} className="text-emerald-300" />
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
