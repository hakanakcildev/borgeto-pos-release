import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
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
} from "@/lib/firebase/orders";
import type { Table, Order } from "@/lib/firebase/types";
import { Button } from "@/components/ui/button";
import { customAlert } from "@/components/ui/alert-dialog";
import { Utensils, Clock, X, Loader2 } from "lucide-react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { signOutUser } from "@/lib/firebase/auth";
import {
  Home,
  LogOut,
  Menu,
  Settings,
  BarChart3,
  Utensils as UtensilsIcon,
  CreditCard,
  Phone,
  History,
  Table as TableIcon,
  Printer,
  Bike,
  Package,
  User,
  Users,
  Calendar,
} from "lucide-react";
import { useCallback } from "react";

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
  return (
    <ProtectedRoute requireAuth={true} requireCompanyAccess={true}>
      <POSLayoutWithTables />
    </ProtectedRoute>
  );
}

// POS Layout component'ini buraya taşıdık
function POSLayoutWithTables() {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const [currentPath, setCurrentPath] = useState(location.pathname);

  useEffect(() => {
    setCurrentPath(location.pathname);
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const handleLogout = useCallback(async () => {
    try {
      // Local storage'ı temizle
      localStorage.removeItem("posAuth");

      // Storage event tetikle
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "posAuth",
          newValue: null,
        })
      );

      // Firebase'den çıkış yap
      await signOutUser();

      // Login sayfasına yönlendir
      navigate({ to: "/auth/login", replace: true });
    } catch (error) {
      // Hata olsa bile temizle ve yönlendir
      localStorage.removeItem("posAuth");
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "posAuth",
          newValue: null,
        })
      );
      navigate({ to: "/auth/login", replace: true });
    }
  }, [navigate]);

  const menuItems = [
    { title: "Masalar", icon: Home, href: "/" },
    { title: "Masa Yönetimi", icon: TableIcon, href: "/tables" },
    { title: "Cari Masaları", icon: User, href: "/customer-tables" },
    { title: "Ürün Yönetimi", icon: UtensilsIcon, href: "/menus" },
    { title: "Stok Yönetimi", icon: Package, href: "/stocks" },
    {
      title: "Ödeme Yöntemleri",
      icon: CreditCard,
      href: "/payment-methods",
    },
    { title: "Kullanıcılar", icon: Users, href: "/users" },
    { title: "Vardiya Kontrol", icon: Calendar, href: "/shifts" },
    { title: "İstatistikler", icon: BarChart3, href: "/statistics" },
    { title: "Masa Geçmişi", icon: History, href: "/table-history" },
    { title: "Kurye Yönetimi", icon: Bike, href: "/couriers" },
    { title: "Yazıcı Ayarları", icon: Printer, href: "/printers" },
    { title: "Destek", icon: Phone, href: "/support" },
    { title: "Ayarlar", icon: Settings, href: "/settings" },
  ];

  const getIsActive = useCallback(
    (href: string) => {
      if (href === "/") {
        return currentPath === "/";
      }
      if (href === "/settings") {
        return (
          currentPath === "/settings" || currentPath.startsWith("/settings/")
        );
      }
      if (href === "/tables") {
        return currentPath === "/tables" || currentPath.startsWith("/tables/");
      }
      if (href === "/customer-tables") {
        return (
          currentPath === "/customer-tables" ||
          currentPath.startsWith("/customer-tables/")
        );
      }
      if (href === "/payment-methods") {
        return (
          currentPath === "/payment-methods" ||
          currentPath.startsWith("/payment-methods/")
        );
      }
      if (href === "/users") {
        return currentPath === "/users" || currentPath.startsWith("/users/");
      }
      if (href === "/support") {
        return (
          currentPath === "/support" || currentPath.startsWith("/support/")
        );
      }
      if (href === "/menus") {
        return currentPath === "/menus" || currentPath.startsWith("/menus/");
      }
      if (href === "/stocks") {
        return currentPath === "/stocks" || currentPath.startsWith("/stocks/");
      }
      if (href === "/statistics") {
        return (
          currentPath === "/statistics" ||
          currentPath.startsWith("/statistics/")
        );
      }
      if (href === "/shifts") {
        return currentPath === "/shifts" || currentPath.startsWith("/shifts/");
      }
      return currentPath === href || currentPath === href + "/";
    },
    [currentPath]
  );

  return (
    <div className="h-[100dvh] flex w-full bg-gray-50 dark:bg-gray-900 overflow-hidden">
      {/* Sidebar - Collapsed/Expanded */}
      <div
        className={`fixed lg:relative top-0 left-0 h-[100dvh] bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex-col z-50 transition-all duration-300 ease-in-out flex-shrink-0 ${
          isSidebarExpanded ? "w-64 xl:w-72" : "w-16 xl:w-24"
        } ${isSidebarExpanded ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        <div className="h-full flex flex-col shadow-lg overflow-hidden">
          {/* Menü Aç/Kapa Butonu - Menü Öğelerinin Üstünde */}
          <div
            className={`flex-shrink-0 transition-all duration-300 ${
              isSidebarExpanded
                ? "px-3 xl:px-6 pt-4 xl:pt-6 pb-2"
                : "px-2 xl:px-3 pt-3 xl:pt-4 pb-2"
            }`}
          >
            <button
              onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
              className={`w-full flex items-center transition-all duration-200 h-10 xl:h-[44px] ${
                isSidebarExpanded
                  ? "gap-2 xl:gap-4 px-3 xl:px-4 text-xs xl:text-sm rounded-xl"
                  : "justify-center px-2 rounded-lg"
              } text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white`}
              title={!isSidebarExpanded ? "Menü" : undefined}
            >
              {isSidebarExpanded ? (
                <X className="h-4 w-4 xl:h-5 xl:w-5 flex-shrink-0 text-gray-500 dark:text-gray-400" />
              ) : (
                <Menu className="h-4 w-4 xl:h-5 xl:w-5 flex-shrink-0 text-gray-500 dark:text-gray-400" />
              )}
              {isSidebarExpanded && (
                <span className="font-medium text-xs xl:text-sm">
                  Menüyü Kapat
                </span>
              )}
            </button>
          </div>
          {/* Menü Öğeleri - Scroll Edilebilir */}
          <div
            className={`flex-1 overflow-y-auto overflow-x-hidden min-h-0 flex flex-col gap-1 ${
              isSidebarExpanded ? "px-3 xl:px-6" : "px-2 xl:px-3"
            }`}
          >
            {menuItems.map((item, index) => {
              const isActive = getIsActive(item.href);
              return (
                <Link
                  key={index}
                  to={item.href as any}
                  onClick={() => {
                    setIsSidebarExpanded(false);
                  }}
                  className={`flex items-center transition-all duration-200 flex-shrink-0 ${
                    isSidebarExpanded
                      ? "gap-2 xl:gap-4 px-3 xl:px-4 py-2 xl:py-2.5 text-xs xl:text-sm rounded-xl"
                      : "justify-center px-2 py-2 xl:py-2.5 rounded-lg"
                  } ${
                    isActive
                      ? isSidebarExpanded
                        ? "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 border-r-4 border-blue-600 dark:border-blue-400 shadow-sm"
                        : "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white"
                  }`}
                  title={!isSidebarExpanded ? item.title : undefined}
                >
                  <item.icon
                    className={`h-4 w-4 xl:h-5 xl:w-5 flex-shrink-0 ${
                      isActive
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-gray-500 dark:text-gray-400"
                    }`}
                  />
                  {isSidebarExpanded && (
                    <span
                      className={`${isActive ? "font-semibold" : "font-medium"} text-xs xl:text-sm`}
                    >
                      {item.title}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
          {/* Logout Butonu */}
          <div
            className={`border-t border-gray-200 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-800 transition-all duration-300 flex-shrink-0 ${
              isSidebarExpanded
                ? "px-3 xl:px-6 py-4 xl:py-6"
                : "px-2 xl:px-3 py-3 xl:py-4"
            }`}
          >
            {isSidebarExpanded ? (
              <button
                onClick={() => {
                  setIsSidebarExpanded(false);
                  handleLogout();
                }}
                className="w-full py-2 xl:py-3 rounded-xl border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-xs xl:text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center justify-center"
              >
                <LogOut className="h-3 w-3 xl:h-4 xl:w-4 mr-1.5 xl:mr-2" />
                Çıkış Yap
              </button>
            ) : (
              <button
                onClick={() => {
                  setIsSidebarExpanded(false);
                  handleLogout();
                }}
                className="w-full p-2 xl:p-3 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200 flex items-center justify-center"
                title="Çıkış Yap"
              >
                <LogOut className="h-4 w-4 xl:h-5 xl:w-5 text-gray-600 dark:text-gray-300" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto h-full">
          <TablesView />
        </div>
      </main>
    </div>
  );
}

// Masalar sayfası component'i
function TablesView() {
  const { userData, companyId, branchId } = useAuth();
  const { resolvedTheme } = useTheme();
  const navigate = useNavigate();
  const { area, activeOnly } = Route.useSearch();
  const [tables, setTables] = useState<Table[]>([]);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedArea, setSelectedArea] = useState<string>(area || "");
  const [showActiveOnly, setShowActiveOnly] = useState<boolean>(
    activeOnly || false
  );

  // URL search params değiştiğinde state'i güncelle
  useEffect(() => {
    if (area !== undefined) {
      setSelectedArea(area);
      setShowActiveOnly(false);
    }
    if (activeOnly !== undefined) {
      setShowActiveOnly(activeOnly);
      if (activeOnly) {
        setSelectedArea("");
      }
    }
  }, [area, activeOnly]);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [sourceTable, setSourceTable] = useState<Table | null>(null);
  const [sourceOrder, setSourceOrder] = useState<Order | null>(null);
  const [moveModalArea, setMoveModalArea] = useState<string>("");
  const [availableTablesForMove, setAvailableTablesForMove] = useState<Table[]>(
    []
  );
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isMovingTable, setIsMovingTable] = useState(false);
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
        // Standart masaları oluştur (yoksa)
        await createDefaultTables(
          effectiveCompanyId,
          effectiveBranchId || undefined
        ).catch(() => {
          // Hata olsa bile devam et
        });

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

        if (tablesData.length > 0 && !selectedArea) {
          const areas = Array.from(
            new Set(
              tablesData
                .map((t) => t.area)
                .filter((area) => area && area.trim() !== "")
            )
          ).sort();
          if (areas.length > 0) {
            setSelectedArea(areas[0]);
          }
        }
      } catch (error) {
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
              setTables(updatedTables);
            } else {
              setTables(tablesData);
            }
          } catch (error) {}
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
    const tableMap = new Map<string, Table>();

    tables.forEach((table) => {
      const key = `${table.area}-${table.tableNumber}`;
      const existing = tableMap.get(key);

      if (!existing) {
        tableMap.set(key, table);
      } else {
        const existingDate = existing.updatedAt || existing.createdAt;
        const currentDate = table.updatedAt || table.createdAt;

        if (currentDate > existingDate) {
          tableMap.set(key, table);
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

    longPressTimer.current = setTimeout(() => {
      setSourceTable(table);
      setSourceOrder(order);
      setShowMoveModal(true);
    }, 500);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleMoveAllItems = async (targetTableId: string) => {
    if (!sourceTable || !sourceOrder) return;

    setIsMovingTable(true);
    try {
      const targetTable = await getTable(targetTableId);
      if (!targetTable) {
        customAlert("Hedef masa bulunamadı", "Hata", "error");
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
      setTables(updatedTables);
      setActiveOrders(updatedOrders.filter((o) => o.status === "active"));

      setShowMoveModal(false);
      setSourceTable(null);
      setSourceOrder(null);
      setMoveModalArea("");
    } catch (error) {
      customAlert("Ürünler taşınırken bir hata oluştu", "Hata", "error");
    } finally {
      setIsMovingTable(false);
    }
  };

  useEffect(() => {
    const effectiveCompanyId = companyId || userData?.companyId;
    const effectiveBranchId = branchId || userData?.assignedBranchId;

    if (showMoveModal && effectiveCompanyId) {
      const loadTables = async () => {
        try {
          const tablesData = await getTablesByCompany(
            effectiveCompanyId,
            effectiveBranchId || undefined
          );
          const filteredTables = tablesData.filter(
            (t) => t.id !== sourceTable?.id
          );
          setAvailableTablesForMove(filteredTables);
          if (filteredTables.length > 0 && !moveModalArea) {
            const firstArea = filteredTables[0].area;
            setMoveModalArea(firstArea);
          }
        } catch (error) {}
      };
      loadTables();
    } else {
      setAvailableTablesForMove([]);
    }
  }, [showMoveModal, userData, sourceTable]);

  const getBackgroundColor = (status: Table["status"], isDark: boolean) => {
    if (isDark) {
      switch (status) {
        case "available":
          return "bg-red-900/40"; // Boş masalar kırmızı
        case "occupied":
          return "bg-green-900/40"; // Dolu masalar yeşil
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
          return "bg-red-100"; // Boş masalar kırmızı
        case "occupied":
          return "bg-green-100"; // Dolu masalar yeşil
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
      tables.map((t) => t.area).filter((area) => area && area.trim() !== "")
    )
  ).sort();

  let filteredTables = selectedArea
    ? tables.filter((t) => t.area === selectedArea)
    : tables;

  if (showActiveOnly) {
    filteredTables = filteredTables.filter((table) => {
      return activeOrders.some(
        (order) =>
          order.tableId === table.id &&
          order.status === "active" &&
          order.items &&
          order.items.length > 0
      );
    });
  }

  // Aktif masa sayısını tüm masalardan hesapla (sadece filtrelenmiş masalardan değil)
  const activeTableCount = tables.filter((table) => {
    return activeOrders.some(
      (order) =>
        order.tableId === table.id &&
        order.status === "active" &&
        order.items &&
        order.items.length > 0
    );
  }).length;

  // Ekran boyutunu algıla ve optimal grid yapısını hesapla
  // Hook'lar her zaman return'den önce çağrılmalı!
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const gridContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateSize = () => {
      if (gridContainerRef.current) {
        const rect = gridContainerRef.current.getBoundingClientRect();
        setContainerSize({ width: rect.width, height: rect.height });
      }
    };

    // İlk yüklemede hesapla
    const timeoutId = setTimeout(updateSize, 100);

    window.addEventListener("resize", updateSize);
    // ResizeObserver kullanarak daha hassas takip
    const resizeObserver = new ResizeObserver(updateSize);
    if (gridContainerRef.current) {
      resizeObserver.observe(gridContainerRef.current);
    }

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("resize", updateSize);
      resizeObserver.disconnect();
    };
  }, [filteredTables.length, showActiveOnly, selectedArea]);

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

  // Ekran boyutuna ve masa sayısına göre optimal grid yapısını hesapla
  const calculateOptimalGrid = (
    tableCount: number,
    width: number,
    height: number
  ) => {
    if (tableCount === 0 || width === 0 || height === 0)
      return { cols: 2, gap: 12 };

    // Padding için alan hesapla
    const paddingX = 32; // px-4 lg:px-6 için (16px * 2)
    const paddingY = 16; // pb-4 için
    const availableWidth = width - paddingX;
    const availableHeight = height - paddingY;

    // Gap değeri (12px)
    const gap = 12;

    // Farklı kolon sayılarını dene ve en iyisini bul
    let bestCols = 2;
    let bestFit = Infinity;

    for (let cols = 2; cols <= 12; cols++) {
      const rows = Math.ceil(tableCount / cols);

      // Her kartın boyutunu hesapla
      const cardWidth = (availableWidth - (cols - 1) * gap) / cols;
      const cardHeight = (availableHeight - (rows - 1) * gap) / rows;

      // Minimum kart boyutu (çok küçük olmasın)
      const minCardSize = 100;

      // Kare olması için en küçük boyutu kullan, ama minimum boyuttan küçük olmasın
      const cardSize = Math.max(Math.min(cardWidth, cardHeight), minCardSize);

      // Tüm kartların sığması için gerekli alan
      const requiredWidth = cols * cardSize + (cols - 1) * gap;
      const requiredHeight = rows * cardSize + (rows - 1) * gap;

      // Eğer sığıyorsa ve daha iyi bir fit ise
      if (
        requiredWidth <= availableWidth &&
        requiredHeight <= availableHeight &&
        cardSize >= minCardSize
      ) {
        const unusedSpace =
          availableWidth - requiredWidth + (availableHeight - requiredHeight);
        if (unusedSpace < bestFit) {
          bestFit = unusedSpace;
          bestCols = cols;
        }
      }
    }

    // Eğer hiçbir kolon sayısı sığmıyorsa, en az satır sayısına sahip olanı seç
    if (bestFit === Infinity) {
      let minRows = Infinity;
      for (let cols = 2; cols <= 12; cols++) {
        const rows = Math.ceil(tableCount / cols);
        if (rows < minRows) {
          minRows = rows;
          bestCols = cols;
        }
      }
    }

    return { cols: bestCols, gap };
  };

  const { cols: optimalColumns, gap } = calculateOptimalGrid(
    filteredTables.length,
    containerSize.width,
    containerSize.height
  );

  return (
    <div className="h-full bg-gray-50 dark:bg-gray-900 flex flex-col overflow-hidden">
      <div className="mb-3 xl:mb-4 px-3 xl:px-4 lg:px-6 pt-2 xl:pt-3 lg:pt-4 flex-shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 xl:gap-4">
          <div>
            <h1 className="text-xl xl:text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              Masalar
            </h1>
            <p className="text-xs xl:text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-0.5 xl:mt-1">
              {filteredTables.length} masa • {activeTableCount} aktif masa
            </p>
          </div>

          <div className="flex gap-1.5 xl:gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => {
                setSelectedArea("");
                setShowActiveOnly(false);
                navigate({
                  to: "/",
                  search: { area: undefined, activeOnly: false },
                  replace: true,
                });
              }}
              className={`px-3 xl:px-4 py-1.5 xl:py-2 rounded-lg text-xs xl:text-sm font-medium whitespace-nowrap transition-all ${
                !selectedArea && !showActiveOnly
                  ? "bg-blue-600 text-white shadow-md"
                  : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700"
              }`}
            >
              Tüm Masalar ({tables.length})
            </button>

            {areas.length > 0 &&
              areas
                .filter((area) => area !== "Paket" && area !== "Hızlı Satış")
                .map((area) => {
                  const areaTables = tables.filter((t) => t.area === area);
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
                      className={`px-3 xl:px-4 py-1.5 xl:py-2 rounded-lg text-xs xl:text-sm font-medium whitespace-nowrap transition-all ${
                        selectedArea === area && !showActiveOnly
                          ? "bg-blue-600 text-white shadow-md"
                          : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700"
                      }`}
                    >
                      {area} ({areaTables.length})
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
              className={`px-3 xl:px-4 py-1.5 xl:py-2 rounded-lg text-xs xl:text-sm font-medium whitespace-nowrap transition-all ${
                showActiveOnly
                  ? "bg-green-600 text-white shadow-md"
                  : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700"
              }`}
            >
              Aktif Masalar ({activeTableCount})
            </button>

            {areas.includes("Hızlı Satış") &&
              (() => {
                const hizliSatisTables = tables.filter(
                  (t) => t.area === "Hızlı Satış"
                );
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
                    className={`px-3 xl:px-4 py-1.5 xl:py-2 rounded-lg text-xs xl:text-sm font-medium whitespace-nowrap transition-all ${
                      selectedArea === "Hızlı Satış" && !showActiveOnly
                        ? "bg-blue-600 text-white shadow-md"
                        : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700"
                    }`}
                  >
                    Hızlı Satış ({hizliSatisTables.length})
                  </button>
                );
              })()}

            {areas.includes("Paket") &&
              (() => {
                const paketTables = tables.filter((t) => t.area === "Paket");
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
                    className={`px-3 xl:px-4 py-1.5 xl:py-2 rounded-lg text-xs xl:text-sm font-medium whitespace-nowrap transition-all ${
                      selectedArea === "Paket" && !showActiveOnly
                        ? "bg-blue-600 text-white shadow-md"
                        : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700"
                    }`}
                  >
                    Paket ({paketTables.length})
                  </button>
                );
              })()}
          </div>
        </div>
      </div>

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
          className="flex-1 px-4 lg:px-6 pb-4 min-h-0 overflow-y-auto"
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${optimalColumns}, minmax(0, 1fr))`,
            gap: `${gap}px`,
            alignContent: "start",
          }}
        >
          {filteredTables.map((table) => {
            const order = getTableOrder(table.id!);

            return (
              <div
                key={table.id}
                onMouseDown={() =>
                  order &&
                  order.items.length > 0 &&
                  handleLongPressStart(table, order)
                }
                onMouseUp={handleLongPressEnd}
                onMouseLeave={handleLongPressEnd}
                onTouchStart={() =>
                  order &&
                  order.items.length > 0 &&
                  handleLongPressStart(table, order)
                }
                onTouchEnd={handleLongPressEnd}
                className="relative w-full"
                style={{
                  aspectRatio: "1",
                  minHeight: "100px",
                  maxHeight: "100%",
                }}
              >
                <Link
                  to="/table/$tableId"
                  params={{ tableId: table.id! }}
                  search={(prev) => ({
                    area: prev?.area || undefined,
                    activeOnly: prev?.activeOnly || false,
                  })}
                  className={`${getBackgroundColor(table.status, resolvedTheme === "dark")} ${getShadowEffect(table.status, order)} rounded-lg p-2 xl:p-3 border border-white hover:shadow-xl transition-all duration-200 cursor-pointer block h-full w-full flex flex-col items-center justify-center ${
                    table.status === "occupied" && order && order.total > 0
                      ? "animate-pulse-subtle"
                      : ""
                  }`}
                >
                  <div className="text-center space-y-1 xl:space-y-2">
                    <div
                      className={`text-lg xl:text-xl sm:text-2xl font-bold ${
                        table.status === "occupied" && order && order.total > 0
                          ? "text-white"
                          : "text-gray-900 dark:text-white"
                      }`}
                    >
                      {table.tableNumber}
                    </div>

                    <div className="flex flex-col items-center gap-0.5 xl:gap-1">
                      <span
                        className={`text-[10px] xl:text-xs font-medium ${
                          table.status === "occupied" &&
                          order &&
                          order.total > 0
                            ? "text-white"
                            : "text-gray-700 dark:text-gray-300"
                        }`}
                      >
                        Toplam
                      </span>
                      <span
                        className={`text-xs xl:text-sm sm:text-base font-bold ${
                          order && order.total > 0
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
                            table.status === "occupied" &&
                            order &&
                            order.total > 0
                              ? "text-white font-medium"
                              : "text-gray-500 dark:text-gray-400"
                          }`}
                        >
                          <Clock
                            className={`h-2.5 w-2.5 xl:h-3 xl:w-3 ${
                              table.status === "occupied" &&
                              order &&
                              order.total > 0
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
                </Link>
              </div>
            );
          })}
        </div>
      )}

      {showMoveModal &&
        sourceTable &&
        sourceOrder &&
        (() => {
          const areas = Array.from(
            new Set(availableTablesForMove.map((t) => t.area).filter(Boolean))
          ).sort();
          const tablesByArea = availableTablesForMove.filter(
            (t) => t.area === moveModalArea
          );

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  {isMovingTable && (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  )}
                  Masa Taşı
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  <strong>{sourceTable.tableNumber}</strong> masasındaki tüm
                  ürünler ({sourceOrder.items.length} ürün) taşınacak. Hangi
                  masaya taşımak istersiniz?
                </p>

                <div className="flex-1 flex flex-col min-h-0">
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Alan Seçin
                    </label>
                    <div className="flex gap-2 flex-wrap">
                      {areas.map((area) => (
                        <Button
                          key={area}
                          type="button"
                          variant={
                            moveModalArea === area ? "default" : "outline"
                          }
                          onClick={() => setMoveModalArea(area)}
                          className={`${
                            moveModalArea === area
                              ? "bg-blue-600 text-white hover:bg-blue-700"
                              : "bg-white hover:bg-gray-50"
                          }`}
                        >
                          {area}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Masa Seçin
                    </label>
                    {tablesByArea.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
                        Bu alanda başka masa bulunamadı
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {tablesByArea.map((table) => (
                          <button
                            key={table.id}
                            onClick={() => handleMoveAllItems(table.id!)}
                            disabled={isMovingTable}
                            className="text-left bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <div className="flex flex-col">
                              <div className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                                {table.tableNumber}
                              </div>
                              <div
                                className={`text-xs px-2 py-1 rounded inline-block w-fit ${
                                  table.status === "available"
                                    ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
                                    : table.status === "occupied"
                                      ? "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300"
                                      : "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300"
                                }`}
                              >
                                {table.status === "available"
                                  ? "Müsait"
                                  : table.status === "occupied"
                                    ? "Dolu"
                                    : table.status === "reserved"
                                      ? "Rezerve"
                                      : "Temizlik"}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 mt-4 pt-4 border-t border-gray-200">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowMoveModal(false);
                      setSourceTable(null);
                      setSourceOrder(null);
                      setMoveModalArea("");
                    }}
                    className="flex-1"
                  >
                    <X className="h-4 w-4 mr-2" />
                    İptal
                  </Button>
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
}
