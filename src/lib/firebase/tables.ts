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
  deleteField,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Table, TableStats } from "./types";

const COLLECTION_NAME = "tables";

// Convert Firestore timestamp to Date
const convertTimestamp = (data: any) => ({
  ...data,
  createdAt: data.createdAt?.toDate() || new Date(),
  updatedAt: data.updatedAt?.toDate() || new Date(),
});

// Convert Date to Firestore timestamp
const convertToFirestore = (data: Partial<Table>) => {
  const filteredData = Object.fromEntries(
    Object.entries(data).filter(([_, value]) => value !== undefined)
  );

  return {
    ...filteredData,
    createdAt:
      filteredData.createdAt && filteredData.createdAt instanceof Date
        ? Timestamp.fromDate(filteredData.createdAt)
        : Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
};

// Get all tables for a company (optionally filtered by branch)
export const getTablesByCompany = async (
  companyId: string,
  branchId?: string
): Promise<Table[]> => {
  try {
    let q;
    if (branchId) {
      q = query(
        collection(db, COLLECTION_NAME),
        where("companyId", "==", companyId),
        where("branchId", "==", branchId)
      );
    } else {
      q = query(
        collection(db, COLLECTION_NAME),
        where("companyId", "==", companyId)
      );
    }

    const querySnapshot = await getDocs(q);

    const tables = querySnapshot.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...convertTimestamp(doc.data()),
        }) as Table
    );

    // Client-side sorting by tableNumber
    return tables.sort((a, b) => {
      // Try to sort numerically if both are numbers
      const aNum = parseInt(a.tableNumber);
      const bNum = parseInt(b.tableNumber);
      
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return aNum - bNum;
      }
      
      // Otherwise sort alphabetically
      return a.tableNumber.localeCompare(b.tableNumber, undefined, {
        numeric: true,
        sensitivity: 'base'
      });
    });
  } catch (error) {
    throw error;
  }
};

// Get table by ID
export const getTable = async (id: string): Promise<Table | null> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...convertTimestamp(docSnap.data()),
      } as Table;
    }
    return null;
  } catch (error) {
    throw error;
  }
};

// Add new table
export const addTable = async (
  table: Omit<Table, "id" | "createdAt" | "updatedAt">
): Promise<string> => {
  try {
    const tableData = convertToFirestore(table);
    const docRef = await addDoc(collection(db, COLLECTION_NAME), tableData);
    return docRef.id;
  } catch (error) {
    throw error;
  }
};

// Standart masaları oluştur (Paket ve Hızlı Satış)
export const createDefaultTables = async (
  companyId: string,
  branchId?: string
): Promise<void> => {
  try {
    // Mevcut masaları kontrol et
    const existingTables = await getTablesByCompany(companyId, branchId);
    
    // Duplicate masaları temizle (area-tableNumber kombinasyonuna göre)
    const tableMap = new Map<string, Table>();
    existingTables.forEach((table) => {
      const key = `${table.area}-${table.tableNumber}`;
      const existing = tableMap.get(key);
      
      if (!existing) {
        tableMap.set(key, table);
      } else {
        // Daha yeni olanı tut
        const existingDate = existing.updatedAt || existing.createdAt;
        const currentDate = table.updatedAt || table.createdAt;
        
        if (currentDate > existingDate) {
          tableMap.set(key, table);
        }
      }
    });
    
    const uniqueTables = Array.from(tableMap.values());
    
    // Paket masası var mı kontrol et
    const hasPaketTable = uniqueTables.some(
      (table) => table.area === "Paket" && table.tableNumber === "Paket"
    );
    
    // Hızlı Satış masası var mı kontrol et
    const hasHizliSatisTable = uniqueTables.some(
      (table) => table.area === "Hızlı Satış" && table.tableNumber === "Hızlı Satış"
    );
    
    // Paket masası yoksa oluştur
    if (!hasPaketTable) {
      await addTable({
        companyId,
        branchId: branchId || undefined,
        area: "Paket",
        tableNumber: "Paket",
        status: "available",
      });
    }
    
    // Hızlı Satış masası yoksa oluştur
    if (!hasHizliSatisTable) {
      await addTable({
        companyId,
        branchId: branchId || undefined,
        area: "Hızlı Satış",
        tableNumber: "Hızlı Satış",
        status: "available",
      });
    }
  } catch (error) {
    throw error;
  }
};

// Update table
export const updateTable = async (
  id: string,
  updates: Partial<Table>
): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    const updateData = convertToFirestore(updates);
    await updateDoc(docRef, updateData);
  } catch (error) {
    throw error;
  }
};

// Delete table
export const deleteTable = async (id: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  } catch (error) {
    throw error;
  }
};

// Update table status
export const updateTableStatus = async (
  id: string,
  status: Table["status"],
  currentOrderId?: string
): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    const updates: any = {
      status,
      updatedAt: Timestamp.now(),
    };
    
    // Eğer currentOrderId undefined ise Firestore'dan sil, değilse set et
    if (currentOrderId === undefined) {
      updates.currentOrderId = deleteField();
    } else {
      updates.currentOrderId = currentOrderId;
    }
    
    await updateDoc(docRef, updates);
  } catch (error) {
    throw error;
  }
};

// Get table statistics
export const getTableStats = async (
  companyId: string,
  branchId?: string
): Promise<TableStats> => {
  try {
    const tables = await getTablesByCompany(companyId, branchId);

    return {
      total: tables.length,
      available: tables.filter((t) => t.status === "available").length,
      occupied: tables.filter((t) => t.status === "occupied").length,
      reserved: tables.filter((t) => t.status === "reserved").length,
      cleaning: tables.filter((t) => t.status === "cleaning").length,
    };
  } catch (error) {
    throw error;
  }
};

