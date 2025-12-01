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
    };
  }
}

export {};

