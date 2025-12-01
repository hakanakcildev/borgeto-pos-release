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
  checkForUpdates: () => {
    console.log("Preload: checkForUpdates called, invoking check-for-updates IPC");
    return ipcRenderer.invoke("check-for-updates");
  },
  onUpdateAvailable: (callback: (version: string) => void) => {
    ipcRenderer.on("update-available", (_event, version: string) => callback(version));
  },
  onUpdateNotAvailable: (callback: () => void) => {
    ipcRenderer.on("update-not-available", () => callback());
  },
  onUpdateDownloaded: (callback: (version: string) => void) => {
    ipcRenderer.on("update-downloaded", (_event, version: string) => callback(version));
  },
  onDownloadProgress: (callback: (progress: { percent: number }) => void) => {
    ipcRenderer.on("download-progress", (_event, progress: { percent: number }) => callback(progress));
  },
  onUpdateError: (callback: (error: string) => void) => {
    ipcRenderer.on("update-error", (_event, error: string) => callback(error));
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
      checkForUpdates: () => Promise<void>;
      onUpdateAvailable: (callback: (version: string) => void) => void;
      onUpdateNotAvailable: (callback: () => void) => void;
      onUpdateDownloaded: (callback: (version: string) => void) => void;
      onDownloadProgress: (callback: (progress: { percent: number }) => void) => void;
      onUpdateError: (callback: (error: string) => void) => void;
    };
  }
}

