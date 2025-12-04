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
      startDownloadUpdate: () => Promise<{ success: boolean; error?: string; devMode?: boolean }>;
      enableAutoDownload: () => Promise<{ success: boolean; devMode?: boolean }>;
      onUpdateAvailable: (callback: (version: string, releaseNotes?: string) => void) => void;
      onUpdateNotAvailable: (callback: (info?: { currentVersion?: string; latestVersion?: string }) => void) => void;
      onUpdateDownloaded: (callback: (version: string) => void) => void;
      onDownloadProgress: (callback: (progress: { percent: number }) => void) => void;
      onUpdateError: (callback: (error: string) => void) => void;
      onUpdateChecking: (callback: () => void) => void;
      onTriggerClearTableHistory: (callback: () => void) => void;
      getAppVersion: () => Promise<{ version: string }>;
      getChangelog: () => Promise<{
        success: boolean;
        error?: string;
        versions?: Array<{ version: string; content: string }>;
      }>;
      getSystemPrinters: () => Promise<{
        success: boolean;
        error?: string;
        printers: Array<{
          id: string;
          name: string;
          description: string;
          status: number;
          isDefault: boolean;
          options: Record<string, any>;
        }>;
      }>;
      print: (data: {
        printerName: string;
        content: string;
        type?: "order" | "cancel" | "payment";
      }) => Promise<{
        success: boolean;
        error?: string;
      }>;
    };
  }
}

export {};

