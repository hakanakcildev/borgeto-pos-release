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
  
  // Encoding komutu - Türkçe karakterler için code page ayarla
  // ESC t n - Set code page (17 = PC857 Turkish, 20 = PC1252 Windows Latin-1)
  const codePage = ESC + "t" + String.fromCharCode(17); // PC857 Turkish (Türkçe karakterler için)
  
  // Margin komutları - Tam genişlik için margin'leri sıfırla/kaldır
  // ESC l n - Left margin (n = 0, sol margin yok)
  const leftMargin = ESC + "l" + String.fromCharCode(0x00);
  // ESC Q n - Set print area width (n = maksimum karakter sayısı, paperWidth)
  // Sağ margin yok için maksimum genişlik kullan
  const printWidth = ESC + "Q" + String.fromCharCode(Math.min(paperWidth, 255));
  // ESC SP n - Character spacing (n = 0, karakter arası boşluk yok)
  const charSpacing = ESC + " " + String.fromCharCode(0x00);
  // ESC 3 n - Line spacing (n = 0, satır arası minimum - üst margin minimize)
  const lineSpacing = ESC + "3" + String.fromCharCode(0x00);

  // Yazıcıyı sıfırla ve ayarları yap (tam genişlik, margin yok, Türkçe encoding)
  content += resetPrinter;
  content += codePage; // Türkçe karakterler için code page
  content += leftMargin; // Sol margin 0
  content += printWidth; // Print width maksimum (sağ margin yok için tam genişlik)
  content += charSpacing; // Karakter arası boşluk 0
  content += lineSpacing; // Satır arası boşluk minimum (üst margin minimize)
  content += fontA;
  content += leftAlign;

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
    content += "\n";
  }

  // 2. Masa bilgisi (sola yaslı, tam genişlik)
  const tableInfo = `Masa ${tableNum}`;
  const tableToPrint =
    tableInfo.length > paperWidth
      ? tableInfo.substring(0, paperWidth)
      : tableInfo;
  // Satırı tam genişliğe tamamla (sola yaslı)
  content += tableToPrint.padEnd(paperWidth);
  content += "\n";

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
    content += "\n";

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
        content += "\n";
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
  content += "\n";

  return content;
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
