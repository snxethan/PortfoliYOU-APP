import React, { useState } from "react";
import { Plus, FolderUp, X } from "lucide-react";

export default function QuickstartPanel({
    onCreate,
    onImport,
    onSelectProject,
}: {
    onCreate: (name: string) => Promise<{ id: string } | null | undefined>;
    onImport: () => Promise<{ id: string } | null | undefined>;
    onSelectProject: (id: string) => void;
}) {
    const [mode, setMode] = useState<'default' | 'create'>('default');
    const [name, setName] = useState('');

    return (
        <div className="bg-[color:var(--bg)] border border-[color:var(--border)] rounded-md p-3 mb-4 max-w-xl mx-auto">
            {mode === 'create' ? (
                <div className="flex flex-col sm:flex-row items-start gap-3">
                    <input autoFocus className="input w-full sm:w-80" placeholder="Portfolio name" value={name} onChange={e => setName(e.target.value)} data-testid="portfolio-name-input" />
                    <div className="flex items-center gap-2">
                        <button
                            className="btn btn-primary"
                            onClick={async () => {
                                const p = await onCreate(name.trim());
                                if (p?.id) { onSelectProject(p.id); }
                                setName(''); setMode('default');
                            }}
                            disabled={!name.trim()}
                            data-testid="confirm-create-btn"
                        >Create</button>
                        <button className="btn btn-outline" onClick={() => setMode('default')}><X size={14} /> Cancel</button>
                    </div>
                </div>
            ) : (
                <div className="flex items-center gap-4 justify-center py-1">
                    <button className="btn btn-outline" onClick={() => setMode('create')} data-testid="create-portfolio-btn"><Plus size={14} className="mr-1" /> Create new Portfolio</button>
                    <button className="btn btn-outline" onClick={async () => { const p = await onImport(); if (p?.id) onSelectProject(p.id); }}><FolderUp size={14} className="mr-1" /> Import Existing Portfolio</button>
                </div>
            )}
        </div>
    );
}
