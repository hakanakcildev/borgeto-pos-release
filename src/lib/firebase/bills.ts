import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Bill, OrderItem, Payment } from "./types";

const COLLECTION_NAME = "bills";

// Convert Firestore timestamp to Date
const convertTimestamp = (data: any) => ({
  ...data,
  createdAt: data.createdAt?.toDate() || new Date(),
  closedAt: data.closedAt?.toDate() || new Date(),
  payments: data.payments?.map((p: any) => ({
    ...p,
    paidAt: p.paidAt?.toDate() || new Date(),
  })),
  items: (data.items || []).map((item: any) => ({
    ...item,
    addedAt: item.addedAt?.toDate() || new Date(),
    movedAt: item.movedAt?.toDate(),
    canceledAt: item.canceledAt?.toDate(),
  })),
});

// Convert Date to Firestore timestamp
const convertToFirestore = (data: Partial<Bill>) => {
  // Recursive olarak undefined değerleri temizle
  const cleanData = (obj: any): any => {
    if (obj === null || obj === undefined) {
      return undefined;
    }
    if (Array.isArray(obj)) {
      return obj.map(cleanData).filter((item) => item !== undefined);
    }
    if (typeof obj === 'object' && !(obj instanceof Date)) {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const cleanedValue = cleanData(value);
        if (cleanedValue !== undefined) {
          cleaned[key] = cleanedValue;
        }
      }
      return cleaned;
    }
    return obj;
  };
  
  const cleanedData = cleanData(data);
  
  const firestoreData: any = {
    companyId: cleanedData.companyId,
    tableId: cleanedData.tableId,
    tableNumber: cleanedData.tableNumber,
    orderId: cleanedData.orderId,
    billNumber: cleanedData.billNumber,
    items: cleanedData.items,
    subtotal: cleanedData.subtotal,
    total: cleanedData.total,
    payments: cleanedData.payments,
    createdBy: cleanedData.createdBy,
    createdAt:
      cleanedData.createdAt && cleanedData.createdAt instanceof Date
        ? Timestamp.fromDate(cleanedData.createdAt)
        : Timestamp.now(),
    closedAt:
      cleanedData.closedAt && cleanedData.closedAt instanceof Date
        ? Timestamp.fromDate(cleanedData.closedAt)
        : Timestamp.now(),
  };
  
  // Opsiyonel alanları sadece tanımlıysa ekle
  if (cleanedData.branchId !== undefined) {
    firestoreData.branchId = cleanedData.branchId;
  }
  if (cleanedData.discount !== undefined && cleanedData.discount !== null) {
    firestoreData.discount = cleanedData.discount;
  }
  if (cleanedData.customerName !== undefined && cleanedData.customerName !== null) {
    firestoreData.customerName = cleanedData.customerName;
  }
  if (cleanedData.customerPhone !== undefined && cleanedData.customerPhone !== null) {
    firestoreData.customerPhone = cleanedData.customerPhone;
  }
  if (cleanedData.notes !== undefined && cleanedData.notes !== null) {
    firestoreData.notes = cleanedData.notes;
  }

  // Payments array'ini temizle ve dönüştür
  if (cleanedData.payments && Array.isArray(cleanedData.payments)) {
    firestoreData.payments = cleanedData.payments.map((p: Payment) => {
      const cleanedPayment: any = {
        amount: p.amount,
        method: p.method,
        paidAt: p.paidAt instanceof Date ? Timestamp.fromDate(p.paidAt) : Timestamp.now(),
      };
      if (p.notes !== undefined && p.notes !== null) {
        cleanedPayment.notes = p.notes;
      }
      if (p.paidItems !== undefined && p.paidItems !== null) {
        cleanedPayment.paidItems = p.paidItems;
      }
      return cleanedPayment;
    });
  }

  // Items array'ini temizle ve dönüştür
  if (cleanedData.items && Array.isArray(cleanedData.items)) {
    firestoreData.items = cleanedData.items.map((item: OrderItem) => {
      const cleanedItem: any = {
        menuId: item.menuId,
        menuName: item.menuName,
        menuPrice: item.menuPrice,
        quantity: item.quantity,
        subtotal: item.subtotal,
      };
      if (item.notes !== undefined && item.notes !== null) {
        cleanedItem.notes = item.notes;
      }
      if (item.addedAt instanceof Date) {
        cleanedItem.addedAt = Timestamp.fromDate(item.addedAt);
      } else if (item.addedAt) {
        cleanedItem.addedAt = Timestamp.fromDate(new Date(item.addedAt));
      }
      if (item.movedAt instanceof Date) {
        cleanedItem.movedAt = Timestamp.fromDate(item.movedAt);
      } else if (item.movedAt) {
        cleanedItem.movedAt = Timestamp.fromDate(new Date(item.movedAt));
      }
      if (item.canceledAt instanceof Date) {
        cleanedItem.canceledAt = Timestamp.fromDate(item.canceledAt);
      } else if (item.canceledAt) {
        cleanedItem.canceledAt = Timestamp.fromDate(new Date(item.canceledAt));
      }
      if (item.movedFromTableId !== undefined && item.movedFromTableId !== null) {
        cleanedItem.movedFromTableId = item.movedFromTableId;
      }
      if (item.movedFromTableNumber !== undefined && item.movedFromTableNumber !== null) {
        cleanedItem.movedFromTableNumber = item.movedFromTableNumber;
      }
      if (item.movedToTableId !== undefined && item.movedToTableId !== null) {
        cleanedItem.movedToTableId = item.movedToTableId;
      }
      if (item.movedToTableNumber !== undefined && item.movedToTableNumber !== null) {
        cleanedItem.movedToTableNumber = item.movedToTableNumber;
      }
      return cleanedItem;
    });
  }

  // Son olarak tüm undefined değerleri temizle
  const finalData: any = {};
  for (const [key, value] of Object.entries(firestoreData)) {
    if (value !== undefined) {
      finalData[key] = value;
    }
  }

  return finalData;
};

