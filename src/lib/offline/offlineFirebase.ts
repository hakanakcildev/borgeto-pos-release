/**
 * Offline-Aware Firebase Wrappers
 * Internet durumunu kontrol eder ve offline ise queue'ya alır
 */

import { addToQueue } from "./offlineQueue";
import {
  updateOrderOffline,
  updateTableOffline,
  saveOrdersOffline,
  loadOrdersOffline,
  saveTablesOffline,
  loadTablesOffline,
} from "./offlineStorage";
import {
  addOrder as firebaseAddOrder,
  updateOrder as firebaseUpdateOrder,
  addPayment as firebaseAddPayment,
  updateOrderStatus as firebaseUpdateOrderStatus,
  getOrder as firebaseGetOrder,
  getOrdersByCompany as firebaseGetOrdersByCompany,
} from "@/lib/firebase/orders";
import {
  updateTableStatus as firebaseUpdateTableStatus,
  getTablesByCompany as firebaseGetTablesByCompany,
} from "@/lib/firebase/tables";
import { addTableHistory as firebaseAddTableHistory } from "@/lib/firebase/tableHistory";
import { addBill as firebaseAddBill } from "@/lib/firebase/bills";
import { addCourierAssignment as firebaseAddCourierAssignment } from "@/lib/firebase/couriers";
import type { Order, Table } from "@/lib/firebase/types";

/**
 * Internet durumunu kontrol et
 */
function isOnline(): boolean {
  return navigator.onLine;
}

/**
 * Order ekle (offline-aware)
 */
