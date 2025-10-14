import { contextBridge } from "electron";
contextBridge.exposeInMainWorld("api", { ping: () => "pong" }); // exposes a safe API to the renderer process


// this file is main process of Electron, started as first thing when the  app starts
// https://www.electronjs.org/docs/latest/api/app

// runs in an isolated context in the renderer process
// prevents giving node access to untrusted content
// https://www.electronjs.org/docs/latest/tutorial/security#2-do-not-enable-nodejs-integration-for-remote-content
