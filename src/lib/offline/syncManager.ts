/**
 * Sync Manager
 * Internet bağlandığında pending işlemleri Firebase'e gönderir
 */

import {
  getQueuedOperations,
  removeFromQueue,
  incrementRetryCount,
  cleanFailedOperations,
  type QueueOperation,
} from "./offlineQueue";
import {
  saveOrdersOffline,
  loadOrdersOffline,
  saveTablesOffline,
  loadTablesOffline,
  setLastSyncTime,
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
import { addTableHistory as firebaseAddTableHistory, type TableHistoryAction } from "@/lib/firebase/tableHistory";
import { addBill as firebaseAddBill } from "@/lib/firebase/bills";
import { addCourierAssignment as firebaseAddCourierAssignment } from "@/lib/firebase/couriers";
import type { Order, Table } from "@/lib/firebase/types";

let isSyncing = false;
let syncListeners: Array<() => void> = [];

/**
 * Sync işlemini başlat
 */
export async function syncPendingOperations(
  companyId: string,
  branchId?: string
): Promise<{ success: number; failed: number }> {
  if (isSyncing) {
    console.log("⏳ Sync already in progress");
    return { success: 0, failed: 0 };
  }

  isSyncing = true;
  const queue = getQueuedOperations();
  
  if (queue.length === 0) {
    isSyncing = false;
    return { success: 0, failed: 0 };
  }

  console.log(`🔄 Syncing ${queue.length} pending operations...`);

  let successCount = 0;
  let failedCount = 0;

  // Başarısız işlemleri temizle
  cleanFailedOperations();

  // Queue'daki işlemleri sırayla işle
  for (const queuedOp of queue) {
    try {
      await processOperation(queuedOp.operation, companyId, branchId);
      removeFromQueue(queuedOp.id);
      successCount++;
      console.log(`✅ Synced operation: ${queuedOp.operation.type}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      incrementRetryCount(queuedOp.id, errorMessage);
      failedCount++;
      console.error(`❌ Failed to sync operation: ${queuedOp.operation.type}`, error);
    }
  }

  // Sync tamamlandıktan sonra verileri yeniden yükle
  if (successCount > 0) {
    try {
      await refreshOfflineData(companyId, branchId);
      setLastSyncTime();
      notifySyncComplete();
    } catch (error) {
      console.error("Error refreshing offline data:", error);
    }
  }

  isSyncing = false;
  console.log(`✅ Sync complete: ${successCount} success, ${failedCount} failed`);
  
  return { success: successCount, failed: failedCount };
}

/**
 * Tek bir işlemi işle
 */
async function processOperation(
  operation: QueueOperation,
  companyId: string,
  branchId?: string
): Promise<void> {
  switch (operation.type) {
    case "addOrder":
      const orderId = await firebaseAddOrder(operation.data);
      // Order'ı offline storage'da güncelle
      const newOrder = await firebaseGetOrder(orderId);
      if (newOrder) {
        const orders = loadOrdersOffline();
        orders.push(newOrder);
        saveOrdersOffline(orders);
      }
      break;

    case "updateOrder":
      await firebaseUpdateOrder(operation.orderId, operation.data);
      // Order'ı offline storage'da güncelle
      const updatedOrder = await firebaseGetOrder(operation.orderId);
      if (updatedOrder) {
        const orders = loadOrdersOffline();
        const index = orders.findIndex((o) => o.id === operation.orderId);
        if (index >= 0) {
          orders[index] = updatedOrder;
          saveOrdersOffline(orders);
        }
      }
      break;

    case "addPayment":
      await firebaseAddPayment(operation.orderId, operation.payment);
      // Order'ı yeniden yükle ve offline storage'da güncelle
      const orderWithPayment = await firebaseGetOrder(operation.orderId);
      if (orderWithPayment) {
        const orders = loadOrdersOffline();
        const index = orders.findIndex((o) => o.id === operation.orderId);
        if (index >= 0) {
          orders[index] = orderWithPayment;
          saveOrdersOffline(orders);
        }
      }
      break;

    case "updateOrderStatus":
      await firebaseUpdateOrderStatus(operation.orderId, operation.status as any);
      // Order'ı offline storage'da güncelle
      const statusOrder = await firebaseGetOrder(operation.orderId);
      if (statusOrder) {
        const orders = loadOrdersOffline();
        const index = orders.findIndex((o) => o.id === operation.orderId);
        if (index >= 0) {
          orders[index] = statusOrder;
          saveOrdersOffline(orders);
        }
      }
      break;

    case "updateTableStatus":
      await firebaseUpdateTableStatus(
        operation.tableId,
        operation.status as any,
        operation.orderId
      );
      // Table'ı offline storage'da güncelle
      const tables = loadTablesOffline();
      const tableIndex = tables.findIndex((t) => t.id === operation.tableId);
      if (tableIndex >= 0) {
        tables[tableIndex] = {
          ...tables[tableIndex],
          status: operation.status as any,
          currentOrderId: operation.orderId,
        };
        saveTablesOffline(tables);
      }
      break;

    case "addTableHistory": {
      const history = operation.history;
      await firebaseAddTableHistory(
        history.companyId,
        operation.tableId,
        history.tableNumber,
        history.action as TableHistoryAction,
        history.description,
        history.details,
        history.branchId
      );
      break;
    }

    case "addBill":
      await firebaseAddBill(operation.bill);
      break;

    case "addCourierAssignment":
      await firebaseAddCourierAssignment(operation.assignment);
      break;

    default:
      throw new Error(`Unknown operation type: ${(operation as any).type}`);
  }
}

/**
 * Offline verileri yeniden yükle
 */
async function refreshOfflineData(
  companyId: string,
  branchId?: string
): Promise<void> {
  try {
    const [orders, tables] = await Promise.all([
      getOrdersByCompany(companyId, { branchId }),
      getTablesByCompany(companyId, branchId),
    ]);

    saveOrdersOffline(orders);
    saveTablesOffline(tables);
    console.log("✅ Offline data refreshed");
  } catch (error) {
    console.error("Error refreshing offline data:", error);
    throw error;
  }
}

/**
 * Sync tamamlandığında listener'ları bilgilendir
 */
function notifySyncComplete(): void {
  syncListeners.forEach((listener) => listener());
}

/**
 * Sync tamamlandığında çağrılacak listener ekle
 */
export function onSyncComplete(listener: () => void): () => void {
  syncListeners.push(listener);
  return () => {
    syncListeners = syncListeners.filter((l) => l !== listener);
  };
}

/**
 * Sync durumunu kontrol et
 */
export function isSyncingNow(): boolean {
  return isSyncing;
}

