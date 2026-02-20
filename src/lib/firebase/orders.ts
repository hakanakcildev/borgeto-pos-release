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
import type { Order, OrderItem, OrderStatus, PaymentStatus, Payment } from "./types";
import { updateTableStatus } from "./tables";
import { updateStatsOnOrderClose } from "./statistics";
import { decreaseStockOnOrderClose } from "./stocks";

const COLLECTION_NAME = "orders";

// Convert Firestore timestamp to Date
const convertTimestamp = (data: any) => ({
  ...data,
  createdAt: data.createdAt?.toDate() || new Date(),
  updatedAt: data.updatedAt?.toDate() || new Date(),
  closedAt: data.closedAt?.toDate(),
  payments: data.payments?.map((p: any) => ({
    ...p,
    paidAt: p.paidAt?.toDate() || new Date(),
  })),
  items: (data.items || []).map((item: any) => ({
    ...item,
    addedAt: item.addedAt?.toDate() || new Date(),
    movedAt: item.movedAt?.toDate(),
    // movedFromTableId ve movedFromTableNumber zaten string, spread operator ile korunuyor
    // Ama açıkça belirtelim:
    movedFromTableId: item.movedFromTableId,
    movedFromTableNumber: item.movedFromTableNumber,
    movedToTableId: item.movedToTableId,
    movedToTableNumber: item.movedToTableNumber,
    // selectedExtras alanını koru
    selectedExtras: item.selectedExtras || undefined,
  })),
  canceledItems: (data.canceledItems || []).map((item: any) => ({
    ...item,
    addedAt: item.addedAt?.toDate() || new Date(),
    canceledAt: item.canceledAt?.toDate(),
  })),
  movedItems: (data.movedItems || []).map((item: any) => ({
    ...item,
    addedAt: item.addedAt?.toDate() || new Date(),
    movedAt: item.movedAt?.toDate(),
  })),
});

