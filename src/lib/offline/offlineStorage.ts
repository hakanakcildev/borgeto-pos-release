/**
 * Offline Storage System
 * Internet kesildiğinde verileri localStorage'da saklar
 */

import type { Order, Table } from "@/lib/firebase/types";

const ORDERS_STORAGE_KEY = "offline_orders";
const TABLES_STORAGE_KEY = "offline_tables";
const LAST_SYNC_KEY = "last_sync_timestamp";

/**
 * Orders'ı localStorage'a kaydet
 */
export function saveOrdersOffline(orders: Order[]): void {
  try {
    localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
    console.log("💾 Orders saved offline:", orders.length);
  } catch (error) {
    console.error("Error saving orders offline:", error);
  }
}

/**
 * Orders'ı localStorage'dan yükle
 */
export function loadOrdersOffline(): Order[] {
  try {
    const stored = localStorage.getItem(ORDERS_STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (error) {
    console.error("Error loading orders offline:", error);
    return [];
  }
}

/**
 * Tables'ı localStorage'a kaydet
 */
export function saveTablesOffline(tables: Table[]): void {
  try {
    localStorage.setItem(TABLES_STORAGE_KEY, JSON.stringify(tables));
    console.log("💾 Tables saved offline:", tables.length);
  } catch (error) {
    console.error("Error saving tables offline:", error);
  }
}

/**
 * Tables'ı localStorage'dan yükle
 */
export function loadTablesOffline(): Table[] {
  try {
    const stored = localStorage.getItem(TABLES_STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (error) {
    console.error("Error loading tables offline:", error);
    return [];
  }
}

/**
 * Belirli bir order'ı localStorage'dan al
 */
export function getOrderOffline(orderId: string): Order | null {
  const orders = loadOrdersOffline();
  return orders.find((o) => o.id === orderId) || null;
}

/**
 * Belirli bir table'ı localStorage'dan al
 */
export function getTableOffline(tableId: string): Table | null {
  const tables = loadTablesOffline();
  return tables.find((t) => t.id === tableId) || null;
}

/**
 * Order'ı offline storage'da güncelle
 */
export function updateOrderOffline(order: Order): void {
  const orders = loadOrdersOffline();
  const index = orders.findIndex((o) => o.id === order.id);
  if (index >= 0) {
    orders[index] = order;
  } else {
    orders.push(order);
  }
  saveOrdersOffline(orders);
}

/**
 * Table'ı offline storage'da güncelle
 */
export function updateTableOffline(table: Table): void {
  const tables = loadTablesOffline();
  const index = tables.findIndex((t) => t.id === table.id);
  if (index >= 0) {
    tables[index] = table;
  } else {
    tables.push(table);
  }
  saveTablesOffline(tables);
}

/**
 * Son sync zamanını kaydet
 */
export function setLastSyncTime(): void {
  try {
    localStorage.setItem(LAST_SYNC_KEY, Date.now().toString());
  } catch (error) {
    console.error("Error saving last sync time:", error);
  }
}

/**
 * Son sync zamanını al
 */
export function getLastSyncTime(): number | null {
  try {
    const stored = localStorage.getItem(LAST_SYNC_KEY);
    return stored ? parseInt(stored, 10) : null;
  } catch (error) {
    console.error("Error reading last sync time:", error);
    return null;
  }
}

/**
 * Offline storage'ı temizle
 */
export function clearOfflineStorage(): void {
  localStorage.removeItem(ORDERS_STORAGE_KEY);
  localStorage.removeItem(TABLES_STORAGE_KEY);
  localStorage.removeItem(LAST_SYNC_KEY);
  console.log("🧹 Offline storage cleared");
}

