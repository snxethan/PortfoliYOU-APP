import React from "react";

export type PageControlsProps = {
    isCloud: boolean;
    pageOrder: string[];
    pages: Record<string, { title?: string } | undefined>;
    currentPageId: string | null;
    onSelectPage: (id: string | null) => void;
    onCreatePage: () => void;
    onRenameCurrentPage: () => void;
    onDeleteCurrentPage: () => void;
};

export default function PageControls({
    isCloud,
    pageOrder,
    pages,
    currentPageId,
    onSelectPage,
    onCreatePage,
    onRenameCurrentPage,
    onDeleteCurrentPage,
}: PageControlsProps) {
    return (
        <div className="px-4 py-3 border-b border-[color:var(--border)] bg-[color:var(--bg)]">
            <div className="flex items-center justify-center">
                <div className="flex items-center gap-2">
                    <label className="text-xs text-[color:var(--fg-muted)]">Page</label>
                    <select
                        className="input px-2 py-1 text-sm"
                        value={currentPageId || ''}
                        onChange={(e) => {
                            const id = e.target.value || null;
                            onSelectPage(id);
                        }}
                    >
                        {pageOrder.map((pid, i) => {
                            const disabled = isCloud && i >= 10;
                            const title = pages[pid]?.title || 'Untitled';
                            const label = disabled ? `${title} (cloud-unavailable)` : title;
                            return (
                                <option key={pid} value={pid} disabled={disabled}>{label}</option>
                            );
                        })}
                    </select>
                    <button
                        className="btn btn-ghost btn-xs flex items-center gap-1"
                        title="New page"
                        onClick={() => onCreatePage()}
                    >
                        New
                    </button>
                    <button
                        className="btn btn-ghost btn-xs"
                        title="Rename page"
                        onClick={() => onRenameCurrentPage()}
                        disabled={!currentPageId}
                    >
                        Rename
                    </button>
                    <button
                        className="btn btn-ghost btn-xs flex items-center gap-1"
                        title="Delete current page"
                        onClick={() => onDeleteCurrentPage()}
                        disabled={!currentPageId}
                    >
                        Delete
                    </button>
                </div>
            </div>
        </div>
    );
}
