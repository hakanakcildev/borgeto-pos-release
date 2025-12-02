declare global {
  interface Window {
    electronAPI?: {
      platform: string;
      versions: {
        node: string;
        chrome: string;
        electron: string;
      };
      quitApp: () => Promise<void>;
      quitAndInstall: () => Promise<void>;
      checkForUpdates: () => Promise<{ success: boolean; error?: string; devMode?: boolean }>;
      onUpdateAvailable: (callback: (version: string) => void) => void;
      onUpdateNotAvailable: (callback: (info?: { currentVersion?: string; latestVersion?: string }) => void) => void;
      onUpdateDownloaded: (callback: (version: string) => void) => void;
      onDownloadProgress: (callback: (progress: { percent: number }) => void) => void;
      onUpdateError: (callback: (error: string) => void) => void;
      onUpdateChecking: (callback: () => void) => void;
    };
  }
}

export {};

