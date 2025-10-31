declare global {
  interface Window {
    api?: {
      ping: () => string;
      saveFile: (options: { defaultPath?: string; data: string }) => Promise<{ canceled: boolean; filePath?: string }>;
      openFileDialog: (options: { filters?: { name: string; extensions: string[] }[] }) => Promise<{ canceled: boolean; filePath?: string; data?: string }>;
      writeFile: (options: { filePath: string; data: string }) => Promise<{ ok: boolean; error?: string }>;
      deleteFile: (options: { filePath: string }) => Promise<{ ok: boolean; error?: string }>;
      showItemInFolder: (options: { filePath: string }) => Promise<{ ok: boolean; error?: string }>;
      renameFile: (options: { fromPath: string; toPath: string }) => Promise<{ ok: boolean; error?: string }>;
      fetchText: (options: { url: string; headers?: Record<string, string> }) => Promise<{ ok: boolean; text?: string; error?: string }>;
    };
  }
}

export {};