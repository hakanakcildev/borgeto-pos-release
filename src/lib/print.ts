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

// Yazdırma içeriği oluştur - yeni format gereksinimlerine göre
export function formatPrintContent(
  type: "order" | "cancel" | "payment",
  items: OrderItem[],
  tableNumber: string | number,
  _orderNumber?: string, // Kullanılmıyor ama geriye dönük uyumluluk için bırakıldı
  additionalInfo?: {
    companyName?: string;
    total?: number;
    paymentMethod?: string;
    subtotal?: number;
    discount?: number;
    paperWidth?: number; // Kağıt genişliği (karakter sayısı)
    canceledItems?: OrderItem[]; // İptal edilmiş ürünler (tekrar yazdırma için)
    isPaid?: boolean; // Ödeme alındı mı?
  }
): string {
  // Türkçe karakterleri koru (UTF-8)
  const companyName = additionalInfo?.companyName;
  const tableNum = String(tableNumber);
  const isPaid = additionalInfo?.isPaid || type === "payment";

  // Kağıt genişliği - 220 karakter (iki katına çıkarıldı)
  const separatorWidth = 220; // Sabit 220 karakter genişliği (önceden 110 idi)

  // İçeriği oluştur
  let content = "";

  // ESC/POS komutları
  const ESC = "\x1B"; // ESC karakteri
  const boldOn = ESC + "E" + "\x01"; // Bold on
  const boldOff = ESC + "E" + "\x00"; // Bold off
  const fontSmall = ESC + "M" + "\x01"; // Font B (küçük font - 9x17)

  // Tüm içerik için küçük font kullan
  content += fontSmall;

  // 1. Firma Adı (ortalanmış, tek satır, tam genişlik, kalın)
  const centeredCompanyName =
    companyName && companyName.length <= separatorWidth
      ? companyName
          .padStart(Math.floor((separatorWidth + companyName.length) / 2), " ")
          .padEnd(separatorWidth, " ")
      : companyName
        ? companyName.substring(0, separatorWidth).padEnd(separatorWidth, " ")
        : "".padEnd(separatorWidth, " ");

  // Firma adını kalın yaz
  if (companyName) {
    content += boldOn + centeredCompanyName + boldOff + "\n";
  }

  // 2. Masa bilgisi/numarası (ortalanmış, tek satır, tam genişlik)
  const tableInfo = `Masa ${tableNum}`;
  const centeredTableInfo =
    tableInfo.length <= separatorWidth
      ? tableInfo
          .padStart(Math.floor((separatorWidth + tableInfo.length) / 2), " ")
          .padEnd(separatorWidth, " ")
      : tableInfo.substring(0, separatorWidth).padEnd(separatorWidth, " ");
  content += centeredTableInfo + "\n";

  // Çizgi
  content += "=".repeat(separatorWidth) + "\n";

  // Satırları formatla (tam genişlik kullan, uzun satırları wrap et) - tüm fonksiyon için kullanılacak
  const formatLine = (line: string): string => {
    if (line.trim().length === 0) return line;

    // Her zaman tam genişlikte formatla
    if (line.length <= separatorWidth) {
      // Tam genişlikte padding ekle (sağa hizalı değil, tam genişlik)
      return line.padEnd(separatorWidth, " ");
    }

    // Uzun satırları wrap et
    const words = line.split(" ");
    const result: string[] = [];
    let currentLine = "";

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (testLine.length <= separatorWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) {
          // Her satırı tam genişlikte formatla
          result.push(currentLine.padEnd(separatorWidth, " "));
        }
        // Çok uzun kelimeyi parçala
        if (word.length > separatorWidth) {
          let remaining = word;
          while (remaining.length > separatorWidth) {
            // Her parçayı tam genişlikte formatla
            result.push(
              remaining.substring(0, separatorWidth).padEnd(separatorWidth, " ")
            );
            remaining = remaining.substring(separatorWidth);
          }
          currentLine = remaining;
        } else {
          currentLine = word;
        }
      }
    }
    if (currentLine) {
      // Son satırı da tam genişlikte formatla
      result.push(currentLine.padEnd(separatorWidth, " "));
    }
    return result.join("\n");
  };

  // 3. Ürünler listesi - Aynı ürünleri birleştir
  // Aynı menuId, aynı extras ve aynı notes'a sahip ürünleri birleştir
  const mergedItems = new Map<
    string,
    {
      item: OrderItem;
      totalQuantity: number;
      totalSubtotal: number;
    }
  >();

  for (const item of items) {
    // Birleştirme anahtarı: menuId + extras + notes
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
    const itemName = item.menuName;
    const price = item.menuPrice || 0;

    // Adet x Ürün Adı (birleştirilmiş miktar)
    const itemLine = `${totalQuantity}x ${itemName}`;
    // Fiyat satırı (birleştirilmiş toplam)
    const priceLine = `${price.toFixed(2)} TL x${totalQuantity} = ${totalSubtotal.toFixed(2)} TL`;

    content += formatLine(itemLine) + "\n";
    content += formatLine(priceLine) + "\n";

    // Ekstra malzemeler varsa göster
    if (item.selectedExtras && item.selectedExtras.length > 0) {
      for (const extra of item.selectedExtras) {
        const extraLine = `+ ${extra.name} (+${extra.price.toFixed(2)} TL)`;
        content += formatLine(extraLine) + "\n";
      }
    }

    // Not varsa göster
    if (item.notes && item.notes.trim()) {
      const noteLine = `Not: ${item.notes}`;
      content += formatLine(noteLine) + "\n";
    }
  }

  // 4. İptal edilmiş ürünler varsa göster (tekrar yazdırma için)
  if (
    additionalInfo?.canceledItems &&
    additionalInfo.canceledItems.length > 0
  ) {
    content += "=".repeat(separatorWidth) + "\n";
    const canceledHeader = "IPTAL EDILEN URUNLER";
    const centeredCanceledHeader = canceledHeader
      .padStart(Math.floor((separatorWidth + canceledHeader.length) / 2), " ")
      .padEnd(separatorWidth, " ");
    content += centeredCanceledHeader + "\n";
    content += "=".repeat(separatorWidth) + "\n";

    for (const item of additionalInfo.canceledItems) {
      const itemName = item.menuName;
      const quantity = item.quantity;
      const price = item.menuPrice || 0;
      const subtotal = item.subtotal || 0;

      const itemLine = `${quantity}x ${itemName} (IPTAL)`;
      const priceLine = `${price.toFixed(2)} TL x${quantity} = ${subtotal.toFixed(2)} TL`;

      content += formatLine(itemLine) + "\n";
      content += formatLine(priceLine) + "\n";
    }
  }

  // 5. Toplam satırı (çizgi öncesi)
  content += "=".repeat(separatorWidth) + "\n";

  // Toplam tutar (birleştirilmiş ürünlerin toplamı)
  const total =
    additionalInfo?.total ||
    Array.from(mergedItems.values()).reduce(
      (sum, { totalSubtotal }) => sum + totalSubtotal,
      0
    );

  // Ödeme durumuna göre farklı format
  if (isPaid) {
    // Ödeme alındıysa: "Toplam Tutar: XXX TL - Ödendi"
    const totalLine = `Toplam Tutar: ${total.toFixed(2)} TL - Odendi`;
    const centeredTotal =
      totalLine.length <= separatorWidth
        ? totalLine
            .padStart(Math.floor((separatorWidth + totalLine.length) / 2), " ")
            .padEnd(separatorWidth, " ")
        : totalLine.substring(0, separatorWidth).padEnd(separatorWidth, " ");
    content += centeredTotal + "\n";
  } else {
    // Sadece yazdırıldıysa: "Toplam Fiyat: XXX TL"
    const totalLine = `Toplam Fiyat: ${total.toFixed(2)} TL`;
    const centeredTotal =
      totalLine.length <= separatorWidth
        ? totalLine
            .padStart(Math.floor((separatorWidth + totalLine.length) / 2), " ")
            .padEnd(separatorWidth, " ")
        : totalLine.substring(0, separatorWidth).padEnd(separatorWidth, " ");
    content += centeredTotal + "\n";
  }

  // Ödeme yöntemi varsa göster
  if (type === "payment" && additionalInfo?.paymentMethod) {
    const paymentLine = `Odeme Yontemi: ${additionalInfo.paymentMethod}`;
    content += paymentLine.padEnd(separatorWidth, " ") + "\n";
  }

  // İndirim varsa göster
  if (additionalInfo?.discount && additionalInfo.discount > 0) {
    const discountLine = `Iskonto: -${additionalInfo.discount.toFixed(2)} TL`;
    content += discountLine.padEnd(separatorWidth, " ") + "\n";
  }

  // Boş satırlar (yazıcı için)
  content += "\n\n";

  return content;
}

