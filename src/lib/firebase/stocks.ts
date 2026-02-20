import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Stock, StockMovement } from "./types";
import { getRecipesByMenuId } from "./recipes";
import {
  convertUnit,
  getBaseUnitFromStockUnit,
} from "../utils/recipeUtils";

const STOCKS_COLLECTION = "stocks";
const STOCK_MOVEMENTS_COLLECTION = "stockMovements";

/** Eski kayıtları yeni birim alanlarına uyumlu hale getirir */
function normalizeStock(stock: Stock): Stock {
  const stockUnit =
    stock.stockUnit ??
    (stock.packageType === "paket"
      ? "paket"
      : stock.packageType === "koli"
        ? "koli"
        : "adet");
  const baseUnit =
    stock.baseUnit ?? getBaseUnitFromStockUnit(stockUnit);
  const itemsPerPackage =
    stock.itemsPerPackage ?? (stock as any).itemsPerPackage ?? 1;
  return {
    ...stock,
    stockUnit,
    baseUnit,
    itemsPerPackage:
      stockUnit === "koli" || stockUnit === "paket" ? itemsPerPackage : undefined,
    packageType:
      stockUnit === "koli" ? "koli" : stockUnit === "paket" ? "paket" : stock.packageType,
  };
}

// Convert Firestore timestamp to Date
const convertTimestamp = (data: any) => ({
  ...data,
  createdAt: data.createdAt?.toDate() || new Date(),
  updatedAt: data.updatedAt?.toDate() || new Date(),
});

const convertMovementTimestamp = (data: any) => ({
  ...data,
  createdAt: data.createdAt?.toDate() || new Date(),
});

// Convert Date to Firestore timestamp
const convertToFirestore = (data: any) => {
  const firestoreData: any = {
    ...data,
    createdAt: data.createdAt instanceof Date 
      ? Timestamp.fromDate(data.createdAt) 
      : Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  
  // Remove undefined values
  Object.keys(firestoreData).forEach(key => {
    if (firestoreData[key] === undefined) {
      delete firestoreData[key];
    }
  });
  
  return firestoreData;
};

const convertMovementToFirestore = (data: any) => {
  const firestoreData: any = {
    ...data,
    createdAt: data.createdAt instanceof Date 
      ? Timestamp.fromDate(data.createdAt) 
      : Timestamp.now(),
  };
  
  // Remove undefined values
  Object.keys(firestoreData).forEach(key => {
    if (firestoreData[key] === undefined) {
      delete firestoreData[key];
    }
  });
  
  return firestoreData;
};

// Get all stocks for a company (optionally filtered by branch)
export const getAllStocksByCompany = async (
  companyId: string,
  branchId?: string
): Promise<Stock[]> => {
  try {
    const q = query(
      collection(db, STOCKS_COLLECTION),
      where("companyId", "==", companyId)
    );

    const querySnapshot = await getDocs(q);

    let stocks = querySnapshot.docs.map(
      (doc) =>
        normalizeStock({
          id: doc.id,
          ...convertTimestamp(doc.data()),
        } as Stock)
    );

    // Client-side filtering by branchId if provided
    if (branchId) {
      stocks = stocks.filter(
        (stock) => !stock.branchId || stock.branchId === branchId
      );
    }

    // Client-side sorting by name (ascending)
    return stocks.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  } catch (error) {
    throw error;
  }
};

// Get stock by ID
export const getStock = async (id: string): Promise<Stock | null> => {
  try {
    const docRef = doc(db, STOCKS_COLLECTION, id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return normalizeStock({
        id: docSnap.id,
        ...convertTimestamp(docSnap.data()),
      } as Stock);
    }
    return null;
  } catch (error) {
    throw error;
  }
};

// Get stock by menu ID
export const getStockByMenuId = async (
  companyId: string,
  menuId: string,
  branchId?: string
): Promise<Stock | null> => {
  try {
    // Get all stocks for company first (to avoid index issues)
    const q = query(
      collection(db, STOCKS_COLLECTION),
      where("companyId", "==", companyId)
    );

    const querySnapshot = await getDocs(q);

    let stocks = querySnapshot.docs.map(
      (doc) =>
        normalizeStock({
          id: doc.id,
          ...convertTimestamp(doc.data()),
        } as Stock)
    );

    // Client-side filtering by menuId (boş menuId eşleşmez)
    stocks = stocks.filter((stock) => stock.menuId === menuId);

    // Client-side filtering by branchId if provided
    if (branchId) {
      stocks = stocks.filter(
        (stock) => !stock.branchId || stock.branchId === branchId
      );
    }

    // Return the first matching stock (should be unique per menuId)
    return stocks.length > 0 ? stocks[0] : null;
  } catch (error) {
    throw error;
  }
};

// Add new stock item
export const addStock = async (
  stock: Omit<Stock, "id" | "createdAt" | "updatedAt">
): Promise<string> => {
  try {
    const normalized = normalizeStock(stock as Stock);
    const stockData = convertToFirestore(normalized);
    const docRef = await addDoc(collection(db, STOCKS_COLLECTION), stockData);
    return docRef.id;
  } catch (error) {
    throw error;
  }
};

// Update stock item
export const updateStock = async (
  id: string,
  updates: Partial<Stock>
): Promise<void> => {
  try {
    const docRef = doc(db, STOCKS_COLLECTION, id);

    // Filter out undefined values before converting
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, value]) => value !== undefined)
    );

    if (Object.keys(cleanUpdates).length === 0) {
      return;
    }

    const updateData = convertToFirestore(cleanUpdates);
    await updateDoc(docRef, updateData);
  } catch (error) {
    throw error;
  }
};

