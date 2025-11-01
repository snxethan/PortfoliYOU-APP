import React, { useState } from "react";

export default function NameModal({ title = "Name", confirmLabel = "OK", onCancel, onConfirm }: { title?: string; confirmLabel?: string; onCancel: () => void; onConfirm: (name: string) => void }) {
  const [name, setName] = useState("");

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2 className="text-lg font-semibold mb-2">{title}</h2>
        <input
          className="input w-full mb-4"
          placeholder="Portfolio name"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="flex gap-2 justify-end">
          <button className="btn btn-outline" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onConfirm(name.trim())} disabled={!name.trim()}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
