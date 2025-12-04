// this file is main process of Electron, started as first thing when the  app starts
// https://www.electronjs.org/docs/latest/api/app



import path from "node:path";
import fsSync from "node:fs";
import os from 'node:os';
import https from "node:https";
import http from "node:http";
import fs from "node:fs/promises";

import { app, BrowserWindow, shell, ipcMain, dialog, Menu, clipboard } from "electron";
import { autoUpdater } from 'electron-updater';
import { APP_NAME, APP_ID, resolveAppIconPath, brandTitle } from "../shared/brand";

import { startStaticServer, stopStaticServer, isServerRunning } from './staticServer';

const isDev = !!process.env.VITE_DEV_SERVER_URL;
let win: BrowserWindow | null = null;
let bounceId: number | null = null; // macOS dock bounce id
let flashTimer: NodeJS.Timeout | null = null;

// creates a BrowserWindow and loads index.html in the window
// https://www.electronjs.org/docs/latest/api/browser-window

function create() {
  // Ensure app identity (useful for Windows taskbar grouping/notifications)
  try { app.setAppUserModelId(APP_ID); } catch { /* ignore */ }

  const iconPath = resolveAppIconPath();
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    title: APP_NAME,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  if (isDev) win!.loadURL(process.env.VITE_DEV_SERVER_URL!);
  else win!.loadFile(path.join(__dirname, "../../dist/index.html"));

  // Emit window state events to renderer for live UI updates
  win.webContents.once('did-finish-load', () => {
    try {
      win!.webContents.send('window-maximize-state', { maximized: win!.isMaximized() });
      const b = win!.getBounds();
      win!.webContents.send('window-move-top', { atTop: typeof b.y === 'number' && b.y <= 0 });
      // Set zoom limits to match custom controls: 0.8 (80%) to 2.0 (200%)
      // Electron uses logarithmic zoom levels: zoomFactor = 1.2^zoomLevel
      // For 80%: log(0.8)/log(1.2) ≈ -1.2, for 200%: log(2.0)/log(1.2) ≈ 3.8
      win!.webContents.setVisualZoomLevelLimits(1, 5);
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
        label: APP_NAME,
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
          { role: 'togglefullscreen' }
        ]
      }
    ];
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  } catch {
    // If menu setup fails, ignore — app still works but clipboard shortcuts might
    // rely on default behavior.
  }

  // App identity already set above via APP_ID
  // Auto-update: check on startup in production
  try {
    if (!isDev) {
      autoUpdater.autoDownload = true;
      autoUpdater.checkForUpdatesAndNotify();
    }
  } catch { /* ignore auto-update errors in dev */ }

  // Handle new window requests (popups)
  win.webContents.setWindowOpenHandler(({ url }) => {
    // Allow Firebase/Google auth URLs to open in a popup window
    if (url.includes("accounts.google.com") || url.includes("firebaseapp.com")) {
      const popupIcon = resolveAppIconPath();
      return {
        action: "allow",
        overrideBrowserWindowOptions: {
          width: 600,
          height: 700,
          center: true,
          title: APP_NAME,
          icon: popupIcon,
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

// Ensure static server is stopped when app is quitting
app.on('will-quit', async () => {
  try {
    if (isServerRunning()) {
      await stopStaticServer();
    }
  } catch { /* ignore */ }
});

// Global error handlers: log and attempt to stop static server to avoid leaving a stuck process
process.on('uncaughtException', async (err) => {
  try {
    const msg = `uncaughtException: ${err && (err as any).stack ? (err as any).stack : String(err)}`;
    try { await appendPreviewLog(msg); } catch { /* ignore */ }
    if (isServerRunning()) {
      try { await stopStaticServer(); } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
});
process.on('unhandledRejection', async (reason) => {
  try {
    const msg = `unhandledRejection: ${reason && (reason as any).stack ? (reason as any).stack : String(reason)}`;
    try { await appendPreviewLog(msg); } catch { /* ignore */ }
    if (isServerRunning()) {
      try { await stopStaticServer(); } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
});

// IPC: Save a file to disk
ipcMain.handle("py:saveFile", async (_event, opts: { defaultPath?: string; data: string; encoding?: 'utf8' | 'base64' }) => {
  const { defaultPath, data, encoding } = opts || {};
  const result = await dialog.showSaveDialog({
    title: brandTitle("Save file"),
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
    title: brandTitle("Save file"),
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
    title: brandTitle("Open file"),
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
    title: brandTitle("Open file"),
    filters: opts?.filters || [{ name: "PortfoliYOU", extensions: ["portfoliyou", "zip"] }],
    properties: ["openFile"],
  });
  if (result.canceled || !result.filePaths?.[0]) return { canceled: true };
  const filePath = result.filePaths[0];
  const buf = await fs.readFile(filePath);
  const dataBase64 = buf.toString('base64');
  return { canceled: false, filePath, dataBase64 };
});

// IPC: Open folder picker (select or create a directory)
ipcMain.handle('py:openFolderDialog', async () => {
  const result = await dialog.showOpenDialog({
    title: brandTitle('Select export folder'),
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled || !result.filePaths?.[0]) return { canceled: true };
  return { canceled: false, filePath: result.filePaths[0] };
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

// IPC: Open a folder or file path with the OS default handler (useful to open folders)
ipcMain.handle('py:openPath', async (_event, opts?: { path: string }) => {
  const p = opts?.path ?? '';
  if (!p) return { ok: false, error: 'No path' };
  try {
    const res = await shell.openPath(p);
    // shell.openPath returns empty string on success
    if (typeof res === 'string' && res.length > 0) return { ok: false, error: res };
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

// IPC: Build static site
ipcMain.handle('py:buildStaticSite', async (_event, opts?: { project: unknown; assets?: Record<string, string>; outputDir?: string; useTempOutput?: boolean; globalCss?: { tailwind?: string }; themeCss?: string }) => {
  try {
    const { buildStaticSite } = await import('./staticCompiler');
    // cast to any to avoid compile-time type mismatches across the IPC boundary
    const res = await buildStaticSite(opts as any);
    return res;
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

// IPC: Start a local static server to preview a built `dist-site` folder
ipcMain.handle('py:preview:startServer', async (_event, opts?: { distDir?: string; host?: string; port?: number }) => {
  try {
    const distDir = opts?.distDir || '';
    if (!distDir) return { ok: false, error: 'No distDir' };
    const host = opts?.host || '0.0.0.0';
    // If caller passes 0 or undefined, let startStaticServer pick an ephemeral port
    const port = typeof opts?.port === 'number' ? Math.max(0, Math.floor(opts!.port)) : 0;
    const res = await startStaticServer(distDir, host, port);
    return { ok: true, localUrl: res.localUrl, lanUrl: res.lanUrl, port: res.port };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

// IPC: Stop the preview static server
ipcMain.handle('py:preview:stopServer', async () => {
  try {
    const res = await stopStaticServer();
    return { ok: res.ok, stopped: res.stopped };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

// IPC: Append a line to the application preview log file (userData/logs/preview.log)
ipcMain.handle('py:appendLog', async (_event, opts?: { line?: string }) => {
  try {
    const line = opts?.line || '';
    const logsDir = path.join(app.getPath('userData'), 'logs');
    await fs.mkdir(logsDir, { recursive: true });
    const logFile = path.join(logsDir, 'preview.log');
    const ts = new Date().toISOString();
    const entry = `[${ts}] ${line}\n`;
    await fs.appendFile(logFile, entry, 'utf8');
    return { ok: true, filePath: logFile };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

// Internal helper used by main process code to record preview logs (kept alongside IPC handler)
async function appendPreviewLog(line?: string) {
  try {
    const logsDir = path.join(app.getPath('userData'), 'logs');
    await fs.mkdir(logsDir, { recursive: true });
    const logFile = path.join(logsDir, 'preview.log');
    const ts = new Date().toISOString();
    const entry = `[${ts}] ${line || ''}\n`;
    await fs.appendFile(logFile, entry, 'utf8');
    return { ok: true, filePath: logFile };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// IPC: Embed a built folder (e.g. dist-site) into a PortfoliYOU project archive (.portfoliyou)
ipcMain.handle('py:embedDistIntoProject', async (_event, opts?: { projectFilePath?: string; distDir?: string; defaultName?: string }) => {
  try {
    const projectFilePath = opts?.projectFilePath || '';
    const distDir = opts?.distDir || '';
    const defaultName = opts?.defaultName || 'project.portfoliyou';
    if (!distDir) return { ok: false, error: 'No distDir' };
    const JSZip = await import('jszip');
    const zip = new JSZip.default();

    // If an existing project file was provided and exists, load it first so we merge
    let targetPath: string | undefined;
    if (projectFilePath) {
      try {
        const buf = await fs.readFile(projectFilePath);
        const existing = await JSZip.default.loadAsync(buf);
        // Merge existing into our zip object by copying entries
        existing.forEach((relativePath: string, file: any) => {
          // We'll let dist-site additions overwrite any existing entries with same path later
          if (file.dir) {
            zip.folder(relativePath);
          } else {
            // read as node buffer asynchronously when generating final
            zip.file(relativePath, file.async ? file.async('nodebuffer') : file);
          }
        });
        targetPath = projectFilePath;
      } catch {
        // If loading fails, continue with empty zip and allow save-as
        targetPath = undefined;
      }
    }

    // Helper to recursively add files from distDir into zip under 'dist-site' folder
    async function addFolderToZip(folderPath: string, zipFolder: any, baseRoot: string) {
      const entries = await fs.readdir(folderPath, { withFileTypes: true });
      for (const ent of entries) {
        const full = path.join(folderPath, ent.name);
        if (ent.isDirectory()) {
          const child = zipFolder.folder(ent.name);
          await addFolderToZip(full, child, baseRoot);
        } else if (ent.isFile()) {
          const buf = await fs.readFile(full);
          zipFolder.file(ent.name, buf);
        }
      }
    }

    // Add dist-site directory into a folder named 'dist-site' at zip root
    const stats = await fs.stat(distDir).catch(() => null);
    if (!stats || !stats.isDirectory()) return { ok: false, error: 'distDir not a directory' };
    const distFolder = zip.folder('dist-site');
    await addFolderToZip(distDir, distFolder, distDir);

    // If we have a target path, overwrite existing file; otherwise prompt save dialog
    const content = await zip.generateAsync({ type: 'nodebuffer' });
    if (targetPath) {
      await fs.writeFile(targetPath, content);
      return { ok: true, filePath: targetPath };
    } else {
      const result = await dialog.showSaveDialog({
        title: 'Save PortfoliYOU project with embedded build',
        defaultPath: defaultName,
        filters: [{ name: 'PortfoliYOU', extensions: ['portfoliyou', 'zip'] }],
      });
      if (result.canceled || !result.filePath) return { canceled: true };
      await fs.writeFile(result.filePath, content);
      return { ok: true, filePath: result.filePath };
    }
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

// IPC: Create an export-ready folder from a built `dist-site` folder.
ipcMain.handle('py:buildExportFolder', async (_event, opts?: { distDir?: string; projectName?: string }) => {
  try {
    const distDir = opts?.distDir || '';
    const projectName = (opts?.projectName || 'portfolio').replace(/[^a-z0-9\-_. ]/gi, '').trim() || 'portfolio';
    if (!distDir) return { ok: false, error: 'No distDir' };
    const stat = await fs.stat(distDir).catch(() => null);
    if (!stat || !stat.isDirectory()) return { ok: false, error: 'distDir not a directory' };

    // Create a temp export folder
    const tmpBase = await fs.mkdtemp(path.join(os.tmpdir(), `portfoliyou-export-`));
    const exportRoot = path.join(tmpBase, projectName);
    await fs.mkdir(exportRoot, { recursive: true });

    // Recursively copy files from distDir into exportRoot, normalize HTML references to relative paths,
    // and organize site CSS/JS into `css/` and `js/` folders to produce a clear export layout compatible
    // with static servers (nginx, Apache, S3) and offline usage.
    async function copyAndProcess(src: string, dest: string) {
      const entries = await fs.readdir(src, { withFileTypes: true });
      for (const ent of entries) {
        const full = path.join(src, ent.name);
        // Determine destination mapping for specific filenames
        let relativeTarget = ent.name;
        const lower = ent.name.toLowerCase();

        if (lower === 'site.css') {
          relativeTarget = path.posix.join('css', 'site.css');
        } else if (lower === 'site.js') {
          relativeTarget = path.posix.join('js', 'site.js');
        }

        // Use path.join with dest for actual filesystem write, but ensure HTML replacements use posix (forward slashes)
        const target = path.join(dest, // base dest folder
          // If relativeTarget contains posix separators, split to platform parts
          ...relativeTarget.split('/'));

        if (ent.isDirectory()) {
          await fs.mkdir(target, { recursive: true });
          await copyAndProcess(full, target);
        } else if (ent.isFile()) {
          // HTML: adjust references and inject base tag for offline relative resolution
          if (lower.endsWith('.html')) {
            let txt = await fs.readFile(full, 'utf8');
            // Replace absolute root references for our known local resources:
            // /site.css -> css/site.css, /site.js -> js/site.js, /assets/... -> assets/...
            txt = txt.replace(/(["'])\/(site\.css)\1/g, `$1css/site.css$1`);
            txt = txt.replace(/(["'])\/(site\.js)\1/g, `$1js/site.js$1`);
            txt = txt.replace(/(["'])\/(assets\/[\w\-./]+)\1/g, `$1assets/$2$1`);

            // If the HTML references '/assets/...' but was served with a leading slash, the above ensures it points to local assets/
            // Ensure a <base href="./"> exists to make relative links work when opening files from disk and when served from a subpath
            if (!/< base\s+href=/i.test(txt)) {
              txt = txt.replace(/(<head[^>]*>)/i, `$1\n  <base href="./">`);
            }

            // Write modified HTML to the intended target (usually dest/index.html or page file)
            await fs.mkdir(path.dirname(target), { recursive: true });
            await fs.writeFile(target, txt, 'utf8');
          } else {
            // For other files, place CSS/JS into their mapped folders, otherwise copy as-is
            const buf = await fs.readFile(full);
            await fs.mkdir(path.dirname(target), { recursive: true });
            await fs.writeFile(target, buf);
          }
        }
      }
    }

    await copyAndProcess(distDir, exportRoot);

    // Ensure there's a 404.html fallback for static hosts (useful for SPA hosting on Netlify/GitHub Pages with redirect)
    try {
      const indexPath = path.join(exportRoot, 'index.html');
      const fallbackPath = path.join(exportRoot, '404.html');
      const statIndex = await fs.stat(indexPath).catch(() => null);
      if (statIndex && statIndex.isFile()) {
        // Copy index -> 404 to allow single-page-app style routing on hosts that serve 404 for unknown paths
        await fs.copyFile(indexPath, fallbackPath);
      }
    } catch { /* ignore */ }

    return { ok: true, path: exportRoot };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

// IPC: Try to resolve a .portfoliyou file for a given path.
ipcMain.handle('py:findProjectFile', async (_event, opts?: { path?: string }) => {
  try {
    const p = opts?.path || '';
    if (!p) return { ok: false, error: 'No path' };
    const stat = await fs.stat(p).catch(() => null);
    // If it's a file and already a .portfoliyou, return it
    if (stat && stat.isFile() && p.toLowerCase().endsWith('.portfoliyou')) return { ok: true, filePath: p };
    // If it's a directory, search for any .portfoliyou file inside
    let dir = '';
    if (stat && stat.isDirectory()) dir = p;
    else dir = path.dirname(p);
    const entries = await fs.readdir(dir).catch(() => []);
    for (const e of entries) {
      if (e.toLowerCase().endsWith('.portfoliyou')) {
        return { ok: true, filePath: path.join(dir, e) };
      }
    }
    return { ok: false };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

// IPC: Zip a directory and return base64
ipcMain.handle('py:zipDir', async (_event, opts?: { dir: string }) => {
  try {
    const dir = opts?.dir || '';
    if (!dir) return { ok: false, error: 'No dir' };
    const JSZip = await import('jszip');
    const zip = new JSZip.default();
    // Recursively add files
    async function addFolder(folderPath: string, zipFolder: any) {
      const entries = await fs.readdir(folderPath, { withFileTypes: true });
      for (const ent of entries) {
        const full = path.join(folderPath, ent.name);
        if (ent.isDirectory()) {
          const child = zipFolder.folder(ent.name);
          await addFolder(full, child);
        } else if (ent.isFile()) {
          const buf = await fs.readFile(full);
          zipFolder.file(ent.name, buf);
        }
      }
    }
    await addFolder(dir, zip);
    const content = await zip.generateAsync({ type: 'base64' });
    return { ok: true, dataBase64: content };
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

// IPC: Open a URL in the system default browser
ipcMain.handle('py:openExternal', async (_event, opts?: { url?: string }) => {
  try {
    const url = opts?.url || '';
    if (!url) return { ok: false, error: 'No URL' };
    // Use shell.openExternal to open in user's default browser
    await shell.openExternal(url);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});
