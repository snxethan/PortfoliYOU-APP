import { contextBridge, ipcRenderer } from "electron";

// Safe, minimal API surface exposed to renderer
contextBridge.exposeInMainWorld("api", {
	ping: () => "pong",
	// Save a file to disk (Electron only)
	saveFile: async (options: { defaultPath?: string; data: string; encoding?: 'utf8' | 'base64' }) => {
		return ipcRenderer.invoke("py:saveFile", options);
	},
	// Save a binary file (base64-encoded) to disk
	saveFileBytes: async (options: { defaultPath?: string; dataBase64: string }) => {
		return ipcRenderer.invoke("py:saveFileBytes", options);
	},
	// Open a file dialog and read the file contents
	openFileDialog: async (options: { filters?: { name: string; extensions: string[] }[] }) => {
		return ipcRenderer.invoke("py:openFileDialog", options);
	},
	// Open a folder picker and return selected directory
	openFolderDialog: async () => {
		return ipcRenderer.invoke("py:openFolderDialog");
	},
	openPath: async (options: { path: string }) => {
		return ipcRenderer.invoke('py:openPath', options);
	},
	// Open a file dialog and read the file as base64 bytes
	openFileDialogBytes: async (options: { filters?: { name: string; extensions: string[] }[] }) => {
		return ipcRenderer.invoke("py:openFileDialogBytes", options);
	},
	writeFile: async (options: { filePath: string; data: string; encoding?: 'utf8' | 'base64' }) => {
		return ipcRenderer.invoke("py:writeFile", options);
	},
	// Write bytes (base64) directly to file
	writeFileBytes: async (options: { filePath: string; dataBase64: string }) => {
		return ipcRenderer.invoke("py:writeFileBytes", options);
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
	// Build static site from project JSON + assets (assets base64 map)
	buildStaticSite: async (options: { project: unknown; assets: Record<string, string>; outputDir?: string }) => {
		return ipcRenderer.invoke('py:buildStaticSite', options || {});
	},
	// Zip a directory and return base64 ZIP
	zipDir: async (options: { dir: string }) => {
		return ipcRenderer.invoke('py:zipDir', options || {});
	},
	// Embed a built folder (dist-site) into a PortfoliYOU project archive
	embedDistIntoProject: async (options: { projectFilePath?: string; distDir?: string; defaultName?: string }) => {
		return ipcRenderer.invoke('py:embedDistIntoProject', options || {});
	},
	// Resolve a .portfoliyou file for a given path (file or directory)
	findProjectFile: async (options: { path?: string }) => {
		return ipcRenderer.invoke('py:findProjectFile', options || {});
	},
	stopFlashFrame: async () => {
		return ipcRenderer.invoke("py:stopFlashFrame");
	},
	// Window controls
	windowMinimize: async () => {
		return ipcRenderer.invoke('py:window:minimize');
	},
	windowMaximize: async () => {
		return ipcRenderer.invoke('py:window:maximize');
	},
	windowUnmaximize: async () => {
		return ipcRenderer.invoke('py:window:unmaximize');
	},
	windowToggleMaximize: async () => {
		return ipcRenderer.invoke('py:window:toggleMaximize');
	},
	windowIsMaximized: async () => {
		return ipcRenderer.invoke('py:window:isMaximized');
	},
	windowClose: async () => {
		return ipcRenderer.invoke('py:window:close');
	},
	openDevTools: async (options?: { mode?: 'right' | 'bottom' | 'undocked' }) => {
		return ipcRenderer.invoke('py:window:openDevTools', options || {});
	},
	toggleDevTools: async () => {
		return ipcRenderer.invoke('py:window:toggleDevTools');
	},
	// Subscribe to window events emitted by main (returns an unsubscribe function)
	onWindowEvent: (eventName: string, cb: (data: unknown) => void) => {
		const allowed = ['window-maximize', 'window-unmaximize', 'window-move-top', 'window-maximize-state'];
		if (!allowed.includes(eventName)) return () => { };
		const handler = (_: Electron.IpcRendererEvent, data: unknown) => cb(data);
		ipcRenderer.on(eventName, handler as unknown as (...args: unknown[]) => void);
		return () => { ipcRenderer.removeListener(eventName, handler as unknown as (...args: unknown[]) => void); };
	},
	// Clipboard
	clipboardWrite: async (options: { text: string }) => {
		return ipcRenderer.invoke('py:clipboardWrite', options);
	},
	clipboardRead: async () => {
		return ipcRenderer.invoke('py:clipboardRead');
	},
}); // exposes a safe API to the renderer process


// this file is main process of Electron, started as first thing when the  app starts
// https://www.electronjs.org/docs/latest/api/app

// runs in an isolated context in the renderer process
// prevents giving node access to untrusted content
// https://www.electronjs.org/docs/latest/tutorial/security#2-do-not-enable-nodejs-integration-for-remote-content
