import React, { useState } from "react";
import { FolderUp, Plus } from "lucide-react";

export default function QuickstartPanel({
    onOpenCreate,
    onImport,
    onSelectProject,
}: {
    onOpenCreate: () => void;
    onImport: () => Promise<{ id: string } | null | undefined>;
    onSelectProject: (id: string) => void;
}) {
    const [importing, setImporting] = useState(false);

    return (
        <div className="rounded-2xl border border-dashed border-[color:var(--border)] bg-[color:var(--muted)]/30 p-5">
            <div className="flex flex-col gap-4 text-center">
                <div>
                    <p className="text-xs uppercase tracking-wide text-[color:var(--fg-muted)]">Quickstart</p>
                    <p className="text-xs text-[color:var(--fg-muted)]">Create or import a project to keep building.</p>
                </div>
                <div className="quickstart-row">
                    <button className="btn btn-accent w-full sm:w-auto gap-2 text-base font-semibold shadow-lg shadow-[color:var(--accent)]/25" onClick={onOpenCreate} data-testid="create-portfolio-btn">
                        <Plus size={16} /> New portfolio
                    </button>
                    <button
                        className="btn btn-outline w-full sm:w-auto gap-2 text-base font-semibold shadow-sm"
                        disabled={importing}
                        onClick={async () => {
                            setImporting(true);
                            try {
                                const project = await onImport();
                                if (project?.id) onSelectProject(project.id);
                            } finally {
                                setImporting(false);
                            }
                        }}
                    >
                        <FolderUp size={14} className="mr-1" /> {importing ? 'Importing…' : 'Import existing'}
                    </button>
                </div>
            </div>
        </div>
    );
}
