import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import {
  getTable,
  createDefaultTables,
} from "@/lib/firebase/tables";
// Offline-aware Firebase functions
import {
  getTablesByCompany,
  updateTableStatus,
  getOrdersByCompany,
  updateOrder,
  addOrder,
  updateOrderStatus,
  getOrder,
} from "@/lib/offline/offlineFirebase";
import type { Table, Order } from "@/lib/firebase/types";
import { customAlert } from "@/components/ui/alert-dialog";
import {
  Utensils,
  Clock,
  Loader2,
  ArrowLeft,
  WifiOff,
  Minimize2,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { HomePage } from "@/components/HomePage";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";

export const Route = createFileRoute("/")({
  component: Index,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      area: (search.area as string) || undefined,
      activeOnly: search.activeOnly === "true" || search.activeOnly === true,
    };
  },
});

function Index() {
  const { area, activeOnly } = Route.useSearch();

  // Eğer area parametresi varsa (boş string hariç) veya activeOnly true ise TablesView göster, yoksa HomePage göster
  // area="all" ise tüm masaları göster (area filtresi uygulanmaz)
  const showTablesView = area !== undefined || activeOnly === true;

  return (
    <ProtectedRoute requireAuth={true} requireCompanyAccess={true}>
      {showTablesView ? <TablesView /> : <HomePage />}
    </ProtectedRoute>
  );
}