// Generate bill number
const generateBillNumber = (): string => {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `AD-${year}-${random}`;
};

// Add new bill
export const addBill = async (
  bill: Omit<Bill, "id" | "billNumber" | "createdAt" | "closedAt">
): Promise<string> => {
  try {
    const billNumber = generateBillNumber();

    const billData: Bill = {
      ...bill,
      billNumber,
      createdAt: new Date(),
      closedAt: new Date(),
    };

    const firestoreData = convertToFirestore(billData);
    const docRef = await addDoc(collection(db, COLLECTION_NAME), firestoreData);
    return docRef.id;
  } catch (error) {
    throw error;
  }
};

// Get bill by ID
export const getBill = async (id: string): Promise<Bill | null> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...convertTimestamp(docSnap.data()),
      } as Bill;
    }
    return null;
  } catch (error) {
    throw error;
  }
};

// Get bills by table
export const getBillsByTable = async (
  companyId: string,
  tableId: string,
  branchId?: string
): Promise<Bill[]> => {
  try {
    let q = query(
      collection(db, COLLECTION_NAME),
      where("companyId", "==", companyId),
      where("tableId", "==", tableId)
    );

    // branchId undefined değilse ve null değilse filtrele
    if (branchId !== undefined && branchId !== null) {
      q = query(q, where("branchId", "==", branchId));
    }

    const querySnapshot = await getDocs(q);
    const bills = querySnapshot.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...convertTimestamp(doc.data()),
        }) as Bill
    );

    // Client-side sorting by createdAt (descending)
    return bills.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } catch (error) {
    throw error;
  }
};

// Get bills by company (optionally filtered by branch, date)
export const getBillsByCompany = async (
  companyId: string,
  options?: {
    branchId?: string;
    startDate?: Date;
    endDate?: Date;
    limitCount?: number;
  }
): Promise<Bill[]> => {
  try {
    let q = query(
      collection(db, COLLECTION_NAME),
      where("companyId", "==", companyId)
    );

    // branchId undefined değilse ve null değilse filtrele
    if (options?.branchId !== undefined && options?.branchId !== null) {
      q = query(q, where("branchId", "==", options.branchId));
    }

    const querySnapshot = await getDocs(q);

    let bills = querySnapshot.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...convertTimestamp(doc.data()),
        }) as Bill
    );

    // Client-side sorting by createdAt (descending)
    bills.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Filter by date range if provided
    if (options?.startDate || options?.endDate) {
      bills = bills.filter((bill) => {
        const billDate = bill.createdAt;
        if (options.startDate && billDate < options.startDate) return false;
        if (options.endDate && billDate > options.endDate) return false;
        return true;
      });
    }

    // Apply limit after sorting and filtering
    if (options?.limitCount) {
      bills = bills.slice(0, options.limitCount);
    }

    return bills;
  } catch (error) {
    throw error;
  }
};

// Get tables with bills (unique tableId'ler)
export const getTablesWithBills = async (
  companyId: string,
  branchId?: string
): Promise<string[]> => {
  try {
    const allBills = await getBillsByCompany(companyId, { branchId });
    const uniqueTableIds = Array.from(new Set(allBills.map((bill) => bill.tableId)));
    return uniqueTableIds;
  } catch (error) {
    throw error;
  }
};

