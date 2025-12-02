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
  // Always remove existing handlers first (for hot reload compatibility)
  try {
    ipcMain.removeHandler("quit-app");
  } catch (e) {
    // Handler doesn't exist yet, that's fine
  }
  
  try {
    ipcMain.removeHandler("check-for-updates");
  } catch (e) {
    // Handler doesn't exist yet, that's fine
  }
  
  try {
    ipcMain.removeHandler("quit-and-install");
  } catch (e) {
    // Handler doesn't exist yet, that's fine
  }
  
  // Register quit-app handler
  ipcMain.handle("quit-app", async () => {
    console.log("quit-app IPC handler called - quitting application");
    app.quit();
  });
  
  // Register check-for-updates handler
  ipcMain.handle("check-for-updates", async () => {
    console.log("🔍 Manual update check requested");
    console.log("Current app version:", app.getVersion());
    if (!isDev) {
      try {
        const result = await autoUpdater.checkForUpdates();
        console.log("Update check result:", result);
        if (result) {
          console.log("- Update info:", result.updateInfo);
          console.log("- CancellationToken:", result.cancellationToken);
        }
        return result;
      } catch (error) {
        console.error("❌ Error checking for updates:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("- Error details:", error);
        if (mainWindow) {
          mainWindow.webContents.send("update-error", errorMessage);
        }
        throw error;
      }
    } else {
      console.log("⚠️ Update check skipped (development mode)");
      return null;
    }
  });
  
  // Register quit-and-install handler for manual update installation
  ipcMain.handle("quit-and-install", async () => {
    console.log("🔄 quit-and-install IPC handler called - installing update and quitting");
    if (!isDev) {
      try {
        // Güncelleme indirildiyse kurulum yap ve çık
        autoUpdater.quitAndInstall(false, true);
      } catch (error) {
        console.error("❌ Error installing update:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (mainWindow) {
          mainWindow.webContents.send("update-error", errorMessage);
        }
        throw error;
      }
    } else {
      console.log("⚠️ Update installation skipped (development mode)");
      app.quit();
    }
  });
  
    console.log("IPC handlers registered: quit-app, check-for-updates, quit-and-install at", new Date().toISOString());
}

// Auto-updater configuration
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

// Windows'ta imza kontrolü package.json'daki "win.verifyUpdateCodeSignature: false" ayarı ile devre dışı bırakıldı
// Runtime'da ek bir ayar gerekmez

// Configure auto-updater for production
if (!isDev) {
  // Electron-updater otomatik olarak package.json'daki publish ayarlarını kullanır
  // verifyUpdateCodeSignature ayarı package.json'da false olarak ayarlandı
  try {
    // GitHub provider için gerekli bilgileri ayarla
    // Bu bilgiler package.json'daki publish ayarlarından otomatik okunur
    // Ancak manuel olarak da ayarlanabilir
    
    console.log("🔧 Auto-updater configuration:");
    console.log("- Current app version:", app.getVersion());
    console.log("- Platform:", process.platform);
    console.log("- Auto download:", autoUpdater.autoDownload);
    console.log("- Auto install on quit:", autoUpdater.autoInstallOnAppQuit);
    console.log("- Update channel:", autoUpdater.channel || "latest");
    console.log("- Signature verification: disabled");
    
    // Electron-updater GitHub provider için package.json'daki publish ayarlarını kullanır
    // Bu yüzden manuel feed URL ayarlamaya gerek yok
    // Ancak debug için kontrol edebiliriz
  } catch (error) {
    console.error("❌ Error configuring auto-updater:", error);
  }
}

// Check for updates every 4 hours
if (!isDev) {
  setInterval(() => {
    try {
      autoUpdater.checkForUpdates().catch((err) => {
        console.error("Error checking for updates (interval):", err);
      });
    } catch (err) {
      console.error("Error checking for updates (interval):", err);
    }
  }, 4 * 60 * 60 * 1000); // 4 hours
}

const createWindow = (): void => {
  // Create the browser window
  const preloadPath = join(__dirname, "preload.js");
  // Icon path - Windows için .ico, diğer platformlar için PNG
  const iconPath = process.platform === "win32" 
    ? join(__dirname, "../public/borgeto-logo.ico")
    : join(__dirname, "../public/images/borgeto-logo.png");
  
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
};

// Auto-updater events
autoUpdater.on("checking-for-update", () => {
  console.log("🔍 Checking for update...");
  console.log("Current app version:", app.getVersion());
  if (mainWindow) {
    mainWindow.webContents.send("update-checking");
  }
});

autoUpdater.on("update-available", (info: { version: string; releaseDate: string; path: string }) => {
  console.log("✅ Update available!");
  console.log("- New version:", info.version);
  console.log("- Current version:", app.getVersion());
  console.log("- Release date:", info.releaseDate);
  console.log("- Path:", info.path);
  if (mainWindow) {
    mainWindow.webContents.send("update-available", info.version);
  }
});

autoUpdater.on("update-not-available", (info: { version: string }) => {
  const currentVersion = app.getVersion();
  const latestVersion = info.version;
  
  console.log("ℹ️ Update not available");
  console.log("- Current version:", currentVersion);
  console.log("- Latest version:", latestVersion);
  console.log("- Versions match:", currentVersion === latestVersion);
  
  // Version karşılaştırması için daha detaylı kontrol
  if (currentVersion !== latestVersion) {
    console.warn("⚠️ Version mismatch detected but update-not-available event fired!");
    console.warn("This might indicate a problem with version comparison.");
  }
  
  if (mainWindow) {
    mainWindow.webContents.send("update-not-available", {
      currentVersion: currentVersion,
      latestVersion: latestVersion,
    });
  }
});

autoUpdater.on("error", (err: Error) => {
  console.error("❌ Error in auto-updater:", err);
  console.error("- Error message:", err.message);
  console.error("- Error stack:", err.stack);
  if (mainWindow) {
    mainWindow.webContents.send("update-error", err.message || String(err));
  }
});

autoUpdater.on("download-progress", (progressObj: { percent: number; transferred: number; total: number }) => {
  console.log(`📥 Download progress: ${progressObj.percent.toFixed(2)}%`);
  console.log(`- Transferred: ${progressObj.transferred} bytes`);
  console.log(`- Total: ${progressObj.total} bytes`);
  if (mainWindow) {
    mainWindow.webContents.send("download-progress", progressObj);
  }
});

autoUpdater.on("update-downloaded", (info: { version: string; releaseDate: string; path: string }) => {
  console.log("✅ Update downloaded!");
  console.log("- Version:", info.version);
  console.log("- Release date:", info.releaseDate);
  console.log("- Path:", info.path);
  if (mainWindow) {
    mainWindow.webContents.send("update-downloaded", info.version);
  }
  // Frontend'den quitApp çağrıldığında otomatik kurulum yapılacak
  // autoUpdater.autoInstallOnAppQuit = true olduğu için uygulama kapatıldığında otomatik kurulur
});

// This method will be called when Electron has finished initialization
app.on("ready", () => {
  // Register IPC handlers on app ready
  registerIpcHandlers();
  
  createWindow();

  // Update kontrolü artık frontend'den yapılıyor (__root.tsx'te)
  // Bu sayede loading ekranı gösterilebiliyor

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

