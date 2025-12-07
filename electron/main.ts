import { app, BrowserWindow, Menu, shell, ipcMain } from "electron";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { autoUpdater } from "electron-updater";
import cron from "node-cron";
import { exec } from "child_process";
import { promisify } from "util";
import { writeFileSync, unlinkSync, readFileSync, existsSync } from "fs";
import { tmpdir } from "os";

const execAsync = promisify(exec);

// ES Module compatibility for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;

let mainWindow: BrowserWindow | null = null;

// Güncelleme bulunduğunda indirmeyi başlatmak için flag
let pendingUpdateInfo: {
  version: string;
  releaseDate: string;
  path: string;
} | null = null;

// Periyodik güncelleme kontrolü için timer
let periodicUpdateCheckInterval: NodeJS.Timeout | null = null;

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

  try {
    ipcMain.removeHandler("clear-table-history");
  } catch (e) {
    // Handler doesn't exist yet, that's fine
  }

  try {
    ipcMain.removeHandler("get-system-printers");
  } catch (e) {
    // Handler doesn't exist yet, that's fine
  }

  try {
    ipcMain.removeHandler("get-local-ip");
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
        // checkForUpdates çağrısı yap ama sonucu döndürme (IPC serialization hatası)
        // Event'ler ile zaten bildirim yapılıyor
        await autoUpdater.checkForUpdates();
        console.log("✅ Update check completed");
        // Sadece success mesajı döndür
        return { success: true };
      } catch (error) {
        console.error("❌ Error checking for updates:", error);
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error("- Error details:", error);
        if (mainWindow) {
          mainWindow.webContents.send("update-error", errorMessage);
        }
        // Hata mesajını düzgün serialize et
        return { success: false, error: errorMessage };
      }
    } else {
      console.log("⚠️ Update check skipped (development mode)");
      return { success: true, devMode: true };
    }
  });

  // Register start-download handler - login sayfasında kullanıcı onayladıktan sonra indirmeyi başlatmak için
  ipcMain.handle("start-download-update", async () => {
    console.log("📥 Starting update download manually");
    if (!isDev) {
      try {
        // autoDownload'u true yap
        autoUpdater.autoDownload = true;

        // Eğer güncelleme zaten bulunmuşsa (pendingUpdateInfo varsa), indirmeyi başlat
        if (pendingUpdateInfo) {
          console.log("✅ Pending update found, starting download...");
          // Güncelleme zaten bulunmuş, tekrar kontrol et (bu sefer autoDownload true olduğu için indirme başlayacak)
          await autoUpdater.checkForUpdates();
          console.log("✅ Download started for pending update");
          return { success: true };
        }

        // Güncelleme bulunmamışsa, yeni kontrol yap
        console.log("🔍 No pending update, checking for updates...");
        const result = await autoUpdater.checkForUpdates();

        if (result && result.updateInfo) {
          console.log("✅ Update found, download should start automatically");
          // autoDownload true olduğu için indirme otomatik başlayacak
        } else {
          console.log("⚠️ No update available");
        }

        console.log("✅ Download process initiated");
        return { success: true };
      } catch (error) {
        console.error("❌ Error starting download:", error);
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        if (mainWindow) {
          mainWindow.webContents.send("update-error", errorMessage);
        }
        return { success: false, error: errorMessage };
      }
    } else {
      console.log("⚠️ Download start skipped (development mode)");
      return { success: true, devMode: true };
    }
  });

  // Register enable-auto-download handler - login sayfasından çıkıldığında autoDownload'u tekrar true yapmak için
  ipcMain.handle("enable-auto-download", async () => {
    console.log("✅ Enabling auto download");
    if (!isDev) {
      autoUpdater.autoDownload = true;

      // Eğer bekleyen bir güncelleme varsa, renderer'a bildir
      if (pendingUpdateInfo && mainWindow) {
        console.log(
          "📢 Notifying renderer about pending update:",
          pendingUpdateInfo.version
        );

        // CHANGELOG.md'den sürüm notlarını al
        const changelogPath = join(__dirname, "..", "CHANGELOG.md");
        let releaseNotes = "";
        if (existsSync(changelogPath)) {
          try {
            const changelogContent = readFileSync(changelogPath, "utf-8");
            // En son sürüm notlarını parse et
            const versionMatch = changelogContent.match(
              new RegExp(
                `## v?${pendingUpdateInfo.version.replace(/\./g, "\\.")}[^#]*`,
                "s"
              )
            );
            if (versionMatch) {
              releaseNotes = versionMatch[0];
            } else {
              // Eğer tam versiyon bulunamazsa, en son sürüm notlarını al
              const latestMatch = changelogContent.match(/## v?[\d.]+[^#]*/s);
              if (latestMatch) {
                releaseNotes = latestMatch[0];
              }
            }
          } catch (error) {
            console.error("❌ Error reading CHANGELOG.md:", error);
          }
        }

        mainWindow.webContents.send(
          "update-available",
          pendingUpdateInfo.version,
          releaseNotes
        );
        // pendingUpdateInfo'yu temizleme - kullanıcı indirmeyi başlatana kadar sakla
      }

      // Her zaman güncelleme kontrolü yap (bekleyen güncelleme olsa bile, yeni güncellemeler olabilir)
      console.log("🔍 Checking for updates...");
      try {
        await autoUpdater.checkForUpdates();
      } catch (error) {
        console.error("❌ Error checking for updates:", error);
      }

      return { success: true };
    }
    return { success: true, devMode: true };
  });

  // Register quit-and-install handler for manual update installation
  ipcMain.handle("quit-and-install", async () => {
    console.log(
      "🔄 quit-and-install IPC handler called - installing update and quitting"
    );
    if (!isDev) {
      try {
        // Güncelleme indirildiyse kurulum yap ve çık
        // İlk parametre: isSilent (false = kullanıcıya göster)
        // İkinci parametre: isForceRunAfter (true = kurulumdan sonra otomatik başlat)
        autoUpdater.quitAndInstall(false, true);
      } catch (error) {
        console.error("❌ Error installing update:", error);
        const errorMessage =
          error instanceof Error ? error.message : String(error);
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

  // Register clear-table-history handler - renderer'dan manuel temizlik isteği için
  ipcMain.handle("clear-table-history", async () => {
    console.log("🗑️ Manual table history clear requested");
    if (mainWindow) {
      mainWindow.webContents.send("trigger-clear-table-history");
      return { success: true };
    }
    return { success: false, error: "No main window" };
  });

  // Register get-app-version handler - mevcut uygulama versiyonunu döndürür
  ipcMain.handle("get-app-version", async () => {
    return { version: app.getVersion() };
  });

  // Register get-changelog handler - CHANGELOG.md'den sürüm notlarını döndürür
  ipcMain.handle("get-changelog", async () => {
    const changelogPath = join(__dirname, "..", "CHANGELOG.md");
    if (existsSync(changelogPath)) {
      try {
        const changelogContent = readFileSync(changelogPath, "utf-8");
        // Tüm sürüm notlarını parse et
        const versions: Array<{ version: string; content: string }> = [];
        const versionMatches =
          changelogContent.matchAll(/## (v?[\d.]+)[^#]*/gs);

        for (const match of versionMatches) {
          const version = match[1].replace(/^v/, ""); // v prefix'ini kaldır
          const content = match[0].trim();
          versions.push({ version, content });
        }

        return { success: true, versions };
      } catch (error) {
        console.error("❌ Error reading CHANGELOG.md:", error);
        return { success: false, error: String(error) };
      }
    }
    return { success: false, error: "CHANGELOG.md not found" };
  });

  // Register get-system-printers handler - sistem yazıcılarını bulmak için
  ipcMain.handle("get-system-printers", async () => {
    console.log("🖨️ System printers requested");
    try {
      const formattedPrinters: Array<{
        id: string;
        name: string;
        description: string;
        status: number;
        isDefault: boolean;
        options: Record<string, any>;
      }> = [];

      // Windows için PowerShell komutu ile yazıcıları al (kağıt boyutu bilgisi ile)
      if (process.platform === "win32") {
        try {
          // WMI kullanarak yazıcı bilgilerini al (kağıt boyutu dahil)
          const { stdout } = await execAsync(
            'powershell -Command "Get-WmiObject -Class Win32_Printer | Select-Object Name, PrinterStatus, Default, PaperSizesSupported, MaxWidth, MaxHeight | ConvertTo-Json"'
          );

          const printers = JSON.parse(stdout);
          const printerArray = Array.isArray(printers) ? printers : [printers];

          printerArray.forEach((printer: any, index: number) => {
            if (printer && printer.Name) {
              // Kağıt boyutunu tespit et
              let paperWidth = 48; // Varsayılan: 80mm termal yazıcı (48 karakter)
              let paperType = "80mm"; // Varsayılan

              // MaxWidth bilgisi varsa kullan (mikron cinsinden)
              if (printer.MaxWidth) {
                const widthMM = printer.MaxWidth / 1000; // Mikron'dan mm'ye çevir
                if (widthMM >= 75 && widthMM <= 85) {
                  // 80mm termal yazıcı
                  paperWidth = 48;
                  paperType = "80mm";
                } else if (widthMM >= 55 && widthMM <= 62) {
                  // 58mm termal yazıcı
                  paperWidth = 32;
                  paperType = "58mm";
                } else if (widthMM >= 100 && widthMM <= 110) {
                  // 110mm termal yazıcı
                  paperWidth = 72;
                  paperType = "110mm";
                } else {
                  // Diğer boyutlar için hesapla (1mm ≈ 0.6 karakter)
                  paperWidth = Math.floor(widthMM * 0.6);
                  paperType = `${Math.round(widthMM)}mm`;
                }
              }

              formattedPrinters.push({
                id: `system_${printer.Name}_${index}`,
                name: printer.Name,
                description: printer.PrinterStatus || "",
                status:
                  printer.PrinterStatus === 3
                    ? 0
                    : printer.PrinterStatus === 4
                      ? 1
                      : 2, // 3=Idle, 4=Printing
                isDefault: printer.Default === true,
                options: {
                  paperWidth: paperWidth,
                  paperType: paperType,
                  maxWidth: printer.MaxWidth,
                  maxHeight: printer.MaxHeight,
                },
              });
            }
          });
        } catch (error) {
          console.error("PowerShell command error:", error);
          // Fallback: Basit Get-Printer komutu
          try {
            const { stdout } = await execAsync(
              'powershell -Command "Get-Printer | Select-Object Name, PrinterStatus, Default | ConvertTo-Json"'
            );

            const printers = JSON.parse(stdout);
            const printerArray = Array.isArray(printers)
              ? printers
              : [printers];

            printerArray.forEach((printer: any, index: number) => {
              if (printer && printer.Name) {
                formattedPrinters.push({
                  id: `system_${printer.Name}_${index}`,
                  name: printer.Name,
                  description: printer.PrinterStatus || "",
                  status:
                    printer.PrinterStatus === "Idle"
                      ? 0
                      : printer.PrinterStatus === "Printing"
                        ? 1
                        : 2,
                  isDefault: printer.Default === true,
                  options: {
                    paperWidth: 48, // Varsayılan
                    paperType: "80mm",
                  },
                });
              }
            });
          } catch (fallbackError) {
            console.error("Fallback PowerShell command error:", fallbackError);
          }
        }
      } else if (process.platform === "darwin") {
        // macOS için lpstat komutu
        try {
          const { stdout } = await execAsync("lpstat -p -d");
          const lines = stdout.split("\n");
          let defaultPrinter = "";

          // Varsayılan yazıcıyı bul
          try {
            const { stdout: defaultStdout } = await execAsync("lpstat -d");
            const defaultMatch = defaultStdout.match(
              /system default destination: (.+)/
            );
            if (defaultMatch) {
              defaultPrinter = defaultMatch[1];
            }
          } catch (e) {
            // Ignore
          }

          lines.forEach((line: string, index: number) => {
            const match = line.match(/printer (.+) is/);
            if (match) {
              const printerName = match[1];
              formattedPrinters.push({
                id: `system_${printerName}_${index}`,
                name: printerName,
                description: "",
                status: 0,
                isDefault: printerName === defaultPrinter,
                options: {},
              });
            }
          });
        } catch (error) {
          console.error("lpstat command error:", error);
        }
      } else {
        // Linux için lpstat komutu
        try {
          const { stdout } = await execAsync("lpstat -p -d");
          const lines = stdout.split("\n");
          let defaultPrinter = "";

          try {
            const { stdout: defaultStdout } = await execAsync("lpstat -d");
            const defaultMatch = defaultStdout.match(
              /system default destination: (.+)/
            );
            if (defaultMatch) {
              defaultPrinter = defaultMatch[1];
            }
          } catch (e) {
            // Ignore
          }

          lines.forEach((line: string, index: number) => {
            const match = line.match(/printer (.+) is/);
            if (match) {
              const printerName = match[1];
              formattedPrinters.push({
                id: `system_${printerName}_${index}`,
                name: printerName,
                description: "",
                status: 0,
                isDefault: printerName === defaultPrinter,
                options: {},
              });
            }
          });
        } catch (error) {
          console.error("lpstat command error:", error);
        }
      }

      console.log(`✅ Found ${formattedPrinters.length} system printers`);

      return {
        success: true,
        printers: formattedPrinters,
      };
    } catch (error) {
      console.error("❌ Error getting system printers:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage,
        printers: [],
      };
    }
  });

  // Register print handler - yazıcıya yazdırma için
  ipcMain.handle(
    "print",
    async (
      _event,
      data: {
        printerName: string;
        content: string;
        type?: "order" | "cancel" | "payment";
      }
    ) => {
      console.log(
        `🖨️ Print request: ${data.type || "order"} to "${data.printerName}"`
      );
      console.log(`📄 Content length: ${data.content.length} bytes`);
      console.log(
        `📄 Content preview (first 100 chars): ${data.content.substring(0, 100).replace(/[\x00-\x1F]/g, ".")}`
      );

      try {
        if (process.platform === "win32") {
          // Windows'ta düz metin yazdırma - notepad /p kullan
          // Bu method Türkçe karakterleri doğru yazdırır
          const tempFile = join(tmpdir(), `print_${Date.now()}.txt`);

          // Düz metin olarak kaydet (UTF-8 with BOM)
          writeFileSync(tempFile, "\uFEFF" + data.content, "utf-8");
          console.log(`📁 Temp file created: ${tempFile}`);

          try {
            // Notepad /PT komutu ile yazdır (sessiz yazdırma)
            // /PT: Print to printer without dialog
            console.log(
              `📤 Attempting to print via notepad to: ${data.printerName}`
            );

            try {
              // PowerShell kullanarak notepad'i yazdırma modunda çalıştır
              const printerNameSafe = data.printerName.replace(/"/g, '`"');
              const tempFileSafe = tempFile.replace(/\\/g, "\\\\");
              const psScript = `$printerName = "${printerNameSafe}";
$file = "${tempFileSafe}";

# Notepad ile yazdır
Start-Process -FilePath "notepad.exe" -ArgumentList "/pt","\`"$file\`"","\`"$printerName\`"" -Wait -WindowStyle Hidden;

# Biraz bekle
Start-Sleep -Milliseconds 500;

Write-Output "SUCCESS";`;

              const psScriptFile = join(
                tmpdir(),
                `print_script_${Date.now()}.ps1`
              );
              writeFileSync(psScriptFile, psScript, "utf-8");

              const { stdout, stderr } = await execAsync(
                `powershell -NoProfile -ExecutionPolicy Bypass -File "${psScriptFile}"`,
                { maxBuffer: 1024 * 1024, timeout: 30000 }
              );

              console.log(`📤 PowerShell stdout: ${stdout}`);
              if (stderr) console.log(`⚠️ PowerShell stderr: ${stderr}`);

              // Script ve temp dosyayı temizle
              try {
                unlinkSync(psScriptFile);
                // Dosyayı hemen silme, biraz bekle (yazdırma tamamlansın)
                setTimeout(() => {
                  try {
                    unlinkSync(tempFile);
                  } catch (e) {
                    // Ignore
                  }
                }, 2000);
              } catch (e) {
                console.warn("Could not delete files:", e);
              }

              console.log(
                `✅ Printed successfully to ${data.printerName} (notepad)`
              );
              return { success: true };
            } catch (notepadError) {
              console.warn(
                "notepad command failed, trying alternative:",
                notepadError
              );

              // Alternatif yöntem: Out-Printer kullan (Windows'ın kendi yazdırma komutu)
              const printerNameSafe2 = data.printerName.replace(/"/g, '`"');
              const tempFileSafe2 = tempFile.replace(/\\/g, "\\\\");
              const psScriptFile = join(
                tmpdir(),
                `print_script_${Date.now()}.ps1`
              );
              const psScriptContent = `$printerName = "${printerNameSafe2}";
$file = "${tempFileSafe2}";

Write-Host "Printer: $printerName";
Write-Host "File: $file";

if (-not (Test-Path $file)) {
  Write-Output "ERROR: File not found: $file";
  exit 1;
}

# Yazıcıyı kontrol et
$printer = Get-Printer -Name $printerName -ErrorAction SilentlyContinue;
if (-not $printer) {
  Write-Output "ERROR: Printer '$printerName' not found";
  exit 1;
}

# Out-Printer ile düz metin yazdır (Windows'ın kendi yazdırma komutu)
try {
  Get-Content -Path $file -Encoding UTF8 | Out-Printer -Name $printerName;
  Write-Output "SUCCESS";
} catch {
  Write-Output "ERROR: Print failed - $($_.Exception.Message)";
  exit 1;
}`;

              writeFileSync(psScriptFile, psScriptContent, "utf-8");

              const { stdout, stderr } = await execAsync(
                `powershell -NoProfile -ExecutionPolicy Bypass -File "${psScriptFile}"`,
                { maxBuffer: 1024 * 1024, timeout: 30000 }
              );

              console.log(`📤 PowerShell stdout: ${stdout}`);
              if (stderr) console.log(`⚠️ PowerShell stderr: ${stderr}`);

              // Script dosyasını temizle
              try {
                unlinkSync(psScriptFile);
                setTimeout(() => {
                  try {
                    unlinkSync(tempFile);
                  } catch (e) {
                    // Ignore
                  }
                }, 2000);
              } catch (e) {
                console.warn("Could not delete files:", e);
              }

              if (stdout && stdout.includes("SUCCESS")) {
                console.log(
                  `✅ Printed successfully to ${data.printerName} (Out-Printer)`
                );
                return { success: true };
              } else {
                const errorMsg = stdout || stderr || "Print command failed";
                console.error(`❌ Print failed: ${errorMsg}`);
                throw new Error(errorMsg);
              }
            }
          } catch (error) {
            // Dosyayı temizle
            try {
              setTimeout(() => {
                try {
                  unlinkSync(tempFile);
                } catch (e) {
                  // Ignore
                }
              }, 2000);
            } catch (e) {
              console.warn("Could not delete temp file:", e);
            }

            console.error("❌ Print error:", error);
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            throw new Error(`Print failed: ${errorMessage}`);
          }
        } else if (process.platform === "darwin") {
          // macOS için lp komutu
          const tempFile = join(tmpdir(), `print_${Date.now()}.txt`);
          writeFileSync(tempFile, data.content, "utf-8");

          try {
            await execAsync(`lp -d "${data.printerName}" "${tempFile}"`);
            unlinkSync(tempFile);
            console.log(`✅ Printed successfully to ${data.printerName}`);
            return { success: true };
          } catch (error) {
            unlinkSync(tempFile);
            throw error;
          }
        } else {
          // Linux için lp komutu
          const tempFile = join(tmpdir(), `print_${Date.now()}.txt`);
          writeFileSync(tempFile, data.content, "utf-8");

          try {
            await execAsync(`lp -d "${data.printerName}" "${tempFile}"`);
            unlinkSync(tempFile);
            console.log(`✅ Printed successfully to ${data.printerName}`);
            return { success: true };
          } catch (error) {
            unlinkSync(tempFile);
            throw error;
          }
        }
      } catch (error) {
        console.error("❌ Error printing:", error);
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        return {
          success: false,
          error: errorMessage,
        };
      }
    }
  );

  // Register get-local-ip handler - yerel IP adresini döndürür
  ipcMain.handle("get-local-ip", async () => {
    try {
      const os = await import("os");
      const networkInterfaces = os.networkInterfaces();

      // WiFi veya Ethernet arayüzlerinden IP'yi bul
      for (const interfaceName in networkInterfaces) {
        const interfaces = networkInterfaces[interfaceName];
        if (!interfaces) continue;

        for (const iface of interfaces) {
          // IPv4 ve internal olmayan (local network) IP'leri tercih et
          if (iface.family === "IPv4" && !iface.internal) {
            // WiFi veya Ethernet arayüzlerini kontrol et
            if (
              interfaceName.toLowerCase().includes("wifi") ||
              interfaceName.toLowerCase().includes("wireless") ||
              interfaceName.toLowerCase().includes("ethernet") ||
              interfaceName.toLowerCase().includes("lan") ||
              interfaceName.toLowerCase().includes("local area connection")
            ) {
              return { ip: iface.address };
            }
          }
        }
      }

      // Eğer WiFi/Ethernet bulunamazsa, ilk IPv4 internal olmayan IP'yi döndür
      for (const interfaceName in networkInterfaces) {
        const interfaces = networkInterfaces[interfaceName];
        if (!interfaces) continue;

        for (const iface of interfaces) {
          if (iface.family === "IPv4" && !iface.internal) {
            return { ip: iface.address };
          }
        }
      }

      return { ip: null };
    } catch (error) {
      console.error("❌ Error getting local IP:", error);
      return { ip: null };
    }
  });

  console.log(
    "IPC handlers registered: quit-app, check-for-updates, quit-and-install, clear-table-history, get-system-printers, print, get-local-ip at",
    new Date().toISOString()
  );
}

// Masa geçmişi temizleme cron job'ı - her gece 03:00'da çalışır
function setupTableHistoryCleanupCron() {
  // Cron pattern: "0 3 * * *" = Her gün saat 03:00'da
  cron.schedule(
    "0 3 * * *",
    () => {
      console.log(
        "🗑️ Scheduled table history cleanup triggered at",
        new Date().toISOString()
      );
      if (mainWindow) {
        mainWindow.webContents.send("trigger-clear-table-history");
      }
    },
    {
      timezone: "Europe/Istanbul", // Türkiye saat dilimi
    }
  );
  console.log("✅ Table history cleanup cron job scheduled for 03:00 daily");
}

// Auto-updater configuration
// Login sayfasında autoDownload false olacak, login yapıldıktan sonra true yapılacak
autoUpdater.autoDownload = false;
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
  setInterval(
    () => {
      try {
        autoUpdater.checkForUpdates().catch((err) => {
          console.error("Error checking for updates (interval):", err);
        });
      } catch (err) {
        console.error("Error checking for updates (interval):", err);
      }
    },
    4 * 60 * 60 * 1000
  ); // 4 hours
}

const createWindow = (): void => {
  // Create the browser window
  const preloadPath = join(__dirname, "preload.js");
  // Icon path - Windows için .ico, diğer platformlar için PNG
  const iconPath =
    process.platform === "win32"
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

    // Focus'u window'a ver (input'ların çalışması için)
    mainWindow?.focus();
    mainWindow?.webContents.focus();

    // Birden fazla kez focus ver (input'ların kesinlikle çalışması için)
    setTimeout(() => {
      mainWindow?.focus();
      mainWindow?.webContents.focus();
    }, 100);

    setTimeout(() => {
      mainWindow?.focus();
      mainWindow?.webContents.focus();
    }, 300);

    setTimeout(() => {
      mainWindow?.focus();
      mainWindow?.webContents.focus();
    }, 500);

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
  }

  // Window focus olaylarını dinle
  mainWindow.on("focus", () => {
    // Window focus aldığında webContents'e de focus ver
    mainWindow?.webContents.focus();
  });

  mainWindow.on("blur", () => {
    // Window blur olduğunda (alt+tab ile çıkıldığında)
    // Tekrar focus alındığında input'ların çalışması için hazırla
    console.log("Window blur - focus kaybedildi");
  });

  mainWindow.on("restore", () => {
    // Window restore olduğunda focus ver
    mainWindow?.focus();
    mainWindow?.webContents.focus();
  });

  if (isDev) {
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

  // Window yüklendiğinde eğer bekleyen güncelleme varsa bildir
  mainWindow.webContents.once("did-finish-load", () => {
    if (pendingUpdateInfo && mainWindow) {
      console.log(
        "📢 Window loaded, sending pending update notification:",
        pendingUpdateInfo.version
      );

      // CHANGELOG.md'den sürüm notlarını al
      const changelogPath = join(__dirname, "..", "CHANGELOG.md");
      let releaseNotes = "";
      if (existsSync(changelogPath)) {
        try {
          const changelogContent = readFileSync(changelogPath, "utf-8");
          // En son sürüm notlarını parse et
          const versionMatch = changelogContent.match(
            new RegExp(
              `## v?${pendingUpdateInfo.version.replace(/\./g, "\\.")}[^#]*`,
              "s"
            )
          );
          if (versionMatch) {
            releaseNotes = versionMatch[0];
          } else {
            // Eğer tam versiyon bulunamazsa, en son sürüm notlarını al
            const latestMatch = changelogContent.match(/## v?[\d.]+[^#]*/s);
            if (latestMatch) {
              releaseNotes = latestMatch[0];
            }
          }
        } catch (error) {
          console.error("❌ Error reading CHANGELOG.md:", error);
        }
      }

      // Renderer'a bildirim gönder
      mainWindow.webContents.send(
        "update-available",
        pendingUpdateInfo.version,
        releaseNotes
      );
    }
  });

  // Uygulama tamamen kapandığında localStorage'ı temizle
  mainWindow.webContents.on("destroyed", () => {
    console.log("WebContents destroyed - cleaning up");
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

autoUpdater.on(
  "update-available",
  (info: { version: string; releaseDate: string; path: string }) => {
    console.log("✅ Update available!");
    console.log("- New version:", info.version);
    console.log("- Current version:", app.getVersion());
    console.log("- Release date:", info.releaseDate);
    console.log("- Path:", info.path);
    console.log("- Auto download:", autoUpdater.autoDownload);

    // Güncelleme bilgisini sakla (manuel indirme için)
    pendingUpdateInfo = info;

    // CHANGELOG.md'den sürüm notlarını al
    const changelogPath = join(__dirname, "..", "CHANGELOG.md");
    let releaseNotes = "";
    if (existsSync(changelogPath)) {
      try {
        const changelogContent = readFileSync(changelogPath, "utf-8");
        // En son sürüm notlarını parse et
        const versionMatch = changelogContent.match(
          new RegExp(`## v?${info.version.replace(/\./g, "\\.")}[^#]*`, "s")
        );
        if (versionMatch) {
          releaseNotes = versionMatch[0];
        } else {
          // Eğer tam versiyon bulunamazsa, en son sürüm notlarını al
          const latestMatch = changelogContent.match(/## v?[\d.]+[^#]*/s);
          if (latestMatch) {
            releaseNotes = latestMatch[0];
          }
        }
      } catch (error) {
        console.error("❌ Error reading CHANGELOG.md:", error);
      }
    }

    // Her zaman renderer'a bildirim gönder (login sayfasında da, oturum açıkta da)
    // Kullanıcı her durumda güncelleme bildirimini görmeli
    if (mainWindow) {
      console.log("📢 Sending update-available event to renderer");
      mainWindow.webContents.send(
        "update-available",
        info.version,
        releaseNotes
      );
    }

    // Eğer autoDownload false ise, indirmeyi durdur (login sayfasında kullanıcı onayı bekleniyor)
    if (!autoUpdater.autoDownload) {
      console.log("⏸️ Auto download disabled - waiting for user confirmation");
    } else {
      // autoDownload true ise indirme otomatik başlayacak
      console.log(
        "📥 Auto download enabled - download will start automatically"
      );
    }
  }
);

autoUpdater.on("update-not-available", (info: { version: string }) => {
  const currentVersion = app.getVersion();
  const latestVersion = info.version;

  console.log("ℹ️ Update not available");
  console.log("- Current version:", currentVersion);
  console.log("- Latest version:", latestVersion);
  console.log("- Versions match:", currentVersion === latestVersion);

  // Version karşılaştırması için daha detaylı kontrol
  if (currentVersion !== latestVersion) {
    console.warn(
      "⚠️ Version mismatch detected but update-not-available event fired!"
    );
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

autoUpdater.on(
  "download-progress",
  (progressObj: { percent: number; transferred: number; total: number }) => {
    console.log(`📥 Download progress: ${progressObj.percent.toFixed(2)}%`);
    console.log(`- Transferred: ${progressObj.transferred} bytes`);
    console.log(`- Total: ${progressObj.total} bytes`);
    if (mainWindow) {
      mainWindow.webContents.send("download-progress", progressObj);
    }
  }
);

autoUpdater.on(
  "update-downloaded",
  (info: { version: string; releaseDate: string; path: string }) => {
    console.log("✅ Update downloaded!");
    console.log("- Version:", info.version);
    console.log("- Release date:", info.releaseDate);
    console.log("- Path:", info.path);

    // Güncelleme indirildi, pendingUpdateInfo'yu temizle
    pendingUpdateInfo = null;

    if (mainWindow) {
      mainWindow.webContents.send("update-downloaded", info.version);
    }
    // Frontend'den quitApp çağrıldığında otomatik kurulum yapılacak
    // autoUpdater.autoInstallOnAppQuit = true olduğu için uygulama kapatıldığında otomatik kurulur
    // Güncelleme indirildiğinde otomatik kurulum için hazır
  }
);

// This method will be called when Electron has finished initialization
app.on("ready", () => {
  // Windows için app user model ID ayarla
  if (process.platform === "win32") {
    app.setAppUserModelId("com.borgeto.pos");
  }

  // Register IPC handlers on app ready
  registerIpcHandlers();

  // Setup table history cleanup cron job
  setupTableHistoryCleanupCron();

  createWindow();

  // Otomatik güncelleme kontrolü - production'da çalışır
  if (!isDev) {
    console.log("🔍 Starting automatic update check on app ready...");
    // Window hazır olduktan hemen sonra güncelleme kontrolü yap
    // Login sayfasında olduğumuz için autoDownload'u false yap (kullanıcı onayı bekleniyor)
    setTimeout(() => {
      // Login sayfasında olduğumuzu kontrol et (URL'den)
      if (mainWindow) {
        mainWindow.webContents.once("did-finish-load", () => {
          mainWindow?.webContents
            .executeJavaScript("window.location.pathname")
            .then((pathname) => {
              if (
                pathname === "/auth/login" ||
                pathname.includes("/auth/login")
              ) {
                console.log("🔐 Login page detected - disabling auto download");
                autoUpdater.autoDownload = false;
              }
              // Güncelleme kontrolü yap
              autoUpdater.checkForUpdates().catch((err) => {
                console.error("❌ Error checking for updates on startup:", err);
              });
            })
            .catch(() => {
              // Hata durumunda normal kontrol yap
              // Login sayfasında olduğumuzu varsay
              autoUpdater.autoDownload = false;
              autoUpdater.checkForUpdates().catch((err) => {
                console.error("❌ Error checking for updates on startup:", err);
              });
            });
        });
      } else {
        // Window yoksa normal kontrol yap
        autoUpdater.autoDownload = false; // Güvenli tarafta olmak için false yap
        autoUpdater.checkForUpdates().catch((err) => {
          console.error("❌ Error checking for updates on startup:", err);
        });
      }
    }, 2000);

    // Periyodik güncelleme kontrolü - her 30 dakikada bir
    console.log("⏰ Setting up periodic update check (every 30 minutes)");
    periodicUpdateCheckInterval = setInterval(
      () => {
        if (!isDev && mainWindow) {
          console.log("🔍 Periodic update check triggered");
          autoUpdater.checkForUpdates().catch((err) => {
            console.error("❌ Error in periodic update check:", err);
          });
        }
      },
      30 * 60 * 1000
    ); // 30 dakika
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
  // Periyodik güncelleme kontrolünü temizle
  if (periodicUpdateCheckInterval) {
    clearInterval(periodicUpdateCheckInterval);
    periodicUpdateCheckInterval = null;
  }

  // On macOS, keep app running even when all windows are closed
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// Uygulama kapanmadan önce localStorage'ı TEMİZLEME - oturum kalıcı olsun
// app.on("before-quit", () => {
//   if (mainWindow && !mainWindow.isDestroyed()) {
//     // WebContents'e localStorage temizleme komutu gönder
//     mainWindow.webContents.executeJavaScript(`
//       try {
//         localStorage.removeItem("posAuth");
//         console.log("localStorage cleaned on app quit");
//       } catch (e) {
//         console.error("Error cleaning localStorage:", e);
//       }
//     `).catch(err => {
//       console.error("Failed to clean localStorage:", err);
//     });
//   }
// });

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