// Delete stock item
export const deleteStock = async (id: string): Promise<void> => {
  try {
    const docRef = doc(db, STOCKS_COLLECTION, id);
    await deleteDoc(docRef);
  } catch (error) {
    throw error;
  }
};

// Get stock movements for a stock item
export const getStockMovements = async (
  stockId: string
): Promise<StockMovement[]> => {
  try {
    const q = query(
      collection(db, STOCK_MOVEMENTS_COLLECTION),
      where("stockId", "==", stockId)
    );

    const querySnapshot = await getDocs(q);

    const movements = querySnapshot.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...convertMovementTimestamp(doc.data()),
        }) as StockMovement
    );

    // Client-side sorting by createdAt (descending)
    return movements.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } catch (error) {
    throw error;
  }
};

// Get all stock movements for a company (optionally filtered by branch)
export const getAllStockMovementsByCompany = async (
  companyId: string,
  branchId?: string
): Promise<StockMovement[]> => {
  try {
    const q = query(
      collection(db, STOCK_MOVEMENTS_COLLECTION),
      where("companyId", "==", companyId)
    );

    const querySnapshot = await getDocs(q);

    let movements = querySnapshot.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...convertMovementTimestamp(doc.data()),
        }) as StockMovement
    );

    // Client-side filtering by branchId if provided
    if (branchId) {
      movements = movements.filter(
        (movement) => !movement.branchId || movement.branchId === branchId
      );
    }

    // Client-side sorting by createdAt (descending)
    return movements.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } catch (error) {
    throw error;
  }
};

// Add stock movement and update stock quantity
export const addStockMovement = async (
  movement: Omit<StockMovement, "id" | "createdAt">,
  updateStockQuantity: boolean = true
): Promise<string> => {
  try {
    // Add movement
    const movementData = convertMovementToFirestore(movement);
    const docRef = await addDoc(
      collection(db, STOCK_MOVEMENTS_COLLECTION),
      movementData
    );

    // Update stock quantity if needed
    if (updateStockQuantity && movement.stockId) {
      const stock = await getStock(movement.stockId);
      if (stock) {
        let quantityToAdd = 0;
        
        // Miktar her zaman stokun baseUnit cinsinden (kg, lt veya adet)
        if (movement.unitType === "package") {
          // Koli/paket girişi: quantity = koli/paket sayısı, adet = quantity * itemsPerPackage
          const itemsPerPackage =
            (stock.itemsPerPackage ?? 0) >= 1 ? stock.itemsPerPackage! : 1;
          quantityToAdd = movement.quantity * itemsPerPackage;
        } else {
          // item: miktar zaten temel birimde (kg, lt veya adet)
          quantityToAdd = movement.quantity;
        }
        
        let newQuantity = stock.currentQuantity;
        
        if (movement.type === "in") {
          newQuantity += quantityToAdd;
        } else if (movement.type === "out") {
          newQuantity -= quantityToAdd;
          // Don't allow negative quantities
          if (newQuantity < 0) {
            newQuantity = 0;
          }
        } else if (movement.type === "adjustment") {
          newQuantity = quantityToAdd;
        }

        await updateStock(movement.stockId, {
          currentQuantity: newQuantity,
        });
      }
    }

    return docRef.id;
  } catch (error) {
    throw error;
  }
};

