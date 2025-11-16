import React, { useState } from "react";

export default function NameModal({ title = "Name", confirmLabel = "OK", onCancel, onConfirm }: { title?: string; confirmLabel?: string; onCancel: () => void; onConfirm: (name: string) => void }) {
  const [name, setName] = useState("");

  function submit() {
    const v = name.trim();
    if (v) onConfirm(v);
  }
  return (
    <div className="modal-overlay" onKeyDown={(e) => { if (e.key === 'Escape') onCancel(); }} tabIndex={-1}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-2">{title}</h2>
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
