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
        <div className="bg-[color:var(--bg)] border border-[color:var(--border)] rounded-md p-4 mb-4 max-w-xl mx-auto">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button className="btn btn-primary w-full sm:w-auto" onClick={onOpenCreate} data-testid="create-portfolio-btn">
                    <Plus size={14} className="mr-1" /> New portfolio
                </button>
                <button
                    className="btn btn-outline w-full sm:w-auto"
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
    );
}
