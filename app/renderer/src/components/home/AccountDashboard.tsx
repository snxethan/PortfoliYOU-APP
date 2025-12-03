import React from "react";
import { Settings as SettingsIcon } from "lucide-react";

export default function AccountDashboard({
    userDisplay,
    usageMB,
    maxStorageMB,
    projectCount,
    projectQuota,
    onOpenSettings,
    highlight,
}: {
    userDisplay: string;
    usageMB: string;
    maxStorageMB: string;
    projectCount: number;
    projectQuota: number;
    onOpenSettings: () => void;
    highlight?: boolean;
}) {
    return (
        <div className={`surface border border-[color:var(--border)] rounded-2xl p-4 shadow-lg shadow-black/14 bg-[color:var(--surface)]/80 account-dashboard ${highlight ? 'highlight-pulse' : ''}`}>
            <div className="account-dashboard__header">
                <div className="account-dashboard__identity">
                    <p className="section-title">Account dashboard</p>
                    <p className="text-sm text-[color:var(--fg)] mt-0.5 leading-tight break-words">
                        <span className="font-medium">{userDisplay}</span>
                    </p>
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
        </div>
    );
}
