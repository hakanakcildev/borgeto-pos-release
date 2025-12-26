/**
 * Offline Sync Hook
 * Internet bağlandığında otomatik olarak pending işlemleri sync eder
 */

import { useEffect, useRef } from "react";
import { useNetworkStatus } from "./useNetworkStatus";
import { syncPendingOperations, onSyncComplete } from "@/lib/offline/syncManager";
import { useAuth } from "@/contexts/AuthContext";
import { getQueuedOperations } from "@/lib/offline/offlineQueue";

export function useOfflineSync() {
  const { isOnline, wasOffline } = useNetworkStatus();
  const { companyId, branchId, userData } = useAuth();
  const hasSyncedRef = useRef(false);
  const syncInProgressRef = useRef(false);

  useEffect(() => {
    const effectiveCompanyId = companyId || userData?.companyId;
    const effectiveBranchId = branchId || userData?.assignedBranchId;

    if (!effectiveCompanyId) return;

    // Internet bağlandığında sync yap
    if (isOnline && wasOffline && !hasSyncedRef.current && !syncInProgressRef.current) {
      const queue = getQueuedOperations();
      if (queue.length > 0) {
        syncInProgressRef.current = true;
        console.log("🔄 Internet bağlandı, sync başlatılıyor...");
        
        syncPendingOperations(effectiveCompanyId, effectiveBranchId)
          .then((result) => {
            if (result.success > 0) {
              console.log(`✅ ${result.success} işlem başarıyla sync edildi`);
            }
            if (result.failed > 0) {
              console.warn(`⚠️ ${result.failed} işlem sync edilemedi`);
            }
            hasSyncedRef.current = true;
            syncInProgressRef.current = false;
          })
          .catch((error) => {
            console.error("❌ Sync hatası:", error);
            syncInProgressRef.current = false;
          });
      } else {
        hasSyncedRef.current = true;
      }
    }

    // Internet kesildiğinde flag'i resetle
    if (!isOnline) {
      hasSyncedRef.current = false;
    }
  }, [isOnline, wasOffline, companyId, branchId, userData]);

  // Sync tamamlandığında callback
  useEffect(() => {
    const unsubscribe = onSyncComplete(() => {
      // Sync tamamlandığında sayfayı yenile (isteğe bağlı)
      // window.location.reload();
    });

    return unsubscribe;
  }, []);
}

