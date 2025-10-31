import { contextBridge, ipcRenderer } from "electron";

// Safe, minimal API surface exposed to renderer
contextBridge.exposeInMainWorld("api", {
	ping: () => "pong",
	// Save a file to disk (Electron only)
	saveFile: async (options: { defaultPath?: string; data: string }) => {
		return ipcRenderer.invoke("py:saveFile", options);
	},
	// Open a file dialog and read the file contents
	openFileDialog: async (options: { filters?: { name: string; extensions: string[] }[] }) => {
		return ipcRenderer.invoke("py:openFileDialog", options);
	},
		writeFile: async (options: { filePath: string; data: string }) => {
			return ipcRenderer.invoke("py:writeFile", options);
		},
		deleteFile: async (options: { filePath: string }) => {
			return ipcRenderer.invoke("py:deleteFile", options);
		},
		showItemInFolder: async (options: { filePath: string }) => {
			return ipcRenderer.invoke("py:showItemInFolder", options);
		},
		renameFile: async (options: { fromPath: string; toPath: string }) => {
			return ipcRenderer.invoke("py:renameFile", options);
		},
		// Fetch text via main process to bypass renderer CORS restrictions (dev convenience)
		fetchText: async (options: { url: string; headers?: Record<string, string> }) => {
			return ipcRenderer.invoke("py:fetchText", options);
		},
		// Request taskbar/dock attention (flash) for notifications
		flashFrame: async (options?: { durationMs?: number; urgent?: boolean }) => {
			return ipcRenderer.invoke("py:flashFrame", options || {});
		},
		stopFlashFrame: async () => {
			return ipcRenderer.invoke("py:stopFlashFrame");
		},
}); // exposes a safe API to the renderer process


// this file is main process of Electron, started as first thing when the  app starts
// https://www.electronjs.org/docs/latest/api/app

// runs in an isolated context in the renderer process
// prevents giving node access to untrusted content
// https://www.electronjs.org/docs/latest/tutorial/security#2-do-not-enable-nodejs-integration-for-remote-content