// Convert Date to Firestore timestamp
const convertToFirestore = (data: Partial<Order>) => {
  // undefined değerleri filtrele ve nested objelerdeki undefined'ları da temizle
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
  
  const filteredData = Object.fromEntries(
    Object.entries(cleanData(data)).filter(([_, value]) => value !== undefined)
  );

  const firestoreData: any = {
    ...filteredData,
    createdAt:
      filteredData.createdAt && filteredData.createdAt instanceof Date
        ? Timestamp.fromDate(filteredData.createdAt)
        : Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  if (filteredData.closedAt instanceof Date) {
    firestoreData.closedAt = Timestamp.fromDate(filteredData.closedAt);
  }

  if (filteredData.payments && Array.isArray(filteredData.payments)) {
    firestoreData.payments = filteredData.payments.map((p: Payment) => ({
      ...p,
      paidAt: p.paidAt instanceof Date ? Timestamp.fromDate(p.paidAt) : Timestamp.now(),
    }));
  }

  // Items array'indeki undefined değerleri temizle
  if (filteredData.items && Array.isArray(filteredData.items)) {
    firestoreData.items = filteredData.items.map((item: OrderItem) => {
      const cleanedItem: any = {
        menuId: item.menuId,
        menuName: item.menuName,
        menuPrice: item.menuPrice,
        quantity: item.quantity,
        subtotal: item.subtotal,
      };
      // notes varsa ekle, yoksa ekleme
      if (item.notes) {
        cleanedItem.notes = item.notes;
      }
      // addedAt varsa ekle
      if (item.addedAt instanceof Date) {
        cleanedItem.addedAt = Timestamp.fromDate(item.addedAt);
      } else if (item.addedAt) {
        cleanedItem.addedAt = Timestamp.fromDate(new Date(item.addedAt));
      }
      // movedAt varsa ekle
      if (item.movedAt instanceof Date) {
        cleanedItem.movedAt = Timestamp.fromDate(item.movedAt);
      } else if (item.movedAt) {
        cleanedItem.movedAt = Timestamp.fromDate(new Date(item.movedAt));
      }
      // movedFromTableId varsa ekle
      if (item.movedFromTableId) {
        cleanedItem.movedFromTableId = item.movedFromTableId;
      }
      // movedFromTableNumber varsa ekle
      if (item.movedFromTableNumber) {
        cleanedItem.movedFromTableNumber = item.movedFromTableNumber;
      }
      // movedToTableId varsa ekle
      if (item.movedToTableId) {
        cleanedItem.movedToTableId = item.movedToTableId;
      }
      // movedToTableNumber varsa ekle
      if (item.movedToTableNumber) {
        cleanedItem.movedToTableNumber = item.movedToTableNumber;
      }
      // selectedExtras varsa ekle
      if (item.selectedExtras && Array.isArray(item.selectedExtras) && item.selectedExtras.length > 0) {
        cleanedItem.selectedExtras = item.selectedExtras;
      }
      return cleanedItem;
    });
  }

  // CanceledItems array'indeki undefined değerleri temizle
  if (filteredData.canceledItems && Array.isArray(filteredData.canceledItems)) {
    firestoreData.canceledItems = filteredData.canceledItems.map((item: OrderItem) => {
      const cleanedItem: any = {
        menuId: item.menuId,
        menuName: item.menuName,
        menuPrice: item.menuPrice,
        quantity: item.quantity,
        subtotal: item.subtotal,
      };
      // notes varsa ekle, yoksa ekleme
      if (item.notes) {
        cleanedItem.notes = item.notes;
      }
      // addedAt varsa ekle
      if (item.addedAt instanceof Date) {
        cleanedItem.addedAt = Timestamp.fromDate(item.addedAt);
      } else if (item.addedAt) {
        cleanedItem.addedAt = Timestamp.fromDate(new Date(item.addedAt));
      }
      // canceledAt varsa ekle
      if (item.canceledAt instanceof Date) {
        cleanedItem.canceledAt = Timestamp.fromDate(item.canceledAt);
      } else if (item.canceledAt) {
        cleanedItem.canceledAt = Timestamp.fromDate(new Date(item.canceledAt));
      }
      // selectedExtras varsa ekle
      if (item.selectedExtras && Array.isArray(item.selectedExtras) && item.selectedExtras.length > 0) {
        cleanedItem.selectedExtras = item.selectedExtras;
      }
      return cleanedItem;
    });
  }

  // MovedItems array'indeki undefined değerleri temizle
  if (filteredData.movedItems && Array.isArray(filteredData.movedItems)) {
    firestoreData.movedItems = filteredData.movedItems.map((item: OrderItem) => {
      const cleanedItem: any = {
        menuId: item.menuId,
        menuName: item.menuName,
        menuPrice: item.menuPrice,
        quantity: item.quantity,
        subtotal: item.subtotal,
      };
      // notes varsa ekle, yoksa ekleme
      if (item.notes) {
        cleanedItem.notes = item.notes;
      }
      // addedAt varsa ekle
      if (item.addedAt instanceof Date) {
        cleanedItem.addedAt = Timestamp.fromDate(item.addedAt);
      } else if (item.addedAt) {
        cleanedItem.addedAt = Timestamp.fromDate(new Date(item.addedAt));
      }
      // movedAt varsa ekle
      if (item.movedAt instanceof Date) {
        cleanedItem.movedAt = Timestamp.fromDate(item.movedAt);
      } else if (item.movedAt) {
        cleanedItem.movedAt = Timestamp.fromDate(new Date(item.movedAt));
      }
      // movedToTableId varsa ekle
      if (item.movedToTableId) {
        cleanedItem.movedToTableId = item.movedToTableId;
      }
      // movedToTableNumber varsa ekle
      if (item.movedToTableNumber) {
        cleanedItem.movedToTableNumber = item.movedToTableNumber;
      }
      // movedFromTableId varsa ekle
      if (item.movedFromTableId) {
        cleanedItem.movedFromTableId = item.movedFromTableId;
      }
      // movedFromTableNumber varsa ekle
      if (item.movedFromTableNumber) {
        cleanedItem.movedFromTableNumber = item.movedFromTableNumber;
      }
      return cleanedItem;
    });
  }

  return firestoreData;
};

// Generate order number
const generateOrderNumber = (): string => {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `ORD-${year}-${random}`;
};

// Calculate order totals
const calculateTotals = (
  items: OrderItem[],
  discount: number = 0
) => {
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const total = subtotal - discount;

  return { subtotal, discount, total };
};

// Add new order
export const addOrder = async (
  order: Omit<Order, "id" | "orderNumber" | "createdAt" | "updatedAt" | "subtotal" | "tax" | "total">
): Promise<string> => {
  try {
    // Generate order number
    const orderNumber = generateOrderNumber();

    // Calculate totals
    const { subtotal, total } = calculateTotals(order.items);

    const orderData: Order = {
      ...order,
      orderNumber,
      subtotal,
      total,
      status: "active",
      paymentStatus: "unpaid",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const firestoreData = convertToFirestore(orderData);
    const docRef = await addDoc(collection(db, COLLECTION_NAME), firestoreData);

    // Update table status to occupied
    if (order.tableId) {
      await updateTableStatus(order.tableId, "occupied", docRef.id);
    }

    return docRef.id;
  } catch (error) {
    throw error;
  }
};

// Get order by ID
export const getOrder = async (id: string): Promise<Order | null> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...convertTimestamp(docSnap.data()),
      } as Order;
    }
    return null;
  } catch (error) {
    throw error;
  }
};