export async function addOrder(
  orderData: Omit<Order, "id" | "orderNumber" | "createdAt" | "updatedAt" | "subtotal" | "tax" | "total">
): Promise<string> {
  // Subtotal ve total'i hesapla (Firebase'deki gibi)
  const subtotal = orderData.items.reduce((sum, item) => sum + item.subtotal, 0);
  const total = subtotal - (orderData.discount || 0);
  
  if (isOnline()) {
    try {
      const orderId = await firebaseAddOrder(orderData);
      // Order'ı offline storage'a da ekle
      const order = await firebaseGetOrder(orderId);
      if (order) {
        const orders = loadOrdersOffline();
        orders.push(order);
        saveOrdersOffline(orders);
      }
      return orderId;
    } catch (error) {
      // Hata durumunda queue'ya al
      console.warn("⚠️ Firebase error, queueing operation:", error);
      const tempId = addToQueue({ type: "addOrder", data: orderData });
      // Optimistic update için geçici order oluştur
      const tempOrder: Order = {
        ...orderData,
        id: tempId,
        orderNumber: `TEMP-${Date.now()}`,
        subtotal,
        total,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Order;
      const orders = loadOrdersOffline();
      orders.push(tempOrder);
      saveOrdersOffline(orders);
      return tempId;
    }
  } else {
    // Offline durumunda queue'ya al
    const tempId = addToQueue({ type: "addOrder", data: orderData });
    // Optimistic update için geçici order oluştur
    const tempOrder: Order = {
      ...orderData,
      id: tempId,
      orderNumber: `TEMP-${Date.now()}`,
      subtotal,
      total,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Order;
    const orders = loadOrdersOffline();
    orders.push(tempOrder);
    saveOrdersOffline(orders);
    return tempId;
  }
}

/**
 * Order güncelle (offline-aware)
 */
export async function updateOrder(
  orderId: string,
  data: Partial<Order>
): Promise<void> {
  if (isOnline()) {
    try {
      await firebaseUpdateOrder(orderId, data);
      // Offline storage'ı da güncelle
      const order = await firebaseGetOrder(orderId);
      if (order) {
        updateOrderOffline(order);
      }
    } catch (error) {
      console.warn("⚠️ Firebase error, queueing operation:", error);
      addToQueue({ type: "updateOrder", orderId, data });
      // Optimistic update
      const orders = loadOrdersOffline();
      const index = orders.findIndex((o) => o.id === orderId);
      if (index >= 0) {
        orders[index] = { ...orders[index], ...data } as Order;
        saveOrdersOffline(orders);
      }
    }
  } else {
    // Offline durumunda queue'ya al
    addToQueue({ type: "updateOrder", orderId, data });
    // Optimistic update
    const orders = loadOrdersOffline();
    const index = orders.findIndex((o) => o.id === orderId);
    if (index >= 0) {
      orders[index] = { ...orders[index], ...data } as Order;
      saveOrdersOffline(orders);
    }
  }
}

/**
 * Payment ekle (offline-aware)
 */
export async function addPayment(
  orderId: string,
  payment: any
): Promise<void> {
  if (isOnline()) {
    try {
      await firebaseAddPayment(orderId, payment);
      // Order'ı yeniden yükle ve offline storage'ı güncelle
      const order = await firebaseGetOrder(orderId);
      if (order) {
        updateOrderOffline(order);
      }
    } catch (error) {
      console.warn("⚠️ Firebase error, queueing operation:", error);
      addToQueue({ type: "addPayment", orderId, payment });
    }
  } else {
    addToQueue({ type: "addPayment", orderId, payment });
    // Optimistic update
    const orders = loadOrdersOffline();
    const index = orders.findIndex((o) => o.id === orderId);
    if (index >= 0) {
      const order = orders[index];
      if (!order.payments) order.payments = [];
      order.payments.push(payment);
      saveOrdersOffline(orders);
    }
  }
}

/**
 * Order status güncelle (offline-aware)
 */
export async function updateOrderStatus(
  orderId: string,
  status: "active" | "completed" | "cancelled" | "closed"
): Promise<void> {
  if (isOnline()) {
    try {
      await firebaseUpdateOrderStatus(orderId, status);
      const order = await firebaseGetOrder(orderId);
      if (order) {
        updateOrderOffline(order);
      }
    } catch (error) {
      console.warn("⚠️ Firebase error, queueing operation:", error);
      addToQueue({ type: "updateOrderStatus", orderId, status });
      // Optimistic update
      const orders = loadOrdersOffline();
      const index = orders.findIndex((o) => o.id === orderId);
      if (index >= 0) {
        orders[index] = { ...orders[index], status } as Order;
        saveOrdersOffline(orders);
      }
    }
  } else {
    addToQueue({ type: "updateOrderStatus", orderId, status });
    // Optimistic update
    const orders = loadOrdersOffline();
    const index = orders.findIndex((o) => o.id === orderId);
    if (index >= 0) {
      orders[index] = { ...orders[index], status } as Order;
      saveOrdersOffline(orders);
    }
  }
}

/**
 * Table status güncelle (offline-aware)
 */
export async function updateTableStatus(
  tableId: string,
  status: "available" | "occupied",
  orderId?: string
): Promise<void> {
  if (isOnline()) {
    try {
      await firebaseUpdateTableStatus(tableId, status, orderId);
      // Offline storage'ı güncelle
      const tables = loadTablesOffline();
      const index = tables.findIndex((t) => t.id === tableId);
      if (index >= 0) {
        tables[index] = {
          ...tables[index],
          status,
          currentOrderId: orderId,
        };
        saveTablesOffline(tables);
      }
    } catch (error) {
      console.warn("⚠️ Firebase error, queueing operation:", error);
      addToQueue({ type: "updateTableStatus", tableId, status, orderId });
      // Optimistic update
      const tables = loadTablesOffline();
      const index = tables.findIndex((t) => t.id === tableId);
      if (index >= 0) {
        tables[index] = {
          ...tables[index],
          status,
          currentOrderId: orderId,
        };
        saveTablesOffline(tables);
      }
    }
  } else {
    addToQueue({ type: "updateTableStatus", tableId, status, orderId });
    // Optimistic update
    const tables = loadTablesOffline();
    const index = tables.findIndex((t) => t.id === tableId);
    if (index >= 0) {
      tables[index] = {
        ...tables[index],
        status,
        currentOrderId: orderId,
      };
      saveTablesOffline(tables);
    }
  }
}

/**
 * Order getir (offline-aware)
 */
export async function getOrder(orderId: string): Promise<Order | null> {
  if (isOnline()) {
    try {
      const order = await firebaseGetOrder(orderId);
      if (order) {
        updateOrderOffline(order);
      }
      return order;
    } catch (error) {
      console.warn("⚠️ Firebase error, loading from offline storage:", error);
      // Offline storage'dan yükle
      return loadOrdersOffline().find((o) => o.id === orderId) || null;
    }
  } else {
    // Offline durumunda localStorage'dan yükle
    return loadOrdersOffline().find((o) => o.id === orderId) || null;
  }
}

/**
 * Orders getir (offline-aware)
 */
export async function getOrdersByCompany(
  companyId: string,
  options?: { branchId?: string }
): Promise<Order[]> {
  if (isOnline()) {
    try {
      const orders = await firebaseGetOrdersByCompany(companyId, options);
      saveOrdersOffline(orders);
      return orders;
    } catch (error) {
      console.warn("⚠️ Firebase error, loading from offline storage:", error);
      // Offline storage'dan yükle ve filtrele
      const allOrders = loadOrdersOffline();
      let filtered = allOrders.filter((o) => o.companyId === companyId);
      if (options?.branchId) {
        filtered = filtered.filter((o) => o.branchId === options.branchId);
      }
      return filtered;
    }
  } else {
    // Offline durumunda localStorage'dan yükle
    const allOrders = loadOrdersOffline();
    let filtered = allOrders.filter((o) => o.companyId === companyId);
    if (options?.branchId) {
      filtered = filtered.filter((o) => o.branchId === options.branchId);
    }
    return filtered;
  }
}

/**
 * Tables getir (offline-aware)
 */
export async function getTablesByCompany(
  companyId: string,
  branchId?: string
): Promise<Table[]> {
  if (isOnline()) {
    try {
      const tables = await firebaseGetTablesByCompany(companyId, branchId);
      saveTablesOffline(tables);
      return tables;
    } catch (error) {
      console.warn("⚠️ Firebase error, loading from offline storage:", error);
      // Offline storage'dan yükle ve filtrele
      const allTables = loadTablesOffline();
      let filtered = allTables.filter((t) => t.companyId === companyId);
      if (branchId) {
        filtered = filtered.filter((t) => t.branchId === branchId);
      }
      return filtered;
    }
  } else {
    // Offline durumunda localStorage'dan yükle
    const allTables = loadTablesOffline();
    let filtered = allTables.filter((t) => t.companyId === companyId);
    if (branchId) {
      filtered = filtered.filter((t) => t.branchId === branchId);
    }
    return filtered;
  }
}

/**
 * Table history ekle (offline-aware)
 */
export async function addTableHistory(
  companyId: string,
  tableId: string,
  tableNumber: string,
  action: any,
  description: string,
  details?: any,
  branchId?: string
): Promise<void> {
  const historyData = {
    companyId,
    tableId,
    tableNumber,
    action,
    description,
    details,
    branchId,
  };
  
  if (isOnline()) {
    try {
      await firebaseAddTableHistory(
        companyId,
        tableId,
        tableNumber,
        action,
        description,
        details,
        branchId
      );
    } catch (error) {
      console.warn("⚠️ Firebase error, queueing operation:", error);
      addToQueue({ type: "addTableHistory", tableId, history: historyData });
    }
  } else {
    addToQueue({ type: "addTableHistory", tableId, history: historyData });
  }
}

/**
 * Bill ekle (offline-aware)
 */
export async function addBill(bill: any): Promise<void> {
  if (isOnline()) {
    try {
      await firebaseAddBill(bill);
    } catch (error) {
      console.warn("⚠️ Firebase error, queueing operation:", error);
      addToQueue({ type: "addBill", bill });
    }
  } else {
    addToQueue({ type: "addBill", bill });
  }
}

/**
 * Courier assignment ekle (offline-aware)
 */
export async function addCourierAssignment(assignment: any): Promise<void> {
  if (isOnline()) {
    try {
      await firebaseAddCourierAssignment(assignment);
    } catch (error) {
      console.warn("⚠️ Firebase error, queueing operation:", error);
      addToQueue({ type: "addCourierAssignment", assignment });
    }
  } else {
    addToQueue({ type: "addCourierAssignment", assignment });
  }
}

