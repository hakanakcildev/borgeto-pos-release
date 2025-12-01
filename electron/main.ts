import { app, BrowserWindow, Menu, shell, ipcMain } from "electron";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { autoUpdater } from "electron-updater";

// ES Module compatibility for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;

let mainWindow: BrowserWindow | null = null;

// Register IPC handlers - this function ensures handler is always registered
function registerIpcHandlers() {
  // Always remove existing handler first (for hot reload compatibility)
  try {
    ipcMain.removeHandler("quit-app");
  } catch (e) {
    // Handler doesn't exist yet, that's fine
  }
  
  // Register quit-app handler
  ipcMain.handle("quit-app", async () => {
    console.log("quit-app IPC handler called - quitting application");
    app.quit();
  });
  
  console.log("IPC handlers registered: quit-app at", new Date().toISOString());
}

// Register handlers immediately (before app is ready)
// This ensures handler is available even if app.on("ready") hasn't fired yet
registerIpcHandlers();

// Auto-updater configuration
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

// Check for updates every 4 hours
if (!isDev) {
  setInterval(() => {
    autoUpdater.checkForUpdates();
  }, 4 * 60 * 60 * 1000); // 4 hours
}

const createWindow = (): void => {
  // Create the browser window
  const preloadPath = join(__dirname, "preload.js");
  const iconPath = join(__dirname, "../public/images/borgeto-logo.png");
  
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    fullscreen: true, // Her zaman tam ekran
    kiosk: !isDev, // Production'da kiosk modu (tam ekran + çıkış engellendi)
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
    icon: iconPath,
    titleBarStyle: "default",
    show: false, // Don't show until ready
    frame: isDev, // Production'da frame'i kaldır (tam ekran için)
    autoHideMenuBar: !isDev, // Production'da menü çubuğunu gizle
  });

  // Load the app
  if (isDev) {
    // Development: Load from Vite dev server
    const port = process.env.PORT || 5173;
    mainWindow.loadURL(`http://localhost:${port}`);
  } else {
    // Production: Load from built files
    // Use loadURL with file:// protocol to ensure proper routing
    const indexPath = join(__dirname, "../dist/index.html");
    mainWindow.loadFile(indexPath);
    
    // Ensure proper routing by handling navigation
    mainWindow.webContents.on("did-fail-load", (_event, errorCode) => {
      // If navigation fails, try loading index.html again
      if (errorCode === -3 && mainWindow) {
        mainWindow.loadFile(indexPath);
      }
    });
  }

  // Show window when ready to prevent visual flash
  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
    
    // Her zaman tam ekran modunu aktif et
    mainWindow?.setFullScreen(true);
    
    // Re-register IPC handlers when window is ready (for hot reload)
    registerIpcHandlers();
    
    // Open DevTools in development
    if (isDev) {
      mainWindow?.webContents.openDevTools();
    }
  });

  // Kiosk modunda F11 ve ESC tuşlarını engelle (production'da)
  if (!isDev) {
    mainWindow?.webContents.on("before-input-event", (event, input) => {
      // F11 (fullscreen toggle) ve ESC (exit fullscreen) tuşlarını engelle
      if (input.key === "F11" || input.key === "Escape") {
        event.preventDefault();
      }
    });
  } else {
    // Development'ta F11 ile tam ekran açıp kapatabilirsiniz
    mainWindow?.webContents.on("before-input-event", (event, input) => {
      // Development'ta sadece ESC'yi engelle (F11'e izin ver)
      if (input.key === "Escape" && input.control) {
        // Ctrl+ESC ile çıkış yapabilirsiniz
        event.preventDefault();
      }
    });
  }

  // Handle window closed
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  // Re-register IPC handlers when webContents is created (for hot reload)
  mainWindow.webContents.on("did-finish-load", () => {
    registerIpcHandlers();
  });
};

// Auto-updater events
autoUpdater.on("checking-for-update", () => {
  console.log("Checking for update...");
});

autoUpdater.on("update-available", (info: { version: string }) => {
  console.log("Update available:", info.version);
  if (mainWindow) {
    mainWindow.webContents.send("update-available", info.version);
  }
});

autoUpdater.on("update-not-available", () => {
  console.log("Update not available");
});

autoUpdater.on("error", (err: Error) => {
  console.error("Error in auto-updater:", err);
});

autoUpdater.on("download-progress", (progressObj: { percent: number }) => {
  if (mainWindow) {
    mainWindow.webContents.send("download-progress", progressObj);
  }
});

autoUpdater.on("update-downloaded", (info: { version: string }) => {
  console.log("Update downloaded:", info.version);
  if (mainWindow) {
    mainWindow.webContents.send("update-downloaded", info.version);
  }
  // Install update on next app quit
  autoUpdater.quitAndInstall(false, true);
});

// This method will be called when Electron has finished initialization
app.on("ready", () => {
  // Re-register IPC handlers on app ready (for hot reload compatibility)
  registerIpcHandlers();
  
  createWindow();

  // Check for updates on app start (only in production)
  if (!isDev) {
    // Wait a bit before checking for updates to let the app load
    setTimeout(() => {
      autoUpdater.checkForUpdates();
    }, 5000); // 5 seconds after app start
  }

  // Set application menu (sadece development'ta)
  if (isDev) {
    if (process.platform === "darwin") {
      // macOS menu
      const template: Electron.MenuItemConstructorOptions[] = [
        {
          label: app.getName(),
          submenu: [
            { role: "about" },
            { type: "separator" },
            { role: "services" },
            { type: "separator" },
            { role: "hide" },
            { role: "hideOthers" },
            { role: "unhide" },
            { type: "separator" },
            { role: "quit" },
          ],
        },
        {
          label: "Edit",
          submenu: [
            { role: "undo" },
            { role: "redo" },
            { type: "separator" },
            { role: "cut" },
            { role: "copy" },
            { role: "paste" },
            { role: "selectAll" },
          ],
        },
        {
          label: "View",
          submenu: [
            { role: "reload" },
            { role: "forceReload" },
            { role: "toggleDevTools" },
            { type: "separator" },
            { role: "resetZoom" },
            { role: "zoomIn" },
            { role: "zoomOut" },
            { type: "separator" },
            { role: "togglefullscreen" },
          ],
        },
        {
          role: "window",
          submenu: [{ role: "minimize" }, { role: "close" }],
        },
      ];
      Menu.setApplicationMenu(Menu.buildFromTemplate(template));
    } else {
      // Windows/Linux menu
      const template: Electron.MenuItemConstructorOptions[] = [
        {
          label: "File",
          submenu: [{ role: "quit" }],
        },
        {
          label: "Edit",
          submenu: [
            { role: "undo" },
            { role: "redo" },
            { type: "separator" },
            { role: "cut" },
            { role: "copy" },
            { role: "paste" },
            { role: "selectAll" },
          ],
        },
        {
          label: "View",
          submenu: [
            { role: "reload" },
            { role: "forceReload" },
            { role: "toggleDevTools" },
            { type: "separator" },
            { role: "resetZoom" },
            { role: "zoomIn" },
            { role: "zoomOut" },
            { type: "separator" },
            { role: "togglefullscreen" },
          ],
        },
      ];
      Menu.setApplicationMenu(Menu.buildFromTemplate(template));
    }
  } else {
    // Production'da menüyü kaldır (kiosk modu için)
    Menu.setApplicationMenu(null);
  }
});

// Quit when all windows are closed
app.on("window-all-closed", () => {
  // On macOS, keep app running even when all windows are closed
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  // On macOS, re-create window when dock icon is clicked
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Security: Prevent new window creation
app.on("web-contents-created", (_, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
});

