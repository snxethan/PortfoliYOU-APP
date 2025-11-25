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
        <div className={`surface border border-[color:var(--border)] rounded-2xl p-4 space-y-4 shadow-lg shadow-black/14 bg-[color:var(--surface)]/80 ${highlight ? 'highlight-pulse' : ''}`}>
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[color:var(--muted)]/40 border border-[color:var(--border)] flex items-center justify-center text-sm font-semibold">
                        {userDisplay ? userDisplay.charAt(0).toUpperCase() : "U"}
                    </div>
                    <div>
                        <p className="text-xs uppercase tracking-wide text-[color:var(--fg-muted)]">Account</p>
                        <p className="text-sm text-[color:var(--fg)] mt-0.5 leading-tight truncate max-w-[18rem]">
                            <span className="font-medium">{userDisplay}</span>
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button className="btn btn-sm shadow-sm" onClick={onOpenSettings} title="Manage account">
                        <SettingsIcon size={14} />
                        <span className="ml-2">Manage</span>
                    </button>
                </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--muted)]/40 p-4">
                    <div className="text-xs text-[color:var(--fg-muted)] uppercase tracking-wide">Cloud usage</div>
                    <div className="mt-2 text-lg font-semibold">{usageMB} <span className="text-xs text-[color:var(--fg-muted)]">/ {maxStorageMB} MB</span></div>
                </div>
                <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--muted)]/40 p-4">
                    <div className="text-xs text-[color:var(--fg-muted)] uppercase tracking-wide">Cloud projects</div>
                    <div className="mt-2 text-lg font-semibold">{projectCount} <span className="text-xs text-[color:var(--fg-muted)]">/ {projectQuota}</span></div>
                </div>
            </div>
        </div>
    );
}
