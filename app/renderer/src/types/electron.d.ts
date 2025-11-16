declare global {
  interface Window {
    api?: {
      ping: () => string;
      saveFile: (options: { defaultPath?: string; data: string; encoding?: 'utf8' | 'base64' }) => Promise<{ canceled: boolean; filePath?: string }>;
      saveFileBytes?: (options: { defaultPath?: string; dataBase64: string }) => Promise<{ canceled: boolean; filePath?: string }>;
      openFileDialog: (options: { filters?: { name: string; extensions: string[] }[] }) => Promise<{ canceled: boolean; filePath?: string; data?: string }>;
      openFileDialogBytes?: (options: { filters?: { name: string; extensions: string[] }[] }) => Promise<{ canceled: boolean; filePath?: string; dataBase64?: string; data?: string }>;
      writeFile: (options: { filePath: string; data: string; encoding?: 'utf8' | 'base64' }) => Promise<{ ok: boolean; error?: string }>;
      writeFileBytes?: (options: { filePath: string; dataBase64: string }) => Promise<{ ok: boolean; error?: string }>;
      deleteFile: (options: { filePath: string }) => Promise<{ ok: boolean; error?: string }>;
      showItemInFolder: (options: { filePath: string }) => Promise<{ ok: boolean; error?: string }>;
      renameFile: (options: { fromPath: string; toPath: string }) => Promise<{ ok: boolean; error?: string }>;
      fetchText: (options: { url: string; headers?: Record<string, string> }) => Promise<{ ok: boolean; text?: string; error?: string }>;
      flashFrame: (options?: { durationMs?: number; urgent?: boolean }) => Promise<{ ok: boolean; error?: string }>;
      stopFlashFrame: () => Promise<{ ok: boolean; error?: string }>;
    };
  }
}

export { };