// Masalar sayfası component'i
function TablesView() {
  const { userData, companyId, branchId, companyData, branchData } = useAuth();
  const { resolvedTheme } = useTheme();
  const navigate = useNavigate();
  const { isOnline } = useNetworkStatus();
  const { area, activeOnly } = Route.useSearch();
  const [tables, setTables] = useState<Table[]>([]);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  // area="all" ise boş string kullan (tüm masaları göster)
  const [selectedArea, setSelectedArea] = useState<string>(
    area === "all" ? "" : area || ""
  );
  const [showActiveOnly, setShowActiveOnly] = useState<boolean>(
    activeOnly || false
  );
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [defaultTablesCreated, setDefaultTablesCreated] = useState(false);

  // URL search params değiştiğinde state'i güncelle
  useEffect(() => {
    if (area !== undefined) {
      // area="all" ise boş string kullan
      setSelectedArea(area === "all" ? "" : area);
      setShowActiveOnly(false);
    }
    if (activeOnly !== undefined) {
      setShowActiveOnly(activeOnly);
      if (activeOnly) {
        setSelectedArea("");
      }
    }
  }, [area, activeOnly]);
  const [selectedTableForMove, setSelectedTableForMove] = useState<{
    table: Table;
    order: Order;
  } | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPressingRef = useRef<boolean>(false);
  const longPressCompletedRef = useRef<boolean>(false);
  const pressingTableIdRef = useRef<string | null>(null);
  const longPressEndTimeRef = useRef<number>(0);
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const [gridLayout, setGridLayout] = useState<{
    cardSize: number;
    cols: number;
    rows: number;
    gap: number;
  }>({ cardSize: 120, cols: 4, rows: 3, gap: 12 });
  const [_isMovingTable, setIsMovingTable] = useState(false);
  const [targetTableIdForMove, setTargetTableIdForMove] = useState<
    string | null
  >(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const loadData = async () => {
      const effectiveCompanyId = companyId || userData?.companyId;
      const effectiveBranchId = branchId || userData?.assignedBranchId;

      if (!effectiveCompanyId) {
        setLoading(false);
        return;
      }

      try {
        // Standart masaları arka planda oluştur (ilk yüklemede bloklamaz)
        if (!defaultTablesCreated) {
          setDefaultTablesCreated(true);
          createDefaultTables(effectiveCompanyId, effectiveBranchId ?? undefined).catch(() => {}).then(() => {});
        }

        const [tablesData, ordersData] = await Promise.all([
          getTablesByCompany(effectiveCompanyId, effectiveBranchId ?? undefined).catch(() => []),
          getOrdersByCompany(effectiveCompanyId, { branchId: effectiveBranchId ?? undefined }).catch(() => []),
        ]);

        const activeOrdersData = ordersData.filter(
          (order) => order.status === "active"
        );
        setActiveOrders(activeOrdersData);

        const tablesToUpdate: Promise<void>[] = [];
        tablesData.forEach((table) => {
          if (table.status === "occupied") {
            const hasActiveOrder = activeOrdersData.some(
              (order) => order.tableId === table.id && order.status === "active"
            );
            if (!hasActiveOrder) {
              tablesToUpdate.push(
                updateTableStatus(table.id!, "available", undefined).catch(
                  () => {}
                )
              );
            }
          }
        });

        // Önce masaları hemen göster (kullanıcı beklemez)
        const uniqueTables = removeDuplicateTables(tablesData);
        setTables(uniqueTables);

        // Masa durumu güncellemelerini arka planda yap, bittiğinde listeyi yenile
        if (tablesToUpdate.length > 0) {
          void Promise.all(tablesToUpdate)
            .then(() => getTablesByCompany(effectiveCompanyId, effectiveBranchId ?? undefined).catch(() => []))
            .then((updated) => setTables(removeDuplicateTables(updated)));
        }

        // Sadece ilk yüklemede ve URL'de area yoksa ve selectedArea boşsa otomatik alan seç
        if (
          isInitialLoad &&
          uniqueTables.length > 0 &&
          !selectedArea &&
          !area
        ) {
          const areas = Array.from(
            new Set(
              uniqueTables
                .map((t: Table) => t.area)
                .filter(
                  (area: string | undefined): area is string =>
                    area !== undefined && area.trim() !== ""
                )
            )
          ).sort();
          if (areas.length > 0) {
            setSelectedArea(areas[0] as string);
          }
          setIsInitialLoad(false);
        } else if (isInitialLoad) {
          setIsInitialLoad(false);
        }
      } catch {
        // Error handling - loading state already set in finally block
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [
    companyId,
    branchId,
    userData?.companyId,
    userData?.assignedBranchId,
    area,
    defaultTablesCreated,
    isInitialLoad,
    selectedArea,
  ]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      const effectiveCompanyId = companyId || userData?.companyId;
      const effectiveBranchId = branchId || userData?.assignedBranchId;

      if (!document.hidden && effectiveCompanyId) {
        const reloadData = async () => {
          try {
            const [tablesData, ordersData] = await Promise.all([
              getTablesByCompany(effectiveCompanyId, effectiveBranchId ?? undefined).catch(() => []),
              getOrdersByCompany(effectiveCompanyId, { branchId: effectiveBranchId ?? undefined }).catch(() => []),
            ]);

            const activeOrdersData = ordersData.filter(
              (order) => order.status === "active"
            );
            setActiveOrders(activeOrdersData);

            const tablesToUpdate: Promise<void>[] = [];
            tablesData.forEach((table) => {
              if (table.status === "occupied") {
                const hasActiveOrder = activeOrdersData.some(
                  (order) =>
                    order.tableId === table.id && order.status === "active"
                );
                if (!hasActiveOrder) {
                  tablesToUpdate.push(
                    updateTableStatus(table.id!, "available", undefined).catch(
                      () => {}
                    )
                  );
                }
              }
            });

            if (tablesToUpdate.length > 0) {
              await Promise.all(tablesToUpdate);
              const updatedTables = await getTablesByCompany(effectiveCompanyId, effectiveBranchId ?? undefined).catch(() => []);
              const uniqueTables = removeDuplicateTables(updatedTables);
              setTables(uniqueTables);
            } else {
              const uniqueTables = removeDuplicateTables(tablesData);
              setTables(uniqueTables);
            }
          } catch {
            // Error handling
          }
        };
        reloadData();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [userData]);

  const removeDuplicateTables = (tables: Table[]): Table[] => {
    if (!tables || tables.length === 0) return [];

    // Önce id bazlı duplicate kontrolü yap
    const idMap = new Map<string, Table>();
    tables.forEach((table) => {
      if (table.id) {
        const existing = idMap.get(table.id);
        if (!existing) {
          idMap.set(table.id, table);
        } else {
          // Aynı id'ye sahip masalar varsa, daha yeni olanı al
          const existingDate = existing.updatedAt || existing.createdAt;
          const currentDate = table.updatedAt || table.createdAt;
          if (currentDate > existingDate) {
            idMap.set(table.id, table);
          }
        }
      }
    });

    // Sonra area-tableNumber kombinasyonuna göre duplicate kontrolü yap
    const tableMap = new Map<string, Table>();
    Array.from(idMap.values()).forEach((table) => {
      // area ve tableNumber boş olabilir, bunları normalize et
      const normalizedArea = (table.area || "").trim();
      const normalizedTableNumber = (table.tableNumber || "").trim();
      const key = `${normalizedArea}-${normalizedTableNumber}`;

      const existing = tableMap.get(key);

      if (!existing) {
        tableMap.set(key, table);
      } else {
        // Aynı area-tableNumber kombinasyonuna sahip masalar varsa, daha yeni olanı al
        const existingDate = existing.updatedAt || existing.createdAt;
        const currentDate = table.updatedAt || table.createdAt;

        if (currentDate > existingDate) {
          tableMap.set(key, table);
        } else if (currentDate.getTime() === existingDate.getTime()) {
          // Aynı tarihse, id'si olanı tercih et
          if (table.id && !existing.id) {
            tableMap.set(key, table);
          }
        }
      }
    });

    return Array.from(tableMap.values());
  };

  const getTableOrder = (tableId: string) => {
    return activeOrders.find(
      (order) => order.tableId === tableId && order.status === "active"
    );
  };

  const handleLongPressStart = (table: Table, order: Order) => {
    if (!order || order.items.length === 0) return;

    isPressingRef.current = true;
    longPressCompletedRef.current = false;
    pressingTableIdRef.current = table.id!;
    longPressTimer.current = setTimeout(() => {
      if (isPressingRef.current && pressingTableIdRef.current === table.id!) {
        setSelectedTableForMove({ table, order });
        longPressCompletedRef.current = true;
      }
    }, 500);
  };

  const handleLongPressEnd = (tableId: string) => {
    // Timer'ı temizle
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    // Eğer long-press tamamlandıysa ve bu masa için yapıldıysa, seçimi koru
    if (
      longPressCompletedRef.current &&
      pressingTableIdRef.current === tableId
    ) {
      // Seçim kalmalı, sadece pressing state'i sıfırla
      // longPressCompletedRef'i true tut ki click handler bilsin
      isPressingRef.current = false;
      pressingTableIdRef.current = null;
      // Long-press bitiş zamanını kaydet (click'i engellemek için)
      longPressEndTimeRef.current = Date.now();
      // Seçimi koru - setSelectedTableForMove çağrılmayacak
      return;
    }

    // Long-press tamamlanmadıysa veya farklı bir masaysa, her şeyi temizle
    // Ama eğer masa zaten seçiliyse ve bu masa için değilse, seçimi koru
    if (selectedTableForMove && selectedTableForMove.table.id !== tableId) {
      // Farklı bir masa için release, seçimi koru
      isPressingRef.current = false;
      pressingTableIdRef.current = null;
      return;
    }

    // Long-press tamamlanmadıysa ve seçim yoksa, her şeyi temizle
    isPressingRef.current = false;
    pressingTableIdRef.current = null;
    longPressCompletedRef.current = false;
  };

  const handleMouseLeave = (tableId: string) => {
    // Eğer bu masa seçiliyse ve hala basılı tutuluyorsa, seçimi kaldır
    if (
      selectedTableForMove &&
      selectedTableForMove.table.id === tableId &&
      isPressingRef.current &&
      pressingTableIdRef.current === tableId
    ) {
      setSelectedTableForMove(null);
      isPressingRef.current = false;
      pressingTableIdRef.current = null;
      longPressCompletedRef.current = false;
    }
    // Timer'ı da temizle (eğer bu masa için timer çalışıyorsa)
    if (longPressTimer.current && pressingTableIdRef.current === tableId) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  // localStorage'dan ürünleri okuyup taşıma işlemini yap
  const handleMoveFromLocalStorage = async (targetTableId: string) => {
    const pendingMoveData = localStorage.getItem("pendingMoveItems");
    if (!pendingMoveData) return;

    try {
      const { sourceTableId, sourceOrderId, items, indices } = JSON.parse(pendingMoveData);
      if (!sourceTableId || !sourceOrderId || !items || items.length === 0) {
        localStorage.removeItem("pendingMoveItems");
        return;
      }

      setIsMovingTable(true);
      setTargetTableIdForMove(targetTableId);

      const targetTable = await getTable(targetTableId);
      if (!targetTable) {
        customAlert("Hedef masa bulunamadı", "Hata", "error");
        localStorage.removeItem("pendingMoveItems");
        setTargetTableIdForMove(null);
        setIsMovingTable(false);
        return;
      }

      const effectiveCompanyId = companyId || userData?.companyId;
      const effectiveBranchId = branchId || userData?.assignedBranchId;

      // Kaynak siparişi al
      const sourceOrder = await getOrder(sourceOrderId);
      if (!sourceOrder) {
        customAlert("Kaynak sipariş bulunamadı", "Hata", "error");
        localStorage.removeItem("pendingMoveItems");
        setTargetTableIdForMove(null);
        setIsMovingTable(false);
        return;
      }

      // Kaynak siparişten taşınacak ürünleri index'lere göre çıkar
      const indicesToRemove = new Set(indices || []);
      const remainingItems = sourceOrder.items.filter(
        (_, index) => !indicesToRemove.has(index)
      );

      // Kaynak siparişi güncelle
      if (remainingItems.length === 0) {
        // Tüm ürünler taşındıysa siparişi kapat
        await updateOrder(sourceOrderId, {
          items: [],
          subtotal: 0,
          total: 0,
        });
        await updateOrderStatus(sourceOrderId, "closed", { branchIdOverride: effectiveBranchId || undefined });
        const sourceTable = await getTable(sourceTableId);
        if (sourceTable) {
          await updateTableStatus(sourceTableId, "available", undefined);
        }
      } else {
        const subtotal = remainingItems.reduce((sum, item) => sum + item.subtotal, 0);
        const total = subtotal - (sourceOrder.discount || 0);
        await updateOrder(sourceOrderId, {
          items: remainingItems,
          subtotal: subtotal,
          total: total,
        });
      }

      // Hedef masada sipariş var mı kontrol et
      const allOrders = await getOrdersByCompany(effectiveCompanyId!, {
        branchId: effectiveBranchId || undefined,
      });
      const targetOrder = allOrders.find(
        (o) => o.tableId === targetTableId && o.status === "active"
      );

      if (targetOrder) {
        // Hedef masada sipariş varsa, ürünleri ekle
        const existingItems = targetOrder.items || [];
        const mergedItems = [...existingItems, ...items];
        const subtotal = mergedItems.reduce((sum, item) => sum + item.subtotal, 0);
        const total = subtotal - (targetOrder.discount || 0);

        await updateOrder(targetOrder.id!, {
          items: mergedItems,
          subtotal: subtotal,
          total: total,
        });
      } else {
        // Hedef masada sipariş yoksa, yeni sipariş oluştur
        await addOrder({
          companyId: effectiveCompanyId!,
          branchId: effectiveBranchId || targetTable.branchId,
          tableId: targetTableId,
          tableNumber: targetTable.tableNumber,
          items: items,
          discount: 0,
          sentItems: items.map((item: any) => item.menuId),
          createdBy: userData!.id!,
          status: "active",
          paymentStatus: "unpaid",
        });
        await updateTableStatus(targetTableId, "occupied", undefined);
      }

      // Masaları ve siparişleri yeniden yükle
      const [updatedTables, updatedOrders] = await Promise.all([
        getTablesByCompany(effectiveCompanyId!, effectiveBranchId ?? undefined).catch(() => []),
        getOrdersByCompany(effectiveCompanyId!, { branchId: effectiveBranchId ?? undefined }).catch(() => []),
      ]);

      const uniqueTables = removeDuplicateTables(updatedTables);
      setTables(uniqueTables);
      setActiveOrders(updatedOrders.filter((o) => o.status === "active"));

      // localStorage'ı temizle
      localStorage.removeItem("pendingMoveItems");

      // Hedef masaya yönlendir
      navigate({
        to: "/table/$tableId",
        params: { tableId: targetTableId },
        search: {
          area: area || undefined,
          activeOnly: activeOnly || false,
          payment: undefined,
        },
      });
    } catch (error) {
      console.error("Taşıma hatası:", error);
      customAlert("Ürünler taşınırken bir hata oluştu", "Hata", "error");
      localStorage.removeItem("pendingMoveItems");
    } finally {
      setTargetTableIdForMove(null);
      setIsMovingTable(false);
    }
  };

  const handleMoveAllItems = async (targetTableId: string) => {
    if (!selectedTableForMove) return;

    const { table: sourceTable, order: sourceOrder } = selectedTableForMove;

    // Aynı masaya taşıma yapılamaz
    if (sourceTable.id === targetTableId) {
      setSelectedTableForMove(null);
      return;
    }

    setIsMovingTable(true);
    setTargetTableIdForMove(targetTableId);
    try {
      const targetTable = await getTable(targetTableId);
      if (!targetTable) {
        customAlert("Hedef masa bulunamadı", "Hata", "error");
        setSelectedTableForMove(null);
        setTargetTableIdForMove(null);
        setIsMovingTable(false);
        return;
      }

      const effectiveCompanyId = companyId || userData?.companyId;
      const effectiveBranchId = branchId || userData?.assignedBranchId;

      const allOrders = await getOrdersByCompany(effectiveCompanyId!, {
        branchId: effectiveBranchId || undefined,
      });
      const targetOrder = allOrders.find(
        (o) => o.tableId === targetTableId && o.status === "active"
      );

      if (targetOrder) {
        const existingItems = targetOrder.items || [];
        const mergedItems = [...existingItems, ...sourceOrder.items];
        const subtotal = mergedItems.reduce(
          (sum, item) => sum + item.subtotal,
          0
        );
        const total = subtotal - (targetOrder.discount || 0);

        await updateOrder(targetOrder.id!, {
          items: mergedItems,
          subtotal: subtotal,
          total: total,
        });
      } else {
        await addOrder({
          companyId: effectiveCompanyId!,
          branchId: effectiveBranchId || targetTable.branchId,
          tableId: targetTableId,
          tableNumber: targetTable.tableNumber,
          items: sourceOrder.items,
          discount: sourceOrder.discount,
          sentItems:
            sourceOrder.sentItems ||
            sourceOrder.items.map((item) => item.menuId),
          createdBy: userData!.id!,
          status: "active",
          paymentStatus: "unpaid",
        });
      }

      await updateTableStatus(sourceTable.id!, "available", undefined);
      await updateOrderStatus(sourceOrder.id!, "closed", { branchIdOverride: effectiveBranchId || undefined });

      const [updatedTables, updatedOrders] = await Promise.all([
        getTablesByCompany(effectiveCompanyId!, effectiveBranchId ?? undefined).catch(() => []),
        getOrdersByCompany(effectiveCompanyId!, { branchId: effectiveBranchId ?? undefined }).catch(() => []),
      ]);

      // Yinelenen masaları filtrele (removeDuplicateTables fonksiyonunu kullan)
      const uniqueTables = removeDuplicateTables(updatedTables);

      setTables(uniqueTables);
      setActiveOrders(updatedOrders.filter((o) => o.status === "active"));

      setSelectedTableForMove(null);
      setTargetTableIdForMove(null);
    } catch {
      customAlert("Ürünler taşınırken bir hata oluştu", "Hata", "error");
      setTargetTableIdForMove(null);
    } finally {
      setIsMovingTable(false);
    }
  };

  // Masada en az bir ürün (iptal edilmemiş) varsa true
  const hasTableProducts = (order: Order | undefined) =>
    !!order?.items?.length &&
    order.items.some((item) => !item.canceledAt);

  const getBackgroundColor = (
    status: Table["status"],
    isDark: boolean,
    order: Order | undefined
  ) => {
    // Ürün olan masalar istisnasız yeşil
    if (hasTableProducts(order)) {
      return isDark ? "bg-green-600/60" : "bg-green-300";
    }
    if (isDark) {
      switch (status) {
        case "available":
          return "bg-red-600/60"; // Boş masalar daha açık kırmızı
        case "occupied":
          return "bg-green-600/60"; // Dolu masalar daha açık yeşil
        case "reserved":
          return "bg-yellow-900/20";
        case "cleaning":
          return "bg-orange-900/20";
        default:
          return "bg-gray-800";
      }
    } else {
      switch (status) {
        case "available":
          return "bg-red-300"; // Boş masalar daha açık kırmızı
        case "occupied":
          return "bg-green-300"; // Dolu masalar daha açık yeşil
        case "reserved":
          return "bg-yellow-50";
        case "cleaning":
          return "bg-orange-50";
        default:
          return "bg-white";
      }
    }
  };

  const getShadowEffect = (
    _status: Table["status"],
    order: Order | undefined
  ) => {
    if (hasTableProducts(order)) {
      return "shadow-lg"; // Daha belirgin gölge
    }
    return "shadow-sm";
  };

  // Otomatik güncelleme için timer
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Her 1 dakikada bir güncelle

    return () => clearInterval(interval);
  }, []);

  // ESC tuşuna basıldığında seçimi kaldır
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedTableForMove) {
        setSelectedTableForMove(null);
        longPressCompletedRef.current = false;
        isPressingRef.current = false;
        pressingTableIdRef.current = null;
        longPressEndTimeRef.current = 0;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedTableForMove]);

  const getTimeAgo = (date: Date | undefined): string => {
    if (!date) return "";
    const diff = currentTime.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return "Az önce";
    if (minutes < 60) return `${minutes} dakika önce`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} saat önce`;
    const days = Math.floor(hours / 24);
    return `${days} gün önce`;
  };

  // İlk eklenen ürünü bul (en eski addedAt değerine sahip)
  const getFirstAddedItem = (order: Order | undefined) => {
    if (!order || !order.items || order.items.length === 0) return null;

    // Tüm ürünler arasından en eski addedAt değerine sahip olanı bul
    return order.items.reduce((oldest, current) => {
      if (!oldest?.addedAt) return current;
      if (!current?.addedAt) return oldest;

      const oldestTime = new Date(oldest.addedAt).getTime();
      const currentTime = new Date(current.addedAt).getTime();

      return currentTime < oldestTime ? current : oldest;
    });
  };

  const areas = useMemo(
    () =>
      Array.from(
        new Set(
          tables
            .filter((t) => t.area !== "Cari")
            .map((t) => t.area)
            .filter((area): area is string =>
              Boolean(area && area.trim() !== "")
            )
        )
      ).sort(),
    [tables]
  );

  // Filtrelenmiş masaları memoize et - sadece tables, selectedArea, showActiveOnly veya activeOrders değiştiğinde yeniden hesapla
  const filteredTables = useMemo(() => {
    // Cari masaları filtrele (masalar sayfasında görünmesin)
    let filtered = tables.filter((t) => t.area !== "Cari");

    // Alan filtresi uygula
    if (selectedArea) {
      filtered = filtered.filter((t) => t.area === selectedArea);
    }

    if (showActiveOnly) {
      filtered = filtered.filter((table) => {
        return activeOrders.some(
          (order) =>
            order.tableId === table.id &&
            order.status === "active" &&
            order.items &&
            order.items.length > 0
        );
      });
    }

    return filtered;
  }, [tables, selectedArea, showActiveOnly, activeOrders]);

  // Grid: Tüm kartlar ekrana tam sığar — ne alta ne sağa taşma, scroll yok. Kolon sayısı ekrana göre.
  const GRID_PADDING = 24; // p-3
  const SAFETY = 4; // taşma/rounding için pay
  const updateGridLayout = useCallback(() => {
    const el = gridContainerRef.current;
    if (!el || filteredTables.length === 0) return;
    const width = Math.max(0, el.clientWidth - GRID_PADDING - SAFETY);
    const height = Math.max(0, el.clientHeight - GRID_PADDING - SAFETY);
    const gap = 12;
    const minCard = 56;
    const n = filteredTables.length;
    let best = { cardSize: minCard, cols: 1, rows: 1, gap };
    // Tüm satır sayılarını dene; kart boyutunu maksimize et, kolon sayısı sınırı yok (ekrana göre)
    for (let rows = 1; rows <= n; rows++) {
      const cols = Math.ceil(n / rows);
      const cardByWidth = (width - (cols - 1) * gap) / cols;
      const cardByHeight = (height - (rows - 1) * gap) / rows;
      const rawSize = Math.min(cardByWidth, cardByHeight);
      const cardSize = Math.floor(rawSize);
      if (cardSize >= minCard && cardSize > best.cardSize) {
        best = { cardSize, cols, rows, gap };
      }
    }
    if (best.cardSize === minCard && best.cols === 1 && best.rows === 1) {
      const cols = Math.max(1, Math.floor((width + gap) / (minCard + gap)));
      const rows = Math.max(1, Math.ceil(n / cols));
      const cardByWidth = (width - (cols - 1) * gap) / cols;
      const cardByHeight = (height - (rows - 1) * gap) / rows;
      best = {
        cardSize: Math.floor(Math.min(cardByWidth, cardByHeight)),
        cols,
        rows,
        gap,
      };
    }
    // Kesin sığdır: hem genişlik hem yükseklik taşmasın (tam sayı pixel)
    let cardSize = Math.max(minCard, Math.floor(best.cardSize));
    const totalW = best.cols * cardSize + (best.cols - 1) * best.gap;
    const totalH = best.rows * cardSize + (best.rows - 1) * best.gap;
    if (totalW > width && best.cols > 0) {
      cardSize = Math.min(cardSize, Math.floor((width - (best.cols - 1) * best.gap) / best.cols));
    }
    if (totalH > height && best.rows > 0) {
      cardSize = Math.min(cardSize, Math.floor((height - (best.rows - 1) * best.gap) / best.rows));
    }
    cardSize = Math.max(minCard, cardSize);
    setGridLayout({ ...best, cardSize });
  }, [filteredTables.length]);

  useEffect(() => {
    updateGridLayout();
    const el = gridContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(updateGridLayout);
    ro.observe(el);
    return () => ro.disconnect();
  }, [updateGridLayout]);

  const gridLayoutStyle = useMemo(
    () => ({
      gridTemplateColumns: `repeat(${gridLayout.cols}, 1fr)` as const,
      gridTemplateRows: `repeat(${gridLayout.rows}, 1fr)` as const,
      gap: `${gridLayout.gap}px`,
    }),
    [gridLayout.cols, gridLayout.rows, gridLayout.gap]
  );

  // Aktif masa sayısını tüm masalardan hesapla (sadece filtrelenmiş masalardan değil)
  // const activeTableCount = tables.filter((table) => {
  //   return activeOrders.some(
  //     (order) =>
  //       order.tableId === table.id &&
  //       order.status === "active" &&
  //       order.items &&
  //       order.items.length > 0
  //   );
  // }).length;


  return (
    <div className="h-[100dvh] bg-gray-50 dark:bg-gray-900 flex flex-col overflow-hidden">
      {/* Header - Anasayfadaki gibi 80px yükseklik */}
      <header className="h-[80px] shrink-0 px-6 flex items-center justify-between bg-black/20 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          {/* Geri Butonu */}
          <button
            onClick={() =>
              navigate({
                to: "/",
                search: { area: undefined, activeOnly: false },
              })
            }
            className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-white/10 transition-colors"
            title="Anasayfaya Dön"
          >
            <ArrowLeft className="h-5 w-5 text-white" />
          </button>

          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="Logo"
              className="h-10 w-10 object-contain"
            />
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-white">Borgeto POS</h1>
                <span className="text-white/80 font-normal text-sm">
                Masalar
                </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          {/* Internet Durumu - Sadece internet kesildiğinde göster */}
          {!isOnline && (
            <div className="flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-lg bg-red-500/90 backdrop-blur-sm">
              <WifiOff className="h-4 w-4 text-white shrink-0" />
              <span className="text-xs sm:text-sm text-white font-medium truncate max-w-[120px] sm:max-w-none">
                İnternet bağlantısı yok
              </span>
            </div>
          )}

          {/* Branch Info + Masaüstüne Dön */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="px-2 sm:px-3 py-1.5 rounded-lg bg-white/10 backdrop-blur-sm truncate max-w-[100px] sm:max-w-[180px]">
              <p className="text-sm text-white font-medium truncate">
                {userData?.branchName || branchData?.name || ""}
              </p>
            </div>
            <button
              onClick={async () => {
                if (window.electronAPI?.minimizeWindow) {
                  try {
                    await window.electronAPI.minimizeWindow();
                  } catch (error) {
                    console.error("Minimize error:", error);
                  }
                }
              }}
              className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-white/10 transition-colors shrink-0"
              title="Masaüstüne Dön"
            >
              <Minimize2 className="h-5 w-5 text-white" />
            </button>
          </div>
        </div>
      </header>

      {/* Ana içerik: üstte yatay filtreler, altta masa grid'i %100 alan, scroll yok */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        {/* Yatay filtre çubuğu - masa kartlarının üstünde */}
        <div className="shrink-0 px-3 pt-3 pb-2 flex flex-wrap items-center gap-2 bg-gray-900/30 dark:bg-black/20 border-b border-white/10">
          <button
            onClick={() => {
              setSelectedArea("");
              setShowActiveOnly(false);
              navigate({
                to: "/",
                search: { area: "all", activeOnly: false },
                replace: true,
              });
            }}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              !selectedArea && !showActiveOnly
                ? "bg-white/20 text-white shadow-md"
                : "bg-white/10 text-white/80 hover:bg-white/15"
            }`}
          >
            Tüm Masalar
          </button>
          {areas.length > 0 &&
            areas
              .filter((a) => a !== "Paket" && a !== "Hızlı Satış")
              .map((area) => (
                <button
                  key={area}
                  onClick={() => {
                    setSelectedArea(area);
                    setShowActiveOnly(false);
                    navigate({
                      to: "/",
                      search: { area, activeOnly: false },
                      replace: true,
                    });
                  }}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    selectedArea === area && !showActiveOnly
                      ? "bg-white/20 text-white shadow-md"
                      : "bg-white/10 text-white/80 hover:bg-white/15"
                  }`}
                >
                  {area}
                </button>
              ))}
          <button
            onClick={() => {
              setShowActiveOnly(true);
              setSelectedArea("");
              navigate({
                to: "/",
                search: { area: undefined, activeOnly: true },
                replace: true,
              });
            }}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              showActiveOnly
                ? "bg-white/20 text-white shadow-md"
                : "bg-white/10 text-white/80 hover:bg-white/15"
            }`}
          >
            Aktif Masalar
          </button>
          {areas.includes("Hızlı Satış") && (
            <button
              onClick={() => {
                setSelectedArea("Hızlı Satış");
                setShowActiveOnly(false);
                navigate({
                  to: "/",
                  search: { area: "Hızlı Satış", activeOnly: false },
                  replace: true,
                });
              }}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedArea === "Hızlı Satış" && !showActiveOnly
                  ? "bg-white/20 text-white shadow-md"
                  : "bg-white/10 text-white/80 hover:bg-white/15"
              }`}
            >
              Hızlı Satış
            </button>
          )}
          {areas.includes("Paket") && (
            <button
              onClick={() => {
                setSelectedArea("Paket");
                setShowActiveOnly(false);
                navigate({
                  to: "/",
                  search: { area: "Paket", activeOnly: false },
                  replace: true,
                });
              }}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedArea === "Paket" && !showActiveOnly
                  ? "bg-white/20 text-white shadow-md"
                  : "bg-white/10 text-white/80 hover:bg-white/15"
              }`}
            >
              Paket
            </button>
          )}
        </div>

        {/* Masa kartları grid'i - kalan alanın %100'ü, scroll yok */}
        <div
          ref={gridContainerRef}
          className="flex-1 min-w-0 min-h-0 overflow-hidden flex flex-col p-3"
        >
          {/* Masalar içeriği - yükleme sadece grid alanında, layout hep görünür */}
          {loading ? (
            <div className="flex-1 flex items-center justify-center min-h-0">
              <div className="text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-600 dark:border-blue-400 border-t-transparent mx-auto mb-3" />
                <p className="text-sm text-gray-600 dark:text-gray-400">Yükleniyor...</p>
              </div>
            </div>
          ) : filteredTables.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-8 sm:p-12 text-center shadow-sm border border-gray-200 dark:border-gray-700 mx-4 lg:mx-6">
              <Utensils className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {showActiveOnly
                  ? "Aktif masa yok"
                  : selectedArea
                    ? `${selectedArea} alanında masa yok`
                    : "Henüz masa eklenmemiş"}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {showActiveOnly
                  ? "Şu anda ürün girişi yapılmış aktif masa bulunmuyor"
                  : selectedArea
                    ? "Başka bir alan seçin veya ayarlar sayfasından masa ekleyin"
                    : "Ayarlar sayfasından masa ekleyebilirsiniz"}
              </p>
            </div>
          ) : (
            <div
              className="w-full h-full min-w-0 min-h-0 grid"
              style={gridLayoutStyle}
            >
              {filteredTables.map((table) => {
                const order = getTableOrder(table.id!);
                const isSelectedForMove =
                  selectedTableForMove?.table.id === table.id;
                const isTargetTableForMove = targetTableIdForMove === table.id;

                return (
                  <div
                    key={table.id}
                    onMouseDown={() =>
                      order &&
                      order.items.length > 0 &&
                      handleLongPressStart(table, order)
                    }
                    onMouseUp={() => handleLongPressEnd(table.id!)}
                    onMouseLeave={() => handleMouseLeave(table.id!)}
                    onTouchStart={() =>
                      order &&
                      order.items.length > 0 &&
                      handleLongPressStart(table, order)
                    }
                    onTouchEnd={() => handleLongPressEnd(table.id!)}
                    onTouchCancel={() => handleMouseLeave(table.id!)}
                    className="relative w-full h-full min-w-0 min-h-0 overflow-hidden"
                  >
                    <div
                      onClick={(e) => {
                        // Eğer long-press sonrası çok kısa süre geçtiyse (200ms), click'i yok say
                        // Bu, long-press release'den hemen sonra gelen click'i engeller
                        const timeSinceLongPressEnd =
                          Date.now() - longPressEndTimeRef.current;
                        if (
                          timeSinceLongPressEnd < 200 &&
                          longPressCompletedRef.current
                        ) {
                          e.preventDefault();
                          e.stopPropagation();
                          return;
                        }

                        // Eğer long-press tamamlandıysa ve bu masa seçiliyse, click'i engelle
                        // (Long-press sonrası release'de zaten seçim kalıyor, burada sadece engelliyoruz)
                        if (
                          longPressCompletedRef.current &&
                          selectedTableForMove &&
                          selectedTableForMove.table.id === table.id
                        ) {
                          e.preventDefault();
                          e.stopPropagation();
                          // Şimdi seçimi kaldır (kullanıcı aynı masaya tıkladı)
                          setSelectedTableForMove(null);
                          longPressCompletedRef.current = false;
                          return;
                        }

                        // Eğer bir masa seçiliyse ve tıklanan masa farklıysa taşıma yap
                        if (
                          selectedTableForMove &&
                          selectedTableForMove.table.id !== table.id
                        ) {
                          e.preventDefault();
                          e.stopPropagation();
                          longPressCompletedRef.current = false;
                          handleMoveAllItems(table.id!);
                        } else if (!selectedTableForMove) {
                          // localStorage'da taşınacak ürünler var mı kontrol et
                          const pendingMoveData = localStorage.getItem("pendingMoveItems");
                          if (pendingMoveData) {
                            e.preventDefault();
                            e.stopPropagation();
                            handleMoveFromLocalStorage(table.id!);
                            return;
                          }
                          // Normal tıklama - masa detayına git
                          navigate({
                            to: "/table/$tableId",
                            params: { tableId: table.id! },
                            search: {
                              area: area || undefined,
                              activeOnly: activeOnly || false,
                              payment: undefined,
                            },
                          });
                        } else {
                          // Aynı masaya tıklandı - seçimi kaldır
                          e.preventDefault();
                          e.stopPropagation();
                          setSelectedTableForMove(null);
                          longPressCompletedRef.current = false;
                        }
                      }}
                      className={`${
                        isSelectedForMove
                          ? "bg-blue-500 dark:bg-blue-600 border-blue-600 dark:border-blue-700 ring-2 ring-blue-300 dark:ring-blue-500"
                          : getBackgroundColor(
                              table.status,
                              resolvedTheme === "dark",
                              order
                            )
                      } ${getShadowEffect(table.status, order)} rounded-lg p-2 border-2 border-white hover:shadow-xl transition-all duration-200 cursor-pointer h-full w-full flex flex-col items-center justify-center overflow-hidden ${
                        isSelectedForMove
                          ? "animate-pulse"
                          : hasTableProducts(order)
                            ? "animate-pulse-subtle"
                            : ""
                      }`}
                    >
                      <div className="text-center space-y-1 xl:space-y-2">
                        <div
                          className={`text-sm sm:text-base font-bold leading-tight ${
                            isSelectedForMove || hasTableProducts(order)
                              ? "text-white"
                              : "text-gray-900 dark:text-white"
                          }`}
                        >
                          {table.tableNumber}
                        </div>

                        <div className="flex flex-col items-center gap-0.5">
                          <span
                            className={`text-xs font-medium ${
                              isSelectedForMove || hasTableProducts(order)
                                ? "text-white"
                                : "text-gray-700 dark:text-gray-300"
                            }`}
                          >
                            Toplam
                          </span>
                          <span
                            className={`text-xs sm:text-sm font-bold ${
                              isSelectedForMove
                                ? "text-white"
                                : hasTableProducts(order)
                                  ? "text-white"
                                  : "text-gray-400 dark:text-gray-500"
                            }`}
                          >
                            {order && order.total > 0
                              ? `₺${order.total.toFixed(2)}`
                              : "₺0.00"}
                          </span>
                        </div>

                        {(() => {
                          const firstItem = getFirstAddedItem(order);
                          return firstItem?.addedAt ? (
                            <div
                              className={`flex items-center justify-center gap-1 mt-0.5 text-[10px] sm:text-xs ${
                                isSelectedForMove || hasTableProducts(order)
                                  ? "text-white font-medium"
                                  : "text-gray-500 dark:text-gray-400"
                              }`}
                            >
                              <Clock className="w-3 h-3 shrink-0" />
                              <span className="truncate">
                                {getTimeAgo(firstItem.addedAt)}
                              </span>
                            </div>
                          ) : null;
                        })()}
                      </div>

                      {/* Loading overlay for target table during move */}
                      {isTargetTableForMove && (
                        <div className="absolute inset-0 bg-black/50 dark:bg-black/70 rounded-lg flex items-center justify-center z-10">
                          <Loader2 className="w-8 h-8 text-white animate-spin" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