// Decrease stock when order is closed (called from order close)
// Reçete sistemi: Menü ürünü satıldığında, reçetesindeki hammaddeler stoktan düşülür
export const decreaseStockOnOrderClose = async (
  companyId: string,
  orderItems: Array<{ menuId: string; quantity: number }>,
  branchId?: string,
  createdBy?: string
): Promise<void> => {
  try {
    // Group items by menuId and sum quantities
    const menuQuantities = new Map<string, number>();
    orderItems.forEach((item) => {
      const current = menuQuantities.get(item.menuId) || 0;
      menuQuantities.set(item.menuId, current + item.quantity);
    });

    // For each menu item, process recipe-based stock decrease
    for (const [menuId, menuQuantity] of menuQuantities.entries()) {
      // Get recipes for this menu item
      const recipes = await getRecipesByMenuId(companyId, menuId, branchId);
      
      if (recipes.length > 0) {
        // Reçete sistemi: Reçetedeki hammaddeleri stoktan düş
        for (const recipe of recipes) {
          if (!recipe.isActive || !recipe.stockItemId) {
            continue;
          }
          
          const stock = await getStock(recipe.stockItemId);
          
          if (!stock || !stock.isActive) {
            continue;
          }
          
          // Reçetedeki miktarı menü miktarı ile çarp
          const totalRecipeQuantity = recipe.quantity * menuQuantity;
          
          // Birim dönüştürmesi yap (reçetedeki birim -> stok birimi)
          // Stok birimi baseUnit'dir (veya adet cinsinden)
          let quantityToDecrease = totalRecipeQuantity;
          
          if (stock.baseUnit && recipe.unit !== "adet") {
            try {
              // Reçetedeki birimi stok birimine dönüştür
              // Eğer stok baseUnit olarak kg tutuluyorsa ve reçete gr kullanıyorsa, dönüştür
              quantityToDecrease = convertUnit(
                totalRecipeQuantity,
                recipe.unit,
                stock.baseUnit
              );
            } catch (error) {
              // Birim dönüştürme hatası, adet cinsinden düş
              console.warn(
                `Birim dönüştürme hatası (${recipe.unit} -> ${stock.baseUnit}):`,
                error
              );
              // Adet cinsinden devam et (eski sistemle uyumluluk)
            }
          }
          
          // Stoktan düş (adet cinsinden)
          // Not: currentQuantity her zaman adet cinsindendir
          // baseUnit sadece alış fiyatı için kullanılır
          const newQuantity = Math.max(0, stock.currentQuantity - quantityToDecrease);
          
          await updateStock(stock.id!, {
            currentQuantity: newQuantity,
          });

          // Add movement record
          await addStockMovement(
            {
              companyId: stock.companyId,
              branchId: stock.branchId,
              stockId: stock.id!,
              type: "out",
              quantity: quantityToDecrease,
              unitType: "item", // Stok hareketi her zaman adet cinsinden
              reason: `Satış (Reçete: ${recipe.menuName || menuId})`,
              notes: `${menuQuantity} adet × ${recipe.quantity} ${recipe.unit} = ${quantityToDecrease} adet`,
              createdBy: createdBy || "",
            },
            false // Don't update quantity again, we already did it
          );
        }
      } else {
        // Eski sistem: Birebir eşleşme (menuId ile stok eşleşmesi)
        const stock = await getStockByMenuId(companyId, menuId, branchId);
        
        if (!stock || !stock.isActive) {
          continue;
        }
        
        // Decrease by quantity (items are already in item count)
        const newQuantity = Math.max(0, stock.currentQuantity - menuQuantity);
        
        await updateStock(stock.id!, {
          currentQuantity: newQuantity,
        });

        // Add movement record
        await addStockMovement(
          {
            companyId: stock.companyId,
            branchId: stock.branchId,
            stockId: stock.id!,
            type: "out",
            quantity: menuQuantity,
            unitType: "item", // Satışta her zaman adet cinsinden
            reason: "Satış (Eski sistem - Birebir eşleşme)",
            createdBy: createdBy || "",
          },
          false // Don't update quantity again, we already did it
        );
      }
    }
  } catch (error) {
    // Don't throw error - stock update shouldn't block order closing
    console.error("Stok düşümü hatası:", error);
  }
};

