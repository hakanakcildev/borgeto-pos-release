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

// Yazdırma içeriği oluştur - 80mm termal yazıcı için optimize edilmiş
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

  // 80mm termal yazıcı için karakter genişliği
  // Font A (12x24) ile 80mm kağıt için yaklaşık 48 karakter (tam genişlik)
  // Kullanıcı tanımlı genişlik varsa onu kullan, yoksa 80mm için 48 karakter
  const paperWidth = additionalInfo?.paperWidth || 48;

  // İçeriği oluştur
  let content = "";

  // ESC/POS komutları - RAW veri biçimi için
  const ESC = String.fromCharCode(0x1b); // ESC karakteri
  const resetPrinter = ESC + "@"; // ESC @ - Reset printer
  const fontA = ESC + "M" + String.fromCharCode(0x00); // ESC M 0 - Font A (12x24) - Büyük font
  const boldOn = ESC + "E" + String.fromCharCode(0x01); // ESC E 1 - Bold on
  const boldOff = ESC + "E" + String.fromCharCode(0x00); // ESC E 0 - Bold off
  const leftAlign = ESC + "a" + String.fromCharCode(0x00); // ESC a 0 - Left align
  
  // Encoding komutu - ASCII kullan (turkishToAscii zaten kullanılıyor, code page gerekmez)
  // Code page komutunu kaldırdık çünkü tüm metinler ASCII'ye çevriliyor
  
  // Margin komutları - Tam genişlik için margin'leri tamamen kaldır
  const GS = String.fromCharCode(0x1d); // GS karakteri (Group Separator)
  
  // ESC GS L nL nH - Set left margin (nL = low byte, nH = high byte)
  // 0x00 0x00 = 0 margin (tam genişlik kullanımı için)
  const leftMarginAdvanced = ESC + GS + String.fromCharCode(0x4c) + String.fromCharCode(0x00) + String.fromCharCode(0x00); // GS L (0x4c = 'L')
  
  // ESC l n - Left margin (basit, 1 byte) - bazı yazıcılar için
  const leftMarginSimple = ESC + String.fromCharCode(0x6c) + String.fromCharCode(0x00); // ESC l (0x6c = 'l')
  
  // ESC GS W nL nH - Set print area width (nL = low byte, nH = high byte)
  // 80mm kağıt için maksimum genişlik (Font A ile ~48 karakter = 0x30)
  const printAreaWidth = ESC + GS + String.fromCharCode(0x57) + String.fromCharCode(Math.min(paperWidth, 255)) + String.fromCharCode(0x00); // GS W (0x57 = 'W')
  
  // ESC Q n - Set print area width (alternatif, bazı yazıcılar için)
  const printWidth = ESC + String.fromCharCode(0x51) + String.fromCharCode(Math.min(paperWidth, 255)); // ESC Q (0x51 = 'Q')
  
  // ESC SP n - Character spacing (n = 0, karakter arası boşluk yok)
  const charSpacing = ESC + String.fromCharCode(0x20) + String.fromCharCode(0x00); // ESC SP (0x20 = ' ')
  
  // ESC 3 n - Line spacing (n = 0, satır arası minimum - üst margin minimize)
  const lineSpacing = ESC + String.fromCharCode(0x33) + String.fromCharCode(0x00); // ESC 3 (0x33 = '3')
  
  // ESC d n - Print and feed n lines (n = 0, feed yok - üst margin minimize)
  const feedLines = ESC + String.fromCharCode(0x64) + String.fromCharCode(0x00); // ESC d (0x64 = 'd')

  // Yazıcıyı sıfırla ve ayarları yap (tam genişlik, margin yok, ASCII encoding)
  // ÖNEMLİ: Komut sırası kritik - önce reset, sonra font/alignment, sonra margin'ler
  // Windows USB yazıcı sürücüsü margin ekliyor, bu yüzden komutları tekrar gönderiyoruz
  content += resetPrinter; // Önce yazıcıyı sıfırla (tüm ayarları temizle)
  content += resetPrinter; // Windows sürücüsü için tekrar reset (margin'leri kaldırmak için)
  content += fontA; // Font A seç
  content += leftAlign; // Sol hizalama
  content += leftMarginAdvanced; // Gelişmiş sol margin 0 (ESC GS L)
  content += leftMarginAdvanced; // Tekrar gönder (Windows sürücüsü için)
  content += leftMarginSimple; // Basit sol margin 0 (ESC l) - bazı yazıcılar için
  content += leftMarginSimple; // Tekrar gönder (Windows sürücüsü için)
  content += printAreaWidth; // Print area width maksimum (ESC GS W)
  content += printAreaWidth; // Tekrar gönder (Windows sürücüsü için)
  content += printWidth; // Print width maksimum (ESC Q) - alternatif
  content += printWidth; // Tekrar gönder (Windows sürücüsü için)
  content += charSpacing; // Karakter arası boşluk 0
  content += lineSpacing; // Satır arası boşluk minimum (üst margin minimize)
  content += feedLines; // Feed lines 0 (üst margin minimize)

  // 1. Firma Adı (sola yaslı, tam genişlik, kalın)
  if (companyName) {
    const nameToPrint =
      companyName.length > paperWidth
        ? companyName.substring(0, paperWidth)
        : companyName;
    content += boldOn;
    // Satırı tam genişliğe tamamla (sola yaslı)
    content += nameToPrint.padEnd(paperWidth);
    content += boldOff;
    content += "\r\n"; // ESC/POS için \r\n kullan
  }

  // 2. Masa bilgisi (sola yaslı, tam genişlik)
  const tableInfo = `Masa ${tableNum}`;
  const tableToPrint =
    tableInfo.length > paperWidth
      ? tableInfo.substring(0, paperWidth)
      : tableInfo;
  // Satırı tam genişliğe tamamla (sola yaslı)
  content += tableToPrint.padEnd(paperWidth);
  content += "\r\n"; // ESC/POS için \r\n kullan

  // 3. Ürünler listesi - Aynı ürünleri birleştir
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

  // Birleştirilmiş ürünleri yazdır
  for (const { item, totalQuantity, totalSubtotal } of mergedItems.values()) {
    // Ürün adını Türkçe karakterlerden temizle ve büyük harfe çevir
    const itemName = turkishToAscii(item.menuName).toUpperCase();
    const price = item.menuPrice || 0;

    // Ürün bilgisi: "Adetx ÜRÜN ADI"
    const itemInfo = `${totalQuantity}x ${itemName}`;

    // Fiyat: "Fiyat TL xAdet = Toplam TL"
    const priceText = `${price.toFixed(2)} TL x${totalQuantity} = ${totalSubtotal.toFixed(2)} TL`;

    // Manuel boşluk hesaplama: Ürün bilgisi + boşluklar + fiyat = paperWidth
    const itemInfoLen = Math.min(itemInfo.length, paperWidth - 1);
    const priceTextLen = Math.min(priceText.length, paperWidth - 1);
    const totalLen = itemInfoLen + priceTextLen;

    let finalLine = "";
    if (totalLen <= paperWidth) {
      // Normal durum: boşluk ekle
      const spaces = paperWidth - totalLen;
      finalLine =
        itemInfo.substring(0, itemInfoLen) +
        " ".repeat(spaces) +
        priceText.substring(0, priceTextLen);
    } else {
      // Uzun durum: ürün bilgisini kısalt
      const maxItemLen = Math.max(1, paperWidth - priceTextLen - 1);
      const spaces = paperWidth - maxItemLen - priceTextLen;
      finalLine =
        itemInfo.substring(0, maxItemLen) +
        " ".repeat(spaces) +
        priceText.substring(0, priceTextLen);
    }

    // Satırı tam genişliğe tamamla
    if (finalLine.length < paperWidth) {
      finalLine = finalLine + " ".repeat(paperWidth - finalLine.length);
    } else if (finalLine.length > paperWidth) {
      finalLine = finalLine.substring(0, paperWidth);
    }

    // Ürün adı (kalın)
    content += boldOn;
    content += finalLine;
    content += boldOff;
    content += "\r\n"; // ESC/POS için \r\n kullan

    // Ekstra malzemeler varsa göster
    if (item.selectedExtras && item.selectedExtras.length > 0) {
      for (const extra of item.selectedExtras) {
        const extraName = turkishToAscii(extra.name);
        const extraLine = `  + ${extraName} (+${extra.price.toFixed(2)} TL)`;
        const extraLineToPrint =
          extraLine.length > paperWidth
            ? extraLine.substring(0, paperWidth)
            : extraLine;
        content += extraLineToPrint.padEnd(paperWidth);
        content += "\r\n";
      }
    }

    // Not varsa göster
    if (item.notes && item.notes.trim()) {
      const noteText = turkishToAscii(item.notes);
      const noteLine = `  Not: ${noteText}`;
      const noteLineToPrint =
        noteLine.length > paperWidth
          ? noteLine.substring(0, paperWidth)
          : noteLine;
      content += noteLineToPrint.padEnd(paperWidth);
      content += "\n";
    }
  }

  // 4. İptal edilmiş ürünler varsa göster
  if (
    additionalInfo?.canceledItems &&
    additionalInfo.canceledItems.length > 0
  ) {
    content += "\n";
    const canceledHeader = "IPTAL EDILEN URUNLER";
    const headerToPrint =
      canceledHeader.length > paperWidth
        ? canceledHeader.substring(0, paperWidth)
        : canceledHeader;
    content += headerToPrint.padEnd(paperWidth);
    content += "\n";

    for (const item of additionalInfo.canceledItems) {
      const itemName = turkishToAscii(item.menuName).toUpperCase();
      const quantity = item.quantity;
      const price = item.menuPrice || 0;
      const subtotal = item.subtotal || 0;

      const itemInfo = `${quantity}x ${itemName} (IPTAL)`;
      const priceText = `${price.toFixed(2)} TL x${quantity} = ${subtotal.toFixed(2)} TL`;

      const itemInfoLen = Math.min(itemInfo.length, paperWidth - 1);
      const priceTextLen = Math.min(priceText.length, paperWidth - 1);
      const totalLen = itemInfoLen + priceTextLen;

      let finalLine = "";
      if (totalLen <= paperWidth) {
        const spaces = paperWidth - totalLen;
        finalLine =
          itemInfo.substring(0, itemInfoLen) +
          " ".repeat(spaces) +
          priceText.substring(0, priceTextLen);
      } else {
        const maxItemLen = Math.max(1, paperWidth - priceTextLen - 1);
        const spaces = paperWidth - maxItemLen - priceTextLen;
        finalLine =
          itemInfo.substring(0, maxItemLen) +
          " ".repeat(spaces) +
          priceText.substring(0, priceTextLen);
      }

      if (finalLine.length < paperWidth) {
        finalLine = finalLine + " ".repeat(paperWidth - finalLine.length);
      } else if (finalLine.length > paperWidth) {
        finalLine = finalLine.substring(0, paperWidth);
      }

      content += boldOn;
      content += finalLine;
      content += boldOff;
      content += "\n";
    }
  }

  // 5. Toplam tutar (sola yaslı, tam genişlik)
  const total =
    additionalInfo?.total ||
    Array.from(mergedItems.values()).reduce(
      (sum, { totalSubtotal }) => sum + totalSubtotal,
      0
    );

  content += "\n";

  if (isPaid) {
    const totalLine = `Toplam Tutar: ${total.toFixed(2)} TL - Odendi`;
    const totalLineToPrint =
      totalLine.length > paperWidth
        ? totalLine.substring(0, paperWidth)
        : totalLine;
    content += boldOn;
    content += totalLineToPrint.padEnd(paperWidth);
    content += boldOff;
    content += "\n";
  } else {
    const totalLine = `Toplam Fiyat: ${total.toFixed(2)} TL`;
    const totalLineToPrint =
      totalLine.length > paperWidth
        ? totalLine.substring(0, paperWidth)
        : totalLine;
    content += boldOn;
    content += totalLineToPrint.padEnd(paperWidth);
    content += boldOff;
    content += "\n";
  }

  // Ödeme yöntemi varsa göster
  if (type === "payment" && additionalInfo?.paymentMethod) {
    const paymentMethodText = turkishToAscii(additionalInfo.paymentMethod);
    const paymentLine = `Odeme Yontemi: ${paymentMethodText}`;
    const paymentLineToPrint =
      paymentLine.length > paperWidth
        ? paymentLine.substring(0, paperWidth)
        : paymentLine;
    content += paymentLineToPrint.padEnd(paperWidth);
    content += "\n";
  }

  // İndirim varsa göster
  if (additionalInfo?.discount && additionalInfo.discount > 0) {
    const discountLine = `Iskonto: -${additionalInfo.discount.toFixed(2)} TL`;
    const discountLineToPrint =
      discountLine.length > paperWidth
        ? discountLine.substring(0, paperWidth)
        : discountLine;
    content += discountLineToPrint.padEnd(paperWidth);
    content += "\n";
  }

  // Boş satır (yazıcı için)
  content += "\r\n";

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
  
  // 80mm = 226.77px (72 DPI'de), ama yazdırma için daha geniş kullanabiliriz
  const paperWidthMM = 80;
  const paperWidthPX = paperWidthMM * 3.779527559; // mm to px (96 DPI)
  
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

  // HTML içeriği oluştur
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
      padding: 0;
    }
    .table-info {
      margin-bottom: 8px;
      padding: 0;
    }
    .item-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
      padding: 0;
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
    .canceled-header {
      margin-top: 8px;
      margin-bottom: 4px;
      font-weight: bold;
      text-decoration: underline;
    }
    .total-row {
      margin-top: 12px;
      padding-top: 8px;
      border-top: 1px dashed #000;
      font-weight: bold;
      font-size: 13px;
    }
    .payment-method {
      margin-top: 4px;
    }
    .discount {
      margin-top: 4px;
      color: #666;
    }
  </style>