// Get orders by company (optionally filtered by branch, status, date)
export const getOrdersByCompany = async (
  companyId: string,
  options?: {
    branchId?: string;
    status?: OrderStatus;
    startDate?: Date;
    endDate?: Date;
    limitCount?: number;
  }
): Promise<Order[]> => {
  try {
    let q = query(
      collection(db, COLLECTION_NAME),
      where("companyId", "==", companyId)
    );

    if (options?.branchId) {
      q = query(q, where("branchId", "==", options.branchId));
    }

    if (options?.status) {
      q = query(q, where("status", "==", options.status));
    }

    const querySnapshot = await getDocs(q);

    let orders = querySnapshot.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...convertTimestamp(doc.data()),
        }) as Order
    );

    // Client-side sorting by createdAt (descending)
    orders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Filter by date range if provided
    if (options?.startDate || options?.endDate) {
      orders = orders.filter((order) => {
        const orderDate = order.createdAt;
        if (options.startDate && orderDate < options.startDate) return false;
        if (options.endDate && orderDate > options.endDate) return false;
        return true;
      });
    }

    // Apply limit after sorting and filtering
    if (options?.limitCount) {
      orders = orders.slice(0, options.limitCount);
    }

    return orders;
  } catch (error) {
    throw error;
  }
};

// Get active orders
export const getActiveOrders = async (
  companyId: string,
  branchId?: string
): Promise<Order[]> => {
  try {
    const allOrders = await getOrdersByCompany(companyId, { branchId });

    return allOrders.filter((order) => order.status === "active");
  } catch (error) {
    throw error;
  }
};

// Update order
export const updateOrder = async (
  id: string,
  updates: Partial<Order>
): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);

    // If items are updated, recalculate totals
    if (updates.items) {
      const { subtotal, total } = calculateTotals(updates.items);
      updates.subtotal = subtotal;
      updates.total = total;
    }

    const updateData = convertToFirestore(updates);
    await updateDoc(docRef, updateData);
  } catch (error) {
    throw error;
  }
};

