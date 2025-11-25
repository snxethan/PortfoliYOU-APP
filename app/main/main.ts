// this file is main process of Electron, started as first thing when the  app starts
// https://www.electronjs.org/docs/latest/api/app



import path from "node:path";
import fsSync from "node:fs";
import https from "node:https";
import http from "node:http";
import fs from "node:fs/promises";

import { app, BrowserWindow, shell, ipcMain, dialog, Menu, clipboard } from "electron";

const isDev = !!process.env.VITE_DEV_SERVER_URL;
let win: BrowserWindow | null = null;
let bounceId: number | null = null; // macOS dock bounce id
let flashTimer: NodeJS.Timeout | null = null;

// creates a BrowserWindow and loads index.html in the window
// https://www.electronjs.org/docs/latest/api/browser-window
function resolveIconPath(): string | undefined {
  // Prefer PNG; fallback to SVG. In dev, read from Vite public; in prod, from dist output.
  const candidates = ["icon.png", "icon.svg"];
  for (const name of candidates) {
    const devPath = path.join(process.cwd(), "app", "renderer", "public", name);
    if (fsSync.existsSync(devPath)) return devPath;
    const prodPath = path.join(__dirname, "../../dist", name);
    if (fsSync.existsSync(prodPath)) return prodPath;
  }
  return undefined;
}

