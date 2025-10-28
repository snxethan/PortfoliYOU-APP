// this file is main process of Electron, started as first thing when the  app starts
// https://www.electronjs.org/docs/latest/api/app



import path from "node:path";

import { app, BrowserWindow, shell } from "electron";

const isDev = !!process.env.VITE_DEV_SERVER_URL;
let win: BrowserWindow | null = null;

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
}

app.whenReady().then(create); // called when Electron has finished initialization and is ready to create browser windows
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) create();
});
