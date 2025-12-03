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
  quitAndInstall: () => {
    console.log("Preload: quitAndInstall called, invoking quit-and-install IPC");
    return ipcRenderer.invoke("quit-and-install");
  },
  checkForUpdates: () => {
    console.log("Preload: checkForUpdates called, invoking check-for-updates IPC");
    return ipcRenderer.invoke("check-for-updates");
  },
  onUpdateAvailable: (callback: (version: string) => void) => {
    ipcRenderer.on("update-available", (_event, version: string) => callback(version));
  },
  onUpdateNotAvailable: (callback: (info?: { currentVersion?: string; latestVersion?: string }) => void) => {
    ipcRenderer.on("update-not-available", (_event, info?: { currentVersion?: string; latestVersion?: string }) => callback(info));
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
  onUpdateChecking: (callback: () => void) => {
    ipcRenderer.on("update-checking", () => callback());
  },
  onTriggerClearTableHistory: (callback: () => void) => {
    ipcRenderer.on("trigger-clear-table-history", () => callback());
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
      quitAndInstall: () => Promise<void>;
      checkForUpdates: () => Promise<void>;
      onUpdateAvailable: (callback: (version: string) => void) => void;
      onUpdateNotAvailable: (callback: (info?: { currentVersion?: string; latestVersion?: string }) => void) => void;
      onUpdateDownloaded: (callback: (version: string) => void) => void;
      onDownloadProgress: (callback: (progress: { percent: number }) => void) => void;
      onUpdateError: (callback: (error: string) => void) => void;
      onUpdateChecking: (callback: () => void) => void;
      onTriggerClearTableHistory: (callback: () => void) => void;
    };
  }
}

