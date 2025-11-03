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
        <div className={`surface p-5 ${highlight ? 'highlight-pulse' : ''}`}>
            <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-center flex-1 uppercase tracking-wide">ACCOUNT DASHBOARD</h3>
                <button className="btn btn-ghost btn-xs" title="Account settings" onClick={onOpenSettings}>
                    <SettingsIcon size={14} />
                </button>
            </div>
            <div className="text-sm text-center "><span className="font-mono">{userDisplay}</span></div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div className="surface p-3 bg-[color:var(--muted)]/40 border border-[color:var(--border)] rounded-md">
                    <div className="text-xs text-[color:var(--fg-muted)]">Cloud usage</div>
                    <div className="mt-1 font-semibold">{usageMB} / {maxStorageMB} MB</div>
                </div>
                <div className="surface p-3 bg-[color:var(--muted)]/40 border border-[color:var(--border)] rounded-md">
                    <div className="text-xs text-[color:var(--fg-muted)]">Cloud projects</div>
                    <div className="mt-1 font-semibold">{projectCount} / {projectQuota}</div>
                </div>
            </div>
        </div>
    );
}
