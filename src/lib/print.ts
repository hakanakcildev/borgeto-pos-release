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

// ESC/POS yazdırma içeriği oluştur - Agresif margin ve encoding düzeltmeleri
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

  let content = "";

  // ESC/POS komutları
  const ESC = String.fromCharCode(0x1b);
  const GS = String.fromCharCode(0x1d);
  const LF = String.fromCharCode(0x0a);
  const CR = String.fromCharCode(0x0d);
  const CRLF = CR + LF;
  
  // Reset - Her şeyi sıfırla
  const resetPrinter = ESC + "@";
  
  // Code page - ASCII (0) - ÖNEMLİ: Her satırdan önce gönder
  const codePageASCII = ESC + String.fromCharCode(0x74) + String.fromCharCode(0x00);
  
  // Alignment - Left
  const leftAlign = ESC + String.fromCharCode(0x61) + String.fromCharCode(0x00);
  
  // Font size - Normal (başlangıç)
  const normalSize = ESC + String.fromCharCode(0x21) + String.fromCharCode(0x00);
  const doubleWidthHeight = ESC + String.fromCharCode(0x21) + String.fromCharCode(0x30);
  
  // Bold
  const boldOn = ESC + String.fromCharCode(0x45) + String.fromCharCode(0x01);
  const boldOff = ESC + String.fromCharCode(0x45) + String.fromCharCode(0x00);
  
  // Margin komutları - Agresif şekilde sıfırla
  const leftMargin0 = GS + String.fromCharCode(0x4c) + String.fromCharCode(0x00) + String.fromCharCode(0x00); // GS L 0 0
  const leftMarginSimple = ESC + String.fromCharCode(0x6c) + String.fromCharCode(0x00); // ESC l 0
  const printAreaWidth = GS + String.fromCharCode(0x57) + String.fromCharCode(0x30) + String.fromCharCode(0x00); // GS W 48
  const charSpacing = ESC + String.fromCharCode(0x20) + String.fromCharCode(0x00); // ESC SP 0
  const lineSpacing = ESC + String.fromCharCode(0x33) + String.fromCharCode(0x00); // ESC 3 0
  
  // Başlangıç komutları - Yazıcıyı tamamen sıfırla
  content += resetPrinter;
  content += resetPrinter; // Tekrar reset
  content += codePageASCII; // ASCII code page
  content += leftAlign; // Left align
  content += normalSize; // Normal size
  
  // Margin'leri agresif şekilde sıfırla
  content += leftMargin0;
  content += leftMargin0; // Tekrar
  content += leftMarginSimple;
  content += printAreaWidth;
  content += charSpacing;
  content += lineSpacing;
  content += CRLF; // İlk satır için feed

  // Yardımcı fonksiyon: Her satırdan önce margin ve encoding komutlarını gönder
  const addLineWithMargin = (text: string) => {
    let line = "";
    line += codePageASCII; // Her satırdan önce code page
    line += leftMargin0; // Her satırdan önce margin sıfırla
    line += leftAlign; // Her satırdan önce left align
    line += text;
    line += CRLF;
    return line;
  };

  // Firma Adı - Büyük ve kalın
  if (companyName) {
    const nameToPrint = companyName.length > paperWidth 
      ? companyName.substring(0, paperWidth) 
      : companyName;
    content += codePageASCII;
    content += leftMargin0;
    content += leftAlign;
    content += doubleWidthHeight;
    content += boldOn;
    content += nameToPrint;
    content += boldOff;
    content += normalSize;
    content += CRLF;
  }

  // Masa bilgisi
  content += addLineWithMargin(`Masa ${tableNum}`);
  content += addLineWithMargin(""); // Boş satır

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
    content += codePageASCII;
    content += leftMargin0;
    content += leftAlign;
    content += normalSize;
    content += boldOn;
    content += `${totalQuantity}x ${itemName}`;
    content += boldOff;
    content += CRLF;

    // Fiyat satırı - Normal boyut
    content += codePageASCII;
    content += leftMargin0;
    content += leftAlign;
    content += normalSize;
    const priceText = `${price.toFixed(2)} TL x${totalQuantity} = ${totalSubtotal.toFixed(2)} TL`;
    content += priceText;
    content += CRLF;

    // Ekstra malzemeler
    if (item.selectedExtras && item.selectedExtras.length > 0) {
      for (const extra of item.selectedExtras) {
        const extraName = turkishToAscii(extra.name);
        content += addLineWithMargin(`  + ${extraName} +${extra.price.toFixed(2)} TL`);
      }
    }

    // Notlar
    if (item.notes && item.notes.trim()) {
      const noteText = turkishToAscii(item.notes);
      content += addLineWithMargin(`  Not: ${noteText}`);
    }

    content += addLineWithMargin(""); // Boş satır
  }

  // İptal edilen ürünler
  if (additionalInfo?.canceledItems && additionalInfo.canceledItems.length > 0) {
    content += addLineWithMargin("IPTAL EDILEN URUNLER");
    for (const item of additionalInfo.canceledItems) {
      const itemName = turkishToAscii(item.menuName).toUpperCase();
      content += addLineWithMargin(`${item.quantity}x ${itemName} (IPTAL)`);
      content += addLineWithMargin(`${item.subtotal.toFixed(2)} TL`);
    }
    content += addLineWithMargin("");
  }

  // Toplam - Büyük ve kalın
  const total =
    additionalInfo?.total ||
    Array.from(mergedItems.values()).reduce(
      (sum, { totalSubtotal }) => sum + totalSubtotal,
      0
    );

  content += addLineWithMargin("");
  content += codePageASCII;
  content += leftMargin0;
  content += leftAlign;
  content += doubleWidthHeight;
  content += boldOn;
  if (isPaid) {
    content += `Toplam Tutar: ${total.toFixed(2)} TL - Odendi`;
  } else {
    content += `Toplam Fiyat: ${total.toFixed(2)} TL`;
  }
  content += boldOff;
  content += normalSize;
  content += CRLF;

  // Ödeme yöntemi
  if (type === "payment" && additionalInfo?.paymentMethod) {
    const paymentMethodText = turkishToAscii(additionalInfo.paymentMethod);
    content += addLineWithMargin(`Odeme Yontemi: ${paymentMethodText}`);
  }

  // İndirim
  if (additionalInfo?.discount && additionalInfo.discount > 0) {
    content += addLineWithMargin(`Iskonto: -${additionalInfo.discount.toFixed(2)} TL`);
  }

  // Boş satırlar
  content += addLineWithMargin("");
  content += addLineWithMargin("Tesekkur ederiz!");
  content += addLineWithMargin("");
  content += addLineWithMargin("");

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
  const paperWidth = 48;
  let content = "";

  const companyNameClean = turkishToAscii(companyName);
  content += companyNameClean + "\r\n";
  content += `Masa ${tableNumber}\r\n`;
  content += "\r\n";

  const exampleItems = [
    { name: "SIRIN KAHVALTI", quantity: 1, price: 1050.0, subtotal: 1050.0 },
    { name: "CAY", quantity: 2, price: 10.0, subtotal: 20.0 },
    { name: "KAHVE", quantity: 1, price: 15.0, subtotal: 15.0 },
  ];

  for (const item of exampleItems) {
    content += `${item.quantity}x ${item.name}\r\n`;
    content += `${item.price.toFixed(2)} TL x${item.quantity} = ${item.subtotal.toFixed(2)} TL\r\n`;
    content += "\r\n";
  }

  content += "\r\n";
  content += "Toplam Fiyat: 1085.00 TL\r\n";
  content += "\r\n\r\n";

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
    return printers.filter((p) => !p.assignedCategories || p.assignedCategories.length === 0);
  }

  return printers.filter((printer) => {
    if (!printer.assignedCategories || printer.assignedCategories.length === 0) {
      return true;
    }
    return itemCategories.some((catId) => printer.assignedCategories?.includes(catId));
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