// Update order status
export const updateOrderStatus = async (
  id: string,
  status: OrderStatus,
  options?: { branchIdOverride?: string }
): Promise<void> => {
  try {
    const updates: Partial<Order> = { status };

    if (status === "closed") {
      updates.closedAt = new Date();
      
      // Önce siparişi al
      const order = await getOrder(id);
      if (!order) {
        throw new Error("Order not found");
      }

      const effectiveBranchId = order.branchId || options?.branchIdOverride;
      if (!order.branchId && effectiveBranchId) {
        updates.branchId = effectiveBranchId;
      }
      
      // Siparişi güncelle (closedAt, ve gerekirse branchId)
      await updateOrder(id, updates);
      
      // Sonra masayı müsait yap ve currentOrderId'yi temizle
      if (order.tableId) {
        await updateTableStatus(order.tableId, "available", undefined);
      }
      
      // İstatistikleri güncelle (sales_stats'e branchId/createdBy yazılır)
      const updatedOrder = { ...order, ...updates, closedAt: new Date(), branchId: effectiveBranchId || order.branchId };
      await updateStatsOnOrderClose(order.companyId, updatedOrder, effectiveBranchId).catch(() => {
        // İstatistik hatası sipariş kapatmayı engellemesin
      });

      // Stok düşümü yap (ödenen tüm ürünler için)
      const paidItemsMap = new Map<string, number>();
      
      // Önce payments içindeki paidItems'ları topla (kısmi ödemeler için)
      if (order.payments && order.payments.length > 0) {
        order.payments.forEach((payment) => {
          if (payment.paidItems && payment.paidItems.length > 0) {
            payment.paidItems.forEach((paidItem) => {
              const current = paidItemsMap.get(paidItem.menuId) || 0;
              paidItemsMap.set(paidItem.menuId, current + paidItem.quantity);
            });
          }
        });
      }
      
      // Eğer paidItems yoksa, order.items içindeki tüm ürünler ödenmiş demektir
      // (Çünkü sipariş kapatılmış ve ödenen ürünler items'tan çıkarılmış olabilir)
      // Eğer paidItems varsa, order.items içindeki kalan ürünler de ödenmiş demektir
      if (order.items && order.items.length > 0) {
        order.items.forEach((item) => {
          const current = paidItemsMap.get(item.menuId) || 0;
          paidItemsMap.set(item.menuId, current + item.quantity);
        });
      }
      
      // Tüm ödenen ürünleri stok düşümü için hazırla
      if (paidItemsMap.size > 0) {
        const orderItems = Array.from(paidItemsMap.entries()).map(([menuId, quantity]) => ({
          menuId,
          quantity,
        }));
        
        await decreaseStockOnOrderClose(order.companyId, orderItems, effectiveBranchId || order.branchId, order.createdBy).catch(() => {
          // Stok hatası sipariş kapatmayı engellemesin
        });
      }
    } else {
      await updateOrder(id, updates);
    }
  } catch (error) {
    throw error;
  }
};

// Add payment to order
export const addPayment = async (
  orderId: string,
  payment: Payment
): Promise<void> => {
  try {
    const order = await getOrder(orderId);
    if (!order) throw new Error("Order not found");

    const payments = order.payments || [];
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0) + payment.amount;
    // Küçük tolerans: ondalık farklar yüzünden tam ödeme "unpaid" kalmasın
    const paidThreshold = (order.total ?? 0) - 0.005;

    let paymentStatus: PaymentStatus = "unpaid";
    if (totalPaid >= paidThreshold && (order.total ?? 0) > 0) {
      paymentStatus = "paid";
    } else if (totalPaid > 0) {
      paymentStatus = "partial";
    }

    await updateOrder(orderId, {
      payments: [...payments, payment],
      paymentStatus,
    });
  } catch (error) {
    throw error;
  }
};

// Cancel order
export const cancelOrder = async (id: string): Promise<void> => {
  try {
    await updateOrderStatus(id, "closed");
  } catch (error) {
    throw error;
  }
};

// Delete order (soft delete - only if closed)
export const deleteOrder = async (id: string): Promise<void> => {
  try {
    const order = await getOrder(id);
    if (!order) throw new Error("Order not found");

    if (order.status !== "closed") {
      throw new Error("Only closed orders can be deleted");
    }

    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);

    // Free the table
    if (order.tableId) {
      await updateTableStatus(order.tableId, "available");
    }
  } catch (error) {
    throw error;
  }
};

