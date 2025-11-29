import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  deleteDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";

export type TableHistoryAction =
  | "item_added"
  | "item_cancelled"
  | "item_moved"
  | "table_moved"
  | "partial_payment"
  | "full_payment";

export interface TableHistoryItem {
  id?: string;
  companyId: string;
  branchId?: string;
  tableId: string;
  tableNumber: string;
  action: TableHistoryAction;
  description: string;
  details?: {
    menuId?: string;
    menuName?: string;
    quantity?: number;
    subtotal?: number;
    movedFromTableNumber?: string;
    movedToTableNumber?: string;
    paymentAmount?: number;
    paymentMethod?: string;
    paidItems?: Array<{
      menuId: string;
      menuName: string;
      quantity: number;
      subtotal: number;
    }>;
  };
  createdAt: Date;
}

const COLLECTION_NAME = "tableHistory";

// Masa geçmişi kaydet
export const addTableHistory = async (
  companyId: string,
  tableId: string,
  tableNumber: string,
  action: TableHistoryAction,
  description: string,
  details?: TableHistoryItem["details"],
  branchId?: string
): Promise<void> => {
  try {
    const historyData = {
      companyId,
      branchId: branchId || null,
      tableId,
      tableNumber,
      action,
      description,
      details: details || null,
      createdAt: Timestamp.now(),
    };

    await addDoc(collection(db, COLLECTION_NAME), historyData);
  } catch (error) {
    throw error;
  }
};

// Masanın geçmişini getir
export const getTableHistory = async (
  companyId: string,
  tableId: string,
  branchId?: string
): Promise<TableHistoryItem[]> => {
  try {
    let q = query(
      collection(db, COLLECTION_NAME),
      where("companyId", "==", companyId),
      where("tableId", "==", tableId)
    );

    if (branchId) {
      q = query(q, where("branchId", "==", branchId));
    }
    // branchId undefined ise filtreleme yapma (tüm branchId'ler dahil)

    const querySnapshot = await getDocs(q);
    const history = querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
      } as TableHistoryItem;
    });
    
    // Client-side sıralama (orderBy index gerektirmez)
    return history.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } catch (error) {
    throw error;
  }
};

// Tüm masa geçmişlerini getir (şirket bazında)
export const getAllTableHistory = async (
  companyId: string,
  branchId?: string
): Promise<TableHistoryItem[]> => {
  try {
    let q = query(
      collection(db, COLLECTION_NAME),
      where("companyId", "==", companyId)
    );

    if (branchId) {
      q = query(q, where("branchId", "==", branchId));
    }

    const querySnapshot = await getDocs(q);
    
    const history = querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
      } as TableHistoryItem;
    });
    
    // Client-side sıralama (orderBy index gerektirmez)
    return history.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } catch (error) {
    throw error;
  }
};

// İşlem yapılmış masaları getir (unique tableId'ler)
export const getTablesWithHistory = async (
  companyId: string,
  branchId?: string
): Promise<string[]> => {
  try {
    const allHistory = await getAllTableHistory(companyId, branchId);
    const uniqueTableIds = Array.from(new Set(allHistory.map((item) => item.tableId)));
    return uniqueTableIds;
  } catch (error) {
    throw error;
  }
};

// Tüm masa geçmişlerini temizle (günlük 03:00'da çalışacak)
export const clearAllTableHistory = async (
  companyId: string,
  branchId?: string
): Promise<void> => {
  try {
    let q = query(
      collection(db, COLLECTION_NAME),
      where("companyId", "==", companyId)
    );

    if (branchId) {
      q = query(q, where("branchId", "==", branchId));
    }
    // branchId undefined ise filtreleme yapma (tüm branchId'ler dahil)

    const querySnapshot = await getDocs(q);
    const deletePromises = querySnapshot.docs.map((docSnapshot) => deleteDoc(docSnapshot.ref));
    await Promise.all(deletePromises);
  } catch (error) {
    throw error;
  }
};

// Günlük temizleme kontrolü (client-side)
export const checkAndClearTableHistory = async (
  companyId: string,
  branchId?: string
): Promise<void> => {
  try {
    const now = new Date();
    const lastClearKey = `tableHistoryLastClear_${companyId}_${branchId || "default"}`;
    const lastClearTime = localStorage.getItem(lastClearKey);
    
    if (lastClearTime) {
      const lastClear = new Date(lastClearTime);
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const lastClearDate = new Date(lastClear.getFullYear(), lastClear.getMonth(), lastClear.getDate());
      
      // Eğer bugün temizlenmişse, tekrar temizleme
      if (lastClearDate.getTime() === today.getTime()) {
        return;
      }
    }

    // Saat 03:00'ı kontrol et
    const clearTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 3, 0, 0);
    const shouldClear = now >= clearTime;

    if (shouldClear) {
      await clearAllTableHistory(companyId, branchId);
      localStorage.setItem(lastClearKey, now.toISOString());
    }
  } catch (error) {
    // Error checking and clearing table history
  }
};

