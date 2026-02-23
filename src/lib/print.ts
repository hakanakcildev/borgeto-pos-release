import type { OrderItem, Category } from "@/lib/firebase/types";

export type PrintTrigger = "all" | "categories" | "manual_only";

/** Tüm Hareket modunda: birlikte = tek fiş, by_group = gruplara göre ayrı fişler */
export type AllPrintMode = "together" | "by_group";

/** Yazdırma grubu (Ayrı yazdır): örn. Mutfak = [waffle, kumpir, tatlılar], Bar = [sıcak içecek, soğuk içecek] */
export interface PrintGroup {
  id: string;
  name: string;
  categoryIds: string[];
}

export interface PrinterDevice {
  id: string;
  name: string;
  type: "serial" | "usb" | "network" | "system";
  port?: string;
  vendorId?: number;
  productId?: number;
  isConnected: boolean;
  /** Ne zaman otomatik yazdırılsın: all = tüm hareket, categories = sadece seçili kategoriler, manual_only = sadece yazdır butonu */
  printTrigger?: PrintTrigger;
  /** Tüm Hareket seçiliyken: "together" = hepsi tek fiş, "by_group" = her grup ayrı fiş */
  allPrintMode?: AllPrintMode;
  /** allPrintMode === "by_group" iken: her grup ayrı adisyon (örn. Mutfak grubu, Bar grubu) */
  printGroups?: PrintGroup[];
  assignedCategories?: string[]; // Kategori ID'leri (printTrigger === "categories" iken kullanılır)
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
  const tableNum = turkishToAscii(String(tableNumber));
  const isPaid = additionalInfo?.isPaid || type === "payment";
  const paperWidth = additionalInfo?.paperWidth || 48; // 80mm için 48 karakter
  const now = new Date();
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const formattedDateTime = `${pad2(now.getDate())}.${pad2(now.getMonth() + 1)}.${now.getFullYear()} - ${pad2(now.getHours())}:${pad2(now.getMinutes())}`;

  // Tablo: Ürün | Adet (birim fiyat) | Toplam
  const colAdet = 12;   // Birim fiyat için (örn. 170.00 TL)
  const colToplam = 12;
  const colUrun = Math.max(18, paperWidth - colAdet - colToplam);

  const padRight = (s: string, w: number) =>
    s.length >= w ? s.substring(0, w) : s + " ".repeat(w - s.length);
  const padLeft = (s: string, w: number) =>
    s.length >= w ? s.substring(0, w) : " ".repeat(w - s.length) + s;
  const fullLine = () => "-".repeat(paperWidth);

  const ESC = String.fromCharCode(0x1b);
  const GS = String.fromCharCode(0x1d);
  const LF = String.fromCharCode(0x0a);
  // ESC d n = "feed n lines" — termal yazıcıda ardışık LF'ler bazen tek sayılır; bu komut kesin n satır boşluk verir
  const feedLines = (n: number) =>
    n <= 0 ? "" : ESC + "d" + String.fromCharCode(Math.min(255, n));
  // Bir satır yazdıktan sonra: LF + feedLines(extra) — her satır arasında dikey boşluk
  // extraLines=0 olsa bile en azından bir LF ver (satır aralığı ESC 3 ile ayarlanır)
  // Bazı yazıcılarda ESC 3 yeterli olmayabilir, bu yüzden her satır sonunda en azından LF kullanıyoruz
  const lineBreak = (extraLines: number) =>
    LF + (extraLines > 0 ? feedLines(extraLines) : "");

  let content = "";

  // 1. Reset printer - Sadece bir kez başta (tüm ayarları sıfırla)
  content += ESC + "@";
  // Reset'ten sonra üst boşluk olmaması için hemen ayarları yap

  // 2. Code page - ASCII (0) - Sadece bir kez
  content += ESC + "t" + String.fromCharCode(0x00);

  // 3. Left alignment - Başlangıçta sol (firma adı için ortaya geçeceğiz)
  content += ESC + "a" + String.fromCharCode(0x00);

