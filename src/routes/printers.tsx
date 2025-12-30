import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  Printer,
  RefreshCw,
  Check,
  X,
  AlertCircle,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { POSLayout } from "@/components/layouts/POSLayout";
import { getCategoriesByCompany } from "@/lib/firebase/menus";
import type { Category } from "@/lib/firebase/types";
import { formatPrintContent, getExamplePrintOutput } from "@/lib/print";
import { getCompany } from "@/lib/firebase/companies";
import { customAlert } from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/printers")({
  component: Printers,
});

function Printers() {
  return (
    <POSLayout headerTitle="Yazıcılar">
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
  assignedCategories?: string[]; // Kategori ID'leri
  paperWidth?: number; // Kağıt genişliği (karakter sayısı)
  paperType?: string; // Kağıt tipi (örn: "80mm", "58mm", "110mm")
  options?: {
    paperWidth?: number;
    paperType?: string;
  };
}

export function PrintersContent() {
  const { userData, companyId, branchId } = useAuth();
  const [printers, setPrinters] = useState<PrinterDevice[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string | null>(null);
  const [editingPrinter, setEditingPrinter] = useState<string | null>(null);
  const [editingPrinterName, setEditingPrinterName] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [showAddNetworkPrinter, setShowAddNetworkPrinter] = useState(false);
  const [networkPrinterIP, setNetworkPrinterIP] = useState("");
  const [networkPrinterName, setNetworkPrinterName] = useState("");

  // Kaydedilmiş yazıcı ayarlarını yükle
  useEffect(() => {
    const loadSavedPrinters = () => {
      try {
        const saved = localStorage.getItem(
          `printers_${companyId || userData?.companyId}`
        );
        if (saved) {
          const savedPrinters = JSON.parse(saved) as PrinterDevice[];
          setPrinters(savedPrinters);

          const selected = localStorage.getItem(
            `selectedPrinter_${companyId || userData?.companyId}`
          );
          if (selected) {
            setSelectedPrinter(selected);
          }
        }
      } catch {
        // Error loading saved printers
      }
    };

    loadSavedPrinters();
  }, [companyId, userData?.companyId]);

  // Sistem yazıcılarını otomatik tara (sayfa yüklendikten sonra)
  useEffect(() => {
    // Electron ortamında sistem yazıcılarını otomatik tara
    const electronAPI = window.electronAPI;
    if (electronAPI?.getSystemPrinters) {
      const autoScanSystemPrinters = async () => {
        try {
          const result = await electronAPI.getSystemPrinters();
          if (result.success && result.printers) {
            const systemPrinters: PrinterDevice[] = result.printers.map(
              (printer) => {
                // Yazıcı tipini belirle (description veya name'e göre)
                let printerType: "serial" | "usb" | "network" | "system" =
                  "system";
                const nameLower = printer.name.toLowerCase();
                const descLower = printer.description.toLowerCase();

                // Network yazıcıları genellikle IP adresi veya network kelimesi içerir
                if (
                  nameLower.includes("network") ||
                  nameLower.includes("ip") ||
                  descLower.includes("network") ||
                  descLower.includes("tcp") ||
                  printer.options?.printerLocation?.includes("network")
                ) {
                  printerType = "network";
                }
                // USB yazıcıları genellikle USB kelimesi içerir
                else if (
                  nameLower.includes("usb") ||
                  descLower.includes("usb") ||
                  printer.options?.printerLocation?.includes("usb")
                ) {
                  printerType = "usb";
                }
                // Seri port yazıcıları genellikle COM veya serial kelimesi içerir
                else if (
                  nameLower.includes("com") ||
                  nameLower.includes("serial") ||
                  descLower.includes("com") ||
                  descLower.includes("serial")
                ) {
                  printerType = "serial";
                }

                return {
                  id: printer.id,
                  name: printer.name,
                  type: printerType,
                  port: printer.description || undefined,
                  isConnected: printer.status === 0 || printer.status === 1, // idle veya printing durumunda bağlı
                  paperWidth: printer.options?.paperWidth || 110, // Kağıt genişliği (karakter sayısı)
                  paperType: printer.options?.paperType || "80mm", // Kağıt tipi
                };
              }
            );

            if (systemPrinters.length > 0) {
              setPrinters((prev) => {
                const merged = [...prev];
                systemPrinters.forEach((newPrinter) => {
                  const exists = merged.find((p) => p.id === newPrinter.id);
                  if (!exists) {
                    merged.push(newPrinter);
                  } else {
                    // Mevcut yazıcının bağlantı durumunu güncelle
                    exists.isConnected = newPrinter.isConnected;
                    exists.name = newPrinter.name;
                  }
                });

                // Kaydet
                const effectiveCompanyId = companyId || userData?.companyId;
                if (effectiveCompanyId) {
                  localStorage.setItem(
                    `printers_${effectiveCompanyId}`,
                    JSON.stringify(merged)
                  );
                }

                return merged;
              });
            }
          }
        } catch {
          // Error saving printers
        }
      };

      // Kısa bir gecikme ile tarama yap (sayfa yüklendikten sonra)
      setTimeout(autoScanSystemPrinters, 1000);
    }
  }, [companyId, userData?.companyId]);

  // Kategorileri yükle
  useEffect(() => {
    const loadCategories = async () => {
      const effectiveCompanyId = companyId || userData?.companyId;
      const effectiveBranchId = branchId || userData?.assignedBranchId;

      if (!effectiveCompanyId) return;

      try {
        const cats = await getCategoriesByCompany(
          effectiveCompanyId,
          effectiveBranchId
        );
        setCategories(cats);
      } catch {
        // Error loading categories
      }
    };

    loadCategories();
  }, [companyId, branchId, userData?.companyId, userData?.assignedBranchId]);

  // Web Serial API ile tüm seri port yazıcıları algıla
  const detectSerialPrinters = useCallback(async (): Promise<
    PrinterDevice[]
  > => {
    const detected: PrinterDevice[] = [];

    // Web Serial API kontrolü
    if ("serial" in navigator) {
      try {
        // Kullanıcıdan port seçmesini iste - tüm portları göster
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const port = await (navigator as any).serial.requestPort({
          filters: [], // Tüm portları göster
        });

        if (port) {
          const portInfo = port.getInfo();
          const portName =
            portInfo.productName ||
            portInfo.manufacturerName ||
            `Seri Port (${portInfo.usbVendorId || "N/A"}:${portInfo.usbProductId || "N/A"})`;

          detected.push({
            id: `serial_${portInfo.usbVendorId || "unknown"}_${portInfo.usbProductId || "unknown"}_${Date.now()}`,
            name: portName,
            type: "serial",
            port: portInfo.path || portInfo.serialNumber || "unknown",
            vendorId: portInfo.usbVendorId,
            productId: portInfo.usbProductId,
            isConnected: true,
          });
        }
      } catch (error: unknown) {
        if (
          error instanceof Error &&
          error.name !== "NotFoundError" &&
          error.name !== "SecurityError"
        ) {
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
            const deviceName =
              device.productName ||
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
      } catch (error: unknown) {
        if (
          error instanceof Error &&
          error.name !== "NotFoundError" &&
          error.name !== "SecurityError"
        ) {
          throw error;
        }
      }
    }

    return detected;
  }, []);

  // Sistem yazıcılarını algıla (Electron API ile)
  const detectSystemPrinters = useCallback(async (): Promise<
    PrinterDevice[]
  > => {
    const detected: PrinterDevice[] = [];

    // Electron API'sini kullanarak tüm sistem yazıcılarını al
    if (window.electronAPI?.getSystemPrinters) {
      try {
        const result = await window.electronAPI.getSystemPrinters();
        if (result.success && result.printers) {
          result.printers.forEach((printer) => {
            // Yazıcı tipini belirle (description veya name'e göre)
            let printerType: "serial" | "usb" | "network" | "system" = "system";
            const nameLower = printer.name.toLowerCase();
            const descLower = printer.description.toLowerCase();

            // Network yazıcıları genellikle IP adresi veya network kelimesi içerir
            if (
              nameLower.includes("network") ||
              nameLower.includes("ip") ||
              descLower.includes("network") ||
              descLower.includes("tcp") ||
              printer.options?.printerLocation?.includes("network")
            ) {
              printerType = "network";
            }
            // USB yazıcıları genellikle USB kelimesi içerir
            else if (
              nameLower.includes("usb") ||
              descLower.includes("usb") ||
              printer.options?.printerLocation?.includes("usb")
            ) {
              printerType = "usb";
            }
            // Seri port yazıcıları genellikle COM veya serial kelimesi içerir
            else if (
              nameLower.includes("com") ||
              nameLower.includes("serial") ||
              descLower.includes("com") ||
              descLower.includes("serial")
            ) {
              printerType = "serial";
            }

            detected.push({
              id: printer.id,
              name: printer.name,
              type: printerType,
              port: printer.description || undefined,
              isConnected: printer.status === 0 || printer.status === 1, // idle veya printing durumunda bağlı
              paperWidth: printer.options?.paperWidth || 110, // Kağıt genişliği (karakter sayısı)
              paperType: printer.options?.paperType || "80mm", // Kağıt tipi
            });
          });
        }
      } catch {
        // Error detecting system printers
      }
    } else {
      // Electron API yoksa fallback (web ortamı)
      if (window.matchMedia && window.matchMedia("print").media !== "print") {
        detected.push({
          id: "system_default",
          name: "Sistem Varsayılan Yazıcısı",
          type: "system",
          isConnected: true,
        });
      }
    }

    return detected;
  }, []);

  // Ağ yazıcılarını otomatik algıla (IP tarama)
  const detectNetworkPrinters = useCallback(async (): Promise<
    PrinterDevice[]
  > => {
    const detected: PrinterDevice[] = [];

    // Yerel ağ IP aralığını tespit et
    try {
      // WebRTC kullanarak yerel IP'yi al (sadece Chrome/Edge)
      const localIP = await new Promise<string | null>((resolve) => {
        const RTCPeerConnection =
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (window as any).RTCPeerConnection ||
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (window as any).webkitRTCPeerConnection ||
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (window as any).mozRTCPeerConnection;

        if (!RTCPeerConnection) {
          resolve(null);
          return;
        }

        const pc = new RTCPeerConnection({ iceServers: [] });
        pc.createDataChannel("");
        pc.createOffer()
          .then((offer: RTCSessionDescriptionInit) =>
            pc.setLocalDescription(offer)
          )
          .catch(() => resolve(null));

        pc.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
          if (event.candidate) {
            const candidate = event.candidate.candidate;
            const match = candidate.match(/([0-9]{1,3}\.){3}[0-9]{1,3}/);
            if (match) {
              const ip = match[0];
              // Yerel IP aralığını kontrol et (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
              if (
                ip.startsWith("192.168.") ||
                ip.startsWith("10.") ||
                /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)
              ) {
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
        printerPorts.forEach((port) => {
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
                method: "HEAD",
                mode: "no-cors",
                signal: AbortSignal.timeout(500),
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
        new Promise((resolve) => setTimeout(resolve, 5000)),
      ]);
    } catch {
      // Ağ tarama hatası - sessizce devam et
    }

    return detected;
  }, []);

  // Ağ yazıcısı ekle
  const addNetworkPrinter = useCallback(
    (ip: string, name: string) => {
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
    },
    [companyId, userData?.companyId]
  );

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
      } catch {
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
                  const exists = allPrinters.find(
                    (p) =>
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
            } catch (error: unknown) {
              if (error instanceof Error && error.name === "NotFoundError") {
                morePorts = false; // Kullanıcı port seçmeyi iptal etti
              } else {
                throw error;
              }
            }
          }
        } catch (error: unknown) {
          if (
            error instanceof Error &&
            error.name !== "NotFoundError" &&
            error.name !== "SecurityError"
          ) {
            setError(
              `Seri port yazıcıları algılanırken hata: ${error.message}`
            );
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
                  const exists = allPrinters.find(
                    (p) =>
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
            } catch (error: unknown) {
              if (error instanceof Error && error.name === "NotFoundError") {
                moreDevices = false; // Kullanıcı cihaz seçmeyi iptal etti
              } else {
                throw error;
              }
            }
          }
        } catch (error: unknown) {
          if (
            error instanceof Error &&
            error.name !== "NotFoundError" &&
            error.name !== "SecurityError"
          ) {
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
                return (
                  p.vendorId === newPrinter.vendorId &&
                  p.productId === newPrinter.productId
                );
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
        setError(
          "Hiç yazıcı bulunamadı. Lütfen yazıcıların bağlı olduğundan emin olun."
        );
      }
    } catch (error: unknown) {
      setError(
        error instanceof Error
          ? error.message
          : "Yazıcılar taranırken bir hata oluştu"
      );
    } finally {
      setIsScanning(false);
    }
  }, [
    detectSerialPrinters,
    detectUSBPrinters,
    detectSystemPrinters,
    detectNetworkPrinters,
    companyId,
    userData?.companyId,
  ]);

  // Yazıcı seç
  const selectPrinter = useCallback(
    (printerId: string) => {
      setSelectedPrinter(printerId);
      const effectiveCompanyId = companyId || userData?.companyId;
      if (effectiveCompanyId) {
        localStorage.setItem(
          `selectedPrinter_${effectiveCompanyId}`,
          printerId
        );
      }
    },
    [companyId, userData?.companyId]
  );

  // Yazıcıyı kaldır
  const removePrinter = useCallback(
    (printerId: string) => {
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
    },
    [companyId, userData?.companyId, selectedPrinter]
  );

  // Yazıcıya kategori ata/kaldır
  const toggleCategoryAssignment = useCallback(
    (printerId: string, categoryId: string) => {
      setPrinters((prev) => {
        const updated = prev.map((p) => {
          if (p.id === printerId) {
            const currentCategories = p.assignedCategories || [];
            const isAssigned = currentCategories.includes(categoryId);

            return {
              ...p,
              assignedCategories: isAssigned
                ? currentCategories.filter((id) => id !== categoryId)
                : [...currentCategories, categoryId],
            };
          }
          return p;
        });

        const effectiveCompanyId = companyId || userData?.companyId;
        if (effectiveCompanyId) {
          localStorage.setItem(
            `printers_${effectiveCompanyId}`,
            JSON.stringify(updated)
          );
        }

        return updated;
      });
    },
    [companyId, userData?.companyId]
  );

  // Yazıcı ismini düzenle
  const updatePrinterName = useCallback(
    (printerId: string, newName: string) => {
      if (!newName || newName.trim() === "") {
        setError("Yazıcı adı boş olamaz");
        return;
      }

      setPrinters((prev) => {
        const updated = prev.map((p) => {
          if (p.id === printerId) {
            return {
              ...p,
              name: newName.trim(),
            };
          }
          return p;
        });

        const effectiveCompanyId = companyId || userData?.companyId;
        if (effectiveCompanyId) {
          localStorage.setItem(
            `printers_${effectiveCompanyId}`,
            JSON.stringify(updated)
          );
        }

        return updated;
      });

      setEditingPrinter(null);
      setEditingPrinterName("");
    },
    [companyId, userData?.companyId]
  );

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
      // Örnek sipariş verisi oluştur
      const exampleItems = [
        {
          menuId: "test1",
          menuName: "SIRIN KAHVALTI",
          quantity: 1,
          menuPrice: 1050,
          subtotal: 1050,
          notes: "",
          selectedExtras: [],
        },
        {
          menuId: "test2",
          menuName: "CAY",
          quantity: 2,
          menuPrice: 10,
          subtotal: 20,
          notes: "",
          selectedExtras: [],
        },
      ];

      // Firma adını al
      let companyName = "";
      if (companyId) {
        try {
          const company = await getCompany(companyId);
          companyName = company?.name || "";
        } catch {
          // Error loading company name
        }
      }

      // Yazdırma içeriğini oluştur
      // Kağıt genişliği kaldırıldı - 80mm için sabit 48 karakter kullanılıyor
      const printContent = formatPrintContent(
        "order",
        exampleItems,
        "5",
        undefined,
        {
          companyName: companyName || "Firma Adi",
          total: 1070,
        }
      );

      // Electron API ile yazdır
      if (window.electronAPI?.print) {
        const result = await window.electronAPI.print({
          printerName: printer.name,
          content: printContent,
          type: "order",
        });

        if (result.success) {
          setError(null);
          customAlert("Test yazdırma başarılı!", "Başarılı", "success");
        } else {
          setError(result.error || "Yazdırma sırasında bir hata oluştu");
        }
      } else {
        setError("Yazdırma API'si kullanılamıyor");
      }
    } catch (error: unknown) {
      setError(
        error instanceof Error
          ? error.message
          : "Yazdırma sırasında bir hata oluştu"
      );
    }
  }, [selectedPrinter, printers, companyId]);

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
                onClick={() =>
                  addNetworkPrinter(networkPrinterIP, networkPrinterName)
                }
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
        <div className="grid grid-cols-1 gap-4">
          {printers.map((printer) => (
            <div
              key={printer.id}
              className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border-2 p-4 ${
                selectedPrinter === printer.id
                  ? "border-blue-500 dark:border-blue-400"
                  : "border-gray-200 dark:border-gray-700"
              }`}
            >
              {/* Yazıcı Başlık Bilgisi */}
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div
                    className={`p-2 rounded-lg shrink-0 ${
                      printer.isConnected
                        ? "bg-green-100 dark:bg-green-900/20"
                        : "bg-gray-100 dark:bg-gray-700"
                    }`}
                  >
                    <Printer
                      className={`h-5 w-5 ${
                        printer.isConnected
                          ? "text-green-600 dark:text-green-400"
                          : "text-gray-400"
                      }`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    {editingPrinter === printer.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editingPrinterName}
                          onChange={(e) =>
                            setEditingPrinterName(e.target.value)
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              updatePrinterName(printer.id, editingPrinterName);
                            } else if (e.key === "Escape") {
                              setEditingPrinter(null);
                              setEditingPrinterName("");
                            }
                          }}
                          className="flex-1 px-2 py-1 text-base font-semibold border border-blue-500 dark:border-blue-400 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          autoFocus
                        />
                        <button
                          onClick={() =>
                            updatePrinterName(printer.id, editingPrinterName)
                          }
                          className="p-1 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                          title="Kaydet"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            setEditingPrinter(null);
                            setEditingPrinterName("");
                          }}
                          className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                          title="İptal"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <h3
                        className="text-base font-semibold text-gray-900 dark:text-white truncate cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        onClick={() => {
                          setEditingPrinter(printer.id);
                          setEditingPrinterName(printer.name);
                        }}
                        title="İsmi düzenlemek için tıklayın"
                      >
                        {printer.name}
                      </h3>
                    )}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
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
                        <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                          <div className="w-2 h-2 bg-green-600 dark:bg-green-400 rounded-full"></div>
                          Bağlı
                        </span>
                      ) : (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          Bağlı Değil
                        </span>
                      )}
                      {printer.assignedCategories &&
                        printer.assignedCategories.length > 0 && (
                          <span className="text-xs text-purple-600 dark:text-purple-400">
                            {printer.assignedCategories.length} Kategori Atanmış
                          </span>
                        )}
                      {printer.paperType && (
                        <span className="text-xs text-blue-600 dark:text-blue-400">
                          Kağıt: {printer.paperType} ({printer.paperWidth}{" "}
                          karakter)
                        </span>
                      )}
                    </div>
                    {printer.port && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                        {printer.port}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {selectedPrinter === printer.id && (
                    <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400 text-sm font-medium">
                      <Check className="h-4 w-4" />
                      <span>Varsayılan</span>
                    </div>
                  )}
                  {selectedPrinter !== printer.id && (
                    <Button
                      onClick={() => selectPrinter(printer.id)}
                      variant="outline"
                      size="sm"
                      className="text-sm"
                    >
                      Varsayılan Yap
                    </Button>
                  )}
                  <Button
                    onClick={() => {
                      if (editingPrinter === printer.id) {
                        setEditingPrinter(null);
                        setEditingPrinterName("");
                      } else {
                        setEditingPrinter(printer.id);
                        setEditingPrinterName(printer.name);
                      }
                    }}
                    variant="outline"
                    size="sm"
                    className="text-orange-600 dark:text-orange-400"
                    title="Kategori ayarları"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                  <Button
                    onClick={() => removePrinter(printer.id)}
                    variant="outline"
                    size="sm"
                    className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Kategori Seçimi - Genişletilebilir */}
              {editingPrinter === printer.id && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                    Yazdırılacak Kategoriler
                  </h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                    Bu kategorilerdeki ürünler masaya eklendiğinde veya iptal
                    edildiğinde otomatik olarak bu yazıcıya yazdırılacak.
                  </p>
                  {categories.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                      {categories.map((category) => {
                        const isAssigned = printer.assignedCategories?.includes(
                          category.id || ""
                        );
                        return (
                          <button
                            key={category.id}
                            onClick={() =>
                              toggleCategoryAssignment(
                                printer.id,
                                category.id || ""
                              )
                            }
                            className={`px-3 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                              isAssigned
                                ? "bg-purple-100 dark:bg-purple-900/20 border-purple-500 dark:border-purple-400 text-purple-700 dark:text-purple-300"
                                : "bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-purple-300 dark:hover:border-purple-600"
                            }`}
                          >
                            {isAssigned && (
                              <Check className="h-4 w-4 inline mr-1" />
                            )}
                            {category.name}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Henüz kategori oluşturulmamış. Önce Ürün Yönetimi'nden
                      kategori ekleyin.
                    </p>
                  )}
                </div>
              )}
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

      {/* Örnek Çıktı Önizlemesi - Her zaman görünür */}
      <div className="mt-6 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          Örnek Çıktı Önizlemesi
        </h3>
        <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded border border-gray-300 dark:border-gray-600 font-mono text-sm whitespace-pre overflow-x-auto">
          <div className="min-w-max">
            {(() => {
              let companyName = "";
              if (companyId) {
                // Firma adını al (async olmadan, sadece gösterim için)
                try {
                  // Burada sadece örnek gösteriyoruz, gerçek firma adı test yazdırmada alınacak
                  companyName = "Firma Adi";
                } catch {
                  // Error loading company name
                }
              }
              return getExamplePrintOutput(companyName || "Firma Adi");
            })()}
          </div>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          Bu örnek çıktı yazıcıdan nasıl görüneceğini gösterir. Türkçe
          karakterler ASCII karşılıklarına çevrilir.
        </p>
      </div>

      {/* Test Yazdırma Butonu */}
      {selectedPrinter && (
        <div className="mt-4">
          <Button
            onClick={testPrint}
            className="w-full bg-green-600 hover:bg-green-700 text-white"
          >
            <Printer className="h-4 w-4 mr-2" />
            Test Yazdır
          </Button>
        </div>
      )}
    </div>
  );
}
