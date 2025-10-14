// this file is main process of Electron, started as first thing when the  app starts
// https://www.electronjs.org/docs/latest/api/app



import path from "node:path";

import { app, BrowserWindow } from "electron";

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
}

app.whenReady().then(create); // called when Electron has finished initialization and is ready to create browser windows
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) create();
});
