/**
 * Offline Queue System
 * Internet kesildiğinde Firebase işlemlerini queue'ya alır
 * Internet bağlandığında sırayla Firebase'e gönderir
 */

export type QueueOperation =
  | { type: "addOrder"; data: any; orderId?: string }
  | { type: "updateOrder"; orderId: string; data: any }
  | { type: "addPayment"; orderId: string; payment: any }
  | { type: "updateOrderStatus"; orderId: string; status: string }
  | { type: "updateTableStatus"; tableId: string; status: string; orderId?: string }
  | { type: "addTableHistory"; tableId: string; history: { companyId: string; tableId: string; tableNumber: string; action: any; description: string; details?: any; branchId?: string } }
  | { type: "addBill"; bill: any }
  | { type: "addCourierAssignment"; assignment: any };

export interface QueuedOperation {
  id: string;
  operation: QueueOperation;
  timestamp: number;
  retryCount: number;
  error?: string;
}

const QUEUE_STORAGE_KEY = "offline_queue";
const MAX_RETRY_COUNT = 3;

/**
 * Queue'dan tüm pending işlemleri al
 */
export function getQueuedOperations(): QueuedOperation[] {
  try {
    const stored = localStorage.getItem(QUEUE_STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (error) {
    console.error("Error reading queue:", error);
    return [];
  }
}

/**
 * Queue'ya yeni işlem ekle
 */
export function addToQueue(operation: QueueOperation): string {
  const queue = getQueuedOperations();
  const id = `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const queuedOp: QueuedOperation = {
    id,
    operation,
    timestamp: Date.now(),
    retryCount: 0,
  };

  queue.push(queuedOp);
  saveQueue(queue);
  
  console.log("📦 Operation queued:", operation.type, id);
  return id;
}

/**
 * Queue'dan işlem kaldır (başarılı olduğunda)
 */
export function removeFromQueue(operationId: string): void {
  const queue = getQueuedOperations();
  const filtered = queue.filter((op) => op.id !== operationId);
  saveQueue(filtered);
  console.log("✅ Operation removed from queue:", operationId);
}

/**
 * Queue'yu kaydet
 */
function saveQueue(queue: QueuedOperation[]): void {
  try {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch (error) {
    console.error("Error saving queue:", error);
  }
}

/**
 * Queue'daki işlemin retry count'unu artır
 */
export function incrementRetryCount(operationId: string, error?: string): void {
  const queue = getQueuedOperations();
  const op = queue.find((o) => o.id === operationId);
  if (op) {
    op.retryCount += 1;
    if (error) {
      op.error = error;
    }
    saveQueue(queue);
  }
}

/**
 * Max retry sayısını aşan işlemleri temizle
 */
export function cleanFailedOperations(): QueuedOperation[] {
  const queue = getQueuedOperations();
  const failed = queue.filter((op) => op.retryCount >= MAX_RETRY_COUNT);
  const remaining = queue.filter((op) => op.retryCount < MAX_RETRY_COUNT);
  saveQueue(remaining);
  
  if (failed.length > 0) {
    console.warn("⚠️ Failed operations removed:", failed.length);
  }
  
  return failed;
}

/**
 * Queue'yu temizle
 */
export function clearQueue(): void {
  localStorage.removeItem(QUEUE_STORAGE_KEY);
  console.log("🧹 Queue cleared");
}