  // 4. Normal font size - Sadece bir kez
  content += ESC + "!" + String.fromCharCode(0x00);

  // 5. Satır aralığı: Başlangıçta 0 (ürün satırları bitişik olacak)
  // Firma/masa/toplam sonrası manuel olarak boşluk ekleyeceğiz
  content += ESC + "3" + String.fromCharCode(0);

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

  // Firma Adı - Büyük ve kalın, ortalanmış (üst boşluk yok)
  if (companyName) {
    const nameToPrint =
      companyName.length > paperWidth
        ? companyName.substring(0, paperWidth)
        : companyName;
    // Firma adını ortala
    content += ESC + "a" + String.fromCharCode(0x01); // Ortala
    content += ESC + "!" + String.fromCharCode(0x30);
    content += ESC + "E" + String.fromCharCode(0x01);
    content += nameToPrint;
    content += ESC + "E" + String.fromCharCode(0x00);
    content += ESC + "!" + String.fromCharCode(0x00);
    // Firma adından sonra boşluk: ESC 3 36 ile satır aralığı + feedLines
    content += ESC + "3" + String.fromCharCode(36);
    content += lineBreak(1);
    content += feedLines(1);
    // Sola dön ve ürün satırları için tekrar 0'a dön
    content += ESC + "a" + String.fromCharCode(0x00); // Sola dön
    content += ESC + "3" + String.fromCharCode(0);
  }

  // Masa ve tarih bilgisi (masa ile tarih arasında bir satır boşluk)
  content += ESC + "!" + String.fromCharCode(0x20);
  content += `Masa: ${tableNum}`;
  content += ESC + "!" + String.fromCharCode(0x00);
  content += lineBreak(1);
  content += feedLines(1);
  // Tarih, ürünlerle aynı küçük boyutta
  content += ESC + "!" + String.fromCharCode(0x00);
  content += `Tarih: ${formattedDateTime}`;
  content += ESC + "!" + String.fromCharCode(0x00);
  // Masa adından sonra boşluk: ESC 3 36 ile satır aralığı + feedLines
  content += ESC + "3" + String.fromCharCode(36);
  content += lineBreak(1);
  content += feedLines(1);
  // Ürün satırları için tekrar 0'a dön
  content += ESC + "3" + String.fromCharCode(0);

  // Tablo başlığı: Ürün | Adet | Toplam (arada gereksiz boşluk yok)
  // Başlıkları eski boyuta döndür
  content += ESC + "!" + String.fromCharCode(0x00);
  content += ESC + "E" + String.fromCharCode(0x01);
  content += padRight("Urun", colUrun) + padLeft("Adet", colAdet) + padLeft("Toplam", colToplam);
  content += ESC + "E" + String.fromCharCode(0x00);
  content += lineBreak(0);
  content += fullLine();
  content += lineBreak(0);
  content += ESC + "!" + String.fromCharCode(0x00);

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

  // Ürün satırları (Ürün-Adet-Toplam ile Toplam arasında gereksiz boşluk yok)
  for (const { item, totalQuantity, totalSubtotal } of mergedItems.values()) {
    const itemName = turkishToAscii(item.menuName).toUpperCase();
    const unitPrice = item.menuPrice ?? 0;
    const left = padRight(`${totalQuantity}x ${itemName}`, colUrun);
    const mid = padLeft(`${unitPrice.toFixed(2)} TL`, colAdet);
    const right = padLeft(`${totalSubtotal.toFixed(2)} TL`, colToplam);
    content += left + mid + right;
    content += lineBreak(0);
    if (item.selectedExtras && item.selectedExtras.length > 0) {
      for (const extra of item.selectedExtras) {
        content += padRight(`  + ${turkishToAscii(extra.name)}`, colUrun) + padLeft(`+${extra.price.toFixed(2)} TL`, colAdet) + padLeft("", colToplam);
        content += lineBreak(0);
      }
    }
    if (item.notes && item.notes.trim()) {
      content += padRight(`  Not: ${turkishToAscii(item.notes)}`, paperWidth);
      content += lineBreak(0);
    }
  }

