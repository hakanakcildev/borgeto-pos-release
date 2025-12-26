import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import {
  getTablesByCompany,
  updateTableStatus,
  getTable,
  createDefaultTables,
} from "@/lib/firebase/tables";
import {
  getOrdersByCompany,
  updateOrder,
  addOrder,
  updateOrderStatus,
  getOrder,
} from "@/lib/firebase/orders";
import type { Table, Order } from "@/lib/firebase/types";
import { customAlert } from "@/components/ui/alert-dialog";
import {
  Utensils,
  Clock,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { HomePage } from "@/components/HomePage";

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

// Ekran boyutuna ve masa sayısına göre optimal grid yapısını hesapla
const calculateOptimalGrid = (
  tableCount: number,
  width: number,
  height: number
) => {
  if (tableCount === 0 || width === 0 || height === 0)
    return { cols: 2, gap: 12, cardSize: 100 };

  // Padding için alan hesapla
  const paddingX = 32; // px-4 lg:px-6 için (16px * 2)
  const paddingY = 48; // py-6 için (24px * 2)
  const availableWidth = width - paddingX;
  const availableHeight = height - paddingY;

  // Gap değeri (12px)
  const gap = 12;

  // Minimum kart boyutu (çok küçük olmasın)
  const minCardSize = 80;

  // Farklı kolon sayılarını dene ve en iyisini bul
  let bestCols = 2;
  let bestCardSize = minCardSize;
  let bestFit = Infinity;

  for (let cols = 2; cols <= 20; cols++) {
    const rows = Math.ceil(tableCount / cols);

    // Her kartın boyutunu hesapla (kare olması için)
    const cardWidth = (availableWidth - (cols - 1) * gap) / cols;
    const cardHeight = (availableHeight - (rows - 1) * gap) / rows;

    // Kare olması için en küçük boyutu kullan
    const cardSize = Math.min(cardWidth, cardHeight);

    // Minimum boyuttan küçük olmamalı
    if (cardSize < minCardSize) continue;

    // Tüm kartların sığması için gerekli alan
    const requiredWidth = cols * cardSize + (cols - 1) * gap;
    const requiredHeight = rows * cardSize + (rows - 1) * gap;

    // Eğer sığıyorsa ve daha iyi bir fit ise
    if (requiredWidth <= availableWidth && requiredHeight <= availableHeight) {
      const unusedSpace =
        availableWidth - requiredWidth + (availableHeight - requiredHeight);
      if (unusedSpace < bestFit) {
        bestFit = unusedSpace;
        bestCols = cols;
        bestCardSize = cardSize;
      }
    }
  }

  // Eğer hiçbir kolon sayısı sığmıyorsa, en az satır sayısına sahip olanı seç
  if (bestFit === Infinity) {
    let minRows = Infinity;
    for (let cols = 2; cols <= 20; cols++) {
      const rows = Math.ceil(tableCount / cols);
      if (rows < minRows) {
        minRows = rows;
        bestCols = cols;
        const cardWidth = (availableWidth - (cols - 1) * gap) / cols;
        const cardHeight = (availableHeight - (rows - 1) * gap) / rows;
        bestCardSize = Math.max(Math.min(cardWidth, cardHeight), minCardSize);
      }
    }
  }

  return { cols: bestCols, gap, cardSize: bestCardSize };
};

// Masalar sayfası component'i
function TablesView() {
  const { userData, companyId, branchId, companyData, branchData } = useAuth();
  const { resolvedTheme } = useTheme();
  const navigate = useNavigate();
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
        // Standart masaları oluştur (sadece ilk yüklemede)
        if (!defaultTablesCreated) {
          await createDefaultTables(
            effectiveCompanyId,
            effectiveBranchId || undefined
          ).catch(() => {
            // Hata olsa bile devam et
          });
          setDefaultTablesCreated(true);
        }

        const [tablesData, ordersData] = await Promise.all([
          getTablesByCompany(
            effectiveCompanyId,
            effectiveBranchId || undefined
          ).catch(() => {
            return [];
          }),
          getOrdersByCompany(effectiveCompanyId, {
            branchId: effectiveBranchId || undefined,
          }).catch(() => {
            return [];
          }),
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

        let uniqueTables: Table[];
        if (tablesToUpdate.length > 0) {
          await Promise.all(tablesToUpdate);
          const updatedTables = await getTablesByCompany(
            effectiveCompanyId,
            effectiveBranchId || undefined
          );
          uniqueTables = removeDuplicateTables(updatedTables);
          setTables(uniqueTables);
        } else {
          uniqueTables = removeDuplicateTables(tablesData);
          setTables(uniqueTables);
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
              getTablesByCompany(
                effectiveCompanyId,
                effectiveBranchId || undefined
              ).catch(() => {
                return [];
              }),
              getOrdersByCompany(effectiveCompanyId, {
                branchId: effectiveBranchId || undefined,
              }).catch(() => {
                return [];
              }),
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
              const updatedTables = await getTablesByCompany(
                effectiveCompanyId,
                effectiveBranchId || undefined
              );
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
        await updateOrderStatus(sourceOrderId, "closed");
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
        getTablesByCompany(effectiveCompanyId!, effectiveBranchId || undefined),
        getOrdersByCompany(effectiveCompanyId!, {
          branchId: effectiveBranchId || undefined,
        }),
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
      await updateOrderStatus(sourceOrder.id!, "closed");

      const [updatedTables, updatedOrders] = await Promise.all([
        getTablesByCompany(effectiveCompanyId!, effectiveBranchId || undefined),
        getOrdersByCompany(effectiveCompanyId!, {
          branchId: effectiveBranchId || undefined,
        }),
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

  const getBackgroundColor = (status: Table["status"], isDark: boolean) => {
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
    status: Table["status"],
    order: Order | undefined
  ) => {
    if (status === "occupied" && order && order.total > 0) {
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

  const areas = Array.from(
    new Set(
      tables
        .filter((t) => t.area !== "Cari") // Cari masaları filtrele
        .map((t) => t.area)
        .filter((area) => area && area.trim() !== "")
    )
  ).sort();

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

  // Ekran boyutunu algıla ve optimal grid yapısını hesapla
  // Hook'lar her zaman return'den önce çağrılmalı!
  const [containerSize, setContainerSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const previousGridConfigRef = useRef<{
    cols: number;
    gap: number;
    cardSize: number;
  } | null>(null);

  useEffect(() => {
    const updateSize = () => {
      // Header yüksekliğini ve sidebar genişliğini hesaba kat
      const headerHeight = 80;
      const sidebarWidth = 192; // w-48 = 12rem = 192px
      const paddingX = 32; // px-4 lg:px-6 için
      const paddingY = 48; // py-6 için (24px * 2)

      const availableHeight = window.innerHeight - headerHeight - paddingY;
      const availableWidth = window.innerWidth - sidebarWidth - paddingX;

      setContainerSize({ width: availableWidth, height: availableHeight });
    };

    // İlk yüklemede hesapla
    updateSize();
    const timeoutId = setTimeout(updateSize, 100);

    // Sadece window resize olduğunda güncelle
    window.addEventListener("resize", updateSize);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("resize", updateSize);
    };
  }, []); // Boş dependency array - sadece mount ve unmount'ta çalışır

  // Grid hesaplamasını memoize et - sadece TOPLAM masa sayısı veya container boyutu değiştiğinde yeniden hesapla
  // NOT: Filtreleme sadece görünümü etkiler, grid boyutlarını etkilememelidir
  // NOT: Bu hook loading check'inden önce olmalı (React Hooks kuralları)
  const {
    cols: optimalColumns,
    gap,
    cardSize,
  } = useMemo(() => {
    // Eğer containerSize henüz hesaplanmadıysa, önceki değeri kullan
    if (
      !containerSize ||
      containerSize.width === 0 ||
      containerSize.height === 0
    ) {
      if (previousGridConfigRef.current) {
        return previousGridConfigRef.current;
      }
      // İlk render için default değerler
      return { cols: 2, gap: 12, cardSize: 100 };
    }

    // Grid hesaplaması için TOPLAM masa sayısını kullan (filtrelenmiş değil)
    // Bu sayede filtreleme değiştiğinde grid boyutları değişmez
    const totalTableCount = tables.length;

    const result = calculateOptimalGrid(
      totalTableCount,
      containerSize.width,
      containerSize.height
    );

    // Önceki değeri güncelle
    previousGridConfigRef.current = result;
    return result;
  }, [tables.length, containerSize]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Yükleniyor...</p>
        </div>
      </div>
    );
  }

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
              src="/images/borgeto-logo.png"
              alt="Logo"
              className="h-10 w-10 object-contain"
            />
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-white">Borgeto Pos</h1>
              {companyData?.name && (
                <span className="text-white/80 font-normal text-sm">
                  {companyData.name}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Branch Info */}
          <div className="flex items-center gap-3">
            <div className="px-3 py-1.5 rounded-lg bg-white/10 backdrop-blur-sm">
              <p className="text-sm text-white font-medium">
                {userData?.branchName || branchData?.name || ""}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Ana içerik alanı - Sidebar ile birlikte */}
      <div className="flex-1 flex overflow-hidden">
        {/* Ana içerik */}
        <div className="flex-1 overflow-y-auto">
          {/* Masalar içeriği */}
          {filteredTables.length === 0 ? (
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
              ref={gridContainerRef}
              className="flex-1 px-4 lg:px-6 py-6 min-h-0 overflow-hidden flex items-center justify-center"
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${optimalColumns}, ${cardSize}px)`,
                gap: `${gap}px`,
                alignContent: "center",
                justifyContent: "center",
                maxHeight: containerSize ? `${containerSize.height}px` : "100%",
              }}
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
                    className="relative w-full"
                    style={{
                      width: `${cardSize}px`,
                      height: `${cardSize}px`,
                    }}
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
                          ? "bg-blue-500 dark:bg-blue-600 border-blue-600 dark:border-blue-700 ring-4 ring-blue-300 dark:ring-blue-500"
                          : getBackgroundColor(
                              table.status,
                              resolvedTheme === "dark"
                            )
                      } ${getShadowEffect(table.status, order)} rounded-lg p-2 xl:p-3 border-2 ${
                        isSelectedForMove
                          ? "border-blue-600 dark:border-blue-700"
                          : "border-white"
                      } hover:shadow-xl transition-all duration-200 cursor-pointer block h-full w-full flex flex-col items-center justify-center ${
                        isSelectedForMove
                          ? "animate-pulse"
                          : table.status === "occupied" &&
                              order &&
                              order.total > 0
                            ? "animate-pulse-subtle"
                            : ""
                      }`}
                    >
                      <div className="text-center space-y-1 xl:space-y-2">
                        <div
                          className={`text-lg xl:text-xl sm:text-2xl font-bold ${
                            isSelectedForMove ||
                            (table.status === "occupied" &&
                              order &&
                              order.total > 0)
                              ? "text-white"
                              : "text-gray-900 dark:text-white"
                          }`}
                        >
                          {table.tableNumber}
                        </div>

                        <div className="flex flex-col items-center gap-0.5 xl:gap-1">
                          <span
                            className={`text-[10px] xl:text-xs font-medium ${
                              isSelectedForMove ||
                              (table.status === "occupied" &&
                                order &&
                                order.total > 0)
                                ? "text-white"
                                : "text-gray-700 dark:text-gray-300"
                            }`}
                          >
                            Toplam
                          </span>
                          <span
                            className={`text-xs xl:text-sm sm:text-base font-bold ${
                              isSelectedForMove
                                ? "text-white text-base xl:text-lg sm:text-xl"
                                : order && order.total > 0
                                  ? table.status === "occupied"
                                    ? "text-white text-base xl:text-lg sm:text-xl"
                                    : "text-blue-600 dark:text-blue-400"
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
                              className={`flex items-center justify-center gap-1 text-[10px] xl:text-xs mt-0.5 xl:mt-1 ${
                                isSelectedForMove ||
                                (table.status === "occupied" &&
                                  order &&
                                  order.total > 0)
                                  ? "text-white font-medium"
                                  : "text-gray-500 dark:text-gray-400"
                              }`}
                            >
                              <Clock
                                className={`h-2.5 w-2.5 xl:h-3 xl:w-3 ${
                                  isSelectedForMove ||
                                  (table.status === "occupied" &&
                                    order &&
                                    order.total > 0)
                                    ? "text-white"
                                    : ""
                                }`}
                              />
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

        {/* Sağ Sidebar - Filtre Butonları */}
        <aside className="w-48 shrink-0 bg-black/20 backdrop-blur-sm overflow-y-auto">
          <div className="p-3 pt-4">
            <div className="flex flex-col gap-2">
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
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all text-left ${
                  !selectedArea && !showActiveOnly
                    ? "bg-white/20 text-white shadow-md"
                    : "bg-white/10 text-white/80 hover:bg-white/15"
                }`}
              >
                Tüm Masalar
              </button>

              {areas.length > 0 &&
                areas
                  .filter((area) => area !== "Paket" && area !== "Hızlı Satış")
                  .map((area) => {
                    return (
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
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all text-left ${
                          selectedArea === area && !showActiveOnly
                            ? "bg-white/20 text-white shadow-md"
                            : "bg-white/10 text-white/80 hover:bg-white/15"
                        }`}
                      >
                        {area}
                      </button>
                    );
                  })}

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
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all text-left ${
                  showActiveOnly
                    ? "bg-white/20 text-white shadow-md"
                    : "bg-white/10 text-white/80 hover:bg-white/15"
                }`}
              >
                Aktif Masalar
              </button>

              {areas.includes("Hızlı Satış") &&
                (() => {
                  return (
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
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all text-left ${
                        selectedArea === "Hızlı Satış" && !showActiveOnly
                          ? "bg-white/20 text-white shadow-md"
                          : "bg-white/10 text-white/80 hover:bg-white/15"
                      }`}
                    >
                      Hızlı Satış
                    </button>
                  );
                })()}

              {areas.includes("Paket") &&
                (() => {
                  return (
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
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all text-left ${
                        selectedArea === "Paket" && !showActiveOnly
                          ? "bg-white/20 text-white shadow-md"
                          : "bg-white/10 text-white/80 hover:bg-white/15"
                      }`}
                    >
                      Paket
                    </button>
                  );
                })()}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
