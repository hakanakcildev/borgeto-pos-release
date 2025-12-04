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

    // Adet x Ürün Adı - Fiyat
    const itemLine = `${quantity}x ${itemName}`;
    const priceLine = `   ${price.toFixed(2)} TL x ${quantity} = ${subtotal.toFixed(2)} TL`;
    lines.push(itemLine);
    lines.push(priceLine);

    // Ekstra malzemeler varsa göster
    if (item.selectedExtras && item.selectedExtras.length > 0) {
      for (const extra of item.selectedExtras) {
        const extraLine = `   + ${extra.name} (+${extra.price.toFixed(2)} TL)`;
        lines.push(extraLine);
      }
    }

    // Not varsa göster
    if (item.notes && item.notes.trim()) {
      const noteLine = `   Not: ${item.notes}`;
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

  // En uzun satırın genişliğini bul (boş satırlar hariç)
  const maxWidth = Math.max(
    ...lines.filter((line) => line.trim().length > 0).map((line) => line.length)
  );

  // Çizgiyi en uzun satırın genişliğine göre oluştur (minimum 40 karakter)
  const separatorWidth = Math.max(maxWidth, 40);
  const separatorLine = "=".repeat(separatorWidth);

  // İçeriği oluştur ve çizgileri ekle
  let content = "";

  // Başlık
  content += headerLine + "\n";
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

    content += line + "\n";
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

  // En uzun satırın genişliğini bul (boş satırlar hariç)
  const maxWidth = Math.max(
    ...lines.filter((line) => line.trim().length > 0).map((line) => line.length)
  );

  // Çizgiyi en uzun satırın genişliğine göre oluştur (minimum 40 karakter)
  const separatorWidth = Math.max(maxWidth, 40);
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
