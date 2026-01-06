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
  options?: {
    paperWidth?: number;
    paperType?: string;
  };
}

// Türkçe karakterleri ASCII karşılıklarına çevir (termal yazıcı uyumluluğu için)
function turkishToAscii(text: string): string {
  return text
    .replace(/ğ/g, "g")
    .replace(/Ğ/g, "G")
    .replace(/ş/g, "s")
    .replace(/Ş/g, "S")
    .replace(/ı/g, "i")
    .replace(/İ/g, "I")
    .replace(/ç/g, "c")
    .replace(/Ç/g, "C")
    .replace(/ö/g, "o")
    .replace(/Ö/g, "O")
    .replace(/ü/g, "u")
    .replace(/Ü/g, "U");
}

// ESC/POS yazdırma içeriği oluştur - Standart ESC/POS formatı
export function formatPrintContent(
  type: "order" | "cancel" | "payment",
  items: OrderItem[],
  tableNumber: string | number,
  _orderNumber?: string,
  additionalInfo?: {
    companyName?: string;
    total?: number;
    paymentMethod?: string;
    subtotal?: number;
    discount?: number;
    paperWidth?: number;
    canceledItems?: OrderItem[];
    isPaid?: boolean;
  }
): string {
  const companyName = additionalInfo?.companyName
    ? turkishToAscii(additionalInfo.companyName)
    : undefined;
  const tableNum = String(tableNumber);
  const isPaid = additionalInfo?.isPaid || type === "payment";
  const paperWidth = additionalInfo?.paperWidth || 48; // 80mm için 48 karakter

  // ESC/POS komutları - Standart byte değerleri
  const ESC = String.fromCharCode(0x1b);
  const GS = String.fromCharCode(0x1d);
  const LF = String.fromCharCode(0x0a); // Sadece LF kullan (ESC/POS standardı)

  let content = "";

  // 1. Reset printer - Sadece bir kez başta (tüm ayarları sıfırla)
  content += ESC + "@";

  // 2. Code page - ASCII (0) - Sadece bir kez
  content += ESC + "t" + String.fromCharCode(0x00);

  // 3. Left alignment - Sadece bir kez
  content += ESC + "a" + String.fromCharCode(0x00);

  // 4. Normal font size - Sadece bir kez
  content += ESC + "!" + String.fromCharCode(0x00);

  // 5. Line spacing - Minimum (0) - Üst margin'i minimize et
  content += ESC + "3" + String.fromCharCode(0x00);

  // 6. Character spacing - 0
  content += ESC + " " + String.fromCharCode(0x00);

  // 7. Left margin - 0 (GS L nL nH) - Sol margin'i sıfırla
  content += GS + "L" + String.fromCharCode(0x00) + String.fromCharCode(0x00);

  // 8. Print area width - Maksimum (GS W nL nH) - 80mm için 576 dots (203 DPI)
  // 80mm = 3.15 inch, 203 DPI = 640 dots, ama genellikle 576 kullanılır
  const printWidth = 576; // 80mm için standart genişlik
  content +=
    GS +
    "W" +
    String.fromCharCode(printWidth & 0xff) +
    String.fromCharCode((printWidth >> 8) & 0xff);

  // Firma Adı - Büyük ve kalın
  if (companyName) {
    const nameToPrint =
      companyName.length > paperWidth
        ? companyName.substring(0, paperWidth)
        : companyName;
    // Double width + height
    content += ESC + "!" + String.fromCharCode(0x30);
    // Bold on
    content += ESC + "E" + String.fromCharCode(0x01);
    content += nameToPrint;
    // Bold off
    content += ESC + "E" + String.fromCharCode(0x00);
    // Normal size
    content += ESC + "!" + String.fromCharCode(0x00);
    content += LF;
  }

  // Masa bilgisi
  content += `Masa ${tableNum}`;
  content += LF;
  content += LF;

  // Ürünleri birleştir
  const mergedItems = new Map<
    string,
    {
      item: OrderItem;
      totalQuantity: number;
      totalSubtotal: number;
    }
  >();

  for (const item of items) {
    const extrasKey =
      item.selectedExtras && item.selectedExtras.length > 0
        ? JSON.stringify(
            item.selectedExtras.map((e) => ({
              id: e.id,
              name: e.name,
              price: e.price,
            }))
          )
        : "";
    const notesKey = item.notes && item.notes.trim() ? item.notes.trim() : "";
    const mergeKey = `${item.menuId}|||${extrasKey}|||${notesKey}`;

    if (mergedItems.has(mergeKey)) {
      const existing = mergedItems.get(mergeKey)!;
      existing.totalQuantity += item.quantity;
      existing.totalSubtotal += item.subtotal;
    } else {
      mergedItems.set(mergeKey, {
        item,
        totalQuantity: item.quantity,
        totalSubtotal: item.subtotal,
      });
    }
  }

  // Ürünleri yazdır
  for (const { item, totalQuantity, totalSubtotal } of mergedItems.values()) {
    // Tüm metinleri ASCII'ye çevir
    const itemName = turkishToAscii(item.menuName).toUpperCase();
    const price = item.menuPrice || 0;

    // Ürün satırı - Normal boyut, kalın
    content += ESC + "E" + String.fromCharCode(0x01); // Bold on
    content += `${totalQuantity}x ${itemName}`;
    content += ESC + "E" + String.fromCharCode(0x00); // Bold off
    content += LF;

    // Fiyat satırı - Normal boyut
    const priceText = `${price.toFixed(2)} TL x${totalQuantity} = ${totalSubtotal.toFixed(2)} TL`;
    content += priceText;
    content += LF;

    // Ekstra malzemeler
    if (item.selectedExtras && item.selectedExtras.length > 0) {
      for (const extra of item.selectedExtras) {
        const extraName = turkishToAscii(extra.name);
        content += `  + ${extraName} +${extra.price.toFixed(2)} TL`;
        content += LF;
      }
    }

    // Notlar
    if (item.notes && item.notes.trim()) {
      const noteText = turkishToAscii(item.notes);
      content += `  Not: ${noteText}`;
      content += LF;
    }

    content += LF;
  }

  // İptal edilen ürünler
  if (
    additionalInfo?.canceledItems &&
    additionalInfo.canceledItems.length > 0
  ) {
    content += "IPTAL EDILEN URUNLER";
    content += LF;
    for (const item of additionalInfo.canceledItems) {
      const itemName = turkishToAscii(item.menuName).toUpperCase();
      content += `${item.quantity}x ${itemName} (IPTAL)`;
      content += LF;
      content += `${item.subtotal.toFixed(2)} TL`;
      content += LF;
    }
    content += LF;
  }

  // Toplam - Büyük ve kalın
  const total =
    additionalInfo?.total ||
    Array.from(mergedItems.values()).reduce(
      (sum, { totalSubtotal }) => sum + totalSubtotal,
      0
    );

  content += LF;
  // Double width + height
  content += ESC + "!" + String.fromCharCode(0x30);
  // Bold on
  content += ESC + "E" + String.fromCharCode(0x01);
  if (isPaid) {
    content += `Toplam Tutar: ${total.toFixed(2)} TL - Odendi`;
  } else {
    content += `Toplam Fiyat: ${total.toFixed(2)} TL`;
  }
  // Bold off
  content += ESC + "E" + String.fromCharCode(0x00);
  // Normal size
  content += ESC + "!" + String.fromCharCode(0x00);
  content += LF;

  // Ödeme yöntemi
  if (type === "payment" && additionalInfo?.paymentMethod) {
    const paymentMethodText = turkishToAscii(additionalInfo.paymentMethod);
    content += `Odeme Yontemi: ${paymentMethodText}`;
    content += LF;
  }

  // İndirim
  if (additionalInfo?.discount && additionalInfo.discount > 0) {
    content += `Iskonto: -${additionalInfo.discount.toFixed(2)} TL`;
    content += LF;
  }

  // Boş satırlar
  content += LF;
  content += "Tesekkur ederiz!";
  content += LF;
  content += LF;
  content += LF;

  return content;
}

