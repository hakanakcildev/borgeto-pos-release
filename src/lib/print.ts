import type { OrderItem, Category } from "@/lib/firebase/types";

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
}

// Basit yazdırma içeriği oluştur - sadece düz metin, Türkçe karakter desteği
export function formatPrintContent(
  type: "order" | "cancel" | "payment",
  items: OrderItem[],
  tableNumber: string | number,
  orderNumber?: string,
  additionalInfo?: {
    companyName?: string;
    total?: number;
    paymentMethod?: string;
    subtotal?: number;
    discount?: number;
    paperWidth?: number; // Kağıt genişliği (karakter sayısı)
  }
): string {
  // Türkçe karakterleri koru (UTF-8)
  const companyName = additionalInfo?.companyName || "Firma Adi";
  const tableNum = String(tableNumber);

  // Önce tüm içeriği oluştur ve en uzun satırın genişliğini bul
  const lines: string[] = [];

  // Başlık
  const headerLine = companyName + " - Masa " + tableNum;
  lines.push(headerLine);
  lines.push(""); // Boş satır

  // Ürünler
  for (const item of items) {
    const itemName = item.menuName;
    const quantity = item.quantity;
    const price = item.menuPrice || 0;
    const subtotal = item.subtotal || 0;

    // Adet x Ürün Adı - Fiyat (kompakt format)
    const itemLine = `${quantity}x ${itemName}`;
    const priceLine = `${price.toFixed(2)} TL x${quantity} = ${subtotal.toFixed(2)} TL`;
    lines.push(itemLine);
    lines.push(priceLine);

    // Ekstra malzemeler varsa göster (kompakt format)
    if (item.selectedExtras && item.selectedExtras.length > 0) {
      for (const extra of item.selectedExtras) {
        const extraLine = `+ ${extra.name} (+${extra.price.toFixed(2)} TL)`;
        lines.push(extraLine);
      }
    }

    // Not varsa göster (kompakt format)
    if (item.notes && item.notes.trim()) {
      const noteLine = `Not: ${item.notes}`;
      lines.push(noteLine);
    }

    lines.push(""); // Boş satır
  }

  // Toplam tutar
  const total =
    additionalInfo?.total ||
    items.reduce((sum, item) => sum + (item.subtotal || 0), 0);
  const totalLine = `Toplam Tutar: ${total.toFixed(2)} TL`;
  lines.push(totalLine);
  lines.push(""); // Boş satır

  // Ödeme bilgisi varsa göster
  if (type === "payment" && additionalInfo?.paymentMethod) {
    lines.push("ODEME ALINDI");
    lines.push(""); // Boş satır
    lines.push(`Odeme Yontemi: ${additionalInfo.paymentMethod}`);

    if (additionalInfo.subtotal) {
      lines.push(`Ara Toplam: ${additionalInfo.subtotal.toFixed(2)} TL`);
    }
    if (additionalInfo.discount && additionalInfo.discount > 0) {
      lines.push(`Iskonto: -${additionalInfo.discount.toFixed(2)} TL`);
    }
    lines.push(`Toplam: ${total.toFixed(2)} TL`);
    lines.push(""); // Boş satır
  }

  // İptal edildi bilgisi
  if (type === "cancel") {
    lines.push("IPTAL EDILDI");
    lines.push(""); // Boş satır
  }

  // Sipariş numarası varsa göster
  if (orderNumber) {
    lines.push(`Siparis No: ${orderNumber}`);
    lines.push(""); // Boş satır
  }

  // 80mm kağıt için maksimum genişlik: 48 karakter (tam genişlik kullanımı)
  // Kağıt genişliği bilgisi varsa kullan, yoksa 80mm için 48 karakter
  const paperWidth = additionalInfo?.paperWidth || 48;
  const maxPaperWidth = Math.min(paperWidth, 48); // Maksimum 48 karakter (80mm)

  // En uzun satırın genişliğini bul (boş satırlar hariç)
  const maxWidth = Math.max(
    ...lines.filter((line) => line.trim().length > 0).map((line) => line.length)
  );

  // Çizgiyi kağıt genişliğine göre oluştur (minimum maxPaperWidth karakter)
  const separatorWidth = Math.max(maxWidth, maxPaperWidth);
  const separatorLine = "=".repeat(separatorWidth);

  // Satırları 48 karakter genişliğinde formatla (uzun satırları wrap et)
  const formatLine = (line: string, width: number): string[] => {
    if (line.trim().length === 0) return [line];
    if (line.length <= width) return [line];

    // Uzun satırları wrap et
    const words = line.split(" ");
    const result: string[] = [];
    let currentLine = "";

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (testLine.length <= width) {
        currentLine = testLine;
      } else {
        if (currentLine) {
          result.push(currentLine);
          currentLine = word.length > width ? word.substring(0, width) : word;
          if (word.length > width) {
            // Çok uzun kelimeyi parçala
            let remaining = word.substring(width);
            while (remaining.length > width) {
              result.push(remaining.substring(0, width));
              remaining = remaining.substring(width);
            }
            if (remaining) currentLine = remaining;
          }
        } else {
          // Tek kelime çok uzunsa kes
          result.push(word.substring(0, width));
          let remaining = word.substring(width);
          while (remaining.length > width) {
            result.push(remaining.substring(0, width));
            remaining = remaining.substring(width);
          }
          currentLine = remaining;
        }
      }
    }
    if (currentLine) result.push(currentLine);
    return result;
  };

  // İçeriği oluştur ve çizgileri ekle
  let content = "";

  // Başlık (ortalanmış)
  const centeredHeader =
    headerLine.length <= separatorWidth
      ? headerLine
          .padStart(Math.floor((separatorWidth + headerLine.length) / 2))
          .padEnd(separatorWidth)
      : headerLine.substring(0, separatorWidth);
  content += centeredHeader + "\n";
  content += separatorLine + "\n";
  content += "\n";

  // Ürünler (başlık çizgisinden sonraki kısım)
  let lastWasEmpty = false;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];

    // Toplam satırından önce çizgi ekle
    if (line === totalLine && lastWasEmpty) {
      content += separatorLine + "\n";
      content += "\n";
    }

    // Satırı formatla (maksimum 48 karakter, uzun satırları wrap et)
    const formattedLines = formatLine(line, separatorWidth);
    for (const formattedLine of formattedLines) {
      content += formattedLine + "\n";
    }
    lastWasEmpty = line.trim().length === 0;
  }

  // Boş satırlar
  content += "\n\n\n";

  return content;
}

