import { contextBridge, ipcRenderer } from "electron";

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electronAPI", {
  // Add any Electron APIs you want to expose to the renderer process here
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },
  quitApp: () => {
    console.log("Preload: quitApp called, invoking quit-app IPC");
    return ipcRenderer.invoke("quit-app");
  },
});

// Type definitions for TypeScript
declare global {
  interface Window {
    electronAPI: {
      platform: string;
      versions: {
        node: string;
        chrome: string;
        electron: string;
      };
      quitApp: () => Promise<void>;
    };
  }
}