// HTML formatında yazdırma içeriği oluştur - 80mm termal yazıcı için optimize edilmiş
export function formatPrintHTMLContent(
  type: "order" | "cancel" | "payment",
  items: OrderItem[],
  tableNumber: string | number,
  _orderNumber?: string,
  additionalInfo?: {
    companyName?: string;
    total?: number;
    paymentMethod?: string;
    subtotal?: number;
    discount?: number;
    paperWidth?: number;
    canceledItems?: OrderItem[];
    isPaid?: boolean;
  }
): string {
  const companyName = additionalInfo?.companyName || "";
  const tableNum = String(tableNumber);
  const isPaid = additionalInfo?.isPaid || type === "payment";
  const paperWidthMM = 80;

  // Ürünleri birleştir
  const mergedItems = new Map<
    string,
    {
      item: OrderItem;
      totalQuantity: number;
      totalSubtotal: number;
    }
  >();

  for (const item of items) {
    const extrasKey =
      item.selectedExtras && item.selectedExtras.length > 0
        ? JSON.stringify(
            item.selectedExtras.map((e) => ({
              id: e.id,
              name: e.name,
              price: e.price,
            }))
          )
        : "";
    const notesKey = item.notes && item.notes.trim() ? item.notes.trim() : "";
    const mergeKey = `${item.menuId}|||${extrasKey}|||${notesKey}`;

    if (mergedItems.has(mergeKey)) {
      const existing = mergedItems.get(mergeKey)!;
      existing.totalQuantity += item.quantity;
      existing.totalSubtotal += item.subtotal;
    } else {
      mergedItems.set(mergeKey, {
        item,
        totalQuantity: item.quantity,
        totalSubtotal: item.subtotal,
      });
    }
  }

  const total =
    additionalInfo?.total ||
    Array.from(mergedItems.values()).reduce(
      (sum, { totalSubtotal }) => sum + totalSubtotal,
      0
    );

  // HTML içeriği
  let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page {
      size: ${paperWidthMM}mm auto;
      margin: 0;
      padding: 0;
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Courier New', monospace;
      width: ${paperWidthMM}mm;
      margin: 0;
      padding: 0;
      font-size: 12px;
      line-height: 1.2;
    }
    .header {
      text-align: center;
      font-weight: bold;
      font-size: 14px;
      margin-bottom: 8px;
    }
    .table-info {
      margin-bottom: 8px;
    }
    .item-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
    }
    .item-name {
      flex: 1;
      font-weight: bold;
    }
    .item-price {
      font-weight: bold;
    }
    .extra-item {
      padding-left: 16px;
      font-size: 10px;
      margin-bottom: 2px;
    }
    .note-item {
      padding-left: 16px;
      font-size: 10px;
      font-style: italic;
      margin-bottom: 2px;
    }
    .total-row {
      margin-top: 12px;
      padding-top: 8px;
      border-top: 1px dashed #000;
      font-weight: bold;
      font-size: 13px;
    }
  </style>