// Örnek çıktı formatını göster (yazıcı sayfası için)
export function getExamplePrintOutput(
  companyName: string = "Firma Adi",
  tableNumber: string = "5"
): string {
  // Örnek satırları oluştur
  const lines = [
    `${companyName} - Masa ${tableNumber}`,
    "",
    "1x Şirin Kahvaltı",
    "   1050.00 TL x 1 = 1050.00 TL",
    "",
    "2x Çay",
    "   10.00 TL x 2 = 20.00 TL",
    "",
    "1x Kahve",
    "   15.00 TL x 1 = 15.00 TL",
    "",
    "Toplam Tutar: 1085.00 TL",
  ];

  // 80mm kağıt için maksimum genişlik: 48 karakter (tam genişlik kullanımı)
  const maxPaperWidth = 48; // 80mm kağıt için standart genişlik

  // En uzun satırın genişliğini bul (boş satırlar hariç)
  const maxWidth = Math.max(
    ...lines.filter((line) => line.trim().length > 0).map((line) => line.length)
  );

  // Çizgiyi kağıt genişliğine göre oluştur (minimum 48 karakter - 80mm)
  const separatorWidth = Math.max(maxWidth, maxPaperWidth);
  const separatorLine = "=".repeat(separatorWidth);

  // İçeriği oluştur
  let content = "";
  content += lines[0] + "\n";
  content += separatorLine + "\n";
  content += "\n";

  for (let i = 2; i < lines.length; i++) {
    const line = lines[i];

    // Toplam satırından önce çizgi ekle
    if (line === "Toplam Tutar: 1085.00 TL") {
      content += separatorLine + "\n";
      content += "\n";
    }

    content += line + "\n";
  }

  return content;
}

// Yazıcıya yazdır
export async function printToPrinter(
  printerName: string,
  content: string,
  type: "order" | "cancel" | "payment" = "order"
): Promise<boolean> {
  if (!window.electronAPI?.print) {
    return false;
  }

  try {
    const result = await window.electronAPI.print({
      printerName,
      content,
      type,
    });

    if (result.success) {
      return true;
    } else {
      return false;
    }
  } catch {
    return false;
  }
}

// Kategoriye göre yazıcıları bul
export function getPrintersForCategories(
  printers: PrinterDevice[],
  _categories: Category[],
  itemCategories: string[]
): PrinterDevice[] {
  const categoryIds = new Set(itemCategories);

  return printers.filter((printer) => {
    if (
      !printer.assignedCategories ||
      printer.assignedCategories.length === 0
    ) {
      return false;
    }

    // Yazıcının atandığı kategorilerden herhangi biri ürün kategorilerinde varsa
    return printer.assignedCategories.some((assignedCategoryId) =>
      categoryIds.has(assignedCategoryId)
    );
  });
}

// Ana yazıcıyı bul
export function getDefaultPrinter(
  printers: PrinterDevice[],
  selectedPrinterId: string | null
): PrinterDevice | null {
  if (selectedPrinterId) {
    const printer = printers.find((p) => p.id === selectedPrinterId);
    if (printer) return printer;
  }

  // Varsayılan yazıcıyı bul (sistem varsayılanı)
  return printers.find((p) => p.isConnected) || null;
}
