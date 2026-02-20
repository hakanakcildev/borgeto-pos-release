/**
 * Reçete Bazlı Stok ve Maliyet Yönetimi Yardımcı Fonksiyonları
 */

// Birim dönüştürme katsayıları (temel birime göre)
const UNIT_CONVERSIONS: Record<string, number> = {
  // Ağırlık
  kg: 1,
  gr: 0.001,
  // Hacim
  lt: 1,
  ml: 0.001,
  // Adet
  adet: 1,
};

/**
 * Bir birimi başka bir birime dönüştürür
 * @param quantity Miktar
 * @param fromUnit Kaynak birim
 * @param toUnit Hedef birim
 * @returns Dönüştürülmüş miktar
 */
export function convertUnit(
  quantity: number,
  fromUnit: string,
  toUnit: string
): number {
  // Aynı birimse direkt döndür
  if (fromUnit === toUnit) {
    return quantity;
  }

  // Birim kategorilerine göre kontrol et
  const weightUnits = ["kg", "gr"];
  const volumeUnits = ["lt", "ml"];
  const countUnits = ["adet"];

  const fromIsWeight = weightUnits.includes(fromUnit);
  const fromIsVolume = volumeUnits.includes(fromUnit);
  const fromIsCount = countUnits.includes(fromUnit);

  const toIsWeight = weightUnits.includes(toUnit);
  const toIsVolume = volumeUnits.includes(toUnit);
  const toIsCount = countUnits.includes(toUnit);

  // Farklı kategoriler arasında dönüşüm yapılamaz
  if (
    (fromIsWeight && !toIsWeight) ||
    (fromIsVolume && !toIsVolume) ||
    (fromIsCount && !toIsCount)
  ) {
    throw new Error(
      `Farklı birim kategorileri arasında dönüşüm yapılamaz: ${fromUnit} -> ${toUnit}`
    );
  }

  // Temel birime (kg, lt, adet) dönüştür
  const baseQuantity = quantity * (UNIT_CONVERSIONS[fromUnit] || 1);

  // Hedef birime dönüştür
  const toUnitConversion = UNIT_CONVERSIONS[toUnit] || 1;

  return baseQuantity / toUnitConversion;
}

/**
 * Bir hammaddenin maliyetini hesaplar
 * @param quantity Miktar
 * @param unit Birim
 * @param lastPurchasePrice Son alış fiyatı (temel birim başına)
 * @param baseUnit Temel birim
 * @param wastePercentage Fire yüzdesi (0-100 arası, opsiyonel)
 * @returns Hesaplanan maliyet
 */
export function calculateIngredientCost(
  quantity: number,
  unit: string,
  lastPurchasePrice: number,
  baseUnit: string,
  wastePercentage?: number
): number {
  // Birimi temel birime dönüştür
  const baseQuantity = convertUnit(quantity, unit, baseUnit);

  // Fire yüzdesini uygula (varsa)
  let adjustedQuantity = baseQuantity;
  if (wastePercentage && wastePercentage > 0) {
    // Fire yüzdesi kadar fazla miktar kullanılır
    // Örn: %10 fire = 100gr için 110gr alınır
    adjustedQuantity = baseQuantity * (1 + wastePercentage / 100);
  }

  // Maliyet = Miktar * Fiyat
  return adjustedQuantity * lastPurchasePrice;
}

/**
 * Bir menü ürününün toplam maliyetini hesaplar (reçetedeki tüm hammaddeler için)
 * @param recipes Reçete listesi
 * @param stockItems Hammadde stokları (lastPurchasePrice ve baseUnit içermeli)
 * @returns Toplam maliyet
 */
export function calculateMenuCost(
  recipes: Array<{
    stockItemId: string;
    quantity: number;
    unit: string;
  }>,
  stockItems: Array<{
    id?: string;
    lastPurchasePrice?: number;
    baseUnit?: string;
    wastePercentage?: number;
  }>
): number {
  let totalCost = 0;

  recipes.forEach((recipe) => {
    const stockItem = stockItems.find(
      (item) => item.id === recipe.stockItemId
    );

    if (!stockItem) {
      return; // Hammadde bulunamadı, atla
    }

    if (
      !stockItem.lastPurchasePrice ||
      !stockItem.baseUnit
    ) {
      return; // Fiyat veya birim bilgisi yok, atla
    }

    const ingredientCost = calculateIngredientCost(
      recipe.quantity,
      recipe.unit,
      stockItem.lastPurchasePrice,
      stockItem.baseUnit,
      stockItem.wastePercentage
    );

    totalCost += ingredientCost;
  });

  return totalCost;
}

/**
 * Birim adını Türkçe'ye çevirir
 */
export function getUnitDisplayName(unit: string): string {
  const unitNames: Record<string, string> = {
    kg: "Kilogram",
    gr: "Gram",
    lt: "Litre",
    ml: "Mililitre",
    adet: "Adet",
    koli: "Koli",
    paket: "Paket",
  };

  return unitNames[unit] || unit;
}

/**
 * Stok biriminden temel birimi döndürür (reçete/maliyet için)
 */
export function getBaseUnitFromStockUnit(
  stockUnit: string
): "kg" | "lt" | "adet" {
  if (stockUnit === "kg" || stockUnit === "gr") return "kg";
  if (stockUnit === "lt" || stockUnit === "ml") return "lt";
  return "adet"; // adet, koli, paket
}

/**
 * Kullanıcı birimindeki miktarı temel birim miktarına çevirir (stok girişi için)
 */
export function stockQuantityToBase(
  quantity: number,
  stockUnit: string,
  itemsPerPackage: number = 1
): number {
  if (stockUnit === "gr") return quantity * 0.001; // gr -> kg
  if (stockUnit === "kg") return quantity;
  if (stockUnit === "ml") return quantity * 0.001; // ml -> lt
  if (stockUnit === "lt") return quantity;
  if (stockUnit === "adet") return quantity;
  if (stockUnit === "koli" || stockUnit === "paket")
    return quantity * itemsPerPackage;
  return quantity;
}

/**
 * Temel birim miktarını stok birimine çevirir (gösterim için)
 */
export function baseQuantityToStock(
  baseQuantity: number,
  stockUnit: string,
  itemsPerPackage: number = 1
): number {
  if (stockUnit === "gr") return baseQuantity * 1000; // kg -> gr
  if (stockUnit === "kg") return baseQuantity;
  if (stockUnit === "ml") return baseQuantity * 1000; // lt -> ml
  if (stockUnit === "lt") return baseQuantity;
  if (stockUnit === "adet") return baseQuantity;
  if (stockUnit === "koli" || stockUnit === "paket")
    return itemsPerPackage > 0 ? baseQuantity / itemsPerPackage : baseQuantity;
  return baseQuantity;
}