</head>
<body>`;

  if (companyName) {
    html += `<div class="header">${companyName.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>`;
  }

  html += `<div class="table-info">Masa ${tableNum.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>`;

  for (const { item, totalQuantity, totalSubtotal } of mergedItems.values()) {
    html += `<div class="item-row">
      <span class="item-name">${totalQuantity}x ${item.menuName.toUpperCase()}</span>
      <span class="item-price">${totalSubtotal.toFixed(2)} TL</span>
    </div>`;

    if (item.selectedExtras && item.selectedExtras.length > 0) {
      for (const extra of item.selectedExtras) {
        html += `<div class="extra-item">+ ${extra.name} +${extra.price.toFixed(2)} TL</div>`;
      }
    }

    if (item.notes && item.notes.trim()) {
      html += `<div class="note-item">Not: ${item.notes}</div>`;
    }
  }

  html += `<div class="total-row">
    <div>Toplam ${isPaid ? "Tutar" : "Fiyat"}: ${total.toFixed(2)} TL${isPaid ? " - Ödendi" : ""}</div>
  </div>`;

  if (type === "payment" && additionalInfo?.paymentMethod) {
    html += `<div>Ödeme Yöntemi: ${additionalInfo.paymentMethod}</div>`;
  }

  if (additionalInfo?.discount && additionalInfo.discount > 0) {
    html += `<div>İskonto: -${additionalInfo.discount.toFixed(2)} TL</div>`;
  }

  html += `</body>
</html>`;

  return html;
}

// Örnek çıktı formatını göster
export function getExamplePrintOutput(
  companyName: string = "Firma Adi",
  tableNumber: string = "5"
): string {
  let content = "";

  const companyNameClean = turkishToAscii(companyName);
  content += companyNameClean + "\n";
  content += `Masa ${tableNumber}\n`;
  content += "\n";

  const exampleItems = [
    { name: "SIRIN KAHVALTI", quantity: 1, price: 1050.0, subtotal: 1050.0 },
    { name: "CAY", quantity: 2, price: 10.0, subtotal: 20.0 },
    { name: "KAHVE", quantity: 1, price: 15.0, subtotal: 15.0 },
  ];

  for (const item of exampleItems) {
    content += `${item.quantity}x ${item.name}\n`;
    content += `${item.price.toFixed(2)} TL x${item.quantity} = ${item.subtotal.toFixed(2)} TL\n`;
    content += "\n";
  }

  content += "\n";
  content += "Toplam Fiyat: 1085.00 TL\n";
  content += "\n\n";

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

    return result.success;
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
  if (!itemCategories || itemCategories.length === 0) {
    return printers.filter(
      (p) => !p.assignedCategories || p.assignedCategories.length === 0
    );
  }

  return printers.filter((printer) => {
    if (
      !printer.assignedCategories ||
      printer.assignedCategories.length === 0
    ) {
      return true;
    }
    return itemCategories.some((catId) =>
      printer.assignedCategories?.includes(catId)
    );
  });
}

// Varsayılan yazıcıyı bul
export function getDefaultPrinter(
  printers: PrinterDevice[],
  selectedPrinterId: string | null
): PrinterDevice | null {
  if (!printers || printers.length === 0) {
    return null;
  }

  // Seçili yazıcı varsa onu döndür
  if (selectedPrinterId) {
    const selected = printers.find((p) => p.id === selectedPrinterId);
    if (selected) {
      return selected;
    }
  }

  // İlk bağlı yazıcıyı döndür
  const connected = printers.find((p) => p.isConnected);
  if (connected) {
    return connected;
  }

  // Hiçbiri yoksa ilk yazıcıyı döndür
  return printers[0] || null;
}
