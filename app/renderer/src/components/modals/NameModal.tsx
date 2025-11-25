import React, { useState } from "react";

export default function NameModal({ title = "Name", confirmLabel = "OK", onCancel, onConfirm }: { title?: string; confirmLabel?: string; onCancel: () => void; onConfirm: (name: string) => void }) {
  const [name, setName] = useState("");

  function submit() {
    const v = name.trim();
    if (v) onConfirm(v);
  }

  return (
    <div className="fixed inset-0 z-[20000] flex items-center justify-center bg-black/50 backdrop-blur-sm" onKeyDown={(e) => { if (e.key === 'Escape') onCancel(); }} tabIndex={-1}>
      <div className="surface p-4 w-full max-w-sm border border-[color:var(--border)] rounded-2xl max-h-[85vh] overflow-auto scrollable scrollable-container" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-header-sticky flex items-start justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button className="btn btn-ghost btn-xs p-1" onClick={onCancel} aria-label="Close"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <input
            className="input w-full mb-4"
            placeholder="Portfolio name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="flex gap-2 justify-end">
            <button type="button" className="btn btn-outline" onClick={onCancel}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={!name.trim()}>{confirmLabel}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
