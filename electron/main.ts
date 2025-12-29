import { app, BrowserWindow, Menu, shell, ipcMain } from "electron";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { autoUpdater } from "electron-updater";
import cron from "node-cron";
import { exec } from "child_process";
import { promisify } from "util";
import { writeFileSync, unlinkSync, readFileSync, existsSync } from "fs";
import { tmpdir } from "os";

// EN ÖNCE: stdout/stderr'i güvenli hale getir - console hatalarını önlemek için
// Bu, tüm kod çalıştırmadan ÖNCE yapılmalı
try {
  // stdout'un write metodunu güvenli hale getir
  if (process.stdout && typeof process.stdout.write === "function") {
    const originalStdoutWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = function (
      chunk: any,
      encoding?: any,
      cb?: any
    ): boolean {
      try {
        if (process.stdout.writable && !process.stdout.destroyed) {
          return originalStdoutWrite(chunk, encoding, cb);
        }
        // Yazılamazsa callback'i çağır (varsa) ve true döndür
        if (typeof cb === "function") {
          cb(null);
        }
        return true;
      } catch (error) {
        // Hata oluşursa callback'i çağır (varsa) ve true döndür
        if (typeof cb === "function") {
          cb(error);
        }
        return true;
      }
    };
  }

  // stderr'in write metodunu güvenli hale getir
  if (process.stderr && typeof process.stderr.write === "function") {
    const originalStderrWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = function (
      chunk: any,
      encoding?: any,
      cb?: any
    ): boolean {
      try {
        if (process.stderr.writable && !process.stderr.destroyed) {
          return originalStderrWrite(chunk, encoding, cb);
        }
        // Yazılamazsa callback'i çağır (varsa) ve true döndür
        if (typeof cb === "function") {
          cb(null);
        }
        return true;
      } catch (error) {
        // Hata oluşursa callback'i çağır (varsa) ve true döndür
        if (typeof cb === "function") {
          cb(error);
        }
        return true;
      }
    };
  }
} catch (error) {
  // stdout/stderr override hatası - sessizce geç
}

const execAsync = promisify(exec);

// ES Module compatibility for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;

// Güvenli logging fonksiyonu - stdout/stderr hatalarını önler
// Önce orijinal console'u sakla
const originalConsole = {
  log: console.log.bind(console),
  error: console.error.bind(console),
  warn: console.warn.bind(console),
  info: console.info.bind(console),
  debug: console.debug.bind(console),
};

function safeLog(...args: any[]): void {
  try {
    if (
      process.stdout &&
      process.stdout.writable &&
      !process.stdout.destroyed
    ) {
      originalConsole.log(...args);
    }
  } catch (error) {
    // stdout'a yazma hatası - sessizce geç
  }
}

function safeError(...args: any[]): void {
  try {
    if (
      process.stderr &&
      process.stderr.writable &&
      !process.stderr.destroyed
    ) {
      originalConsole.error(...args);
    }
  } catch (error) {
    // stderr'a yazma hatası - sessizce geç
  }
}

function safeWarn(...args: any[]): void {
  try {
    if (
      process.stderr &&
      process.stderr.writable &&
      !process.stderr.destroyed
    ) {
      originalConsole.warn(...args);
    }
  } catch (error) {
    // stderr'a yazma hatası - sessizce geç
  }
}

// Console'u güvenli hale getir - tüm console çağrıları güvenli olacak
console.log = safeLog;
console.error = safeError;
console.warn = safeWarn;
console.info = safeLog;
console.debug = safeLog;

// Uncaught exception handler'ları EN BAŞTA tanımla - process crash'lerini önlemek için
// Bu handler'lar app.on("ready")'den ÖNCE tanımlanmalı
process.on("uncaughtException", (error: Error) => {
  safeError("❌ Uncaught Exception:", error);
  safeError("- Message:", error.message);
  safeError("- Stack:", error.stack);
  // Process'i kapatma, sadece log'la (uygulama çalışmaya devam etsin)
});

