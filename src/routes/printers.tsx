import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Printer, RefreshCw, Check, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { POSLayout } from "@/components/layouts/POSLayout";

export const Route = createFileRoute("/printers")({
  component: Printers,
});

function Printers() {
  return (
    <POSLayout>
      <PrintersContent />
    </POSLayout>
  );
}

interface PrinterDevice {
  id: string;
  name: string;
  type: "serial" | "usb" | "network" | "system";
  port?: string;
  vendorId?: number;
  productId?: number;
  isConnected: boolean;
}

function PrintersContent() {
  const { userData, companyId } = useAuth();
  const [printers, setPrinters] = useState<PrinterDevice[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [showAddNetworkPrinter, setShowAddNetworkPrinter] = useState(false);
  const [networkPrinterIP, setNetworkPrinterIP] = useState("");
  const [networkPrinterName, setNetworkPrinterName] = useState("");

  // Kaydedilmiş yazıcı ayarlarını yükle
  useEffect(() => {
    const loadSavedPrinters = () => {
      try {
        const saved = localStorage.getItem(`printers_${companyId || userData?.companyId}`);
        if (saved) {
          const savedPrinters = JSON.parse(saved) as PrinterDevice[];
          setPrinters(savedPrinters);
          
          const selected = localStorage.getItem(`selectedPrinter_${companyId || userData?.companyId}`);
          if (selected) {
            setSelectedPrinter(selected);
          }
        }
      } catch (error) {
        // Error loading saved printers
      }
    };

    loadSavedPrinters();
  }, [companyId, userData?.companyId]);

  // Web Serial API ile tüm seri port yazıcıları algıla
  const detectSerialPrinters = useCallback(async (): Promise<PrinterDevice[]> => {
    const detected: PrinterDevice[] = [];

    // Web Serial API kontrolü
    if ("serial" in navigator) {
      try {
        // Kullanıcıdan port seçmesini iste - tüm portları göster
        const port = await (navigator as any).serial.requestPort({
          filters: [] // Tüm portları göster
        });
        
        if (port) {
          const portInfo = port.getInfo();
          const portName = portInfo.productName || 
                          portInfo.manufacturerName || 
                          `Seri Port (${portInfo.usbVendorId || 'N/A'}:${portInfo.usbProductId || 'N/A'})`;
          
          detected.push({
            id: `serial_${portInfo.usbVendorId || 'unknown'}_${portInfo.usbProductId || 'unknown'}_${Date.now()}`,
            name: portName,
            type: "serial",
            port: portInfo.path || portInfo.serialNumber || "unknown",
            vendorId: portInfo.usbVendorId,
            productId: portInfo.usbProductId,
            isConnected: true,
          });
        }
      } catch (error: any) {
        if (error.name !== "NotFoundError" && error.name !== "SecurityError") {
          throw error;
        }
      }
    }

    return detected;
  }, []);

  // WebUSB API ile tüm USB yazıcıları algıla
  const detectUSBPrinters = useCallback(async (): Promise<PrinterDevice[]> => {
    const detected: PrinterDevice[] = [];

    if ("usb" in navigator) {
      try {
        // Printer class (7) ve tüm alt sınıfları için filtre
        const device = await (navigator as any).usb.requestDevice({
          filters: [
            { classCode: 7 }, // Printer class
            { classCode: 7, subclassCode: 1 }, // Printer subclass
            { classCode: 7, subclassCode: 2 },
            { classCode: 7, subclassCode: 3 },
          ],
        });

        if (device) {
          await device.open();
          try {
            await device.selectConfiguration(1);
            const deviceName = device.productName || 
                             `USB Yazıcı (${device.vendorId}:${device.productId})`;
            
            detected.push({
              id: `usb_${device.vendorId}_${device.productId}_${Date.now()}`,
              name: deviceName,
              type: "usb",
              vendorId: device.vendorId,
              productId: device.productId,
              isConnected: true,
            });
          } finally {
            await device.close();
          }
        }
      } catch (error: any) {
        if (error.name !== "NotFoundError" && error.name !== "SecurityError") {
          throw error;
        }
      }
    }

    return detected;
  }, []);

  // Sistem yazıcılarını algıla (tarayıcı yazdırma API'si)
  const detectSystemPrinters = useCallback(async (): Promise<PrinterDevice[]> => {
    const detected: PrinterDevice[] = [];

    // Tarayıcı yazdırma API'si ile sistem yazıcılarını göster
    // Not: Web API'leri güvenlik nedeniyle sistem yazıcı listesini direkt alamaz
    // Ancak yazdırma dialogu üzerinden erişilebilir
    if (window.matchMedia && window.matchMedia("print").media !== "print") {
      // Yazdırma desteği var
      detected.push({
        id: "system_default",
        name: "Sistem Varsayılan Yazıcısı",
        type: "system",
        isConnected: true,
      });
    }

    return detected;
  }, []);

  // Ağ yazıcılarını otomatik algıla (IP tarama)
  const detectNetworkPrinters = useCallback(async (): Promise<PrinterDevice[]> => {
    const detected: PrinterDevice[] = [];
    
    // Yerel ağ IP aralığını tespit et
    try {
      // WebRTC kullanarak yerel IP'yi al (sadece Chrome/Edge)
      const localIP = await new Promise<string | null>((resolve) => {
        const RTCPeerConnection = (window as any).RTCPeerConnection || 
                                 (window as any).webkitRTCPeerConnection || 
                                 (window as any).mozRTCPeerConnection;
        
        if (!RTCPeerConnection) {
          resolve(null);
          return;
        }

        const pc = new RTCPeerConnection({ iceServers: [] });
        pc.createDataChannel("");
        pc.createOffer()
          .then(offer => pc.setLocalDescription(offer))
          .catch(() => resolve(null));

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            const candidate = event.candidate.candidate;
            const match = candidate.match(/([0-9]{1,3}\.){3}[0-9]{1,3}/);
            if (match) {
              const ip = match[0];
              // Yerel IP aralığını kontrol et (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
              if (ip.startsWith("192.168.") || 
                  ip.startsWith("10.") || 
                  /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)) {
                pc.close();
                resolve(ip);
              }
            }
          }
        };

        setTimeout(() => {
          pc.close();
          resolve(null);
        }, 3000);
      });

      if (!localIP) {
        return detected; // Yerel IP bulunamadı
      }

      // IP aralığını belirle (örnek: 192.168.1.1 -> 192.168.1.0/24)
      const ipParts = localIP.split(".");
      const baseIP = `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}`;
      
      // Yaygın yazıcı portları
      const printerPorts = [9100, 515, 631, 9101, 9102];
      
      // İlk 50 IP'yi tara (performans için sınırlı)
      const scanPromises: Promise<void>[] = [];
      for (let i = 1; i <= 50; i++) {
        const testIP = `${baseIP}.${i}`;
        
        // Her port için kontrol et
        printerPorts.forEach(port => {
          const promise = new Promise<void>((resolve) => {
            const img = new Image();
            const timeout = setTimeout(() => {
              resolve();
            }, 500); // 500ms timeout
            
            img.onload = () => {
              clearTimeout(timeout);
              // Port açık, yazıcı olabilir
              detected.push({
                id: `network_${testIP}_${port}_${Date.now()}`,
                name: `Ağ Yazıcısı (${testIP}:${port})`,
                type: "network",
                port: `${testIP}:${port}`,
                isConnected: true,
              });
              resolve();
            };
            
            img.onerror = () => {
              clearTimeout(timeout);
              resolve();
            };
            
            // Port kontrolü için HTTP isteği (sadece 631 portu için çalışır)
            if (port === 631) {
              fetch(`http://${testIP}:${port}`, { 
                method: 'HEAD', 
                mode: 'no-cors',
                signal: AbortSignal.timeout(500)
              })
                .then(() => {
                  detected.push({
                    id: `network_${testIP}_${port}_${Date.now()}`,
                    name: `Ağ Yazıcısı (${testIP}:${port})`,
                    type: "network",
                    port: `${testIP}:${port}`,
                    isConnected: true,
                  });
                })
                .catch(() => {})
                .finally(() => resolve());
            } else {
              resolve();
            }
          });
          
          scanPromises.push(promise);
        });
      }
      
      // Tüm taramaları bekle (maksimum 5 saniye)
      await Promise.race([
        Promise.all(scanPromises),
        new Promise(resolve => setTimeout(resolve, 5000))
      ]);
      
    } catch (error) {
      // Ağ tarama hatası - sessizce devam et
    }

    return detected;
  }, []);


  // Ağ yazıcısı ekle
  const addNetworkPrinter = useCallback((ip: string, name: string) => {
    if (!ip || !name) {
      setError("Lütfen IP adresi ve yazıcı adı girin");
      return;
    }

    // IP adresi formatını kontrol et
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(ip)) {
      setError("Geçerli bir IP adresi girin (örn: 192.168.1.100)");
      return;
    }

    const newPrinter: PrinterDevice = {
      id: `network_${ip}_${Date.now()}`,
      name: name,
      type: "network",
      port: ip,
      isConnected: false, // Bağlantı test edilebilir
    };

    setPrinters((prev) => {
      const exists = prev.find((p) => p.type === "network" && p.port === ip);
      if (exists) {
        setError("Bu IP adresine sahip bir yazıcı zaten eklenmiş");
        return prev;
      }

      const updated = [...prev, newPrinter];
      const effectiveCompanyId = companyId || userData?.companyId;
      if (effectiveCompanyId) {
        localStorage.setItem(
          `printers_${effectiveCompanyId}`,
          JSON.stringify(updated)
        );
      }
      return updated;
    });

    setNetworkPrinterIP("");
    setNetworkPrinterName("");
    setShowAddNetworkPrinter(false);
  }, [companyId, userData?.companyId]);

  // Tüm yazıcıları tarama - tek bir izin isteği ile
  const scanForPrinters = useCallback(async () => {
    setIsScanning(true);
    setError(null);
    const allPrinters: PrinterDevice[] = [];

    try {
      // Sistem yazıcılarını ekle (izin gerektirmez)
      const systemPrinters = await detectSystemPrinters();
      allPrinters.push(...systemPrinters);

      // Ağ yazıcılarını otomatik tara (kablosuz yazıcılar için)
      try {
        const networkPrinters = await detectNetworkPrinters();
        allPrinters.push(...networkPrinters);
      } catch (error: any) {
        // Ağ tarama hatası - sessizce devam et
      }

      // Web Serial API ile seri port yazıcıları
      // Kullanıcıdan bir kez izin istenir, sonra tüm portlar gösterilir
      if ("serial" in navigator) {
        try {
          // Kullanıcıya tüm portları göster, seçmesini iste
          const serialPrinters = await detectSerialPrinters();
          allPrinters.push(...serialPrinters);
          
          // Kullanıcı birden fazla port seçmek isteyebilir
          // Bu durumda tekrar tekrar izin isteyebiliriz
          let morePorts = true;
          let attemptCount = 0;
          const maxAttempts = 10; // Maksimum 10 port algılama denemesi
          
          while (morePorts && attemptCount < maxAttempts) {
            try {
              const additionalPorts = await detectSerialPrinters();
              if (additionalPorts.length > 0) {
                // Yeni port bulundu, ekle
                additionalPorts.forEach((port) => {
                  const exists = allPrinters.find((p) => 
                    p.type === "serial" && 
                    p.vendorId === port.vendorId && 
                    p.productId === port.productId
                  );
                  if (!exists) {
                    allPrinters.push(port);
                  }
                });
                attemptCount++;
              } else {
                morePorts = false;
              }
            } catch (error: any) {
              if (error.name === "NotFoundError") {
                morePorts = false; // Kullanıcı port seçmeyi iptal etti
              } else {
                throw error;
              }
            }
          }
        } catch (error: any) {
          if (error.name !== "NotFoundError" && error.name !== "SecurityError") {
            setError(`Seri port yazıcıları algılanırken hata: ${error.message}`);
          }
        }
      }

      // WebUSB API ile USB yazıcıları
      // Kullanıcıdan bir kez izin istenir, sonra tüm USB yazıcılar gösterilir
      if ("usb" in navigator) {
        try {
          const usbPrinters = await detectUSBPrinters();
          allPrinters.push(...usbPrinters);
          
          // Kullanıcı birden fazla USB cihaz seçmek isteyebilir
          let moreDevices = true;
          let attemptCount = 0;
          const maxAttempts = 10; // Maksimum 10 USB cihaz algılama denemesi
          
          while (moreDevices && attemptCount < maxAttempts) {
            try {
              const additionalDevices = await detectUSBPrinters();
              if (additionalDevices.length > 0) {
                // Yeni cihaz bulundu, ekle
                additionalDevices.forEach((device) => {
                  const exists = allPrinters.find((p) => 
                    p.type === "usb" && 
                    p.vendorId === device.vendorId && 
                    p.productId === device.productId
                  );
                  if (!exists) {
                    allPrinters.push(device);
                  }
                });
                attemptCount++;
              } else {
                moreDevices = false;
              }
            } catch (error: any) {
              if (error.name === "NotFoundError") {
                moreDevices = false; // Kullanıcı cihaz seçmeyi iptal etti
              } else {
                throw error;
              }
            }
          }
        } catch (error: any) {
          if (error.name !== "NotFoundError" && error.name !== "SecurityError") {
            setError(`USB yazıcıları algılanırken hata: ${error.message}`);
          }
        }
      }

      // Mevcut yazıcılarla birleştir (tekrar eklemeyi önle)
      setPrinters((prev) => {
        const merged = [...prev];
        allPrinters.forEach((newPrinter) => {
          // Aynı vendorId ve productId'ye sahip yazıcıları kontrol et
          const exists = merged.find((p) => {
            if (p.type === newPrinter.type) {
              if (p.type === "serial" || p.type === "usb") {
                return p.vendorId === newPrinter.vendorId && 
                       p.productId === newPrinter.productId;
              }
              return p.id === newPrinter.id;
            }
            return false;
          });
          
          if (!exists) {
            merged.push(newPrinter);
          } else {
            // Mevcut yazıcının bağlantı durumunu güncelle
            exists.isConnected = newPrinter.isConnected;
            exists.name = newPrinter.name; // İsim güncellenmiş olabilir
          }
        });
        return merged;
      });

      // Kaydet
      const effectiveCompanyId = companyId || userData?.companyId;
      if (effectiveCompanyId) {
        setPrinters((current) => {
          localStorage.setItem(
            `printers_${effectiveCompanyId}`,
            JSON.stringify(current)
          );
          return current;
        });
      }

      if (allPrinters.length === 0) {
        setError("Hiç yazıcı bulunamadı. Lütfen yazıcıların bağlı olduğundan emin olun.");
      }
    } catch (error: any) {
      setError(error.message || "Yazıcılar taranırken bir hata oluştu");
    } finally {
      setIsScanning(false);
    }
  }, [detectSerialPrinters, detectUSBPrinters, detectSystemPrinters, detectNetworkPrinters, companyId, userData?.companyId]);

  // Yazıcı seç
  const selectPrinter = useCallback((printerId: string) => {
    setSelectedPrinter(printerId);
    const effectiveCompanyId = companyId || userData?.companyId;
    if (effectiveCompanyId) {
      localStorage.setItem(`selectedPrinter_${effectiveCompanyId}`, printerId);
    }
  }, [companyId, userData?.companyId]);

  // Yazıcıyı kaldır
  const removePrinter = useCallback((printerId: string) => {
    setPrinters((prev) => {
      const filtered = prev.filter((p) => p.id !== printerId);
      const effectiveCompanyId = companyId || userData?.companyId;
      if (effectiveCompanyId) {
        localStorage.setItem(
          `printers_${effectiveCompanyId}`,
          JSON.stringify(filtered)
        );
        if (selectedPrinter === printerId) {
          setSelectedPrinter(null);
          localStorage.removeItem(`selectedPrinter_${effectiveCompanyId}`);
        }
      }
      return filtered;
    });
  }, [companyId, userData?.companyId, selectedPrinter]);

  // Test yazdırma
  const testPrint = useCallback(async () => {
    if (!selectedPrinter) {
      setError("Lütfen önce bir yazıcı seçin");
      return;
    }

    const printer = printers.find((p) => p.id === selectedPrinter);
    if (!printer) {
      setError("Seçili yazıcı bulunamadı");
      return;
    }

    try {
      if (printer.type === "system") {
        // Sistem yazıcısı için tarayıcı yazdırma dialogunu aç
        window.print();
      } else {
        // Seri port veya USB yazıcı için test yazdırma
        setError("Seri port ve USB yazıcılar için yazdırma özelliği yakında eklenecek");
      }
    } catch (error: any) {
      setError(error.message || "Yazdırma sırasında bir hata oluştu");
    }
  }, [selectedPrinter, printers]);

  return (
    <div className="h-full bg-gray-50 dark:bg-gray-900 p-3 lg:p-4 overflow-y-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Printer className="h-8 w-8" />
          Yazıcı Ayarları
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
          Bağlı yazıcıları yönetin ve yazdırma ayarlarını yapın
        </p>
      </div>

      {/* Hata Mesajı */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Yazıcı Tarama ve Ekleme Butonları */}
      <div className="mb-6 flex gap-2 flex-wrap">
        <Button
          onClick={scanForPrinters}
          disabled={isScanning}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          {isScanning ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Taranıyor...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Yazıcıları Otomatik Tara
            </>
          )}
        </Button>
        <Button
          onClick={() => setShowAddNetworkPrinter(true)}
          variant="outline"
          className="border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20"
        >
          <Printer className="h-4 w-4 mr-2" />
          Ağ Yazıcısı Ekle
        </Button>
      </div>

      {/* Ağ Yazıcısı Ekleme Modalı */}
      {showAddNetworkPrinter && (
        <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Ağ Yazıcısı Ekle
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Yazıcı Adı
              </label>
              <input
                type="text"
                value={networkPrinterName}
                onChange={(e) => setNetworkPrinterName(e.target.value)}
                placeholder="Örn: Mutfak Yazıcısı"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                IP Adresi
              </label>
              <input
                type="text"
                value={networkPrinterIP}
                onChange={(e) => setNetworkPrinterIP(e.target.value)}
                placeholder="Örn: 192.168.1.100"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => addNetworkPrinter(networkPrinterIP, networkPrinterName)}
                className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
              >
                Ekle
              </Button>
              <Button
                onClick={() => {
                  setShowAddNetworkPrinter(false);
                  setNetworkPrinterIP("");
                  setNetworkPrinterName("");
                }}
                variant="outline"
                className="flex-1"
              >
                İptal
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Yazıcı Listesi */}
      {printers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {printers.map((printer) => (
            <div
              key={printer.id}
              className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border-2 p-2 ${
                selectedPrinter === printer.id
                  ? "border-blue-500 dark:border-blue-400"
                  : "border-gray-200 dark:border-gray-700"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div
                    className={`p-1.5 rounded-lg flex-shrink-0 ${
                      printer.isConnected
                        ? "bg-green-100 dark:bg-green-900/20"
                        : "bg-gray-100 dark:bg-gray-700"
                    }`}
                  >
                    <Printer
                      className={`h-4 w-4 ${
                        printer.isConnected
                          ? "text-green-600 dark:text-green-400"
                          : "text-gray-400"
                      }`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                      {printer.name}
                    </h3>
                    <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                      <span
                        className={`text-[10px] px-1 py-0.5 rounded ${
                          printer.type === "serial"
                            ? "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                            : printer.type === "usb"
                            ? "bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300"
                            : printer.type === "network"
                            ? "bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300"
                            : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                        }`}
                      >
                        {printer.type === "serial"
                          ? "Seri"
                          : printer.type === "usb"
                          ? "USB"
                          : printer.type === "network"
                          ? "Ağ"
                          : "Sistem"}
                      </span>
                      {printer.isConnected ? (
                        <span className="text-[10px] text-green-600 dark:text-green-400 flex items-center gap-0.5">
                          <div className="w-1.5 h-1.5 bg-green-600 dark:bg-green-400 rounded-full"></div>
                          Bağlı
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-500 dark:text-gray-400">
                          Bağlı Değil
                        </span>
                      )}
                    </div>
                    {printer.port && (
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                        {printer.port}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {selectedPrinter === printer.id && (
                    <div className="flex items-center gap-0.5 text-blue-600 dark:text-blue-400 text-xs font-medium">
                      <Check className="h-3 w-3" />
                      <span className="hidden sm:inline">Seçili</span>
                    </div>
                  )}
                  {selectedPrinter !== printer.id && (
                    <Button
                      onClick={() => selectPrinter(printer.id)}
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 px-2"
                    >
                      Seç
                    </Button>
                  )}
                  <Button
                    onClick={() => removePrinter(printer.id)}
                    variant="outline"
                    size="sm"
                    className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 h-7 w-7 p-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8 text-center">
          <Printer className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 mb-2">
            Henüz yazıcı bulunamadı
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            "Yazıcıları Tara" butonuna tıklayarak bağlı yazıcıları algılayın
          </p>
        </div>
      )}

      {/* Test Yazdırma Butonu */}
      {selectedPrinter && (
        <div className="mt-6">
          <Button
            onClick={testPrint}
            className="w-full bg-green-600 hover:bg-green-700 text-white"
          >
            <Printer className="h-4 w-4 mr-2" />
            Test Yazdır
          </Button>
        </div>
      )}

      {/* Bilgi Notu */}
      <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">
          Yazıcı Algılama Hakkında
        </h4>
        <ul className="text-xs text-blue-800 dark:text-blue-400 space-y-1 list-disc list-inside">
          <li>
            Seri port ve USB yazıcıları algılamak için tarayıcı izni gereklidir
          </li>
          <li>
            Yazıcı algılama özelliği HTTPS veya localhost bağlantılarında çalışır
          </li>
          <li>
            Sistem yazıcıları için tarayıcının yazdırma dialogu kullanılır
          </li>
        </ul>
      </div>
    </div>
  );
}

