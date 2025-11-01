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
    <div className="modal-overlay">
      <div className="modal">
        <h2 className="text-lg font-semibold mb-2">Import .portfoliyou File</h2>
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
