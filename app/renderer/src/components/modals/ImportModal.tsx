import React, { useRef } from "react";

export default function ImportModal({ onImport, onClose }: { onImport: (file: File) => void; onClose: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      onImport(file);
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-[20000] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose} role="dialog" aria-modal="true">
      <div className="surface p-4 w-full max-w-md border border-[color:var(--border)] rounded-2xl max-h-[85vh] overflow-auto scrollable scrollable-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header-sticky flex items-start justify-between">
          <h2 className="text-lg font-semibold">Import .portfoliyou File</h2>
          <button className="btn btn-ghost btn-xs p-1" onClick={onClose} aria-label="Close"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".portfoliyou,application/json"
          onChange={handleFileChange}
          className="mb-4"
        />
        <div className="flex gap-2">
          <button className="btn btn-primary" onClick={() => fileInputRef.current?.click()}>Choose File</button>
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