process.on("unhandledRejection", (reason: any, promise: Promise<any>) => {
  safeError("❌ Unhandled Rejection at:", promise);
  safeError("- Reason:", reason);
  // Process'i kapatma, sadece log'la (uygulama çalışmaya devam etsin)
});

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

  try {
    ipcMain.removeHandler("open-dev-tools");
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

  // Register enable-auto-download handler - ARTIK KULLANILMIYOR
  // Kullanıcı sadece "İndir ve Kur" butonuna bastığında indirme başlayacak
  ipcMain.handle("enable-auto-download", async () => {
    console.log("⚠️ enable-auto-download called but auto-download is disabled - user must click download button");
    if (!isDev) {
      // autoDownload'u false tut - kullanıcı butona basana kadar indirme yapılmayacak
      autoUpdater.autoDownload = false;

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

      // Güncelleme kontrolü yapma - kullanıcı butona basana kadar bekle
      // Güncelleme kontrolü zaten periyodik olarak yapılıyor
      console.log("⏸️ Auto download disabled - waiting for user to click download button");

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

      // Windows için kapsamlı yazıcı tarama (USB, WiFi, Bluetooth, Network)
      if (process.platform === "win32") {
        try {
          // PowerShell script'ini geçici dosyaya yaz ve çalıştır (escape sorunlarını önlemek için)
          const powershellScript = `
$printers = @()
try {
  # WMI ile tüm yazıcıları al (detaylı bilgi ile)
  $wmiPrinters = Get-WmiObject -Class Win32_Printer -ErrorAction SilentlyContinue | Select-Object Name, PrinterStatus, Default, PortName, Local, Network, Shared, DeviceID, Location, Comment, WorkOffline
  
  foreach ($printer in $wmiPrinters) {
    # Bağlantı türünü belirle
    $connectionType = "unknown"
    $portName = if ($printer.PortName) { $printer.PortName.ToLower() } else { "" }
    
    if ($portName -like "*usb*" -or $portName -like "*dot4*" -or $portName -like "*wsd*" -or $portName.StartsWith("USB")) {
      $connectionType = "usb"
    } elseif ($portName -like "*tcp*" -or $portName -like "*ip*" -or $portName -like "*lpd*" -or $portName -like "*9100*" -or $portName -like "*snmp*" -or $portName -like "*http*" -or $portName -like "*https*") {
      $connectionType = "network"
    } elseif ($portName -like "*bth*" -or $portName -like "*bluetooth*") {
      $connectionType = "bluetooth"
    } elseif ($portName -like "*com*" -or $portName -like "*lpt*" -or $portName -like "*serial*") {
      $connectionType = "serial"
    } elseif ($printer.Network -eq $true -or $printer.Shared -eq $true) {
      $connectionType = "network"
    } elseif ($printer.Local -eq $true -and -not $portName -like "*tcp*") {
      $connectionType = "usb"
    }
    
    # Kağıt boyutu bilgilerini al
    $maxWidth = $null
    $maxHeight = $null
    try {
      $printerNameEscaped = $printer.Name -replace "'", "''"
      $printerConfig = Get-WmiObject -Class Win32_PrinterConfiguration -Filter "Name='$printerNameEscaped'" -ErrorAction SilentlyContinue
      if ($printerConfig) {
        $maxWidth = $printerConfig.MaxExtentX
        $maxHeight = $printerConfig.MaxExtentY
      }
    } catch {}
    
    $printers += @{
      Name = $printer.Name
      PrinterStatus = $printer.PrinterStatus
      Default = $printer.Default
      PortName = $printer.PortName
      ConnectionType = $connectionType
      Network = $printer.Network
      Local = $printer.Local
      Shared = $printer.Shared
      Location = $printer.Location
      Comment = $printer.Comment
      DeviceID = $printer.DeviceID
      WorkOffline = $printer.WorkOffline
      MaxWidth = $maxWidth
      MaxHeight = $maxHeight
    }
  }
  
  # Alternatif: PowerShell Get-Printer cmdlet ile (daha modern, bazı yazıcıları daha iyi bulur)
  try {
    $psPrinters = Get-Printer -ErrorAction SilentlyContinue | Select-Object Name, PrinterStatus, Type, PortName, Shared, Default
    foreach ($printer in $psPrinters) {
      # Eğer WMI'de yoksa ekle
      $exists = $printers | Where-Object { $_.Name -eq $printer.Name }
      if (-not $exists) {
        $connectionType = "unknown"
        $portName = if ($printer.PortName) { $printer.PortName.ToLower() } else { "" }
        
        if ($portName -like "*usb*" -or $portName -like "*dot4*" -or $portName -like "*wsd*") {
          $connectionType = "usb"
        } elseif ($portName -like "*tcp*" -or $portName -like "*ip*" -or $portName -like "*lpd*" -or $portName -like "*9100*") {
          $connectionType = "network"
        } elseif ($portName -like "*bth*" -or $portName -like "*bluetooth*") {
          $connectionType = "bluetooth"
        } elseif ($printer.Type -like "*Network*" -or $printer.Shared -eq $true) {
          $connectionType = "network"
        } elseif ($printer.Type -like "*Local*") {
          $connectionType = "usb"
        }
        
        $printers += @{
          Name = $printer.Name
          PrinterStatus = if ($printer.PrinterStatus -eq "Idle") { 3 } elseif ($printer.PrinterStatus -eq "Printing") { 4 } else { 0 }
          Default = $printer.Default
          PortName = $printer.PortName
          ConnectionType = $connectionType
          Network = $printer.Shared -eq $true
          Local = $printer.Shared -eq $false
          Shared = $printer.Shared
          Location = ""
          Comment = ""
          DeviceID = $printer.Name
          WorkOffline = $false
          MaxWidth = $null
          MaxHeight = $null
        }
      }
    }
  } catch {}
  
  # Network yazıcıları için ekstra tarama (WSD, Bonjour, vs.)
  try {
    $networkPrinters = Get-PrinterPort -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "*TCP*" -or $_.Name -like "*WSD*" -or $_.Name -like "*IP*" } | Select-Object Name, Description
    foreach ($port in $networkPrinters) {
      # Port'a bağlı yazıcıları bul
      $portPrinters = $printers | Where-Object { $_.PortName -eq $port.Name }
      foreach ($p in $portPrinters) {
        if ($p.ConnectionType -eq "unknown" -or $p.ConnectionType -eq "usb") {
          $p.ConnectionType = "network"
        }
      }
    }
  } catch {}
  
} catch {
  Write-Error $_.Exception.Message
}

$printers | ConvertTo-Json -Depth 10
          `.trim();

          // Script'i geçici dosyaya yaz
          const scriptPath = join(tmpdir(), `get-printers-${Date.now()}.ps1`);
          writeFileSync(scriptPath, powershellScript, "utf8");

          try {
          const { stdout } = await execAsync(
              `powershell -ExecutionPolicy Bypass -File "${scriptPath}"`
            );

            // Geçici dosyayı temizle
            try {
              unlinkSync(scriptPath);
            } catch (e) {
              // Dosya silme hatası - önemli değil
            }

          const printers = JSON.parse(stdout);
          const printerArray = Array.isArray(printers) ? printers : [printers];

          printerArray.forEach((printer: any, index: number) => {
            if (printer && printer.Name) {
              // Kağıt boyutunu tespit et
              let paperWidth = 56; // Varsayılan: 80mm termal yazıcı (56 karakter - küçük font)
              let paperType = "80mm"; // Varsayılan

              // MaxWidth bilgisi varsa kullan (mikron veya pixel cinsinden olabilir)
              if (printer.MaxWidth) {
                let widthMM = printer.MaxWidth / 1000; // Mikron'dan mm'ye çevir (eğer mikron ise)
                // Eğer çok büyükse (pixel olabilir), farklı hesaplama yap
                if (widthMM > 1000) {
                  widthMM = printer.MaxWidth / 100; // Pixel olabilir
                }
                if (widthMM >= 75 && widthMM <= 85) {
                  paperWidth = 56;
                  paperType = "80mm";
                } else if (widthMM >= 55 && widthMM <= 62) {
                  paperWidth = 40;
                  paperType = "58mm";
                } else if (widthMM >= 100 && widthMM <= 110) {
                  paperWidth = 80;
                  paperType = "110mm";
                } else {
                  paperWidth = Math.floor(widthMM * 0.7);
                  paperType = `${Math.round(widthMM)}mm`;
                }
              }

              // Bağlantı türü açıklaması
              let connectionDescription = "";
              if (printer.ConnectionType === "usb") {
                connectionDescription = "USB Bağlantı";
              } else if (printer.ConnectionType === "network") {
                connectionDescription = "WiFi/Ağ Bağlantı";
              } else if (printer.ConnectionType === "bluetooth") {
                connectionDescription = "Bluetooth Bağlantı";
              } else if (printer.ConnectionType === "serial") {
                connectionDescription = "Seri Port Bağlantı";
              } else {
                connectionDescription = printer.PortName || "Bilinmeyen Bağlantı";
              }

              // Location veya Comment bilgisi varsa description'a ekle
              const locationInfo = printer.Location ? ` [${printer.Location}]` : "";
              const commentInfo = printer.Comment ? ` - ${printer.Comment}` : "";
              const description = `${connectionDescription}${locationInfo}${commentInfo}`;

              formattedPrinters.push({
                id: `system_${printer.Name.replace(/[^a-zA-Z0-9]/g, "_")}_${index}`,
                name: printer.Name,
                description: description,
                status:
                  printer.PrinterStatus === 3 || printer.PrinterStatus === "Idle"
                    ? 0
                    : printer.PrinterStatus === 4 || printer.PrinterStatus === "Printing"
                      ? 1
                      : printer.WorkOffline === true
                        ? 2
                        : 0,
                isDefault: printer.Default === true,
                options: {
                  paperWidth: paperWidth,
                  paperType: paperType,
                  maxWidth: printer.MaxWidth,
                  maxHeight: printer.MaxHeight,
                  connectionType: printer.ConnectionType || "unknown",
                  portName: printer.PortName || "",
                },
              });
            }
          });
          } catch (execError) {
            // Geçici dosyayı temizle (hata durumunda da)
            try {
              if (existsSync(scriptPath)) {
                unlinkSync(scriptPath);
              }
            } catch (e) {
              // Dosya silme hatası - önemli değil
            }
            throw execError;
          }
        } catch (error) {
          console.error("PowerShell command error:", error);
          // Fallback: Basit Get-Printer komutu
          try {
            const { stdout } = await execAsync(
              'powershell -Command "Get-Printer | Select-Object Name, PrinterStatus, Default, PortName | ConvertTo-Json"'
            );

            const printers = JSON.parse(stdout);
            const printerArray = Array.isArray(printers)
              ? printers
              : [printers];

            printerArray.forEach((printer: any, index: number) => {
              if (printer && printer.Name) {
                // Bağlantı türünü port name'den tespit et
                const portName = (printer.PortName || "").toLowerCase();
                let connectionType = "unknown";
                if (portName.includes("usb") || portName.includes("dot4")) {
                  connectionType = "usb";
                } else if (portName.includes("tcp") || portName.includes("ip") || portName.includes("9100")) {
                  connectionType = "network";
                } else if (portName.includes("bth") || portName.includes("bluetooth")) {
                  connectionType = "bluetooth";
                }

                formattedPrinters.push({
                  id: `system_${printer.Name.replace(/[^a-zA-Z0-9]/g, "_")}_${index}`,
                  name: printer.Name,
                  description: connectionType !== "unknown" ? `${connectionType.toUpperCase()} Bağlantı` : printer.PortName || "",
                  status:
                    printer.PrinterStatus === "Idle"
                      ? 0
                      : printer.PrinterStatus === "Printing"
                        ? 1
                        : 2,
                  isDefault: printer.Default === true,
                  options: {
                    paperWidth: 56,
                    paperType: "80mm",
                    connectionType: connectionType,
                    portName: printer.PortName || "",
                  },
                });
              }
            });
          } catch (fallbackError) {
            console.error("Fallback PowerShell command error:", fallbackError);
          }
        }
      } else if (process.platform === "darwin") {
        // macOS için kapsamlı yazıcı tarama (USB, WiFi, Bluetooth, Network)
        try {
          // lpstat ile tüm yazıcıları al
          const { stdout } = await execAsync("lpstat -p -d -v");
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

          // lpstat -v ile port bilgilerini al
          const portInfoMap: Record<string, string> = {};
          try {
            const { stdout: portStdout } = await execAsync("lpstat -v");
            const portLines = portStdout.split("\n");
            portLines.forEach((line: string) => {
              const match = line.match(/device for (.+): (.+)/);
              if (match) {
                portInfoMap[match[1]] = match[2];
              }
            });
          } catch (e) {
            // Ignore
          }

          lines.forEach((line: string, index: number) => {
            const match = line.match(/printer (.+) is/);
            if (match) {
              const printerName = match[1];
              const portInfo = portInfoMap[printerName] || "";
              const portLower = portInfo.toLowerCase();

              // Bağlantı türünü belirle
              let connectionType = "unknown";
              let connectionDescription = "";
              if (portLower.includes("usb") || portLower.includes("usbprint")) {
                connectionType = "usb";
                connectionDescription = "USB Bağlantı";
              } else if (
                portLower.includes("ipp") ||
                portLower.includes("ipp://") ||
                portLower.includes("http://") ||
                portLower.includes("https://") ||
                portLower.includes("socket://") ||
                portLower.includes("lpd://") ||
                portLower.includes("dnssd://")
              ) {
                connectionType = "network";
                connectionDescription = "WiFi/Ağ Bağlantı";
              } else if (
                portLower.includes("bluetooth") ||
                portLower.includes("bth")
              ) {
                connectionType = "bluetooth";
                connectionDescription = "Bluetooth Bağlantı";
              } else if (
                portLower.includes("serial") ||
                portLower.includes("/dev/tty")
              ) {
                connectionType = "serial";
                connectionDescription = "Seri Port Bağlantı";
              } else if (portInfo) {
                connectionDescription = portInfo;
              }

              formattedPrinters.push({
                id: `system_${printerName}_${index}`,
                name: printerName,
                description: connectionDescription,
                status: 0,
                isDefault: printerName === defaultPrinter,
                options: {
                  connectionType: connectionType,
                  portName: portInfo,
                },
              });
            }
          });
        } catch (error) {
          console.error("lpstat command error:", error);
        }
      } else {
        // Linux için kapsamlı yazıcı tarama (USB, WiFi, Bluetooth, Network)
        try {
          const { stdout } = await execAsync("lpstat -p -d -v");
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

          // lpstat -v ile port bilgilerini al
          const portInfoMap: Record<string, string> = {};
          try {
            const { stdout: portStdout } = await execAsync("lpstat -v");
            const portLines = portStdout.split("\n");
            portLines.forEach((line: string) => {
              const match = line.match(/device for (.+): (.+)/);
              if (match) {
                portInfoMap[match[1]] = match[2];
              }
            });
          } catch (e) {
            // Ignore
          }

          lines.forEach((line: string, index: number) => {
            const match = line.match(/printer (.+) is/);
            if (match) {
              const printerName = match[1];
              const portInfo = portInfoMap[printerName] || "";
              const portLower = portInfo.toLowerCase();

              // Bağlantı türünü belirle
              let connectionType = "unknown";
              let connectionDescription = "";
              if (
                portLower.includes("usb") ||
                portLower.includes("/dev/usb") ||
                portLower.includes("usbprint")
              ) {
                connectionType = "usb";
                connectionDescription = "USB Bağlantı";
              } else if (
                portLower.includes("ipp") ||
                portLower.includes("ipp://") ||
                portLower.includes("http://") ||
                portLower.includes("https://") ||
                portLower.includes("socket://") ||
                portLower.includes("lpd://") ||
                portLower.includes("dnssd://") ||
                portLower.includes("ipp14://")
              ) {
                connectionType = "network";
                connectionDescription = "WiFi/Ağ Bağlantı";
              } else if (
                portLower.includes("bluetooth") ||
                portLower.includes("bth")
              ) {
                connectionType = "bluetooth";
                connectionDescription = "Bluetooth Bağlantı";
              } else if (
                portLower.includes("serial") ||
                portLower.includes("/dev/tty") ||
                portLower.includes("/dev/ttyS")
              ) {
                connectionType = "serial";
                connectionDescription = "Seri Port Bağlantı";
              } else if (portInfo) {
                connectionDescription = portInfo;
              }

              formattedPrinters.push({
                id: `system_${printerName}_${index}`,
                name: printerName,
                description: connectionDescription,
                status: 0,
                isDefault: printerName === defaultPrinter,
                options: {
                  connectionType: connectionType,
                  portName: portInfo,
                },
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
      safeLog(
        `🖨️ Print request: ${data.type || "order"} to "${data.printerName}"`
      );
      safeLog(`📄 Content length: ${data.content.length} bytes`);
      safeLog(
        `📄 Content preview (first 100 chars): ${data.content.substring(0, 100).replace(/[\x00-\x1F]/g, ".")}`
      );

      try {
        if (process.platform === "win32") {
          // Windows'ta düz metin yazdırma - notepad /p kullan
          // Bu method Türkçe karakterleri doğru yazdırır
          const tempFile = join(tmpdir(), `print_${Date.now()}.txt`);

          // Düz metin olarak kaydet (UTF-8 with BOM)
          try {
            writeFileSync(tempFile, "\uFEFF" + data.content, "utf-8");
            safeLog(`📁 Temp file created: ${tempFile}`);
          } catch (writeError) {
                safeError("❌ Error writing temp file:", writeError);
            const errorMessage =
              writeError instanceof Error
                ? writeError.message
                : String(writeError);
            return {
              success: false,
              error: `Dosya yazma hatası: ${errorMessage}`,
            };
          }

          try {
            // Raw printing - doğrudan yazıcı portuna yaz (margin yok)
            safeLog(
              `📤 Attempting to print via raw port to: ${data.printerName}`
            );

            try {
              // PowerShell ile yazıcı port adını al ve doğrudan port'a yaz
              const printerNameSafe = data.printerName.replace(/"/g, '`"');
              const tempFileSafe = tempFile.replace(/\\/g, "\\\\");
              const psScript = "$printerName = \"" + printerNameSafe + "\";\n" +
                "$file = \"" + tempFileSafe + "\";\n\n" +
                "# Yazıcıyı ve port adını al\n" +
                "$printer = Get-Printer -Name $printerName -ErrorAction SilentlyContinue;\n" +
                "if (-not $printer) {\n" +
                "  Write-Output \"ERROR: Printer not found\";\n" +
                "  exit 1;\n" +
                "}\n\n" +
                "$portName = $printer.PortName;\n" +
                "Write-Host \"Printer Port: $portName\";\n\n" +
                "# Port tipine göre yazdır\n" +
                "if ($portName -like \"LPT*\" -or $portName -like \"USB*\" -or $portName -like \"COM*\") {\n" +
                "  # LPT, USB veya COM portu - doğrudan copy /b komutu ile raw printing (margin yok)\n" +
                "  # USB portları genellikle \"USB001\", \"USB002\" formatındadır\n" +
                "  try {\n" +
                "    cmd /c \"copy /b \\\"$file\\\" $portName\" 2>&1 | Out-Null;\n" +
                "    if ($LASTEXITCODE -eq 0) {\n" +
                "      Write-Output \"SUCCESS\";\n" +
                "    } else {\n" +
                "      # Copy başarısız olursa Out-Printer'a fallback yap\n" +
                "      $content = Get-Content -Path $file -Encoding UTF8 -Raw;\n" +
                "      $content | Out-Printer -Name $printerName;\n" +
                "      Write-Output \"SUCCESS\";\n" +
                "    }\n" +
                "  } catch {\n" +
                "    # Hata durumunda Out-Printer'a fallback yap\n" +
                "    $content = Get-Content -Path $file -Encoding UTF8 -Raw;\n" +
                "    $content | Out-Printer -Name $printerName;\n" +
                "    Write-Output \"SUCCESS\";\n" +
                "  }\n" +
                "} else {\n" +
                "  # Network veya diğer portlar - Out-Printer kullan ama margin'i minimize etmeye çalış\n" +
                "  # Yazıcı ayarlarını geçici olarak değiştirmeye çalış (margin = 0)\n" +
                "  try {\n" +
                "    # Yazıcı ayarlarını al\n" +
                "    $printerSettings = Get-WmiObject -Class Win32_PrinterConfiguration -Filter \"Name='$printerName'\" -ErrorAction SilentlyContinue;\n" +
                "    \n" +
                "    # Out-Printer ile yazdır (yazıcı sürücüsü ayarlarına bağlı)\n" +
                "    $content = Get-Content -Path $file -Encoding UTF8 -Raw;\n" +
                "    $content | Out-Printer -Name $printerName;\n" +
                "    Write-Output \"SUCCESS\";\n" +
                "  } catch {\n" +
                "    Write-Output \"ERROR: Print failed - $($_.Exception.Message)\";\n" +
                "    exit 1;\n" +
                "  }\n" +
                "}";

              const psScriptFile = join(
                tmpdir(),
                `print_script_${Date.now()}.ps1`
              );
              try {
                writeFileSync(psScriptFile, psScript, "utf-8");
              } catch (writeError) {
                safeError("❌ Error writing PowerShell script:", writeError);
                const errorMessage =
                  writeError instanceof Error
                    ? writeError.message
                    : String(writeError);
                // Temp dosyayı temizle
                try {
                  setTimeout(() => {
                    try {
                      unlinkSync(tempFile);
                    } catch (e) {
                      // Ignore
                    }
                  }, 2000);
                } catch (e) {
                  // Ignore
                }
                return {
                  success: false,
                  error: `Script dosyası yazma hatası: ${errorMessage}`,
                };
              }

              let stdout: string, stderr: string;
              try {
                const result = await execAsync(
                  `powershell -NoProfile -ExecutionPolicy Bypass -File "${psScriptFile}"`,
                  { maxBuffer: 1024 * 1024, timeout: 30000 }
                );
                stdout = result.stdout;
                stderr = result.stderr || "";
              } catch (execError: any) {
                safeError("❌ PowerShell execution error:", execError);
                // Script ve temp dosyayı temizle
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
                  safeWarn("Could not delete files:", e);
                }
                const errorMessage =
                  execError instanceof Error
                    ? execError.message
                    : String(execError);
                return {
                  success: false,
                  error: `PowerShell hatası: ${errorMessage}`,
                };
              }

              safeLog(`📤 PowerShell stdout: ${stdout}`);
              if (stderr) safeLog(`⚠️ PowerShell stderr: ${stderr}`);

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

              safeLog(
                `✅ Printed successfully to ${data.printerName} (notepad)`
              );
              return { success: true };
            } catch (notepadError) {
              safeWarn(
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
# Yazıcı ayarlarını optimize et - tam genişlik kullanımı için
try {
  $content = Get-Content -Path $file -Encoding UTF8 -Raw;
  
  # Yazıcı ayarlarını kontrol et ve optimize et
  $printerSettings = Get-PrinterProperty -PrinterName $printerName -PropertyName "PrinterDefault" -ErrorAction SilentlyContinue;
  
  # Out-Printer ile yazdır (yazıcı sürücüsü varsayılan ayarlarını kullanır)
  # Not: Font ve genişlik ayarları yazıcı sürücüsüne bağlıdır
  $content | Out-Printer -Name $printerName;
  Write-Output "SUCCESS";
} catch {
  Write-Output "ERROR: Print failed - $($_.Exception.Message)";
  exit 1;
}`;

              try {
                writeFileSync(psScriptFile, psScriptContent, "utf-8");
              } catch (writeError) {
                safeError("❌ Error writing PowerShell script:", writeError);
                const errorMessage =
                  writeError instanceof Error
                    ? writeError.message
                    : String(writeError);
                // Temp dosyayı temizle
                try {
                  setTimeout(() => {
                    try {
                      unlinkSync(tempFile);
                    } catch (e) {
                      // Ignore
                    }
                  }, 2000);
                } catch (e) {
                  // Ignore
                }
                return {
                  success: false,
                  error: `Script dosyası yazma hatası: ${errorMessage}`,
                };
              }

              let stdout: string, stderr: string;
              try {
                const result = await execAsync(
                  `powershell -NoProfile -ExecutionPolicy Bypass -File "${psScriptFile}"`,
                  { maxBuffer: 1024 * 1024, timeout: 30000 }
                );
                stdout = result.stdout;
                stderr = result.stderr || "";
              } catch (execError: any) {
                safeError("❌ PowerShell execution error:", execError);
                // Script ve temp dosyayı temizle
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
                  safeWarn("Could not delete files:", e);
                }
                const errorMessage =
                  execError instanceof Error
                    ? execError.message
                    : String(execError);
                return {
                  success: false,
                  error: `PowerShell hatası: ${errorMessage}`,
                };
              }

              safeLog(`📤 PowerShell stdout: ${stdout}`);
              if (stderr) safeLog(`⚠️ PowerShell stderr: ${stderr}`);

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
                safeLog(
                  `✅ Printed successfully to ${data.printerName} (Out-Printer)`
                );
                return { success: true };
              } else {
                const errorMsg = stdout || stderr || "Print command failed";
                safeError(`❌ Print failed: ${errorMsg}`);
                return {
                  success: false,
                  error: errorMsg,
                };
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

            safeError("❌ Print error:", error);
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            throw new Error(`Print failed: ${errorMessage}`);
          }
        } else if (process.platform === "darwin") {
          // macOS için lp komutu
          const tempFile = join(tmpdir(), `print_${Date.now()}.txt`);
          try {
            writeFileSync(tempFile, data.content, "utf-8");
          } catch (writeError) {
                safeError("❌ Error writing temp file:", writeError);
            const errorMessage =
              writeError instanceof Error
                ? writeError.message
                : String(writeError);
            return {
              success: false,
              error: `Dosya yazma hatası: ${errorMessage}`,
            };
          }

          try {
            await execAsync(`lp -d "${data.printerName}" "${tempFile}"`);
            try {
              unlinkSync(tempFile);
            } catch (e) {
              console.warn("Could not delete temp file:", e);
            }
            safeLog(`✅ Printed successfully to ${data.printerName}`);
            return { success: true };
          } catch (error) {
            try {
              unlinkSync(tempFile);
            } catch (e) {
              console.warn("Could not delete temp file:", e);
            }
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            return {
              success: false,
              error: `Yazdırma hatası: ${errorMessage}`,
            };
          }
        } else {
          // Linux için lp komutu
          const tempFile = join(tmpdir(), `print_${Date.now()}.txt`);
          try {
            writeFileSync(tempFile, data.content, "utf-8");
          } catch (writeError) {
                safeError("❌ Error writing temp file:", writeError);
            const errorMessage =
              writeError instanceof Error
                ? writeError.message
                : String(writeError);
            return {
              success: false,
              error: `Dosya yazma hatası: ${errorMessage}`,
            };
          }

          try {
            await execAsync(`lp -d "${data.printerName}" "${tempFile}"`);
            try {
              unlinkSync(tempFile);
            } catch (e) {
              console.warn("Could not delete temp file:", e);
            }
            safeLog(`✅ Printed successfully to ${data.printerName}`);
            return { success: true };
          } catch (error) {
            try {
              unlinkSync(tempFile);
            } catch (e) {
              console.warn("Could not delete temp file:", e);
            }
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            return {
              success: false,
              error: `Yazdırma hatası: ${errorMessage}`,
            };
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

  // DevTools'u açmak için IPC handler (sadece development'ta)
  ipcMain.handle("open-dev-tools", async () => {
    if (isDev && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.openDevTools();
      safeLog("🔧 DevTools açıldı (IPC handler)");
    }
  });

  console.log(
    "IPC handlers registered: quit-app, check-for-updates, quit-and-install, clear-table-history, get-system-printers, print, get-local-ip, open-dev-tools at",
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
  // Eğer zaten bir window varsa, yeni window oluşturma
  if (mainWindow) {
    // Window zaten var, destroy edilmiş mi kontrol et
    if (!mainWindow.isDestroyed()) {
      // Window var ve destroy edilmemiş, sadece focus et
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
      return;
    } else {
      // Window destroy edilmiş, null yap
      mainWindow = null;
    }
  }

  // Tüm açık window'ları kontrol et (ekstra güvenlik)
  const allWindows = BrowserWindow.getAllWindows();
  if (allWindows.length > 0) {
    // Zaten bir window var, onu kullan
    const existingWindow = allWindows[0];
    if (!existingWindow.isDestroyed()) {
      mainWindow = existingWindow;
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
      return;
    }
  }

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
      // CRITICAL FIX: webSecurity: false - file:// protocol ile ES modules yüklerken CORS hatası alınıyor
      // Bu, script'lerin yüklenmemesine ve beyaz ekrana neden oluyor
      // Electron'da local file'lar için güvenlik riski minimal
      webSecurity: false,
      // ES modules ve CORS sorunlarını önlemek için
      allowRunningInsecureContent: false,
      // Sandbox'u kapat (contextIsolation ile birlikte kullanılamaz)
      sandbox: false,
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
    const indexPath = join(__dirname, "../dist/index.html");

    // Dosyanın var olup olmadığını kontrol et
    if (!existsSync(indexPath)) {
      safeError("❌ index.html bulunamadı:", indexPath);
      safeError("Lütfen uygulamayı yeniden build edin: npm run build");
      // Hata mesajı göster
      mainWindow.webContents.once("did-finish-load", () => {
        mainWindow?.webContents.executeJavaScript(`
          document.body.innerHTML = \`
            <div style="padding: 40px; text-align: center; font-family: Arial; background: #f0f0f0; height: 100vh; display: flex; align-items: center; justify-content: center;">
              <div style="background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 600px;">
                <h1 style="color: #dc2626; margin-bottom: 20px;">❌ Build Hatası</h1>
                <p style="color: #666; margin-bottom: 20px; line-height: 1.6;">
                  index.html dosyası bulunamadı. Lütfen uygulamayı yeniden build edin.
                </p>
                <p style="color: #999; font-size: 14px; font-family: monospace;">
                  ${indexPath}
                </p>
              </div>
            </div>
          \`;
        `);
      });
      return;
    }

    safeLog("📄 Loading index.html from:", indexPath);
    safeLog("📄 __dirname:", __dirname);
    safeLog("📄 indexPath exists:", existsSync(indexPath));

    // Production'da detaylı log'lar
    mainWindow.webContents.once("did-finish-load", () => {
      safeLog("✅ index.html yüklendi");
      // Root element'in var olup olmadığını kontrol et
      mainWindow?.webContents
        .executeJavaScript(
          `
        console.log("🔍 Production Debug - Root element kontrolü:");
        const root = document.getElementById('root');
        console.log("  - Root element var mı?", !!root);
        console.log("  - Root innerHTML:", root ? root.innerHTML.substring(0, 200) : "N/A");
        console.log("  - Document readyState:", document.readyState);
        console.log("  - Window location:", window.location.href);
        console.log("  - Scripts loaded:", document.scripts.length);
        // Tüm script'leri listele
        Array.from(document.scripts).forEach((script, i) => {
          console.log(\`  - Script \${i}: \${script.src || 'inline'}\`);
        });
      `
        )
        .catch((err) => {
          safeError("❌ Root element kontrolü hatası:", err);
        });
    });

    // CRITICAL FIX: loadFile yerine loadURL kullan ve file:// protocol'ü açıkça belirt
    // Bu, ES modules yüklerken CORS sorunlarını önler
    const fileUrl = `file://${indexPath.replace(/\\/g, "/")}`;
    safeLog("📄 Loading file URL:", fileUrl);
    mainWindow.loadURL(fileUrl);

    // Ensure proper routing by handling navigation
    mainWindow.webContents.on(
      "did-fail-load",
      (_event, errorCode, errorDescription, validatedURL) => {
        safeError("❌ Navigation failed:", {
          errorCode,
          errorDescription,
          validatedURL,
        });
      // If navigation fails, try loading index.html again
      if (errorCode === -3 && mainWindow) {
          safeLog("🔄 Retrying to load index.html...");
          const retryFileUrl = `file://${indexPath.replace(/\\/g, "/")}`;
          mainWindow.loadURL(retryFileUrl);
        }
      }
    );

    // Sayfa yüklendiğinde kontrol et (sadece development'ta)
    if (isDev) {
      mainWindow.webContents.once("did-finish-load", () => {
        safeLog("✅ Page loaded successfully");
        // Root element'in var olup olmadığını kontrol et
        mainWindow?.webContents
          .executeJavaScript(
            `
          (function() {
            const root = document.getElementById('root');
            if (!root) {
              console.error('❌ Root element (#root) bulunamadı!');
              return false;
            }
            if (root.innerHTML.trim() === '') {
              console.warn('⚠️ Root element boş - React henüz render edilmedi');
              return false;
            }
            console.log('✅ Root element bulundu ve içerik var');
            return true;
          })();
        `
          )
          .then((result) => {
            if (!result) {
              safeError(
                "⚠️ Root element kontrolü başarısız - React render edilmemiş olabilir"
              );
              // DevTools otomatik açılmasın (müşteri konsolu görmesin)
            }
          })
          .catch((err) => {
            safeError("❌ Root element kontrolü hatası:", err);
          });
      });
    }
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

    // DevTools otomatik açılmasın (müşteri konsolu görmesin)
    // Development'ta manuel olarak Ctrl+Shift+I ile açılabilir

    // Production'da console hatalarını yakala ve log'la
    if (!isDev && mainWindow) {
      // Console mesajlarını yakala
      mainWindow.webContents.on(
        "console-message",
        (_event, level, message, line, sourceId) => {
          if (level >= 2) {
            // 0=debug, 1=log, 2=warning, 3=error
            safeError(
              `[Renderer Console ${level === 2 ? "WARNING" : "ERROR"}]`,
              message
            );
            if (sourceId) {
              safeError(`  Source: ${sourceId}:${line}`);
            }
          }
        }
      );

      // JavaScript hatalarını yakala (sadece kritik hatalarda DevTools aç)
      mainWindow.webContents.on(
        "did-fail-load",
        (_event, errorCode, errorDescription, validatedURL) => {
          safeError("❌ Page load failed:", {
            errorCode,
            errorDescription,
            validatedURL,
          });
          // Sadece kritik hatalarda DevTools'u aç (normal navigation hatalarını ignore et)
          // -3 = ERR_ABORTED (normal navigation), -102 = ERR_CONNECTION_REFUSED (dev server yok)
          // Sadece gerçek kritik hatalarda aç (ör: -105 = ERR_NAME_NOT_RESOLVED, -106 = ERR_INTERNET_DISCONNECTED)
          if (errorCode !== -3 && errorCode !== -102) {
            // Kritik hata - sadece log'la, production'da DevTools açma
            safeError(
              `⚠️ Critical load error (code: ${errorCode}) - check logs`
            );
            // Production'da DevTools açma - sadece log'la
            // Kullanıcı Ctrl+Shift+I ile manuel açabilir
          }
        }
      );

      // Uncaught exception'ları yakala
      mainWindow.webContents
        .executeJavaScript(
          `
        window.addEventListener('error', (event) => {
          console.error('Uncaught Error:', event.error || event.message, event.filename, event.lineno);
        });
        window.addEventListener('unhandledrejection', (event) => {
          console.error('Unhandled Promise Rejection:', event.reason);
        });
      `
        )
        .catch((err) => {
          safeError("Failed to setup error handlers:", err);
        });
    }
  });

  // Kiosk modunda F11 ve ESC tuşlarını engelle (production'da)
  // Ancak Ctrl+Shift+I ile DevTools açılabilir (hata ayıklama için)
  if (!isDev) {
    mainWindow?.webContents.on("before-input-event", (event, input) => {
      // F11 (fullscreen toggle) ve ESC (exit fullscreen) tuşlarını engelle
      if (
        input.key === "F11" ||
        (input.key === "Escape" && !input.control && !input.shift)
      ) {
        event.preventDefault();
      }
      // Ctrl+Shift+I ile DevTools açılabilir (hata ayıklama için)
      if (input.key === "I" && input.control && input.shift) {
        // DevTools açma izni ver
        return;
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

// Single instance lock - uygulamanın sadece bir instance'ının çalışmasını sağla
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // Eğer başka bir instance zaten çalışıyorsa, bu instance'ı kapat
  app.quit();
  process.exit(0);
}

// İkinci instance açıldığında (kullanıcı uygulamayı tekrar açtığında)
app.on("second-instance", () => {
  // Eğer window varsa, focus et
  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.focus();
  } else {
    // Window yoksa yeni bir tane oluştur
    createWindow();
  }
});

// This method will be called when Electron has finished initialization
// app.whenReady() kullan - app.on("ready") yerine (daha güvenli, tek sefer çalışır)
app.whenReady().then(() => {
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
