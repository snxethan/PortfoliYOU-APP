// this file is main process of Electron, started as first thing when the  app starts
// https://www.electronjs.org/docs/latest/api/app



import path from "node:path";
import https from "node:https";
import http from "node:http";
import fs from "node:fs/promises";

import { app, BrowserWindow, shell, ipcMain, dialog } from "electron";

const isDev = !!process.env.VITE_DEV_SERVER_URL;
let win: BrowserWindow | null = null;
let bounceId: number | null = null; // macOS dock bounce id
let flashTimer: NodeJS.Timeout | null = null;

// creates a BrowserWindow and loads index.html in the window
// https://www.electronjs.org/docs/latest/api/browser-window
function create() {

  win = new BrowserWindow({
    width: 1200, // sets the width of the window to 1200 pixels
    height: 800, // sets the height of the window to 800 pixels
    webPreferences: {
        // preload script runs before other scripts in the renderer process
  // https://www.electronjs.org/docs/latest/api/browser-window#new-browserwindowoptions
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true, // 
      nodeIntegration: false,
    },
  });
  if (isDev) win!.loadURL(process.env.VITE_DEV_SERVER_URL!);
  else win!.loadFile(path.join(__dirname, "../renderer/index.html"));

  // Handle new window requests (popups)
  win.webContents.setWindowOpenHandler(({ url }) => {
    // Allow Firebase/Google auth URLs to open in a popup window
    if (url.includes("accounts.google.com") || url.includes("firebaseapp.com")) {
      return {
        action: "allow",
        overrideBrowserWindowOptions: {
          width: 600,
          height: 700,
          center: true,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
          },
        },
      };
    }
    
    // Open other external links in system browser
    if (url.startsWith("http")) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    
    return { action: "allow" };
  });

  // Handle navigation within the main window
  win.webContents.on("will-navigate", (event, url) => {
    const isLocalDev = !!process.env.VITE_DEV_SERVER_URL && url.startsWith(process.env.VITE_DEV_SERVER_URL);
    const isAppFile = url.startsWith("file://");
    
    // Allow local dev and app file navigations
    if (isLocalDev || isAppFile) return;
    
    // Prevent navigation to external URLs in main window (open in system browser instead)
    if (url.startsWith("http")) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // Stop flashing when window gains focus
  win.on("focus", () => {
    try {
      if (process.platform === "darwin") {
        if (bounceId !== null) { app.dock?.cancelBounce?.(bounceId); bounceId = null; }
      } else {
        win?.flashFrame(false);
      }
      if (flashTimer) { clearTimeout(flashTimer); flashTimer = null; }
    } catch { /* ignore */ }
  });
}

app.whenReady().then(create); // called when Electron has finished initialization and is ready to create browser windows
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) create();
});

// IPC: Save a file to disk
ipcMain.handle("py:saveFile", async (_event, opts: { defaultPath?: string; data: string }) => {
  const { defaultPath, data } = opts || {};
  const result = await dialog.showSaveDialog({
    title: "Save PortfoliYOU file",
    defaultPath: defaultPath || "project.portfoliyou",
    filters: [{ name: "PortfoliYOU", extensions: ["portfoliyou", "json"] }],
  });
  if (result.canceled || !result.filePath) return { canceled: true };
  await fs.writeFile(result.filePath, data, "utf8");
  return { canceled: false, filePath: result.filePath };
});

// IPC: Open file dialog and read file contents
ipcMain.handle("py:openFileDialog", async (_event, opts: { filters?: { name: string; extensions: string[] }[] }) => {
  const result = await dialog.showOpenDialog({
    title: "Open PortfoliYOU file",
    filters: opts?.filters || [{ name: "PortfoliYOU", extensions: ["portfoliyou", "json"] }],
    properties: ["openFile"],
  });
  if (result.canceled || !result.filePaths?.[0]) return { canceled: true };
  const filePath = result.filePaths[0];
  const data = await fs.readFile(filePath, "utf8");
  return { canceled: false, filePath, data };
});

// IPC: Write directly to file path
ipcMain.handle("py:writeFile", async (_event, opts?: { filePath: string; data: string }) => {
  const filePath = opts?.filePath ?? "";
  const data = opts?.data ?? "";
  if (!filePath) return { ok: false, error: "No filePath" };
  await fs.writeFile(filePath, data, "utf8");
  return { ok: true };
});

// IPC: Delete a file
ipcMain.handle("py:deleteFile", async (_event, opts?: { filePath: string }) => {
  const filePath = opts?.filePath ?? "";
  if (!filePath) return { ok: false, error: "No filePath" };
  try {
    await fs.unlink(filePath);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

// IPC: Reveal a file in the system file manager
ipcMain.handle("py:showItemInFolder", async (_event, opts?: { filePath: string }) => {
  const filePath = opts?.filePath ?? "";
  if (!filePath) return { ok: false, error: "No filePath" };
  try {
    shell.showItemInFolder(filePath);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

// IPC: Rename/move a file
ipcMain.handle("py:renameFile", async (_event, opts?: { fromPath: string; toPath: string }) => {
  const fromPath = opts?.fromPath ?? "";
  const toPath = opts?.toPath ?? "";
  if (!fromPath || !toPath) return { ok: false, error: "Missing fromPath/toPath" };
  try {
    await fs.rename(fromPath, toPath);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

// IPC: Fetch text content from a URL in the main process (avoids renderer CORS)
ipcMain.handle("py:fetchText", async (_event, opts?: { url?: string; headers?: Record<string, string> }) => {
  const url = opts?.url ?? "";
  const headers = opts?.headers ?? {};
  if (!url) return { ok: false, error: "No URL provided" };
  try {
    const doRequest = (u: URL) => new Promise<string>((resolve, reject) => {
      const lib = u.protocol === "https:" ? https : http;
      const req = lib.request(u, { method: "GET", headers }, (res) => {
        if ((res.statusCode || 0) >= 400) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      });
      req.on("error", reject);
      req.end();
    });
    const text = await doRequest(new URL(url));
    return { ok: true, text };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

// IPC: Request the app to flash/bounce to attract attention
ipcMain.handle("py:flashFrame", async (_event, opts?: { durationMs?: number; urgent?: boolean }) => {
  const durationMs = Math.max(1000, opts?.durationMs ?? 6000);
  try {
    if (process.platform === "darwin") {
      // informational bounce; store id so we can cancel later
      if (app.dock && typeof app.dock.bounce === "function") {
        if (bounceId !== null) app.dock.cancelBounce(bounceId);
        bounceId = app.dock.bounce("informational");
      }
    } else {
      // Windows/Linux taskbar flash until stopped or timeout
      win?.flashFrame(true);
      if (flashTimer) { clearTimeout(flashTimer); flashTimer = null; }
      flashTimer = setTimeout(() => {
        try { win?.flashFrame(false); } catch { /* ignore */ }
        flashTimer = null;
      }, durationMs);
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) } as const;
  }
});

// IPC: Stop flashing/bouncing
ipcMain.handle("py:stopFlashFrame", async () => {
  try {
    if (process.platform === "darwin") {
      if (bounceId !== null) { app.dock?.cancelBounce?.(bounceId); bounceId = null; }
    } else {
      win?.flashFrame(false);
    }
    if (flashTimer) { clearTimeout(flashTimer); flashTimer = null; }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) } as const;
  }
});
