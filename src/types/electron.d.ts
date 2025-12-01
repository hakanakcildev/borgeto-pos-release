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
      checkForUpdates: () => Promise<void>;
      onUpdateAvailable: (callback: (version: string) => void) => void;
      onUpdateNotAvailable: (callback: () => void) => void;
      onUpdateDownloaded: (callback: (version: string) => void) => void;
      onDownloadProgress: (callback: (progress: { percent: number }) => void) => void;
      onUpdateError: (callback: (error: string) => void) => void;
    };
  }
}

export {};