</head>
<body>`;

  // Firma adı
  if (companyName) {
    html += `<div class="header">${companyName.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>`;
  }

  // Masa bilgisi
  html += `<div class="table-info">Masa ${tableNum.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>`;

  // Ürünler
  for (const { item, totalQuantity, totalSubtotal } of mergedItems.values()) {
    const itemName = item.menuName.toUpperCase();
    const price = item.menuPrice || 0;
    
    html += `<div class="item-row">
      <span class="item-name">${totalQuantity}x ${itemName.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</span>
      <span class="item-price">${price.toFixed(2)} TL x${totalQuantity} = ${totalSubtotal.toFixed(2)} TL</span>
    </div>`;

    // Ekstra malzemeler
    if (item.selectedExtras && item.selectedExtras.length > 0) {
      for (const extra of item.selectedExtras) {
        html += `<div class="extra-item">+ ${extra.name.replace(/</g, "&lt;").replace(/>/g, "&gt;")} (+${extra.price.toFixed(2)} TL)</div>`;
      }
    }

    // Notlar
    if (item.notes && item.notes.trim()) {
      html += `<div class="note-item">Not: ${item.notes.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>`;
    }
  }

  // İptal edilen ürünler
  if (additionalInfo?.canceledItems && additionalInfo.canceledItems.length > 0) {
    html += `<div class="canceled-header">IPTAL EDILENLER:</div>`;
    
    const canceledMerged = new Map<string, { item: OrderItem; totalQuantity: number; totalSubtotal: number }>();
    for (const item of additionalInfo.canceledItems) {
      const extrasKey = item.selectedExtras && item.selectedExtras.length > 0
        ? JSON.stringify(item.selectedExtras.map((e) => ({ id: e.id, name: e.name, price: e.price })))
        : "";
      const notesKey = item.notes && item.notes.trim() ? item.notes.trim() : "";
      const mergeKey = `${item.menuId}|||${extrasKey}|||${notesKey}`;

      if (canceledMerged.has(mergeKey)) {
        const existing = canceledMerged.get(mergeKey)!;
        existing.totalQuantity += item.quantity;
        existing.totalSubtotal += item.subtotal;
      } else {
        canceledMerged.set(mergeKey, {
          item,
          totalQuantity: item.quantity,
          totalSubtotal: item.subtotal,
        });
      }
    }

    for (const { item, totalQuantity, totalSubtotal } of canceledMerged.values()) {
      const itemName = item.menuName.toUpperCase();
      const price = item.menuPrice || 0;
      
      html += `<div class="item-row">
        <span class="item-name">${totalQuantity}x ${itemName.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</span>
        <span class="item-price">${price.toFixed(2)} TL x${totalQuantity} = ${totalSubtotal.toFixed(2)} TL</span>
      </div>`;
    }
  }

  // Toplam
  if (isPaid) {
    html += `<div class="total-row">Toplam Tutar: ${total.toFixed(2)} TL - Odendi</div>`;
  } else {
    html += `<div class="total-row">Toplam Fiyat: ${total.toFixed(2)} TL</div>`;
  }

  // Ödeme yöntemi
  if (type === "payment" && additionalInfo?.paymentMethod) {
    html += `<div class="payment-method">Ödeme Yöntemi: ${additionalInfo.paymentMethod.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>`;
  }

  // İndirim
  if (additionalInfo?.discount && additionalInfo.discount > 0) {
    html += `<div class="discount">İskonto: -${additionalInfo.discount.toFixed(2)} TL</div>`;
  }

  html += `</body>
</html>`;

  return html;
}

// Örnek çıktı formatını göster (yazıcı sayfası için)
export function getExamplePrintOutput(
  companyName: string = "Firma Adi",
  tableNumber: string = "5"
): string {
  const paperWidth = 48; // 80mm kağıt için Font A (tam genişlik)

  let content = "";

  // Firma Adı (sola yaslı)
  const companyNameClean = turkishToAscii(companyName);
  content += companyNameClean + "\n";

  // Masa bilgisi (sola yaslı)
  const tableInfo = `Masa ${tableNumber}`;
  content += tableInfo + "\n";

  // Örnek ürünler
  const exampleItems = [
    { name: "SIRIN KAHVALTI", quantity: 1, price: 1050.0, subtotal: 1050.0 },
    { name: "CAY", quantity: 2, price: 10.0, subtotal: 20.0 },
    { name: "KAHVE", quantity: 1, price: 15.0, subtotal: 15.0 },
  ];

  for (const item of exampleItems) {
    // Ürün bilgisi ve fiyatı aynı satırda, manuel boşluk hesaplama ile
    const itemInfo = `${item.quantity}x ${item.name}`;
    const priceText = `${item.price.toFixed(2)} TL x${item.quantity} = ${item.subtotal.toFixed(2)} TL`;
    const totalLength = itemInfo.length + priceText.length;
    const spacesNeeded = Math.max(0, paperWidth - totalLength);

    const line = itemInfo + " ".repeat(spacesNeeded) + priceText;
    const finalLine =
      line.length > paperWidth ? line.substring(0, paperWidth) : line;
    content += finalLine.padEnd(paperWidth) + "\n";
  }

  // Toplam
  content += "\n";
  const totalLine = "Toplam Fiyat: 1085.00 TL";
  content += totalLine + "\n";

  // Boş satırlar
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

    if (result.success) {
      return true;
    } else {
      return false;
    }
  } catch {
    return false;
  }
}

// Yazıcıya raster image olarak yazdır (HTML'den)
export async function printToPrinterAsRaster(
  printerName: string,
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
    paperWidth?: number;
    canceledItems?: OrderItem[];
    isPaid?: boolean;
  }
): Promise<boolean> {
  if (!window.electronAPI?.print) {
    return false;
  }

  try {
    // Raster image içeriğini oluştur
    const { formatPrintContentAsRaster } = await import("./print-raster");
    const content = await formatPrintContentAsRaster(
      type,
      items,
      tableNumber,
      orderNumber,
      additionalInfo
    );

    // Yazdır
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
  } catch (error) {
    console.error("Raster print error:", error);
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
