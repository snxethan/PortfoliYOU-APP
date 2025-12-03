import React from "react";
import { Settings as SettingsIcon, Chrome, Github, CheckCircle2 } from "lucide-react";

export default function AccountDashboard({
    userDisplay,
    usageMB,
    maxStorageMB,
    projectCount,
    projectQuota,
    onOpenSettings,
    linkedProviders,
}: {
    userDisplay: string;
    usageMB: string;
    maxStorageMB: string;
    projectCount: number;
    projectQuota: number;
    onOpenSettings: () => void;
    linkedProviders?: Array<{ providerId: string; email?: string | null; displayName?: string | null }>;
}) {
    const providerIcons: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
        'google.com': Chrome,
        'github.com': Github,
    };

    const providerNames: Record<string, string> = {
        'google.com': 'Google',
        'github.com': 'GitHub',
        'password': 'Email',
    };

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
                <div className="account-dashboard__actions">
                    <button className="btn btn-sm shadow-sm account-dashboard__settings-btn" onClick={onOpenSettings} title="Open account settings">
                        <SettingsIcon size={14} />
                        <span className="ml-2">Account Settings</span>
                    </button>
                </div>
            </div>
            <div className="account-dashboard__stats">
                <div className="account-dashboard__stat">
                    <div className="text-xs text-[color:var(--fg-muted)] uppercase tracking-wide">Cloud usage</div>
                    <div className="mt-2 text-lg font-semibold">{usageMB} <span className="text-xs text-[color:var(--fg-muted)]">/ {maxStorageMB} MB</span></div>
                </div>
                <div className="account-dashboard__stat">
                    <div className="text-xs text-[color:var(--fg-muted)] uppercase tracking-wide">Cloud projects</div>
                    <div className="mt-2 text-lg font-semibold">{projectCount} <span className="text-xs text-[color:var(--fg-muted)]">/ {projectQuota}</span></div>
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