function create() {

  const iconPath = resolveIconPath();
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    title: "Portfoli-YOU",
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  if (isDev) win!.loadURL(process.env.VITE_DEV_SERVER_URL!);
  else win!.loadFile(path.join(__dirname, "../renderer/index.html"));

  // Emit window state events to renderer for live UI updates
  win.webContents.once('did-finish-load', () => {
    try {
      win!.webContents.send('window-maximize-state', { maximized: win!.isMaximized() });
      const b = win!.getBounds();
      win!.webContents.send('window-move-top', { atTop: typeof b.y === 'number' && b.y <= 0 });
    } catch { /* ignore */ }
  });

  win.on('maximize', () => {
    try { win?.webContents.send('window-maximize', { maximized: true }); } catch { /* ignore */ }
  });
  win.on('unmaximize', () => {
    try { win?.webContents.send('window-unmaximize', { maximized: false }); } catch { /* ignore */ }
  });
  // Emit move events so renderer can detect drag-to-top (for snap-to-maximize UI)
  win.on('move', () => {
    try {
      const b = win!.getBounds();
      const atTop = typeof b.y === 'number' && b.y <= 0;
      win!.webContents.send('window-move-top', { atTop });
    } catch { /* ignore */ }
  });

  // Application menu with standard Edit actions so Cut/Copy/Paste work with
  // Ctrl/Cmd-X/C/V and other platform-appropriate shortcuts.
  try {
    const isMac = process.platform === 'darwin';
    const template: any = [
      // App menu (macOS)
      ...(isMac ? [{
        label: app.name,
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' }
        ]
      }] : []),

      // File menu
      {
        label: 'File',
        submenu: [
          isMac ? { role: 'close' } : { role: 'quit' }
        ]
      },

      // Edit menu with standard clipboard actions
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          ...(isMac ? [
            { role: 'pasteAndMatchStyle' },
            { role: 'delete' },
            { role: 'selectAll' }
          ] : [
            { role: 'delete' },
            { type: 'separator' },
            { role: 'selectAll' }
          ])
        ]
      },

      // View menu useful for dev
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'toggleFullScreen' }
        ]
      }
    ];
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  } catch (e) {
    // If menu setup fails, ignore — app still works but clipboard shortcuts might
    // rely on default behavior.
  }

  // Ensure Windows Taskbar grouping and notifications show proper identity
  try { app.setAppUserModelId("dev.snxethan.portfoliyou"); } catch { /* ignore */ }

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

  // Window control IPC handlers
  ipcMain.handle('py:window:minimize', () => {
    const w = BrowserWindow.getFocusedWindow() || win;
    if (w) { w.minimize(); return { ok: true }; }
    return { ok: false };
  });
  ipcMain.handle('py:window:maximize', () => {
    const w = BrowserWindow.getFocusedWindow() || win;
    if (w && !w.isMaximized()) { w.maximize(); return { ok: true, maximized: true }; }
    return { ok: false, maximized: false };
  });
  ipcMain.handle('py:window:unmaximize', () => {
    const w = BrowserWindow.getFocusedWindow() || win;
    if (w && w.isMaximized()) { w.unmaximize(); return { ok: true, maximized: false }; }
    return { ok: false, maximized: false };
  });
  ipcMain.handle('py:window:toggleMaximize', () => {
    const w = BrowserWindow.getFocusedWindow() || win;
    if (!w) return { ok: false };
    if (w.isMaximized()) { w.unmaximize(); return { ok: true, maximized: false }; }
    w.maximize(); return { ok: true, maximized: true };
  });
  ipcMain.handle('py:window:isMaximized', () => {
    const w = BrowserWindow.getFocusedWindow() || win;
    return { ok: true, maximized: !!w && w.isMaximized() };
  });
  ipcMain.handle('py:window:close', () => {
    const w = BrowserWindow.getFocusedWindow() || win;
    if (w) { w.close(); return { ok: true }; }
    return { ok: false };
  });

  // Open/Toggle DevTools for focused window
  ipcMain.handle('py:window:openDevTools', (_event, opts?: { mode?: 'right' | 'bottom' | 'undocked' }) => {
    const w = BrowserWindow.getFocusedWindow() || win;
    if (!w) return { ok: false };
    try {
      w.webContents.openDevTools({ mode: (opts && opts.mode) || 'right' });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  });
  ipcMain.handle('py:window:toggleDevTools', () => {
    const w = BrowserWindow.getFocusedWindow() || win;
    if (!w) return { ok: false };
    try {
      if (w.webContents.isDevToolsOpened()) w.webContents.closeDevTools();
      else w.webContents.openDevTools({ mode: 'right' });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
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
ipcMain.handle("py:saveFile", async (_event, opts: { defaultPath?: string; data: string; encoding?: 'utf8' | 'base64' }) => {
  const { defaultPath, data, encoding } = opts || {};
  const result = await dialog.showSaveDialog({
    title: "Save PortfoliYOU file",
    defaultPath: defaultPath || "project.portfoliyou",
    filters: [{ name: "PortfoliYOU", extensions: ["portfoliyou", "json"] }],
  });
  if (result.canceled || !result.filePath) return { canceled: true };
  await fs.writeFile(result.filePath, data, encoding === 'base64' ? { encoding: 'base64' } : "utf8");
  return { canceled: false, filePath: result.filePath };
});

// IPC: Save base64 bytes to disk
ipcMain.handle("py:saveFileBytes", async (_event, opts: { defaultPath?: string; dataBase64: string }) => {
  const { defaultPath, dataBase64 } = opts || {};
  const result = await dialog.showSaveDialog({
    title: "Save PortfoliYOU file",
    defaultPath: defaultPath || "project.portfoliyou",
    filters: [{ name: "PortfoliYOU", extensions: ["portfoliyou", "zip"] }],
  });
  if (result.canceled || !result.filePath) return { canceled: true };
  await fs.writeFile(result.filePath, dataBase64, { encoding: 'base64' });
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

// IPC: Open file dialog and read file as base64 bytes
ipcMain.handle("py:openFileDialogBytes", async (_event, opts: { filters?: { name: string; extensions: string[] }[] }) => {
  const result = await dialog.showOpenDialog({
    title: "Open PortfoliYOU file",
    filters: opts?.filters || [{ name: "PortfoliYOU", extensions: ["portfoliyou", "zip"] }],
    properties: ["openFile"],
  });
  if (result.canceled || !result.filePaths?.[0]) return { canceled: true };
  const filePath = result.filePaths[0];
  const buf = await fs.readFile(filePath);
  const dataBase64 = buf.toString('base64');
  return { canceled: false, filePath, dataBase64 };
});

// IPC: Write directly to file path
ipcMain.handle("py:writeFile", async (_event, opts?: { filePath: string; data: string; encoding?: 'utf8' | 'base64' }) => {
  const filePath = opts?.filePath ?? "";
  const data = opts?.data ?? "";
  const encoding = opts?.encoding;
  if (!filePath) return { ok: false, error: "No filePath" };
  await fs.writeFile(filePath, data, encoding === 'base64' ? { encoding: 'base64' } : "utf8");
  return { ok: true };
});

// IPC: Write base64 bytes directly to file path
ipcMain.handle("py:writeFileBytes", async (_event, opts?: { filePath: string; dataBase64: string }) => {
  const filePath = opts?.filePath ?? "";
  const dataBase64 = opts?.dataBase64 ?? "";
  if (!filePath) return { ok: false, error: "No filePath" };
  await fs.writeFile(filePath, dataBase64, { encoding: 'base64' });
  return { ok: true };
});

// IPC: system clipboard write/read (string)
ipcMain.handle('py:clipboardWrite', async (_event, opts?: { text: string }) => {
  try {
    if (!opts || typeof opts.text !== 'string') return { ok: false, error: 'No text' };
    clipboard.writeText(opts.text);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

ipcMain.handle('py:clipboardRead', async () => {
  try {
    const text = clipboard.readText();
    return { ok: true, text };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
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