// Örnek çıktı formatını göster (yazıcı sayfası için)
export function getExamplePrintOutput(
  companyName: string = "Firma Adi",
  tableNumber: string = "5"
): string {
  const maxPaperWidth = 220; // Varsayılan kağıt genişliği (iki katına çıkarıldı)
  const separatorWidth = maxPaperWidth;

  let content = "";

  // Firma Adı (ortalanmış)
  const centeredCompanyName = companyName
    .padStart(Math.floor((separatorWidth + companyName.length) / 2))
    .padEnd(separatorWidth);
  content += centeredCompanyName + "\n";

  // Masa bilgisi (ortalanmış)
  const tableInfo = `Masa ${tableNumber}`;
  const centeredTableInfo = tableInfo
    .padStart(Math.floor((separatorWidth + tableInfo.length) / 2))
    .padEnd(separatorWidth);
  content += centeredTableInfo + "\n";

  // Çizgi
  content += "=".repeat(separatorWidth) + "\n";
  content += "\n";

  // Örnek ürünler
  const exampleItems = [
    { name: "1x Şirin Kahvaltı", price: "1050.00 TL x1 = 1050.00 TL" },
    { name: "2x Çay", price: "10.00 TL x2 = 20.00 TL" },
    { name: "1x Kahve", price: "15.00 TL x1 = 15.00 TL" },
  ];

  for (const item of exampleItems) {
    content += item.name.padEnd(separatorWidth) + "\n";
    content += item.price.padEnd(separatorWidth) + "\n";
    content += "\n";
  }

  // Toplam
  content += "=".repeat(separatorWidth) + "\n";
  content += "\n";
  const totalLine = "Toplam Fiyat: 1085.00 TL";
  const centeredTotal = totalLine
    .padStart(Math.floor((separatorWidth + totalLine.length) / 2))
    .padEnd(separatorWidth);
  content += centeredTotal + "\n";

  // Boş satırlar
  content += "\n\n\n";

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
