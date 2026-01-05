import html2canvas from "html2canvas";
import type { OrderItem } from "@/lib/firebase/types";
import { formatPrintHTMLContent } from "./print";

// ESC/POS raster image komutunu oluştur
// GS v 0 m xL xH yL yH d1...dk
// m = mode (0 = normal, 1 = double width, 2 = double height, 3 = double width+height)
// xL, xH = width in dots (low byte, high byte) - bytes per line * 8
// yL, yH = height in dots (low byte, high byte)
// d1...dk = image data (bitmap)
function convertBitmapToESCPOSRaster(
  bitmap: Uint8Array,
  width: number,
  height: number
): string {
  const GS = String.fromCharCode(0x1d);
  
  // GS v 0 m xL xH yL yH d1...dk
  const mode = 0; // Normal mode
  
  // Width ve height byte'larını hesapla
  // Width: bytes per line * 8 (pixel genişliği)
  const bytesPerLine = Math.ceil(width / 8);
  const widthInDots = bytesPerLine * 8;
  const xL = widthInDots & 0xff;
  const xH = (widthInDots >> 8) & 0xff;
  const yL = height & 0xff;
  const yH = (height >> 8) & 0xff;
  
  // Komutu oluştur
  let command = GS + String.fromCharCode(0x76) + String.fromCharCode(0x30); // GS v 0
  command += String.fromCharCode(mode);
  command += String.fromCharCode(xL);
  command += String.fromCharCode(xH);
  command += String.fromCharCode(yL);
  command += String.fromCharCode(yH);
  
  // Bitmap verisini ekle
  for (let i = 0; i < bitmap.length; i++) {
    command += String.fromCharCode(bitmap[i]);
  }
  
  return command;
}

// Canvas'ı siyah-beyaz (1-bit) bitmap'e dönüştür
// ESC/POS raster format: Her byte 8 pixel yüksekliğinde bir sütunu temsil eder (vertical byte format)
// Byte'lar yatay olarak düzenlenir
function convertCanvasToBitmap(
  canvas: HTMLCanvasElement,
  threshold: number = 128
): { bitmap: Uint8Array; width: number; height: number } {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas context not available");
  }
  
  const width = canvas.width;
  const height = canvas.height;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  
  // ESC/POS raster format: Her byte 8 pixel yüksekliğinde bir sütunu temsil eder
  // Byte'lar yatay olarak düzenlenir
  const bytesPerLine = Math.ceil(width / 8);
  const rows = Math.ceil(height / 8);
  const bitmap = new Uint8Array(bytesPerLine * rows * 8);
  
  // Önce tüm pikselleri siyah-beyaz array'e çevir
  const pixels: boolean[][] = [];
  for (let y = 0; y < height; y++) {
    pixels[y] = [];
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      
      // Grayscale'e dönüştür (luminance)
      const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      
      // Threshold ile siyah-beyaza dönüştür
      pixels[y][x] = gray < threshold;
    }
  }
  
  // ESC/POS format: Her byte 8 pixel yüksekliğinde bir sütunu temsil eder
  // Byte'lar yatay olarak düzenlenir
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < bytesPerLine; col++) {
      let byteValue = 0;
      for (let bit = 0; bit < 8; bit++) {
        const y = row * 8 + bit;
        const x = col * 8 + (7 - bit);
        
        if (y < height && x < width && pixels[y] && pixels[y][x]) {
          byteValue |= 1 << bit;
        }
      }
      bitmap[row * bytesPerLine + col] = byteValue;
    }
  }
  
  return { bitmap, width, height };
}

// HTML string'ini canvas'a dönüştür
async function convertHTMLToCanvas(htmlString: string): Promise<HTMLCanvasElement> {
  // HTML string'ini DOM'a ekle
  const tempDiv = document.createElement("div");
  tempDiv.style.position = "absolute";
  tempDiv.style.left = "-9999px";
  tempDiv.style.top = "0";
  tempDiv.style.width = "576px"; // 80mm at 203 DPI = 576px
  tempDiv.style.backgroundColor = "white";
  document.body.appendChild(tempDiv);
  
  // HTML içeriğini ekle
  tempDiv.innerHTML = htmlString;
  
  try {
    // html2canvas ile canvas'a dönüştür
    const canvas = await html2canvas(tempDiv, {
      width: 576, // 80mm at 203 DPI
      height: tempDiv.scrollHeight,
      scale: 1,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
    });
    
    return canvas;
  } finally {
    // Temp div'i temizle
    document.body.removeChild(tempDiv);
  }
}

// HTML içeriğini ESC/POS raster image komutuna dönüştür
export async function convertHTMLToESCPOSRaster(
  htmlString: string,
  threshold: number = 128
): Promise<string> {
  // HTML'i canvas'a dönüştür
  const canvas = await convertHTMLToCanvas(htmlString);
  
  // Canvas'ı bitmap'e dönüştür
  const { bitmap, width, height } = convertCanvasToBitmap(canvas, threshold);
  
  // ESC/POS raster image komutuna dönüştür
  const rasterCommand = convertBitmapToESCPOSRaster(bitmap, width, height);
  
  return rasterCommand;
}

// Yazdırma içeriği oluştur (raster image için)
export async function formatPrintContentAsRaster(
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
): Promise<string> {
  // HTML içeriğini oluştur
  const htmlContent = formatPrintHTMLContent(
    type,
    items,
    tableNumber,
    _orderNumber,
    additionalInfo
  );
  
  // ESC/POS komutları - Reset ve margin ayarları
  const ESC = String.fromCharCode(0x1b);
  const GS = String.fromCharCode(0x1d);
  const resetPrinter = ESC + "@";
  const leftMargin = ESC + GS + String.fromCharCode(0x4c) + String.fromCharCode(0x00) + String.fromCharCode(0x00); // GS L 0 0
  
  let content = "";
  
  // Yazıcıyı sıfırla ve margin'leri sıfırla
  content += resetPrinter;
  content += leftMargin;
  
  // HTML'i ESC/POS raster image komutuna dönüştür
  const rasterCommand = await convertHTMLToESCPOSRaster(htmlContent, 128);
  content += rasterCommand;
  
  // Kağıt kesme komutu (GS V m)
  const paperCut = GS + String.fromCharCode(0x56) + String.fromCharCode(0x00); // GS V 0 (partial cut)
  content += paperCut;
  
  // Feed
  content += ESC + String.fromCharCode(0x64) + String.fromCharCode(0x05); // ESC d 5 (5 satır feed)
  
  return content;
}