  content += fullLine();
  content += lineBreak(0);

  if (
    additionalInfo?.canceledItems &&
    additionalInfo.canceledItems.length > 0
  ) {
    content += lineBreak(3);
    content += "IPTAL EDILEN URUNLER";
    content += lineBreak(3);
    for (const item of additionalInfo.canceledItems) {
      content += `${item.quantity}x ${turkishToAscii(item.menuName).toUpperCase()} (IPTAL)`;
      content += lineBreak(2);
      content += `${item.subtotal.toFixed(2)} TL`;
      content += lineBreak(2);
    }
  }

  const total =
    additionalInfo?.total ||
    Array.from(mergedItems.values()).reduce(
      (sum, { totalSubtotal }) => sum + totalSubtotal,
      0
    );

  // Toplam'dan önce satır aralığını artır
  content += ESC + "3" + String.fromCharCode(36);
  content += lineBreak(1);
  content += ESC + "!" + String.fromCharCode(0x10);
  content += ESC + "E" + String.fromCharCode(0x01);
  content += `Toplam: ${total.toFixed(2)} TL`;
  if (isPaid) content += " - Odendi";
  content += ESC + "E" + String.fromCharCode(0x00);
  content += ESC + "!" + String.fromCharCode(0x00);
  content += lineBreak(1); // Toplam yazısından sonra tek satır boşluk

  if (type === "payment" && additionalInfo?.paymentMethod) {
    content += `Odeme: ${turkishToAscii(additionalInfo.paymentMethod)}`;
    content += lineBreak(1);
  }
  if (additionalInfo?.discount && additionalInfo.discount > 0) {
    content += `Iskonto: -${additionalInfo.discount.toFixed(2)} TL`;
    content += lineBreak(1);
  }

  // Afiyet Olsun ortada; altında kesim için bol boşluk (fiş uzun çıksın, kullanıcı rahat kessin)
  content += lineBreak(1);
  content += ESC + "a" + String.fromCharCode(0x01); // Ortala
  content += ESC + "!" + String.fromCharCode(0x10);
  content += "Afiyet Olsun";
  content += ESC + "!" + String.fromCharCode(0x00);
  content += lineBreak(0); // Merkez hizalamayı bu satırda uygula
  content += ESC + "a" + String.fromCharCode(0x00); // Sola dön
  // Orta seviye alt boşluk
  content += lineBreak(24);

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

// Otomatik yazdırma: "Tüm Hareket" veya "Ürün Girişi" (kategori eşleşen) yazıcıları döndürür. "Sadece yazdır butonu" olanlar dahil edilmez.
export function getPrintersForAutoPrint(
  printers: PrinterDevice[],
  itemCategoryIds: string[]
): PrinterDevice[] {
  return printers.filter((p) => {
    const trigger = p.printTrigger ?? "manual_only";
    if (trigger === "manual_only") return false;
    if (trigger === "all") return true;
    if (trigger === "categories" && p.assignedCategories?.length) {
      return itemCategoryIds.some((id) => p.assignedCategories!.includes(id));
    }
    return false;
  });
}

// "Tüm Hareket" seçili yazıcılar (giriş/iptal hepsini alır)
export function getPrintersForAllMovement(
  printers: PrinterDevice[]
): PrinterDevice[] {
  return printers.filter((p) => (p.printTrigger ?? "manual_only") === "all");
}

// "Ürün Girişi" seçili ve bu kategori atanmış yazıcılar
export function getPrintersForCategory(
  printers: PrinterDevice[],
  categoryId: string
): PrinterDevice[] {
  return printers.filter(
    (p) =>
      (p.printTrigger ?? "manual_only") === "categories" &&
      p.assignedCategories?.includes(categoryId)
  );
}

// Kategoriye göre yazıcıları bul (geriye uyumluluk; otomatik yazdırma için getPrintersForAutoPrint kullanın)
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
