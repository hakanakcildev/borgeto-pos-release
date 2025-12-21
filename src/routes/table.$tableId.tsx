import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getTable,
  updateTableStatus,
  getTablesByCompany,
  addTable,
} from "@/lib/firebase/tables";
import {
  getOrder,
  addOrder,
  updateOrder,
  addPayment,
  updateOrderStatus,
  getOrdersByCompany,
} from "@/lib/firebase/orders";
import {
  getAllMenusByCompany,
  getAllCategoriesByCompany,
} from "@/lib/firebase/menus";
import {
  getPaymentMethodsByCompany,
  createDefaultPaymentMethods,
} from "@/lib/firebase/paymentMethods";
import { addTableHistory } from "@/lib/firebase/tableHistory";
import {
  getCouriersByCompany,
  addCourierAssignment,
} from "@/lib/firebase/couriers";
import { addBill } from "@/lib/firebase/bills";
import {
  getCustomersByCompany,
  addCustomer,
  getCustomer,
  updateCustomer,
} from "@/lib/firebase/customers";
import type { Courier, CustomerAccount } from "@/lib/firebase/types";
import {
  formatPrintContent,
  printToPrinter,
  getPrintersForCategories,
  getDefaultPrinter,
} from "@/lib/print";
import { customAlert } from "@/components/ui/alert-dialog";
import type {
  Table,
  Order,
  OrderItem,
  Menu,
  Category,
  Payment,
  PaymentMethodConfig,
  SelectedExtra,
} from "@/lib/firebase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTouchKeyboard } from "@/contexts/TouchKeyboardContext";
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  Minus,
  Trash2,
  Send,
  ShoppingCart,
  X,
  CreditCard,
  Check,
  CheckCircle,
  Clock,
  Loader2,
  Utensils,
  Delete,
} from "lucide-react";
import { POSLayout } from "@/components/layouts/POSLayout";

export const Route = createFileRoute("/table/$tableId")({
  component: TableDetail,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      area: (search.area as string) || undefined,
      activeOnly: search.activeOnly === "true" || search.activeOnly === true,
      payment: (search.payment as string) || undefined,
    };
  },
  loader: async ({ params }) => {
    try {
      const table = await getTable(params.tableId);
      if (!table) {
        // Masa bulunamazsa ana sayfaya yönlendir (hata verme)
        // Bu, ödeme işleminden sonra yönlendirme yapılırken route loader'ın çalışması durumunda olabilir
        throw new Error("Table not found");
      }
      return { table };
    } catch (error) {
      console.error("Masa yüklenirken hata:", error);
      // Eğer masa bulunamazsa, ana sayfaya yönlendir
      // Bu, ödeme işleminden sonra yönlendirme yapılırken route loader'ın çalışması durumunda olabilir
      throw new Error("Table not found");
    }
  },
});

function TableDetail() {
  const { tableId } = Route.useParams();
  const search = Route.useSearch();

  return (
    <POSLayout
      backTo={{
        path: "/",
        search: {
          area: search.area,
          activeOnly: search.activeOnly,
        },
      }}
    >
      <TableDetailContent />
    </POSLayout>
  );
}

function TableDetailContent() {
  const { table } = Route.useLoaderData();
  const { tableId } = Route.useParams();
  const navigate = useNavigate();
  const { userData, companyId, branchId, currentUser, companyData } = useAuth();
  const [currentTable, setCurrentTable] = useState<Table>(table);

  // Anasayfaya yönlendirirken search params'ı koru
  const search = Route.useSearch();
  const navigateToHome = useCallback(() => {
    // Eğer cari masasıysa, cari masalar sayfasına dön
    if (currentTable.area === "Cari") {
      navigate({
        to: "/customer-tables",
      });
    } else {
      navigate({
        to: "/",
        search: {
          area: search.area,
          activeOnly: search.activeOnly,
        },
      });
    }
  }, [navigate, search, currentTable]);

  // Zaman farkını hesapla ve "X dakika önce" formatında göster
  const _getTimeAgo = useCallback((date: Date | undefined): string => {
    if (!date) return "";
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return "Az önce";
    if (minutes < 60) return `${minutes} dakika önce`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} saat önce`;
    const days = Math.floor(hours / 24);
    return `${days} gün önce`;
  }, []);
  const [order, setOrder] = useState<Order | null>(null);
  const [isRefreshingOrder, setIsRefreshingOrder] = useState(false);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null
  );
  const [selectedCategoryName, setSelectedCategoryName] = useState<
    string | null
  >(null);
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState("");
  const [showCart, setShowCart] = useState(false);

  // Miktar girme modalı için state'ler
  const [_showQuantityModal, setShowQuantityModal] = useState(false);
  const [selectedMenuForQuantity, setSelectedMenuForQuantity] =
    useState<Menu | null>(null);
  const [quantityInput, setQuantityInput] = useState("");
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ekstra malzeme seçimi için state'ler
  const [_showExtraModal, setShowExtraModal] = useState(false);
  const [selectedMenuForExtra, setSelectedMenuForExtra] = useState<Menu | null>(
    null
  );
  const [selectedExtras, setSelectedExtras] = useState<Set<string>>(new Set());

  // Sipariş yönetimi state'leri
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [_showFullScreenPayment, setShowFullScreenPayment] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [_showCancelItemModal, setShowCancelItemModal] = useState(false);
  const [showAddNoteModal, setShowAddNoteModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<OrderItem | null>(null);
  const [_selectedMenuForNote, setSelectedMenuForNote] = useState<Menu | null>(
    null
  );
  const [_itemNote, setItemNote] = useState("");
  const itemNoteTextareaRef = useRef<HTMLTextAreaElement>(null);
  const { openKeyboard } = useTouchKeyboard();
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodConfig[]>(
    []
  );
  const [appliedPayments, setAppliedPayments] = useState<
    Array<{ method: string; methodName: string; amount: number; id: string }>
  >([]);
  const [_cancelItemOptions, _setCancelItemOptions] = useState<
    Array<{ item: OrderItem; index: number }>
  >([]);
  const [discountType, setDiscountType] = useState<
    "percentage" | "amount"
  >("percentage");
  const [discountValue, setDiscountValue] = useState<string>("");
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set()); // Seçili ürün index'leri
  const [selectedCartItems, setSelectedCartItems] = useState<Set<string>>(
    new Set()
  ); // Seçili cart item ID'leri
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [selectedCourierId, setSelectedCourierId] = useState<string>("");
  const [packageCount, setPackageCount] = useState<string>("1");
  const [changeAmount, setChangeAmount] = useState<string>("0");
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [_availableTables, setAvailableTables] = useState<Table[]>([]);
  const [_selectedArea, setSelectedArea] = useState<string>("");
  const [showQuantitySelectionModal, setShowQuantitySelectionModal] =
    useState(false);
  const [quantitySelectionAction, setQuantitySelectionAction] = useState<
    "cancel" | "move" | "payment" | null
  >(null);
  const [_selectedItemForQuantity, _setSelectedItemForQuantity] = useState<{
    menuId: string;
    menuName: string;
    totalQuantity: number;
    indices: number[];
  } | null>(null);
  const [_selectedQuantity, _setSelectedQuantity] = useState<number>(1);
  const [pendingPaymentQuantity, setPendingPaymentQuantity] = useState<{
    menuId: string;
    quantity: number;
    indices: number[];
  } | null>(null);
  const [pendingPaymentItems, setPendingPaymentItems] = useState<
    Array<{
      menuId: string;
      menuName: string;
      totalQuantity: number;
      menuPrice: number;
      indices: number[];
    }>
  >([]);
  const [_currentPaymentItemIndex, setCurrentPaymentItemIndex] =
    useState<number>(0);
  const [selectedQuantities, setSelectedQuantities] = useState<
    Map<string, number>
  >(new Map());

  // Tam ekran ödeme ekranı için state'ler
  const [_paymentScreenSelectedItems, _setPaymentScreenSelectedItems] = useState<
    Set<number>
  >(new Set());
  const [_paymentScreenSelectedQuantities, _setPaymentScreenSelectedQuantities] =
    useState<Map<number, number>>(new Map()); // key: item index, value: selected quantity
  const [_paymentScreenAmount, _setPaymentScreenAmount] = useState<string>("");
  const [_paymentScreenDiscountType, _setPaymentScreenDiscountType] = useState<
    "percentage" | "amount" | "manual"
  >("percentage");
  const [_paymentScreenDiscountValue, _setPaymentScreenDiscountValue] =
    useState<string>("");
  const [_paymentScreenManualDiscount, _setPaymentScreenManualDiscount] =
    useState<string>("");
  const [_showPaymentScreenDiscountModal, _setShowPaymentScreenDiscountModal] =
    useState(false);
  const [, _setSelectedNumericKey] = useState<number | null>(null);
  const [_paymentScreenQuantityInput, _setPaymentScreenQuantityInput] =
    useState<string>("");
  // Paket masaları için kurye atama state'leri
  const [_paymentScreenSelectedCourierId, _setPaymentScreenSelectedCourierId] =
    useState<string>("");
  const [_paymentScreenChangeAmount, _setPaymentScreenChangeAmount] =
    useState<string>("0");
  const [_showPaymentScreenCourierModal, _setShowPaymentScreenCourierModal] =
    useState(false);
  const [
    _showPaymentScreenChangeAmountModal,
    _setShowPaymentScreenChangeAmountModal,
  ] = useState(false);

  // Cari yönetimi için state'ler
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
  const [customers, setCustomers] = useState<CustomerAccount[]>([]);
  const [customerTables, setCustomerTables] = useState<Table[]>([]);
  const [newCustomerName, setNewCustomerName] = useState<string>("");
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  
  // Tüm masaları yükle (cari masaları kontrol etmek için)
  const [allTablesForCheck, setAllTablesForCheck] = useState<Table[]>([]);
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);

  // İptal için state'ler (ödeme gibi)
  const [pendingCancelItems, setPendingCancelItems] = useState<
    Array<{
      menuId: string;
      menuName: string;
      totalQuantity: number;
      indices: number[];
    }>
  >([]);
  const [currentCancelItemIndex, setCurrentCancelItemIndex] =
    useState<number>(0);
  const [selectedCancelQuantities, setSelectedCancelQuantities] = useState<
    Map<string, number>
  >(new Map());
  const [_selectedItemsForCancel, _setSelectedItemsForCancel] = useState<
    Set<number>
  >(new Set());

  // Taşıma için state'ler (ödeme gibi)
  const [pendingMoveItems, setPendingMoveItems] = useState<
    Array<{
      menuId: string;
      menuName: string;
      totalQuantity: number;
      indices: number[];
    }>
  >([]);
  const [_currentMoveItemIndex, setCurrentMoveItemIndex] = useState<number>(0);
  const [selectedMoveQuantities, setSelectedMoveQuantities] = useState<
    Map<string, number>
  >(new Map());

  // Loading states
  const [isSendingOrder, setIsSendingOrder] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [_processingPaymentMethodId, _setProcessingPaymentMethodId] = useState<
    string | null
  >(null);
  const [isCanceling, setIsCanceling] = useState(false);
  const [_isMovingItems, setIsMovingItems] = useState(false);

  // Yazıcılar için state
  const [printers, setPrinters] = useState<
    Array<{
      id: string;
      name: string;
      type: "serial" | "usb" | "network" | "system";
      port?: string;
      vendorId?: number;
      productId?: number;
      isConnected: boolean;
      assignedCategories?: string[];
    }>
  >([]);
  const [selectedPrinterId, setSelectedPrinterId] = useState<string | null>(
    null
  );

  // Masa değiştiğinde sipariş state'ini hemen temizle - eski siparişlerin görünmesini engelle
  useEffect(() => {
    // Masa değiştiğinde hemen temizle
    setOrder(null);
    setCart([]);
    setNotes("");
    setSelectedItems(new Set());
    setSelectedCartItems(new Set());
    setPendingPaymentItems([]);
    setPendingPaymentQuantity(null);
    setSelectedQuantities(new Map());
    setShowPaymentModal(false);
    setPaymentAmount("");
    setPaymentMethod("");
    setAppliedPayments([]);
  }, [table?.id]);

  useEffect(() => {
    const loadData = async () => {
      const effectiveCompanyId = companyId || userData?.companyId;
      const effectiveBranchId = branchId || userData?.assignedBranchId;

      if (!effectiveCompanyId) {
        setLoading(false);
        return;
      }

      try {
        // Önce standart ödeme yöntemlerini oluştur (yoksa)
        await createDefaultPaymentMethods(
          effectiveCompanyId,
          effectiveBranchId || undefined
        ).catch(() => {
          // Error creating default payment methods
        });

        // Manager kullanıcısının ID'si (QR menü branchId'si olarak kullanılacak)
        const managerUserId = userData?.id || undefined;

        const [
          menusData,
          categoriesData,
          tableData,
          allOrders,
          paymentMethodsData,
        ] = await Promise.all([
          getAllMenusByCompany(
            effectiveCompanyId,
            effectiveBranchId || undefined,
            managerUserId
          ).catch(() => {
            return [];
          }),
          getAllCategoriesByCompany(
            effectiveCompanyId,
            effectiveBranchId || undefined,
            managerUserId
          ).catch(() => {
            return [];
          }),
          getTable(table.id!).catch(() => {
            return null;
          }),
          getOrdersByCompany(effectiveCompanyId, {
            branchId: effectiveBranchId || undefined,
          }).catch(() => {
            return [];
          }),
          getPaymentMethodsByCompany(
            effectiveCompanyId,
            effectiveBranchId || undefined
          ).catch(() => {
            return [];
          }),
        ]);

        // Bu masa için sadece aktif siparişi bul
        const orderData = allOrders.find(
          (o) => o.tableId === table.id && o.status === "active"
        );

        // Sadece müsait ürünleri göster
        const availableMenus = menusData.filter((menu) => menu.isAvailable);
        setMenus(availableMenus);

        // Sadece aktif kategorileri göster
        const activeCategories = categoriesData.filter((cat) => cat.isActive);
        setCategories(activeCategories);
        if (tableData) {
          setCurrentTable(tableData);
        }

        // Yazıcıları yükle
        try {
          const savedPrinters = localStorage.getItem(
            `printers_${effectiveCompanyId}`
          );
          if (savedPrinters) {
            const printersData = JSON.parse(savedPrinters);
            setPrinters(printersData);

            const selected = localStorage.getItem(
              `selectedPrinter_${effectiveCompanyId}`
            );
            if (selected) {
              setSelectedPrinterId(selected);
            }
          }
        } catch (error) {}

        // Aktif ödeme yöntemlerini filtrele ve yükle
        const activePaymentMethods = paymentMethodsData.filter(
          (pm) => pm.isActive
        );
        setPaymentMethods(activePaymentMethods);

        // Ödeme yöntemi otomatik seçilmeyecek, kullanıcı manuel seçecek

        // Kuryeleri yükle
        try {
          const couriersData = await getCouriersByCompany(
            effectiveCompanyId,
            effectiveBranchId || undefined
          );
          const activeCouriers = couriersData.filter((c) => c.isActive);
          setCouriers(activeCouriers);
        } catch (error) {
          // Error loading couriers
        }

        // Tüm masaları yükle (cari masaları kontrol etmek için)
        try {
          const tablesData = await getTablesByCompany(
            effectiveCompanyId,
            effectiveBranchId || undefined
          );
          setAllTablesForCheck(tablesData);
        } catch (error) {
          // Error loading tables
        }

        // Sadece aktif sipariş varsa göster, yoksa temizle
        if (orderData && orderData.status === "active") {
          setOrder(orderData);
          // Cart'ı temiz tut - sadece yeni eklenen ürünler cart'ta olacak
          setCart([]);
          setNotes("");
        } else {
          // Aktif sipariş yoksa temizle
          setOrder(null);
          setCart([]);
          setNotes("");
        }

        // İlk kategoriyi seç
        if (activeCategories.length > 0 && !selectedCategoryId) {
          setSelectedCategoryId(activeCategories[0].id!);
          setSelectedCategoryName(activeCategories[0].name);
        }
      } catch (error) {
        console.error("Error loading data:", error);
        // Error loading data - still set loading to false
        setLoading(false);
      } finally {
        setLoading(false);
      }
    };

    if (!table?.id) {
      setLoading(false);
      return;
    }

    loadData();
  }, [
    companyId,
    branchId,
    userData?.companyId,
    userData?.assignedBranchId,
    userData?.id,
    table?.id,
    // order?.id kaldırıldı - masa değiştiğinde sipariş state'i zaten temizleniyor
  ]);

  // Ödeme modalı açıldığında tüm ürünleri göster
  // NOT: Eğer pendingPaymentItems zaten doluysa (seçili ürünler varsa), yeniden oluşturma
  useEffect(() => {
    if (showPaymentModal && order && order.items.length > 0) {
      // Eğer pendingPaymentItems zaten doluysa ve seçili ürünler varsa, koru
      // (indirim uygulandıktan sonra seçili ürünlerin korunması için)
      if (pendingPaymentItems.length > 0) {
        // Seçili ürünler var, sadece index'leri güncelle (order değişmiş olabilir)
        const updatedPendingItems = pendingPaymentItems.map(pendingItem => {
          // Yeni order'da aynı menuId'ye sahip ürünlerin index'lerini bul
          const newIndices: number[] = [];
          order.items.forEach((item, index) => {
            if (item.menuId === pendingItem.menuId) {
              newIndices.push(index);
            }
          });
          
          // Toplam miktarı hesapla
          const totalQuantity = order.items
            .filter(item => item.menuId === pendingItem.menuId)
            .reduce((sum, item) => sum + item.quantity, 0);
          
          return {
            ...pendingItem,
            totalQuantity,
            indices: newIndices,
            menuPrice: order.items.find(item => item.menuId === pendingItem.menuId)?.menuPrice || pendingItem.menuPrice,
          };
        }).filter(item => item.indices.length > 0); // Sadece hala order'da olan ürünleri tut
        
        setPendingPaymentItems(updatedPendingItems);
        return; // Seçili ürünler korunuyor, çık
      }
      
      // Tüm ürünleri menuId'ye göre grupla (seçili ürün yoksa)
      const groupedItems = new Map<
        string,
        {
          menuId: string;
          menuName: string;
          totalQuantity: number;
          menuPrice: number;
          indices: number[];
        }
      >();

      order.items.forEach((item, index) => {
        const existing = groupedItems.get(item.menuId);
        if (existing) {
          existing.totalQuantity += item.quantity;
          existing.indices.push(index);
        } else {
          groupedItems.set(item.menuId, {
            menuId: item.menuId,
            menuName: item.menuName,
            totalQuantity: item.quantity,
            menuPrice: item.menuPrice,
            indices: [index],
          });
        }
      });

      // pendingPaymentItems'ı güncelle (tüm ürünler)
      const newPendingItems = Array.from(groupedItems.values());
      setPendingPaymentItems(newPendingItems);

      // Mevcut selectedQuantities'yi koru, yeni ürünler için 0 başlat
      setSelectedQuantities((prev) => {
        const newMap = new Map(prev);
        newPendingItems.forEach((item) => {
          if (!newMap.has(item.menuId)) {
            newMap.set(item.menuId, 0); // Başlangıçta seçili miktar 0
          }
        });
        return newMap;
      });
    } else if (showPaymentModal) {
      // Sipariş yoksa temizle
      setPendingPaymentItems([]);
      setSelectedQuantities(new Map());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPaymentModal, order?.id, order?.items?.length]);

  // URL'den ödeme modalı durumunu kontrol et
  useEffect(() => {
    if (
      search.payment === "true" &&
      order &&
      order.items &&
      order.items.length > 0
    ) {
      setShowPaymentModal(true);
    }
  }, [search.payment, order]);

  // Seçili kategorinin ürünlerini filtrele
  // menu.category alanı kategori adını (name) tutuyor, ID değil
  const filteredMenus = selectedCategoryName
    ? menus.filter((menu) => {
        // Kategori adını karşılaştır (case-insensitive)
        return (
          menu.category &&
          selectedCategoryName &&
          menu.category.trim().toLowerCase() ===
            selectedCategoryName.trim().toLowerCase()
        );
      })
    : menus;

  // Sepete ürün ekle (not ile birlikte) - sadece modal'dan yeni ürün eklemek için
  const _addToCartWithNote = useCallback(
    (menu: Menu, note?: string, extras?: SelectedExtra[]) => {
      const extrasTotal =
        extras?.reduce((sum, extra) => sum + extra.price, 0) || 0;
      const itemPrice = menu.price + extrasTotal;

      setCart((prev) => {
        // Yeni eklenen ürünleri ayrı tutmak için her eklemede yeni bir item oluştur
        const cartItemId = `${menu.id}-${Date.now()}-${Math.random()}`;
        return [
          ...prev,
          {
            cartItemId,
            menuId: menu.id!,
            menuName: menu.name,
            menuPrice: menu.price,
            quantity: 1,
            subtotal: itemPrice,
            notes: note || undefined,
            selectedExtras: extras && extras.length > 0 ? extras : undefined,
            addedAt: new Date(),
          },
        ];
      });
      // Sepeti göster
      setShowCart(true);
      // Modal'ı kapat
      setShowAddNoteModal(false);
      setSelectedMenuForNote(null);
      setItemNote("");
    },
    []
  );

  // Ürün ekleme butonuna tıklandığında ekstra malzeme kontrolü yap
  const handleAddToCart = useCallback(
    (menu: Menu) => {
      // Eğer refresh işlemi devam ediyorsa ürün eklemeyi engelle
      if (isRefreshingOrder) return;

      // Eğer üründe ekstra malzeme varsa modal göster
      if (menu.extras && menu.extras.length > 0) {
        setSelectedMenuForExtra(menu);
        // Zorunlu ekstraları otomatik seç
        const requiredExtras = new Set(
          menu.extras
            .filter((extra) => extra.isRequired)
            .map((extra) => extra.id)
        );
        setSelectedExtras(requiredExtras);
        setShowExtraModal(true);
      } else {
        // Ekstra malzeme yoksa direkt sepete ekle
        setCart((prev) => {
          const cartItemId = `${menu.id}-${Date.now()}-${Math.random()}`;
          return [
            ...prev,
            {
              cartItemId,
              menuId: menu.id!,
              menuName: menu.name,
              menuPrice: menu.price,
              quantity: 1,
              subtotal: menu.price,
              addedAt: new Date(),
            },
          ];
        });
        setShowCart(true);
      }
    },
    [isRefreshingOrder]
  );

  // Ekstra malzemeleri seçip sepete ekle
  const _handleAddToCartWithExtras = useCallback(() => {
    if (!selectedMenuForExtra) return;

    // Eğer refresh işlemi devam ediyorsa ürün eklemeyi engelle
    if (isRefreshingOrder) return;

    const selectedExtrasList: SelectedExtra[] = Array.from(selectedExtras)
      .map((extraId) => {
        const extra = selectedMenuForExtra.extras?.find(
          (e) => e.id === extraId
        );
        return extra
          ? {
              id: extra.id,
              name: extra.name,
              price: extra.price,
            }
          : null;
      })
      .filter((e): e is SelectedExtra => e !== null);

    const extrasTotal = selectedExtrasList.reduce(
      (sum, extra) => sum + extra.price,
      0
    );
    const itemPrice = selectedMenuForExtra.price + extrasTotal;

    setCart((prev) => {
      const cartItemId = `${selectedMenuForExtra.id}-${Date.now()}-${Math.random()}`;
      return [
        ...prev,
        {
          cartItemId,
          menuId: selectedMenuForExtra.id!,
          menuName: selectedMenuForExtra.name,
          menuPrice: selectedMenuForExtra.price,
          quantity: 1,
          subtotal: itemPrice,
          selectedExtras:
            selectedExtrasList.length > 0 ? selectedExtrasList : undefined,
          addedAt: new Date(),
        },
      ];
    });

    // Modal'ı kapat ve state'leri temizle
    setShowExtraModal(false);
    setSelectedMenuForExtra(null);
    setSelectedExtras(new Set());
    setShowCart(true);
  }, [selectedMenuForExtra, selectedExtras, isRefreshingOrder]);

  // Long press başlat (miktar girme modalı için)
  const handleLongPressStart = useCallback((menu: Menu) => {
    longPressTimerRef.current = setTimeout(() => {
      setSelectedMenuForQuantity(menu);
      setQuantityInput("");
      // Eğer üründe ekstra malzeme varsa zorunlu olanları otomatik seç
      if (menu.extras && menu.extras.length > 0) {
        const requiredExtras = new Set(
          menu.extras
            .filter((extra) => extra.isRequired)
            .map((extra) => extra.id)
        );
        setSelectedExtras(requiredExtras);
      } else {
        setSelectedExtras(new Set());
      }
      setShowQuantityModal(true);
    }, 500); // 500ms basılı tutma
  }, []);

  // Long press iptal
  const handleLongPressEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // Miktar girme modalından ürün ekle
  const _handleAddWithQuantity = useCallback(() => {
    if (!selectedMenuForQuantity || !quantityInput) return;

    // Virgülü noktaya çevir
    const normalizedInput = quantityInput.replace(",", ".");
    const quantity = parseFloat(normalizedInput);

    if (isNaN(quantity) || quantity <= 0) {
      customAlert("Geçerli bir miktar girin", "Uyarı", "warning");
      return;
    }

    // Eğer ekstra malzeme seçildiyse onları kullan, yoksa boş
    const selectedExtrasList: SelectedExtra[] = Array.from(selectedExtras)
      .map((extraId) => {
        const extra = selectedMenuForQuantity.extras?.find(
          (e) => e.id === extraId
        );
        return extra
          ? {
              id: extra.id,
              name: extra.name,
              price: extra.price,
            }
          : null;
      })
      .filter((e): e is SelectedExtra => e !== null);

    const extrasTotal = selectedExtrasList.reduce(
      (sum, extra) => sum + extra.price,
      0
    );
    const itemPrice = selectedMenuForQuantity.price + extrasTotal;

    setCart((prev) => {
      const cartItemId = `${selectedMenuForQuantity.id}-${Date.now()}-${Math.random()}`;
      return [
        ...prev,
        {
          cartItemId,
          menuId: selectedMenuForQuantity.id!,
          menuName: selectedMenuForQuantity.name,
          menuPrice: selectedMenuForQuantity.price,
          quantity: quantity,
          subtotal: itemPrice * quantity,
          selectedExtras:
            selectedExtrasList.length > 0 ? selectedExtrasList : undefined,
          addedAt: new Date(),
        },
      ];
    });

    // Modal'ı kapat
    setShowQuantityModal(false);
    setSelectedMenuForQuantity(null);
    setQuantityInput("");
    setSelectedExtras(new Set());
    // Sepeti göster
    setShowCart(true);
  }, [selectedMenuForQuantity, quantityInput, selectedExtras]);

  // Sepetteki ürün miktarını güncelle (cartItemId ile)
  const _updateQuantity = useCallback((cartItemId: string, delta: number) => {
    setCart((prev) => {
      const item = prev.find((i) => i.cartItemId === cartItemId);
      if (!item) return prev;

      const newQuantity = item.quantity + delta;
      if (newQuantity <= 0) {
        return prev.filter((i) => i.cartItemId !== cartItemId);
      }

      // Ekstra malzemelerin fiyatını da hesaba kat
      const extrasTotal =
        item.selectedExtras?.reduce((sum, extra) => sum + extra.price, 0) || 0;
      const itemPrice = item.menuPrice + extrasTotal;

      return prev.map((i) =>
        i.cartItemId === cartItemId
          ? {
              ...i,
              quantity: newQuantity,
              subtotal: newQuantity * itemPrice,
            }
          : i
      );
    });
  }, []);

  // Sepetten ürün sil (cartItemId ile)
  const removeFromCart = useCallback((cartItemId: string) => {
    setCart((prev) => prev.filter((item) => item.cartItemId !== cartItemId));
  }, []);

  // Cart içindeki ürünler için miktar artırma
  const increaseCartItemQuantity = useCallback((menuId: string) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.menuId === menuId) {
          const newQuantity = item.quantity + 1;
          return {
            ...item,
            quantity: newQuantity,
            subtotal: newQuantity * item.menuPrice,
          };
        }
        return item;
      })
    );
  }, []);

  // Cart içindeki ürünler için miktar azaltma
  const decreaseCartItemQuantity = useCallback((menuId: string) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.menuId === menuId) {
            const newQuantity = Math.max(1, item.quantity - 1);
            return {
              ...item,
              quantity: newQuantity,
              subtotal: newQuantity * item.menuPrice,
            };
          }
          return item;
        })
        .filter((item) => {
          // Miktarı 0 olan ürünleri kaldır
          if (item.menuId === menuId) {
            return item.quantity > 0;
          }
          return true;
        })
    );
  }, []);

  // Cart içindeki ürünleri silme
  const removeCartItem = useCallback((menuId: string) => {
    setCart((prev) => prev.filter((item) => item.menuId !== menuId));
  }, []);

  // Gönderilmemiş ürünler için miktar artırma
  const increaseUnsentItemQuantity = useCallback(
    async (menuId: string) => {
      if (!order) return;

      const _effectiveCompanyId = companyId || userData?.companyId;
      const _effectiveBranchId = branchId || userData?.assignedBranchId;

      // Gönderilmemiş ürünleri bul (sentItems içinde olmayan)
      const _unsentItems = order.items.filter(
        (item) => !item.canceledAt && !order.sentItems?.includes(item.menuId)
      );

      // İlgili ürünü bul ve miktarını artır
      const updatedItems = order.items.map((item) => {
        if (
          item.menuId === menuId &&
          !item.canceledAt &&
          !order.sentItems?.includes(item.menuId)
        ) {
          const newQuantity = item.quantity + 1;
          return {
            ...item,
            quantity: newQuantity,
            subtotal: newQuantity * item.menuPrice,
          };
        }
        return item;
      });

      // Toplam hesapla
      const subtotal = updatedItems.reduce(
        (sum, item) => sum + item.subtotal,
        0
      );
      const total = subtotal - (order.discount || 0);

      // Firebase'e kaydet
      await updateOrder(order.id!, {
        items: updatedItems,
        subtotal: subtotal,
        total: total,
      });

      // Order'ı güncelle
      const updatedOrder = await getOrder(order.id!);
      if (updatedOrder) {
        setOrder(updatedOrder);
      }
    },
    [order, companyId, userData, branchId]
  );

  // Gönderilmemiş ürünler için miktar azaltma
  const decreaseUnsentItemQuantity = useCallback(
    async (menuId: string) => {
      if (!order) return;

      const _effectiveCompanyId = companyId || userData?.companyId;
      const _effectiveBranchId = branchId || userData?.assignedBranchId;

      // İlgili ürünü bul ve miktarını azalt
      const updatedItems = order.items
        .map((item) => {
          if (
            item.menuId === menuId &&
            !item.canceledAt &&
            !order.sentItems?.includes(item.menuId)
          ) {
            const newQuantity = Math.max(1, item.quantity - 1);
            return {
              ...item,
              quantity: newQuantity,
              subtotal: newQuantity * item.menuPrice,
            };
          }
          return item;
        })
        .filter((item) => {
          // Miktarı 0 olan gönderilmemiş ürünleri kaldır
          if (
            item.menuId === menuId &&
            !item.canceledAt &&
            !order.sentItems?.includes(item.menuId)
          ) {
            return item.quantity > 0;
          }
          return true;
        });

      // Toplam hesapla
      const subtotal = updatedItems.reduce(
        (sum, item) => sum + item.subtotal,
        0
      );
      const total = subtotal - (order.discount || 0);

      // Firebase'e kaydet
      await updateOrder(order.id!, {
        items: updatedItems,
        subtotal: subtotal,
        total: total,
      });

      // Order'ı güncelle
      const updatedOrder = await getOrder(order.id!);
      if (updatedOrder) {
        setOrder(updatedOrder);
      }
    },
    [order, companyId, userData, branchId]
  );

  // Gönderilmemiş ürünleri silme
  const removeUnsentItem = useCallback(
    async (menuId: string) => {
      if (!order) return;

      const _effectiveCompanyId = companyId || userData?.companyId;
      const _effectiveBranchId = branchId || userData?.assignedBranchId;

      // İlgili gönderilmemiş ürünleri kaldır
      const updatedItems = order.items.filter(
        (item) =>
          !(
            item.menuId === menuId &&
            !item.canceledAt &&
            !order.sentItems?.includes(item.menuId)
          )
      );

      // Toplam hesapla
      const subtotal = updatedItems.reduce(
        (sum, item) => sum + item.subtotal,
        0
      );
      const total = subtotal - (order.discount || 0);

      // Firebase'e kaydet
      await updateOrder(order.id!, {
        items: updatedItems,
        subtotal: subtotal,
        total: total,
      });

      // Order'ı güncelle
      const updatedOrder = await getOrder(order.id!);
      if (updatedOrder) {
        setOrder(updatedOrder);
      }
    },
    [order, companyId, userData, branchId]
  );

  // Toplam hesapla
  const cartTotal = cart.reduce((sum, item) => sum + item.subtotal, 0);

  // Siparişi kaydet (aynı ürünleri birleştir)
  const handleSendOrder = useCallback(async () => {
    const effectiveCompanyId = companyId || userData?.companyId;
    const effectiveBranchId = branchId || userData?.assignedBranchId;

    if (!effectiveCompanyId || cart.length === 0) return;

    setIsSendingOrder(true);
    try {
      // Mevcut siparişin items'ını al (varsa) - güncel order'ı al
      let currentOrder = order;
      if (order?.id) {
        // Güncel order'ı al (ödemelerden sonra güncellenmiş olabilir)
        try {
          currentOrder = await getOrder(order.id);
        } catch (error) {
          // Hata durumunda mevcut order'ı kullan
          currentOrder = order;
        }
      }
      const existingItems = currentOrder?.items || [];

      // Tüm ürünleri birleştir (mevcut + yeni) - menuId'ye göre birleştir
      const itemMap = new Map<string, OrderItem>();

      // Önce mevcut siparişteki ürünleri ekle
      existingItems.forEach((item) => {
        itemMap.set(item.menuId, {
          menuId: item.menuId,
          menuName: item.menuName,
          menuPrice: item.menuPrice,
          quantity: item.quantity,
          subtotal: item.subtotal,
          notes: item.notes || undefined,
          addedAt: item.addedAt || new Date(), // Mevcut item'ın addedAt'ini koru
        });
      });

      // Sonra yeni eklenen ürünleri ekle veya birleştir
      cart.forEach((item) => {
        const existing = itemMap.get(item.menuId);
        if (existing) {
          // Aynı ürünü birleştir (notları birleştir)
          existing.quantity += item.quantity;
          existing.subtotal = existing.quantity * existing.menuPrice;
          // Notları birleştir (varsa)
          if (item.notes) {
            existing.notes = existing.notes
              ? `${existing.notes}, ${item.notes}`
              : item.notes;
          }
          // addedAt'i en eski olanı koru (ilk eklenen zamanı)
          if (item.addedAt && existing.addedAt) {
            existing.addedAt =
              item.addedAt < existing.addedAt ? item.addedAt : existing.addedAt;
          } else if (item.addedAt) {
            existing.addedAt = item.addedAt;
          }
        } else {
          // Yeni ürün ekle
          itemMap.set(item.menuId, {
            menuId: item.menuId,
            menuName: item.menuName,
            menuPrice: item.menuPrice,
            quantity: item.quantity,
            subtotal: item.subtotal,
            notes: item.notes || undefined,
            addedAt: item.addedAt || new Date(),
          });
        }
      });

      const finalItems = Array.from(itemMap.values());

      // Toplam hesapla
      const subtotal = finalItems.reduce((sum, item) => sum + item.subtotal, 0);
      const total = subtotal - (currentOrder?.discount || 0);

      // Gönderilen ürün ID'lerini kaydet (yeni eklenenler)
      const newItemIds = cart.map((item) => item.menuId);
      const existingSentItems = currentOrder?.sentItems || [];
      const sentItemIds = Array.from(
        new Set([...existingSentItems, ...newItemIds])
      );

      let updatedOrder: Order | null = null;
      if (currentOrder) {
        // Mevcut siparişi güncelle (eski + yeni ürünler)
        const updateData: any = {
          items: finalItems,
          subtotal: subtotal,
          total: total,
          sentItems: sentItemIds, // Gönderilen ürünleri kaydet
        };
        // Sadece notes varsa ekle (undefined gönderme)
        if (currentOrder.notes) {
          updateData.notes = currentOrder.notes;
        }
        await updateOrder(currentOrder.id!, updateData);
        updatedOrder = await getOrder(currentOrder.id!);
      } else {
        // Yeni sipariş oluştur
        const newOrderData: any = {
          companyId: effectiveCompanyId,
          branchId: effectiveBranchId || currentTable.branchId,
          tableId: currentTable.id!,
          tableNumber: currentTable.tableNumber,
          items: finalItems,
          sentItems: sentItemIds, // Gönderilen ürünleri kaydet
          createdBy: userData?.id || "",
        };
        // notes alanını ekleme (undefined gönderme)
        const orderId = await addOrder(newOrderData);
        updatedOrder = await getOrder(orderId);
      }

      // Yeni eklenen ürünleri kaydet (cart temizlenmeden önce)
      const newItems = [...cart];

      // Siparişi güncelle ve sepeti temizle
      // updatedOrder zaten tüm cart öğelerini içeriyor, bu yüzden cart'ı hemen temizleyebiliriz
      setOrder(updatedOrder);
      setCart([]);
      setNotes("");
      setShowCart(false);

      // Masayı dolu yap ve currentOrderId'yi güncelle
      if (updatedOrder && currentTable.id) {
        try {
          await updateTableStatus(currentTable.id, "occupied", updatedOrder.id);
          const tableData = await getTable(currentTable.id);
          if (tableData) {
            setCurrentTable(tableData);
          }
        } catch (error) {
          console.error("Masa güncellenirken hata:", error);
        }

        // Yeni eklenen ürünleri yazdır (kategori yazıcılarına - tek adisyon)
        try {
          if (newItems.length > 0) {
            // Kategorilere göre grupla
            const itemsByCategory = new Map<string, OrderItem[]>();

            for (const item of newItems) {
              const menuItem = menus.find((m) => m.id === item.menuId);
              if (menuItem && menuItem.category) {
                const category = categories.find(
                  (c) => c.name === menuItem.category
                );
                if (category) {
                  const categoryId = category.id || "";
                  if (!itemsByCategory.has(categoryId)) {
                    itemsByCategory.set(categoryId, []);
                  }
                  itemsByCategory.get(categoryId)!.push(item);
                }
              }
            }

            // Her kategori için o kategorideki tüm ürünleri tek adisyonda yazdır
            for (const [
              categoryId,
              categoryItems,
            ] of itemsByCategory.entries()) {
              const category = categories.find((c) => c.id === categoryId);
              if (category) {
                // Bu kategoriye atanmış yazıcıları bul
                const categoryPrinters = getPrintersForCategories(
                  printers,
                  categories,
                  [categoryId]
                );

                // Her yazıcıya bu kategorideki TÜM ürünleri tek adisyonda yazdır
                for (const printer of categoryPrinters) {
                  const printContent = formatPrintContent(
                    "order",
                    categoryItems, // Tüm ürünler tek adisyonda
                    currentTable.tableNumber,
                    undefined, // Sipariş no gösterilmeyecek
                    {
                      companyName: companyData?.name || "",
                      isPaid: false, // Gönderilen ürünler henüz ödenmedi
                    }
                  );
                  await printToPrinter(printer.name, printContent, "order");
                }
              }
            }
          }
        } catch (error) {
          // Yazdırma hatası siparişi etkilemesin
        }

        // Masa geçmişine kaydet - Her yeni eklenen ürün için
        const effectiveBranchIdForHistory =
          branchId || userData?.assignedBranchId;
        try {
          for (const cartItem of cart) {
            await addTableHistory(
              effectiveCompanyId,
              currentTable.id!,
              currentTable.tableNumber,
              "item_added",
              `${cartItem.menuName} eklendi`,
              {
                menuId: cartItem.menuId,
                menuName: cartItem.menuName,
                quantity: cartItem.quantity,
                subtotal: cartItem.subtotal,
              },
              effectiveBranchIdForHistory || undefined
            );
          }
        } catch (error) {
          // Geçmiş kaydetme hatası işlemi durdurmamalı
        }
      }

      // İşlem tamamlandı
      // Paket masaları için cart'ı temizle ve siparişi güncelle, masalar sayfasına dönme
      if (currentTable.area === "Paket") {
        setCart([]);
        if (updatedOrder) {
          setOrder(updatedOrder);
        }
      } else {
        // Navigation ayarını kontrol et
        const navSettings = localStorage.getItem("navigationSettings");
        if (navSettings) {
          try {
            const settings = JSON.parse(navSettings);
            if (settings.returnAfterProductAdd) {
              navigateToHome();
            } else {
              setCart([]);
              if (updatedOrder) {
                setOrder(updatedOrder);
              }
            }
          } catch (error) {
            // Hata durumunda varsayılan davranış (masalara dön)
            navigateToHome();
          }
        } else {
          // Ayar yoksa varsayılan davranış (masalara dön)
          navigateToHome();
        }
      }
    } catch (error) {
      customAlert("Sipariş kaydedilirken bir hata oluştu", "Hata", "error");
    } finally {
      setIsSendingOrder(false);
    }
  }, [
    userData,
    cart,
    order,
    notes,
    currentTable,
    navigate,
    isRefreshingOrder,
    menus,
    categories,
    printers,
    companyId,
    branchId,
    companyData,
    tableId,
    allTablesForCheck,
  ]);

  // Ödeme alma
  const handlePayment = useCallback(
    async (
      overrideAmount?: string,
      overrideSelectedItems?: Set<number>,
      overridePendingPaymentItems?: Array<{
        menuId: string;
        menuName: string;
        totalQuantity: number;
        menuPrice: number;
        indices: number[];
      }>,
      overrideSelectedQuantities?: Map<string, number>,
      overridePaymentMethod?: string,
      overrideCourierId?: string,
      overridePackageCount?: string,
      overrideChangeAmount?: string,
      isGift?: boolean
    ) => {
      // Eğer overrideAmount verilmişse onu kullan, yoksa state'ten oku
      const amountToUse = overrideAmount || paymentAmount;

      // Eğer overridePaymentMethod verilmişse onu kullan, yoksa state'ten oku
      const paymentMethodToUse = overridePaymentMethod || paymentMethod;

      // Eğer override değerler verilmişse onları kullan, yoksa state'ten oku
      const quantitiesToUse =
        overrideSelectedQuantities !== undefined
          ? overrideSelectedQuantities
          : selectedQuantities;
      const pendingItemsToUse =
        overridePendingPaymentItems !== undefined
          ? overridePendingPaymentItems
          : pendingPaymentItems;

      // Eğer selectedQuantities ile ürün seçildiyse, itemsToUse'u oluştur
      let itemsToUse: Set<number>;
      if (overrideSelectedItems !== undefined) {
        itemsToUse = overrideSelectedItems;
      } else if (quantitiesToUse.size > 0 && pendingItemsToUse.length > 0) {
        // selectedQuantities ile seçilen ürünler için indices'leri topla
        // Sadece seçilen miktar kadar index ekle (tüm indices'leri değil)
        itemsToUse = new Set<number>();
        pendingItemsToUse.forEach((paymentItem) => {
          const selectedQty = quantitiesToUse.get(paymentItem.menuId) || 0;
          if (selectedQty > 0) {
            // Bu ürün için seçilen miktar varsa, sadece seçilen miktar kadar index ekle
            let remainingQty = selectedQty;
            for (const index of paymentItem.indices) {
              if (remainingQty <= 0) break;
              if (!order) continue;
              const item = order.items[index];
              if (!item || item.menuId !== paymentItem.menuId) continue; // menuId kontrolü ekle
              
              itemsToUse.add(index);
              
              // Seçilen miktardan bu item'ın miktarını düş
              remainingQty -= item.quantity;
            }
          }
        });
      } else if (pendingItemsToUse.length > 0) {
        // Eğer pendingItemsToUse varsa ama quantitiesToUse yoksa, tüm pendingItemsToUse'u kullan
        itemsToUse = new Set<number>();
        if (order) {
          pendingItemsToUse.forEach((paymentItem) => {
            paymentItem.indices.forEach((index) => {
              const item = order.items[index];
              if (item && item.menuId === paymentItem.menuId) { // menuId kontrolü ekle
                itemsToUse.add(index);
              }
            });
          });
        }
      } else {
        // Hiç seçili ürün yoksa, selectedItems state'ini kullan
        itemsToUse = selectedItems;
      }

      if (
        !order ||
        !order.items ||
        !amountToUse ||
        parseFloat(amountToUse) <= 0 ||
        isNaN(parseFloat(amountToUse))
      ) {
        customAlert(
          "Lütfen geçerli bir ödeme tutarı girin",
          "Uyarı",
          "warning"
        );
        return;
      }

      setIsProcessingPayment(true);
      try {
        const amount = parseFloat(amountToUse);

        // Önce kalan tutarı hesapla (seçili ürün varsa onların toplamı, yoksa tüm masanın toplamı)
        // İndirim dikkate alınmalı
        const orderSubtotal = (order.items || []).reduce(
          (sum, item) => sum + item.subtotal,
          0
        );
        const orderDiscount = order.discount || 0;
        const orderTotal = order.total || orderSubtotal - orderDiscount;

        let remaining: number;
        if (itemsToUse.size > 0) {
          // Seçili ürünlerin toplamı - quantitiesToUse ile seçilen miktarı dikkate al
          let selectedSubtotal = 0;
          
          // Eğer quantitiesToUse ile miktar seçildiyse, sadece seçilen miktar kadar hesapla
          if (quantitiesToUse.size > 0 && pendingItemsToUse.length > 0) {
            pendingItemsToUse.forEach((paymentItem) => {
              const selectedQty = quantitiesToUse.get(paymentItem.menuId) || 0;
              if (selectedQty > 0) {
                let remainingQty = selectedQty;
                for (const index of paymentItem.indices) {
                  if (remainingQty <= 0) break;
                  const item = order.items[index];
                  if (!item) continue;
                  
                  const qtyToUse = Math.min(item.quantity, remainingQty);
                  selectedSubtotal += qtyToUse * item.menuPrice;
                  remainingQty -= qtyToUse;
                }
              }
            });
          } else {
            // Eğer quantitiesToUse yoksa, itemsToUse içindeki tüm items'ları kullan
            const selectedItemsArray = Array.from(itemsToUse);
            const mergedSelectedItems = new Map<
              string,
              { quantity: number; subtotal: number }
            >();
            selectedItemsArray.forEach((index) => {
              const item = order.items[index];
              if (!item) return;
              const existing = mergedSelectedItems.get(item.menuId);
              if (existing) {
                existing.quantity += item.quantity;
                existing.subtotal += item.subtotal;
              } else {
                mergedSelectedItems.set(item.menuId, {
                  quantity: item.quantity,
                  subtotal: item.subtotal,
                });
              }
            });
            selectedSubtotal = Array.from(
              mergedSelectedItems.values()
            ).reduce((sum, { subtotal }) => sum + subtotal, 0);
          }
          
          // Seçili ürünlerin toplamından orantılı indirim düş
          const discountRatio =
            orderSubtotal > 0 ? orderDiscount / orderSubtotal : 0;
          remaining = Math.max(
            0,
            selectedSubtotal - selectedSubtotal * discountRatio
          );
        } else {
          // Tüm masanın toplamı (indirimli)
          remaining = orderTotal;
        }

        // Kısmi ödeme kontrolü: Seçili ürün varsa VEYA girilen tutar toplamdan azsa
        const isPartialPayment = itemsToUse.size > 0 || amount < remaining;

        let paidItems:
          | Array<{
              menuId: string;
              menuName: string;
              quantity: number;
              menuPrice: number;
              subtotal: number;
            }>
          | undefined;

        if (isPartialPayment && itemsToUse.size > 0) {
          // Kısmi ödeme: Seçili ürünlerin toplamı
          const selectedItemsArray = Array.from(itemsToUse);

          // Seçili ürünleri menuId'ye göre birleştir
          const mergedSelectedItems = new Map<
            string,
            { item: OrderItem; quantity: number; subtotal: number }
          >();

          // Eğer birden fazla ürün için miktar seçildiyse, tüm seçilen miktarları kullan
          if (pendingItemsToUse.length > 0) {
            // Tüm ürünler için seçilen miktarları kullan
            pendingItemsToUse.forEach((paymentItem) => {
              // Eğer bu ürün için miktar seçildiyse kullan, yoksa tüm miktarı kullan
              const selectedQty =
                quantitiesToUse.get(paymentItem.menuId) ||
                paymentItem.totalQuantity;
              let remainingQuantity = selectedQty;

              for (const index of paymentItem.indices) {
                if (remainingQuantity <= 0) break;
                // Sadece itemsToUse içindeki index'leri işle
                if (!itemsToUse.has(index)) continue;
                
                const item = order.items[index];
                if (!item || item.menuId !== paymentItem.menuId) continue; // menuId kontrolü ekle

                const paidQuantity =
                  item.quantity <= remainingQuantity
                    ? item.quantity
                    : remainingQuantity;
                const paidSubtotal = paidQuantity * item.menuPrice;

                const existing = mergedSelectedItems.get(item.menuId);
                if (existing) {
                  existing.quantity += paidQuantity;
                  existing.subtotal += paidSubtotal;
                } else {
                  mergedSelectedItems.set(item.menuId, {
                    item,
                    quantity: paidQuantity,
                    subtotal: paidSubtotal,
                  });
                }

                remainingQuantity -= paidQuantity;
              }
            });
          }
          // Eğer sadece pendingPaymentQuantity varsa (tek ürün için miktar seçildiyse)
          else if (pendingPaymentQuantity) {
            let remainingQuantity = pendingPaymentQuantity.quantity;

            for (const index of pendingPaymentQuantity.indices) {
              if (remainingQuantity <= 0) break;
              const item = order.items[index];
              if (!item) continue;

              const paidQuantity =
                item.quantity <= remainingQuantity
                  ? item.quantity
                  : remainingQuantity;
              const paidSubtotal = paidQuantity * item.menuPrice;

              const existing = mergedSelectedItems.get(item.menuId);
              if (existing) {
                existing.quantity += paidQuantity;
                existing.subtotal += paidSubtotal;
              } else {
                mergedSelectedItems.set(item.menuId, {
                  item,
                  quantity: paidQuantity,
                  subtotal: paidSubtotal,
                });
              }

              remainingQuantity -= paidQuantity;
            }

            // Diğer seçili ürünleri ekle (pendingPaymentQuantity.indices içinde olmayan)
            const pendingIndicesSet = new Set(pendingPaymentQuantity.indices);
            selectedItemsArray.forEach((index) => {
              if (!pendingIndicesSet.has(index)) {
                const item = order.items[index];
                if (!item) return;

                const existing = mergedSelectedItems.get(item.menuId);
                if (existing) {
                  existing.quantity += item.quantity;
                  existing.subtotal += item.subtotal;
                } else {
                  mergedSelectedItems.set(item.menuId, {
                    item,
                    quantity: item.quantity,
                    subtotal: item.subtotal,
                  });
                }
              }
            });
          }
          // Hiç miktar seçilmediyse, tüm seçili ürünlerin tamamını ekle
          else {
            selectedItemsArray.forEach((index) => {
              const item = order.items[index];
              if (!item) return;

              const existing = mergedSelectedItems.get(item.menuId);
              if (existing) {
                existing.quantity += item.quantity;
                existing.subtotal += item.subtotal;
              } else {
                mergedSelectedItems.set(item.menuId, {
                  item,
                  quantity: item.quantity,
                  subtotal: item.subtotal,
                });
              }
            });
          }

          const selectedTotal = Array.from(mergedSelectedItems.values()).reduce(
            (sum, { subtotal }) => sum + subtotal,
            0
          );
          remaining = selectedTotal;

          // Ödenen ürünler listesi - mergedSelectedItems zaten doğru miktarları içeriyor
          // NOT: paidItems burada oluşturuluyor ama indirim henüz uygulanmadı
          // İndirim uygulandıktan sonra paidItems'ı güncellemek gerekecek
          paidItems = Array.from(mergedSelectedItems.values()).map(
            ({ item, quantity, subtotal }) => ({
              menuId: item.menuId,
              menuName: item.menuName,
              quantity,
              menuPrice: item.menuPrice, // Orijinal birim fiyat (indirimsiz)
              subtotal, // Bu indirim uygulanmadan önceki subtotal, indirim uygulandıktan sonra güncellenecek
            })
          );
        } else {
          // Tam ödeme veya numerik keypad ile kısmi ödeme: Mevcut ürünlerin toplamı (indirimli)
          remaining = orderTotal;

          // Eğer numerik keypad ile girilen tutar toplamdan azsa VE ürün seçilmemişse
          // Sadece ödeme kaydı yap, ürün miktarlarında değişiklik yapma
          if (isPartialPayment && amount < remaining && itemsToUse.size === 0) {
            // Ürün seçilmemişse, paidItems undefined olarak kalacak
            // Böylece sadece ödeme kaydı yapılacak, ürün miktarları değişmeyecek
            paidItems = undefined;
          }
        }

        // İndirim hesapla
        let discountAmount = 0;
        let discountBaseAmount = 0; // İndirim hesaplanacak tutar (seçili ürünler varsa onların toplamı, yoksa tüm masanın toplamı)
        
        // Eğer seçili ürünler varsa, indirimi sadece seçili ürünlerin toplam fiyatına uygula
        // ÖNEMLİ: Sadece pendingItemsToUse (seçili ürünler listesi) kullan, order.items kullanma
        if (pendingItemsToUse.length > 0) {
          // Seçili ürünlerin toplam fiyatını hesapla
          pendingItemsToUse.forEach((paymentItem) => {
            // Eğer quantitiesToUse varsa, sadece seçilen miktar kadar hesapla
            if (quantitiesToUse.size > 0) {
              const selectedQty = quantitiesToUse.get(paymentItem.menuId) || 0;
              if (selectedQty > 0) {
                // Seçilen miktar * birim fiyat
                discountBaseAmount += selectedQty * paymentItem.menuPrice;
              }
            } else {
              // Miktar seçimi yoksa, tüm seçili ürünün fiyatını ekle
              discountBaseAmount += paymentItem.totalQuantity * paymentItem.menuPrice;
            }
          });
        } else {
          // Seçili ürün yoksa, tüm masadaki ürünlerin toplam fiyatına indirim uygula
          const orderSubtotal = (order.items || []).reduce(
            (sum, item) => sum + (item.menuPrice * item.quantity),
            0
          );
          discountBaseAmount = orderSubtotal;
        }

        // İndirim miktarını hesapla
        if (discountType === "percentage" && discountValue) {
          const percentage = parseFloat(discountValue);
          discountAmount = (discountBaseAmount * percentage) / 100;
        } else if (discountType === "amount" && discountValue) {
          discountAmount = Math.min(parseFloat(discountValue), discountBaseAmount);
        }

        // İndirim varsa uygula
        if (discountAmount > 0) {
          // Eğer seçili ürünler varsa, indirimi sadece seçili ürünlere uygula
          // ÖNEMLİ: Sadece pendingItemsToUse (seçili ürünler listesi) kullan
          if (pendingItemsToUse.length > 0) {
            // Seçili ürünlerin toplam fiyatına direkt indirim uygula
            // discountBaseAmount zaten sadece seçili ürünlerin toplam fiyatı
            // discountAmount zaten bu toplam üzerinden hesaplanmış indirim miktarı
            // Şimdi bu indirimi seçili ürünlere orantılı olarak dağıt
            const discountRatio = discountBaseAmount > 0 
              ? discountAmount / discountBaseAmount 
              : 0;

            // Seçili ürünlerin subtotal değerlerini güncelle
            const updatedItems = [...order.items];
            
            // ÖNEMLİ: Sadece pendingItemsToUse içindeki ürünlere indirim uygula
            if (quantitiesToUse.size > 0) {
              // Miktar seçimi yapılmışsa, sadece seçilen miktarlara indirim uygula
              pendingItemsToUse.forEach((paymentItem) => {
                const selectedQty = quantitiesToUse.get(paymentItem.menuId) || 0;
                if (selectedQty > 0) {
                  // Bu ürün için seçilen miktarın toplam fiyatı
                  const selectedTotal = selectedQty * paymentItem.menuPrice;
                  // Bu ürün için indirim miktarı (orantılı)
                  const itemDiscount = selectedTotal * discountRatio;
                  
                  // Bu ürünün indices'lerine indirimi uygula
                  let remainingQty = selectedQty;
                  for (const index of paymentItem.indices) {
                    if (remainingQty <= 0) break;
                    if (!itemsToUse.has(index)) continue;
                    const item = updatedItems[index];
                    if (!item || item.menuId !== paymentItem.menuId) continue;
                    
                    const qtyToUse = Math.min(item.quantity, remainingQty);
                    // Bu index'teki ürün için indirim miktarı (orantılı)
                    // selectedTotal bu ürün için seçilen miktarın toplam fiyatı
                    const indexDiscount = (qtyToUse * item.menuPrice / selectedTotal) * itemDiscount;
                    
                    // Sadece seçilen miktar kadar indirim uygula
                    // Eğer ürünün tamamı seçildiyse, subtotal'ı güncelle
                    // Eğer kısmi seçildiyse, sadece seçilen kısmın indirimini uygula
                    if (qtyToUse === item.quantity) {
                      // Tüm ürün seçildiyse, orijinal fiyattan indirim düş
                      const originalTotal = item.menuPrice * item.quantity;
                      updatedItems[index] = {
                        ...item,
                        subtotal: Math.max(0, originalTotal - indexDiscount),
                      };
                    } else {
                      // Kısmi seçildiyse, sadece seçilen kısmın indirimini uygula
                      const discountPerUnit = indexDiscount / qtyToUse;
                      const discountedPricePerUnit = item.menuPrice - discountPerUnit;
                      // Seçilen kısım indirimli, seçilmeyen kısım normal fiyat
                      updatedItems[index] = {
                        ...item,
                        subtotal: (discountedPricePerUnit * qtyToUse) + (item.menuPrice * (item.quantity - qtyToUse)),
                      };
                    }
                    
                    remainingQty -= qtyToUse;
                  }
                }
              });
            } else if (pendingPaymentQuantity) {
              // Tek ürün için miktar seçildiyse
              let remainingQty = pendingPaymentQuantity.quantity;
              for (const index of pendingPaymentQuantity.indices) {
                if (remainingQty <= 0) break;
                if (!itemsToUse.has(index)) continue;
                const item = updatedItems[index];
                if (!item) continue;
                
                const qtyToUse = Math.min(item.quantity, remainingQty);
                // Orijinal fiyat üzerinden indirim hesapla
                const originalSubtotalForQty = qtyToUse * item.menuPrice;
                const itemDiscount = originalSubtotalForQty * discountRatio;
                
                if (qtyToUse === item.quantity) {
                  // Tüm ürün seçildiyse, orijinal fiyattan indirim düş
                  const originalTotal = item.menuPrice * item.quantity;
                  updatedItems[index] = {
                    ...item,
                    subtotal: Math.max(0, originalTotal - itemDiscount),
                  };
                } else {
                  // Kısmi seçildiyse, sadece seçilen kısmın indirimini uygula
                  const discountPerUnit = itemDiscount / qtyToUse;
                  const discountedPricePerUnit = item.menuPrice - discountPerUnit;
                  updatedItems[index] = {
                    ...item,
                    subtotal: (discountedPricePerUnit * qtyToUse) + (item.menuPrice * (item.quantity - qtyToUse)),
                  };
                }
                
                remainingQty -= qtyToUse;
              }
              
              // Diğer seçili ürünleri ekle (pendingPaymentQuantity.indices içinde olmayan)
              const pendingIndicesSet = new Set(pendingPaymentQuantity.indices);
              const selectedItemsArray = Array.from(itemsToUse);
              selectedItemsArray.forEach((index) => {
                if (!pendingIndicesSet.has(index)) {
                  const item = updatedItems[index];
                  if (item) {
                    const originalSubtotal = item.menuPrice * item.quantity;
                    const itemDiscount = originalSubtotal * discountRatio;
                    updatedItems[index] = {
                      ...item,
                      subtotal: Math.max(0, originalSubtotal - itemDiscount),
                    };
                  }
                }
              });
            } else {
              // Hiç miktar seçilmediyse, tüm seçili ürünlerin tamamına indirim uygula
              // ÖNEMLİ: Sadece pendingItemsToUse içindeki ürünlere uygula
              pendingItemsToUse.forEach((paymentItem) => {
                // Bu ürün için toplam fiyat
                const itemTotal = paymentItem.totalQuantity * paymentItem.menuPrice;
                // Bu ürün için indirim miktarı (orantılı)
                const itemDiscount = itemTotal * discountRatio;
                
                // Bu ürünün indices'lerine indirimi uygula
                for (const index of paymentItem.indices) {
                  if (!itemsToUse.has(index)) continue;
                  const item = updatedItems[index];
                  if (!item || item.menuId !== paymentItem.menuId) continue;
                  
                  // Bu index'teki ürün için indirim miktarı (orantılı)
                  const indexDiscount = (item.menuPrice * item.quantity / itemTotal) * itemDiscount;
                  
                  const originalSubtotal = item.menuPrice * item.quantity;
                  updatedItems[index] = {
                    ...item,
                    subtotal: Math.max(0, originalSubtotal - indexDiscount),
                  };
                }
              });
            }

            // Sipariş toplamlarını güncelle
            // order.subtotal her zaman orijinal fiyatların toplamı olmalı
            const newSubtotal = updatedItems.reduce(
              (sum, item) => sum + (item.menuPrice * item.quantity),
              0
            );
            // order.total ise indirimli toplam olmalı
            const newTotal = updatedItems.reduce(
              (sum, item) => sum + item.subtotal,
              0
            );

            // İndirim uygulandıktan sonra paidItems'ı güncelle (indirimli subtotal değerleri ile)
            if (paidItems && paidItems.length > 0 && updatedItems.length > 0) {
              paidItems = paidItems.map((paidItem) => {
                // Bu paidItem için updatedItems içindeki güncellenmiş item'ı bul
                // Birden fazla item aynı menuId'ye sahip olabilir, hepsini topla
                const matchingItems = updatedItems.filter((item) => item.menuId === paidItem.menuId);
                if (matchingItems.length > 0) {
                  // Seçilen miktar
                  const selectedQty = quantitiesToUse.get(paidItem.menuId) || paidItem.quantity;
                  
                  // Eğer miktar seçimi yapıldıysa, seçilen miktar kadar subtotal hesapla
                  // updatedItems içindeki item'ların subtotal'larını topla ve orantılı olarak seçilen miktara göre hesapla
                  let totalOriginalSubtotal = 0;
                  let totalDiscountedSubtotal = 0;
                  let totalQuantity = 0;
                  
                  matchingItems.forEach((item) => {
                    const originalSubtotal = item.menuPrice * item.quantity;
                    totalOriginalSubtotal += originalSubtotal;
                    totalDiscountedSubtotal += item.subtotal;
                    totalQuantity += item.quantity;
                  });
                  
                  // İndirim oranını hesapla
                  const discountRatio = totalOriginalSubtotal > 0 
                    ? (totalOriginalSubtotal - totalDiscountedSubtotal) / totalOriginalSubtotal 
                    : 0;
                  
                  // Seçilen miktar için orijinal subtotal
                  const selectedOriginalSubtotal = paidItem.menuPrice * selectedQty;
                  // Seçilen miktar için indirimli subtotal
                  const selectedDiscountedSubtotal = selectedOriginalSubtotal * (1 - discountRatio);
                  
                  return {
                    ...paidItem,
                    quantity: selectedQty,
                    subtotal: selectedDiscountedSubtotal,
                  };
                }
                return paidItem;
              });
            }

            await updateOrder(order.id!, {
              items: updatedItems,
              subtotal: newSubtotal,
              total: newTotal,
            });
          } else {
            // Seçili ürün yoksa, indirimi tüm siparişe uygula (sadece tam ödeme için)
            if (!isPartialPayment) {
              const currentDiscount = order.discount || 0;
              const newDiscount = currentDiscount + discountAmount;
              const newSubtotal = order.subtotal;
              const newTotal = Math.max(0, newSubtotal - newDiscount);

              await updateOrder(order.id!, {
                discount: newDiscount,
                total: newTotal,
              });
            }
          }
        }

        const payment: Payment = {
          amount,
          method: paymentMethodToUse, // overridePaymentMethod veya paymentMethod state'i
          paidAt: new Date(),
          isGift: isGift || false,
          paidItems: isPartialPayment ? paidItems : undefined,
        };

        // Kısmi ödeme ise seçili ürünleri order'dan kaldır (önce kaldır, sonra ödeme ekle)
        // Eğer ürün seçilmemişse (itemsToUse.size === 0), ürün miktarlarında değişiklik yapma
        if (isPartialPayment && itemsToUse.size > 0) {
          const updatedItems = [...order.items];
          const itemsToUpdate: Array<{
            index: number;
            quantity: number;
            subtotal: number;
          }> = [];
          const indicesToRemove = new Set<number>();

          // Eğer birden fazla ürün için miktar seçildiyse, her ürün için seçilen miktar kadar kaldır
          // allPendingIndices: Sadece işlenen (seçilen miktar kadar) index'leri tutar
          const allPendingIndices = new Set<number>();
          
          // itemsToUse içindeki index'leri kullan - zaten sadece seçilen miktar kadar index içeriyor
          const processedIndices = new Set<number>();

          if (pendingItemsToUse.length > 0 && quantitiesToUse.size > 0) {
            // Tüm ürünler için seçilen miktarları kullan
            pendingItemsToUse.forEach((paymentItem) => {
              // Eğer bu ürün için miktar seçildiyse kullan, yoksa tüm miktarı kullan
              const selectedQty =
                quantitiesToUse.get(paymentItem.menuId) ||
                paymentItem.totalQuantity;
              let remainingQuantity = selectedQty;

              for (const index of paymentItem.indices) {
                if (remainingQuantity <= 0) break;
                // Sadece itemsToUse içindeki index'leri işle
                if (!itemsToUse.has(index)) continue;
                
                const item = order.items[index];
                if (!item || item.menuId !== paymentItem.menuId) continue; // menuId kontrolü ekle

                // Sadece işlenen (seçilen miktar kadar) index'leri allPendingIndices'e ekle
                processedIndices.add(index);
                allPendingIndices.add(index);
                
                // Eğer item'ın tamamı ödendiyse veya bir kısmı ödendiyse, index'i ekle
                if (item.quantity <= remainingQuantity) {
                  // Tüm item'ı kaldır (tamamı ödendi)
                  indicesToRemove.add(index);
                  remainingQuantity -= item.quantity;
                } else {
                  // Item'ın bir kısmını kaldır - quantity'yi azalt (sadece ödenen miktar kadar)
                  const newQuantity = item.quantity - remainingQuantity;
                  const newSubtotal = newQuantity * item.menuPrice;
                  itemsToUpdate.push({
                    index,
                    quantity: newQuantity,
                    subtotal: newSubtotal,
                  });
                  remainingQuantity = 0;
                }
              }
            });
          } else if (pendingItemsToUse.length > 0) {
            // Eğer pendingItemsToUse varsa ama quantitiesToUse yoksa, itemsToUse içindeki tüm index'leri kullan
            itemsToUse.forEach((index) => {
              const item = order.items[index];
              if (!item) return;
              
              processedIndices.add(index);
              allPendingIndices.add(index);
              indicesToRemove.add(index);
            });
          }
          // Eğer sadece pendingPaymentQuantity varsa (tek ürün için miktar seçildiyse)
          else if (pendingPaymentQuantity) {
            let remainingQuantity = pendingPaymentQuantity.quantity;

            for (const index of pendingPaymentQuantity.indices) {
              if (remainingQuantity <= 0) break;
              const item = order.items[index];
              if (!item) continue;

              allPendingIndices.add(index);

              if (item.quantity <= remainingQuantity) {
                // Tüm item'ı kaldır (tamamı ödendi)
                indicesToRemove.add(index);
                remainingQuantity -= item.quantity;
              } else {
                // Item'ın bir kısmını kaldır - quantity'yi azalt (sadece ödenen miktar kadar)
                const newQuantity = item.quantity - remainingQuantity;
                const newSubtotal = newQuantity * item.menuPrice;
                itemsToUpdate.push({
                  index,
                  quantity: newQuantity,
                  subtotal: newSubtotal,
                });
                remainingQuantity = 0;
              }
            }
          }

          // Eğer quantitiesToUse ile miktar seçildiyse, sadece allPendingIndices içindeki ürünleri işle
          // itemsToUse zaten sadece seçilen miktar kadar index içeriyor
          // allPendingIndices de sadece işlenen (seçilen miktar kadar) index'leri içeriyor
          // Bu yüzden otherSelectedIndices mantığına gerek yok - sadece allPendingIndices içindeki ürünler işlendi
          
          // Eğer pendingItemsToUse veya pendingPaymentQuantity yoksa ve selectedItems varsa, 
          // o zaman itemsToUse içindeki tüm index'leri kaldır (otherSelectedIndices mantığı)
          if (pendingItemsToUse.length === 0 && !pendingPaymentQuantity && itemsToUse.size > 0) {
            // Eğer quantitiesToUse yoksa ve selectedItems varsa, tüm seçili ürünleri kaldır
            const selectedItemsArray = Array.from(itemsToUse);
            const otherSelectedIndices = selectedItemsArray
              .filter((index) => !allPendingIndices.has(index))
              .sort((a, b) => b - a);

            otherSelectedIndices.forEach((index) => {
              if (index >= 0 && index < updatedItems.length) {
                indicesToRemove.add(index);
              }
            });
          }
          // Eğer pendingItemsToUse veya pendingPaymentQuantity varsa, 
          // allPendingIndices içindeki ürünler zaten işlendi, başka bir şey yapmaya gerek yok

          // Önce quantity güncellemelerini yap (kısmi ödeme için)
          if (itemsToUpdate.length > 0) {
            itemsToUpdate.forEach((update) => {
              const item = updatedItems[update.index];
              if (item) {
                updatedItems[update.index] = {
                  ...item,
                  quantity: update.quantity,
                  subtotal: update.subtotal,
                };
              }
            });
          }

          // Sonra tamamen kaldırılacak index'leri sil (büyükten küçüğe sırala)
          const sortedIndicesToRemove = Array.from(indicesToRemove).sort(
            (a, b) => b - a
          );
          sortedIndicesToRemove.forEach((index) => {
            if (index >= 0 && index < updatedItems.length) {
              updatedItems.splice(index, 1);
            }
          });

          // Yeni toplamları hesapla
          const newSubtotal = updatedItems.reduce(
            (sum, item) => sum + item.subtotal,
            0
          );
          
          // Seçili ürünlere indirim uygulanıp uygulanmadığını kontrol et
          // Seçili ürünlerin subtotal'larının orijinal fiyatlarından düşük olup olmadığını kontrol et
          let hasSelectedItemsDiscount = false;
          if (itemsToUse.size > 0) {
            const selectedItemsOriginalTotal = Array.from(itemsToUse).reduce((sum, index) => {
              const item = order.items[index];
              if (item) {
                return sum + (item.menuPrice * item.quantity);
              }
              return sum;
            }, 0);
            
            const selectedItemsDiscountedTotal = Array.from(itemsToUse).reduce((sum, index) => {
              const item = order.items[index];
              if (item) {
                return sum + item.subtotal;
              }
              return sum;
            }, 0);
            
            // Eğer seçili ürünlerin indirimli toplamı orijinal toplamından düşükse, indirim uygulanmış demektir
            hasSelectedItemsDiscount = selectedItemsDiscountedTotal < selectedItemsOriginalTotal;
          }
          
          // Seçili ürünlere indirim uygulanmışsa, order.discount'ı sıfırla
          // Çünkü indirim sadece seçili ürünlere uygulanmıştır ve ödemesi alındıktan sonra masada indirim kalmamalı
          const discountToApply = hasSelectedItemsDiscount ? 0 : (order.discount || 0);
          const newTotal = Math.max(0, newSubtotal - discountToApply);

          // Order'ı güncelle (ürünleri kaldır)
          await updateOrder(order.id!, {
            items: updatedItems,
            subtotal: newSubtotal,
            total: newTotal,
            discount: discountToApply, // Seçili ürünlere indirim uygulanmışsa, masada indirim kalmamalı
          });

          // Seçili ürünleri temizle
          setSelectedItems(new Set());
          setPendingPaymentQuantity(null);
          // NOT: pendingPaymentItems ve selectedQuantities ödeme işleminde kullanılacak, şimdi temizleme
        }
        // Eğer itemsToUse.size === 0 ise (ürün seçilmemişse), ürün miktarlarında değişiklik yapma
        // Ancak tag'ların ödemesini aldığında (kısmi ödeme ve ürün seçilmemişse), order'ın total'ini güncelle
        if (isPartialPayment && itemsToUse.size === 0) {
          // Tag'ların ödemesini aldığında, order'ın total'inden ödeme tutarını düş
          const currentSubtotal = (order.items || []).reduce(
            (sum, item) => sum + item.subtotal,
            0
          );
          const currentDiscount = order.discount || 0;
          const currentTotal = order.total || currentSubtotal - currentDiscount;
          
          // Yeni total'i hesapla (ödeme tutarını düş)
          const newTotal = Math.max(0, currentTotal - amount);
          
          // Order'ı güncelle (sadece total'i güncelle, items değişmeyecek)
          await updateOrder(order.id!, {
            total: newTotal,
          });
        }

        // Ödemeyi ekle
        await addPayment(order.id!, payment);

        // Siparişi yeniden yükle (güncel haliyle) - önce yükle ki diğer işlemlerde kullanabilelim
        const updatedOrder = await getOrder(order.id!);

        // Arka planda yapılacak işlemler için verileri hazırla
        const effectiveCompanyId = companyId || userData?.companyId;
        const effectiveBranchId = branchId || userData?.assignedBranchId;

        // Ödeme yöntemi adını bul (bir kez hesapla)
        const selectedPaymentMethod = paymentMethods.find(
          (pm) => pm.code === paymentMethodToUse
        );
        const paymentMethodName = selectedPaymentMethod
          ? selectedPaymentMethod.name
          : paymentMethodToUse === "cash"
            ? "Nakit"
            : paymentMethodToUse === "card"
              ? "Kart"
              : paymentMethodToUse === "mealCard"
                ? "Yemek Kartı"
                : paymentMethodToUse;

        // Adisyon ve masa geçmişi kayıtlarını paralel olarak arka planda yap
        if (effectiveCompanyId) {
          // Adisyon oluşturma işlemini arka planda başlat
          (async () => {
            try {
              // Ödenen ürünleri belirle
              let billItems: OrderItem[] = [];

              if (isPartialPayment && paidItems) {
                // Kısmi ödeme: Sadece ödenen ürünleri al
                billItems = paidItems.map((paidItem) => {
                  const orderItem = order.items.find(
                    (item) => item.menuId === paidItem.menuId
                  );
                  if (orderItem) {
                    return {
                      ...orderItem,
                      quantity: paidItem.quantity,
                      subtotal: paidItem.subtotal,
                    };
                  }
                  return {
                    menuId: paidItem.menuId,
                    menuName: paidItem.menuName,
                    menuPrice: paidItem.subtotal / paidItem.quantity,
                    quantity: paidItem.quantity,
                    subtotal: paidItem.subtotal,
                    addedAt: new Date(),
                  };
                });
              } else {
                // Tam ödeme: Tüm ürünleri al
                billItems = [...order.items];
              }

              // Adisyon toplamlarını hesapla
              // Orijinal fiyatları kullan (indirim öncesi)
              const billSubtotal = billItems.reduce(
                (sum, item) => sum + (item.menuPrice * item.quantity),
                0
              );
              const billDiscount = isPartialPayment ? 0 : order.discount || 0;
              const billTotal = Math.max(0, billSubtotal - billDiscount);

              // Adisyon oluştur
              await addBill({
                companyId: effectiveCompanyId,
                branchId: effectiveBranchId || undefined,
                tableId: currentTable.id!,
                tableNumber: currentTable.tableNumber,
                orderId: order.id!,
                items: billItems,
                subtotal: billSubtotal,
                discount: billDiscount > 0 ? billDiscount : undefined,
                total: billTotal,
                payments: [payment],
                customerName: order.customerName,
                customerPhone: order.customerPhone,
                notes: order.notes,
                createdBy: userData?.id || currentUser?.uid || "",
              });
            } catch (error) {
              // Error saving bill
            }
          })();

          // Masa geçmişine kaydetme işlemini arka planda başlat
          (async () => {
            try {
              if (isPartialPayment && paidItems) {
                // Kısmi ödeme
                await addTableHistory(
                  effectiveCompanyId,
                  currentTable.id!,
                  currentTable.tableNumber,
                  "partial_payment",
                  `Kısmi ödeme alındı (${paymentMethodName})`,
                  {
                    paymentAmount: amount,
                    paymentMethod: paymentMethodName,
                    paidItems: paidItems,
                  },
                  effectiveBranchId || undefined
                );
              } else {
                // Tam ödeme
                await addTableHistory(
                  effectiveCompanyId,
                  currentTable.id!,
                  currentTable.tableNumber,
                  "full_payment",
                  `Tam ödeme alındı (${paymentMethodName})`,
                  {
                    paymentAmount: amount,
                    paymentMethod: paymentMethodName,
                  },
                  effectiveBranchId || undefined
                );
              }
            } catch (error) {
              // Error saving table history
            }
          })();
        }

        // Kurye ataması yapıldıysa (paket masaları için)
        const courierIdToUse =
          overrideCourierId !== undefined
            ? overrideCourierId
            : selectedCourierId;
        const packageCountToUse =
          overridePackageCount !== undefined
            ? overridePackageCount
            : packageCount;
        const changeAmountToUse =
          overrideChangeAmount !== undefined
            ? overrideChangeAmount
            : changeAmount;

        if (courierIdToUse && updatedOrder) {
          const courier = couriers.find((c) => c.id === courierIdToUse);
          if (courier) {
            const effectiveCompanyId = companyId || userData?.companyId;
            const effectiveBranchId = branchId || userData?.assignedBranchId;
            const packageCountNum = parseInt(packageCountToUse) || 1;
            const changeAmountNum = parseFloat(changeAmountToUse) || 0;

            // Kurye ataması oluştur
            await addCourierAssignment({
              companyId: effectiveCompanyId!,
              branchId: effectiveBranchId || undefined,
              orderId: updatedOrder.id!,
              tableId: currentTable.id!,
              tableNumber: currentTable.tableNumber,
              courierId: courier.id!,
              courierName: courier.name,
              packageCount: packageCountNum,
              changeAmount: changeAmountNum,
              paymentMethod: paymentMethodToUse, // overridePaymentMethod veya paymentMethod state'i
              totalAmount: amount,
              assignedBy: userData?.id || currentUser?.uid || "",
            });

            // Siparişe kurye bilgilerini ekle
            await updateOrder(updatedOrder.id!, {
              courierId: courier.id,
              courierName: courier.name,
              changeAmount: changeAmountNum,
            });
          }
        }

        // Ödeme alındığında ana yazıcıdan yazdır (arka planda, await olmadan)
        // Yazdırma için gerekli verileri sakla
        const printData = {
          isPartialPayment,
          paidItems: paidItems,
          orderItems: order.items,
          updatedOrderItems: updatedOrder?.items || [],
          amount,
          paymentMethodName,
          tableNumber: currentTable.tableNumber,
          orderNumber: updatedOrder?.orderNumber || order.orderNumber,
          discount: updatedOrder?.discount || 0,
          subtotal: updatedOrder?.subtotal || 0,
        };

        (async () => {
          try {
            const defaultPrinter = getDefaultPrinter(
              printers,
              selectedPrinterId
            );
            if (defaultPrinter && updatedOrder) {
              // Ödenen ürünleri al (kısmi ödeme durumunda sadece ödenenler)
              let paidItemsForPrint: OrderItem[] = [];

              if (printData.isPartialPayment && printData.paidItems) {
                // Kısmi ödeme: Sadece ödenen ürünleri al
                paidItemsForPrint = printData.paidItems.map((paidItem) => {
                  const orderItem = printData.orderItems.find(
                    (item) => item.menuId === paidItem.menuId
                  );
                  return orderItem
                    ? {
                        ...orderItem,
                        quantity: paidItem.quantity,
                        subtotal: paidItem.subtotal,
                      }
                    : {
                        menuId: paidItem.menuId,
                        menuName: paidItem.menuName,
                        menuPrice: paidItem.subtotal / paidItem.quantity,
                        quantity: paidItem.quantity,
                        subtotal: paidItem.subtotal,
                        addedAt: new Date(),
                        selectedExtras: [],
                      };
                });
              } else {
                // Tam ödeme: Tüm ürünleri al
                paidItemsForPrint = printData.updatedOrderItems;
              }

              if (paidItemsForPrint.length > 0) {
                const printContent = formatPrintContent(
                  "payment",
                  paidItemsForPrint,
                  printData.tableNumber,
                  undefined, // Sipariş no gösterilmeyecek
                  {
                    total: printData.amount,
                    paymentMethod: printData.paymentMethodName,
                    discount: printData.discount,
                    subtotal: printData.subtotal,
                    companyName: companyData?.name || "",
                    isPaid: true, // Ödeme alındı
                    paperWidth: defaultPrinter?.options?.paperWidth || 110,
                  }
                );
                await printToPrinter(
                  defaultPrinter.name,
                  printContent,
                  "payment"
                );
              }
            }
          } catch (error) {
            // Yazdırma hatası ödeme işlemini etkilemesin
          }
        })();

        // Tüm ödemelerin toplamını hesapla
        const totalPaidAmount = (updatedOrder?.payments || []).reduce(
          (sum, payment) => sum + payment.amount,
          0
        );
        // Order total'ini hesapla (subtotal - discount)
        const updatedOrderSubtotal = (updatedOrder?.items || []).reduce(
          (sum, item) => sum + item.subtotal,
          0
        );
        const updatedOrderDiscount = updatedOrder?.discount || 0;
        const orderTotalAmount =
          updatedOrder?.total || updatedOrderSubtotal - updatedOrderDiscount;
        const _isFullyPaid =
          totalPaidAmount >= orderTotalAmount && orderTotalAmount > 0;

        // Eğer TAM ödeme alındıysa (ve partial ödeme değilse) veya tüm ürünler kaldırıldıysa siparişi kapat
        // Not: Kısmi ödemede (seçilen ürünlerin belli adetleri) masada ürün kaldığı sürece sipariş açık kalmalı
        // Kurye atandıysa siparişi kapat
        // VEYA tüm ödemelerin toplamı order total'ine eşit veya fazlaysa VE kısmi ödeme değilse siparişi kapat
        const isFullyPaidCheck =
          totalPaidAmount >= orderTotalAmount && orderTotalAmount > 0 && !isPartialPayment;
        
        if (
          (!isPartialPayment && updatedOrder?.paymentStatus === "paid") ||
          (updatedOrder && updatedOrder.items.length === 0) ||
          courierIdToUse ||
          (isFullyPaidCheck && updatedOrder && orderTotalAmount > 0)
        ) {
          // Tam ödeme alındıysa, refresh sırasında loading göster ve ürün eklemeyi engelle

          // Tüm ürünler kaldırıldıysa ya da tam ödeme alındıysa veya kurye atandıysa siparişi kapat
          if (updatedOrder && currentTable.id) {
            await updateOrderStatus(updatedOrder.id!, "closed");
            // Masa durumunu güncelle
            try {
              await updateTableStatus(currentTable.id, "available", undefined);
            } catch (error) {
              console.error("Masa durumu güncellenirken hata:", error);
            }
            // Siparişi boş olarak güncelle (liste görünür kalır ama boş olur)
            await updateOrder(updatedOrder.id!, {
              items: [],
              subtotal: 0,
              total: 0,
              discount: 0,
            });

            // Tam ödeme alındıysa hemen order state'ini null yap - UI'ı temizle
            if (isFullyPaidCheck) {
              setIsRefreshingOrder(true);
              setOrder(null); // Hemen null yap ki eski ürünler görünmesin
              setCart([]); // Cart'ı da temizle
              setNotes(""); // Notes'u da temizle
            }

            // Modal'ı kapat
            setShowPaymentModal(false);
            setPaymentAmount("0");
            setPaymentMethod("");
            setAppliedPayments([]);
          }

          // Her ödeme alındığında (kısmi veya tam) masayı refresh et ve masada kal
          // Eğer tam ödeme alındıysa, önce refresh yap sonra masaya dön
          try {
            // Önce güncel order'ı al (updatedOrder zaten güncel)
            // Eğer updatedOrder varsa onu kullan, yoksa getOrdersByCompany ile al
            let finalOrder: Order | null = null;
            
            if (updatedOrder && updatedOrder.items && updatedOrder.items.length > 0) {
              // updatedOrder güncel, onu kullan
              finalOrder = updatedOrder;
            } else {
              // updatedOrder yoksa veya items boşsa, getOrdersByCompany ile kontrol et
              const allOrders = await getOrdersByCompany(
                companyId || userData?.companyId || "",
                {
                  branchId: branchId || userData?.assignedBranchId || undefined,
                }
              );
              // Sadece items'ı olan ve active olan order'ı bul
              const activeOrder = allOrders.find(
                (o) =>
                  o.tableId === currentTable.id &&
                  o.status === "active" &&
                  o.items &&
                  o.items.length > 0
              );
              if (activeOrder) {
                finalOrder = activeOrder;
              }
            }

            // Masa bilgilerini de yeniden yükle
            if (currentTable.id) {
              try {
                const refreshedTable = await getTable(currentTable.id);
                if (refreshedTable) {
                  setCurrentTable(refreshedTable);
                }
              } catch (error) {
                // Masa bulunamazsa hata verme, sadece logla
                console.error("Masa güncellenirken hata:", error);
              }
            }

            // Eğer tam ödeme alındıysa kesinlikle null yap - yeni adisyon için hazır
            if (isFullyPaidCheck) {
              setOrder(null);
              setCart([]);
              setNotes("");
            } else if (finalOrder && finalOrder.items && finalOrder.items.length > 0) {
              // Güncel order varsa ve items'ı varsa göster
              setOrder(finalOrder);
            } else {
              // Order yoksa veya items boşsa null yap
              setOrder(null);
              setCart([]);
              setNotes("");
            }
          } catch (error) {
            // Hata durumunda null yap
            setOrder(null);
            setCart([]);
            setNotes("");
          } finally {
            // Loading state'ini her durumda kapat - yeni ürün eklenebilsin
            setIsRefreshingOrder(false);
          }

          // Navigation ayarını kontrol et - eğer returnAfterPayment açıksa, URL'yi güncelleme
          const navSettings = localStorage.getItem("navigationSettings");
          let shouldReturnAfterPayment = false;
          if (navSettings) {
            try {
              const settings = JSON.parse(navSettings);
              shouldReturnAfterPayment = settings.returnAfterPayment === true;
            } catch (error) {
              // Hata durumunda devam et
            }
          }

          // Eğer returnAfterPayment açıksa, URL'yi güncelleme ve doğrudan yönlendirme yap
          if (shouldReturnAfterPayment) {
            // Yönlendirme yapmadan önce kısa bir gecikme ekle
            setTimeout(() => {
              navigateToHome();
            }, 100);
            return; // Hemen return yap, diğer işlemleri yapma
          }

          // URL'den payment parametresini kaldır (sadece returnAfterPayment kapalıysa)
          navigate({
            to: "/table/$tableId",
            params: { tableId: tableId },
            search: (prev) => ({
              area: prev?.area ?? undefined,
              activeOnly: prev?.activeOnly ?? false,
              payment: undefined,
            }),
            replace: true,
          });
        }

        // Kısmi ödeme durumunda siparişi güncelle
        setOrder(updatedOrder);
        setShowPaymentModal(false);
        setPaymentAmount("");
        setDiscountType("percentage");
        setDiscountValue("");

        // Kurye atama state'lerini temizle
        setSelectedCourierId("");
        setPackageCount("1");
        setChangeAmount("0");

        // Ödeme işlemi tamamlandı, modal state'lerini temizle
        setPendingPaymentItems([]);
        setCurrentPaymentItemIndex(0);
        setSelectedQuantities(new Map());

        // Navigation ayarını kontrol et (kısmi ödeme için)
        const navSettings = localStorage.getItem("navigationSettings");
        let shouldReturnAfterPayment = false;
        if (navSettings) {
          try {
            const settings = JSON.parse(navSettings);
            shouldReturnAfterPayment = settings.returnAfterPayment === true;
          } catch (error) {
            // Hata durumunda devam et
          }
        }

        // Eğer returnAfterPayment açıksa, URL'yi güncelleme ve doğrudan yönlendirme yap
        if (shouldReturnAfterPayment) {
          // Yönlendirme yapmadan önce kısa bir gecikme ekle
          // Böylece route loader'ın çalışmasını engelle
          setTimeout(() => {
            navigateToHome();
          }, 100);
          return; // Hemen return yap, diğer işlemleri yapma
        }

        // URL'den payment parametresini kaldır (sadece returnAfterPayment kapalıysa)
        navigate({
          to: "/table/$tableId",
          params: { tableId: tableId },
          search: (prev) => ({
            area: (prev?.area ?? undefined) as string | undefined,
            activeOnly: prev?.activeOnly ?? false,
            payment: undefined,
          }),
          replace: true,
        });
      } catch (error) {
        customAlert("Ödeme işlenirken bir hata oluştu", "Hata", "error");
      } finally {
        setIsProcessingPayment(false);
      }
    },
    [
      order,
      paymentAmount,
      paymentMethod,
      paymentMethods,
      discountType,
      discountValue,
      selectedItems,
      pendingPaymentQuantity,
      pendingPaymentItems,
      selectedQuantities,
      selectedCourierId,
      packageCount,
      changeAmount,
      couriers,
      companyId,
      branchId,
      userData,
      currentTable,
      navigate,
      printers,
      selectedPrinterId,
    ]
  );

  // Ürün iptal etme
  const _handleCancelItem = useCallback(async () => {
    if (!order || !selectedItem) return;

    try {
      // Index bilgisini kullan (en basit ve güvenilir yöntem)
      let itemIndex = (selectedItem as any)._index;

      // Index yoksa, id'den çıkar veya menuId ile ilk eşleşeni bul
      if (itemIndex === undefined || itemIndex < 0) {
        if (selectedItem.id && selectedItem.id.includes("-")) {
          // Format: "menuId-index" - son kısmı index olarak kullan
          const parts = selectedItem.id.split("-");
          const lastPart = parts[parts.length - 1];
          itemIndex = parseInt(lastPart);
          if (isNaN(itemIndex)) {
            // Id'den index çıkarılamadı, menuId ile ilk eşleşeni bul
            itemIndex = order.items.findIndex(
              (item) => item.menuId === selectedItem.menuId
            );
          }
        } else {
          // Id yoksa veya format yanlışsa, menuId ile ilk eşleşeni bul
          itemIndex = order.items.findIndex(
            (item) => item.menuId === selectedItem.menuId
          );
        }
      }

      if (
        itemIndex === -1 ||
        itemIndex < 0 ||
        itemIndex >= order.items.length
      ) {
        customAlert("Ürün bulunamadı", "Hata", "error");
        return;
      }

      // Index ile sil - sadece seçilen item'ı sil
      const canceledItem = order.items[itemIndex];
      const updatedItems = order.items.filter(
        (_, index) => index !== itemIndex
      );

      // İptal edilen ürünü canceledItems'a ekle
      const canceledItems = order.canceledItems || [];
      canceledItems.push({
        ...canceledItem,
        addedAt: canceledItem.addedAt || new Date(),
        canceledAt: new Date(),
      });

      // Eğer hiç ürün kalmadıysa siparişi kapat ve masayı müsait yap
      if (updatedItems.length === 0) {
        try {
          // İptal edilen ürünü yazdır (kategori yazıcılarına) - sipariş kapanmadan önce
          try {
            const menuItem = menus.find((m) => m.id === canceledItem.menuId);
            if (menuItem && menuItem.category) {
              const category = categories.find(
                (c) => c.name === menuItem.category
              );
              if (category) {
                // Bu kategoriye atanmış yazıcıları bul
                const categoryPrinters = getPrintersForCategories(
                  printers,
                  categories,
                  [category.id || ""]
                );

                // Her yazıcıya yazdır
                for (const printer of categoryPrinters) {
                  const printContent = formatPrintContent(
                    "cancel",
                    [canceledItem],
                    currentTable.tableNumber,
                    order.orderNumber,
                    {
                      companyName: companyData?.name || "",
                    }
                  );
                  await printToPrinter(printer.name, printContent, "cancel");
                }
              }
            }
          } catch (error) {
            // Yazdırma hatası iptal işlemini etkilemesin
          }

          // Önce canceledItems'ı kaydet
          const subtotal = 0;
          const total = 0;
          await updateOrder(order.id!, {
            items: updatedItems,
            canceledItems: canceledItems,
            subtotal: subtotal,
            total: total,
          });

          // Sonra masayı müsait yap (currentOrderId'yi temizle)
          await updateTableStatus(currentTable.id!, "available", undefined);

          // Navigation ayarını kontrol et
          const navSettings = localStorage.getItem("navigationSettings");
          if (navSettings) {
            try {
              const settings = JSON.parse(navSettings);
              if (
                settings.returnAfterProductCancel ||
                settings.returnAfterOrderClose
              ) {
                navigateToHome();
                return;
              }
            } catch (error) {
              // Hata durumunda varsayılan davranış (masalara dön)
              navigateToHome();
              return;
            }
          } else {
            // Ayar yoksa varsayılan davranış (masalara dön)
            navigateToHome();
            return;
          }

          // Sonra siparişi kapat (updateOrderStatus zaten masayı güncelliyor ama emin olmak için)
          await updateOrderStatus(order.id!, "closed");

          // Masayı yeniden yükle
          if (currentTable.id) {
            try {
              const updatedTable = await getTable(currentTable.id);
              if (updatedTable) {
                setCurrentTable(updatedTable);
              }
            } catch (error) {
              console.error("Masa güncellenirken hata:", error);
            }
          }

          setOrder(null);
          setShowCancelItemModal(false);
          setSelectedItem(null);

          // Ana sayfaya yönlendir (alert vermeden)
          navigateToHome();
        } catch (error) {
          customAlert("Sipariş kapatılırken bir hata oluştu", "Hata", "error");
        }
        return;
      }

      // Toplam hesapla
      const subtotal = updatedItems.reduce(
        (sum, item) => sum + item.subtotal,
        0
      );
      const total = subtotal - (order.discount || 0);

      await updateOrder(order.id!, {
        items: updatedItems,
        canceledItems: canceledItems,
        subtotal: subtotal,
        total: total,
      });

      // İptal edilen ürünü yazdır (kategori yazıcılarına)
      try {
        const menuItem = menus.find((m) => m.id === canceledItem.menuId);
        if (menuItem && menuItem.category) {
          const category = categories.find((c) => c.name === menuItem.category);
          if (category) {
            // Bu kategoriye atanmış yazıcıları bul
            const categoryPrinters = getPrintersForCategories(
              printers,
              categories,
              [category.id || ""]
            );

            // Her yazıcıya yazdır
            for (const printer of categoryPrinters) {
              const printContent = formatPrintContent(
                "cancel",
                [canceledItem],
                currentTable.tableNumber,
                order.orderNumber,
                {
                  companyName: companyData?.name || "",
                  paperWidth: printer.paperWidth || 48,
                }
              );
              await printToPrinter(printer.name, printContent, "cancel");
            }
          }
        }
      } catch (error) {
        // Yazdırma hatası iptal işlemini etkilemesin
      }

      // Masa geçmişine kaydet
      const effectiveCompanyId = companyId || userData?.companyId;
      const effectiveBranchId = branchId || userData?.assignedBranchId;
      if (effectiveCompanyId) {
        try {
          await addTableHistory(
            effectiveCompanyId,
            currentTable.id!,
            currentTable.tableNumber,
            "item_cancelled",
            `${canceledItem.menuName} iptal edildi`,
            {
              menuId: canceledItem.menuId,
              menuName: canceledItem.menuName,
              quantity: canceledItem.quantity,
              subtotal: canceledItem.subtotal,
            },
            effectiveBranchId || undefined
          );
        } catch (error) {
          // Error saving table history
        }
      }

      // Siparişi yeniden yükle
      const updatedOrder = await getOrder(order.id!);
      setOrder(updatedOrder);

      setShowCancelItemModal(false);
      setSelectedItem(null);

      // Navigation ayarını kontrol et
      const navSettings = localStorage.getItem("navigationSettings");
      if (navSettings) {
        try {
          const settings = JSON.parse(navSettings);
          if (settings.returnAfterProductCancel) {
            navigateToHome();
          }
        } catch (error) {
          // Hata durumunda yönlendirme yapma
        }
      }
    } catch (error) {
      customAlert("Ürün iptal edilirken bir hata oluştu", "Hata", "error");
    }
  }, [
    order,
    selectedItem,
    currentTable,
    navigate,
    companyId,
    branchId,
    userData,
    menus,
    categories,
    printers,
  ]);

  // Ürün seçimi toggle
  const _toggleItemSelection = useCallback((index: number) => {
    setSelectedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  }, []);

  // Seçili ürünleri seçilen miktarlarla iptal et
  const handleCancelSelectedItemsWithQuantities = useCallback(
    async (
      quantities: Map<string, number>,
      selectedIndices: number[]
    ) => {
      if (!order || quantities.size === 0) return;

      setIsCanceling(true);
      try {
        const canceledItems = order.canceledItems || [];
        const updatedItems: OrderItem[] = [];
        const itemsToCancel: OrderItem[] = [];

        // Her index için işlem yap
        selectedIndices.forEach((index) => {
          const item = order.items[index];
          if (!item || item.canceledAt) {
            // Zaten iptal edilmiş veya geçersiz, olduğu gibi ekle
            updatedItems.push(item);
            return;
          }

          const cancelQty = quantities.get(item.menuId) || 0;
          const itemQty = item.quantity;

          if (cancelQty >= itemQty) {
            // Tüm miktar iptal ediliyor
            canceledItems.push({
              ...item,
              addedAt: item.addedAt || new Date(),
              canceledAt: new Date(),
            });
            itemsToCancel.push(item);
          } else if (cancelQty > 0) {
            // Kısmi iptal - ürünü böl
            const canceledItem: OrderItem = {
              ...item,
              quantity: cancelQty,
              subtotal: (item.subtotal / itemQty) * cancelQty,
              addedAt: item.addedAt || new Date(),
              canceledAt: new Date(),
            };
            canceledItems.push(canceledItem);
            itemsToCancel.push(canceledItem);

            // Kalan miktarı güncelle
            const remainingQty = itemQty - cancelQty;
            const remainingSubtotal = (item.subtotal / itemQty) * remainingQty;
            updatedItems.push({
              ...item,
              quantity: remainingQty,
              subtotal: remainingSubtotal,
            });
          } else {
            // İptal edilmeyecek, olduğu gibi ekle
            updatedItems.push(item);
          }
        });

        // Diğer ürünleri ekle (seçili olmayanlar)
        order.items.forEach((item, index) => {
          if (!selectedIndices.includes(index) && !item.canceledAt) {
            updatedItems.push(item);
          }
        });

        // Eğer hiç ürün kalmadıysa siparişi kapat ve masayı müsait yap
        if (updatedItems.length === 0) {
          const subtotal = 0;
          const total = 0;
          await updateOrder(order.id!, {
            items: updatedItems,
            canceledItems: canceledItems,
            subtotal: subtotal,
            total: total,
          });

          if (currentTable.id) {
            try {
              await updateTableStatus(currentTable.id, "available", undefined);
              await updateOrderStatus(order.id!, "closed");
              const updatedTable = await getTable(currentTable.id);
              if (updatedTable) {
                setCurrentTable(updatedTable);
              }
            } catch (error) {
              console.error("Masa güncellenirken hata:", error);
            }
          }
          setOrder(null);
          setSelectedItems(new Set());
          setPendingCancelItems([]);
          setSelectedCancelQuantities(new Map());
          setIsCanceling(false);
          return;
        }

        // Toplam hesapla
        const subtotal = updatedItems.reduce(
          (sum, item) => sum + item.subtotal,
          0
        );
        const total = subtotal - (order.discount || 0);

        await updateOrder(order.id!, {
          items: updatedItems,
          canceledItems: canceledItems,
          subtotal: subtotal,
          total: total,
        });

        // İptal edilen ürünleri yazdır (kategori yazıcılarına)
        try {
          if (itemsToCancel.length > 0) {
            for (const canceledItem of itemsToCancel) {
              const menuItem = menus.find((m) => m.id === canceledItem.menuId);
              if (menuItem && menuItem.category) {
                const category = categories.find(
                  (c) => c.name === menuItem.category
                );
                if (category) {
                  const categoryPrinters = getPrintersForCategories(
                    printers,
                    categories,
                    [category.id || ""]
                  );

                  for (const printer of categoryPrinters) {
                    const printContent = formatPrintContent(
                      "cancel",
                      [canceledItem],
                      currentTable.tableNumber,
                      order.orderNumber,
                      {
                        companyName: companyData?.name || "",
                        paperWidth: printer.paperWidth || 48,
                      }
                    );
                    await printToPrinter(printer.name, printContent, "cancel");
                  }
                }
              }
            }
          }
        } catch (error) {
          // Yazdırma hatası iptal işlemini etkilemesin
        }

        // Masa geçmişine kaydet
        const effectiveCompanyId = companyId || userData?.companyId;
        const effectiveBranchId = branchId || userData?.assignedBranchId;
        if (effectiveCompanyId) {
          try {
            for (const canceledItem of itemsToCancel) {
              await addTableHistory(
                effectiveCompanyId,
                currentTable.id!,
                currentTable.tableNumber,
                "item_cancelled",
                `${canceledItem.menuName} (${canceledItem.quantity} adet) iptal edildi`,
                {
                  menuId: canceledItem.menuId,
                  menuName: canceledItem.menuName,
                  quantity: canceledItem.quantity,
                  subtotal: canceledItem.subtotal,
                },
                effectiveBranchId || undefined
              );
            }
          } catch (error) {
            // Error saving table history
          }
        }

        // Siparişi yeniden yükle
        const updatedOrder = await getOrder(order.id!);
        setOrder(updatedOrder);
        setSelectedItems(new Set());
        setPendingCancelItems([]);
        setSelectedCancelQuantities(new Map());
        setShowQuantitySelectionModal(false);
        setQuantitySelectionAction(null);

        // Navigation ayarını kontrol et
        const navSettings = localStorage.getItem("navigationSettings");
        if (navSettings) {
          try {
            const settings = JSON.parse(navSettings);
            if (settings.returnAfterProductCancel) {
              navigateToHome();
            }
          } catch (error) {
            // Hata durumunda yönlendirme yapma
          }
        }
      } catch (error) {
        customAlert("Ürünler iptal edilirken bir hata oluştu", "Hata", "error");
      } finally {
        setIsCanceling(false);
      }
    },
    [
      order,
      menus,
      categories,
      printers,
      currentTable,
      companyId,
      branchId,
      userData,
      companyData,
      navigateToHome,
    ]
  );

  // Seçili ürünleri taşı
  const _handleMoveSelectedItems = useCallback(
    async (targetTableId: string) => {
      if (!order || selectedItems.size === 0) return;

      setIsMovingItems(true);
      try {
        // Eğer adet seçim modalından geliyorsa, her seçili üründen seçilen miktar kadar taşı
        let itemsToMove: OrderItem[] = [];

        // Eğer birden fazla ürün için miktar seçildiyse, tüm seçilen miktarları kullan
        if (pendingMoveItems.length > 0) {
          const itemsToMoveArray: OrderItem[] = [];
          const indicesToRemove = new Set<number>();
          const itemsToUpdate: Array<{
            index: number;
            quantity: number;
            subtotal: number;
          }> = [];

          // Tüm ürünler için seçilen miktarları kullan
          pendingMoveItems.forEach((moveItem) => {
            // Eğer bu ürün için miktar seçildiyse kullan, yoksa tüm miktarı kullan
            const selectedQty =
              selectedMoveQuantities.get(moveItem.menuId) ||
              moveItem.totalQuantity;
            let remainingQuantity = selectedQty;

            for (const index of moveItem.indices) {
              if (remainingQuantity <= 0) break;
              const item = order.items[index];
              if (!item) continue;

              const moveQty = Math.min(remainingQuantity, item.quantity);
              if (moveQty <= 0) continue;

              if (moveQty === item.quantity) {
                // Tüm satırı hedef masaya taşı
                itemsToMoveArray.push(item);
                indicesToRemove.add(index);
              } else {
                // Sadece moveQty kadarını taşı, kalan miktarı kaynak masada bırak
                const moveSubtotal = moveQty * item.menuPrice;
                itemsToMoveArray.push({
                  ...item,
                  quantity: moveQty,
                  subtotal: moveSubtotal,
                });

                const newQuantity = item.quantity - moveQty;
                const newSubtotal = newQuantity * item.menuPrice;
                itemsToUpdate.push({
                  index,
                  quantity: newQuantity,
                  subtotal: newSubtotal,
                });
              }

              remainingQuantity -= moveQty;
            }
          });

          itemsToMove = itemsToMoveArray;

          // Önce quantity güncellemelerini yap ve taşınacak index'leri çıkar
          let updatedItems = order.items
            .map((it, idx) => {
              if (indicesToRemove.has(idx)) {
                return null;
              }

              const update = itemsToUpdate.find((u) => u.index === idx);
              if (update) {
                return {
                  ...it,
                  quantity: update.quantity,
                  subtotal: update.subtotal,
                };
              }

              return it;
            })
            .filter((item): item is OrderItem => item !== null);

          // Hedef masayı al (önce al, geçmiş kaydetme için gerekli)
          const targetTable = await getTable(targetTableId);
          if (!targetTable) {
            customAlert("Hedef masa bulunamadı", "Hata", "error");
            return;
          }

          // Masa geçmişine kaydet - Her taşınan ürün için (return'den önce)
          const effectiveCompanyId = companyId || userData?.companyId;
          const effectiveBranchIdForHistory =
            branchId || userData?.assignedBranchId;
          if (effectiveCompanyId) {
            try {
              for (const item of itemsToMove) {
                // Kaynak masanın geçmişine kaydet
                await addTableHistory(
                  effectiveCompanyId,
                  currentTable.id!,
                  currentTable.tableNumber,
                  "item_moved",
                  `${item.menuName} Masa ${targetTable.tableNumber}'ya taşındı`,
                  {
                    menuId: item.menuId,
                    menuName: item.menuName,
                    quantity: item.quantity,
                    subtotal: item.subtotal,
                    movedFromTableNumber: currentTable.tableNumber,
                    movedToTableNumber: targetTable.tableNumber,
                  },
                  effectiveBranchIdForHistory || undefined
                );

                // Hedef masanın geçmişine kaydet
                await addTableHistory(
                  effectiveCompanyId,
                  targetTableId,
                  targetTable.tableNumber,
                  "item_added",
                  `${item.menuName} Masa ${currentTable.tableNumber}'dan taşındı`,
                  {
                    menuId: item.menuId,
                    menuName: item.menuName,
                    quantity: item.quantity,
                    subtotal: item.subtotal,
                    movedFromTableNumber: currentTable.tableNumber,
                    movedToTableNumber: targetTable.tableNumber,
                  },
                  effectiveBranchIdForHistory || undefined
                );
              }
            } catch (error) {
              // Error saving table history
            }
          }

          if (updatedItems.length === 0) {
            // Hiç ürün kalmadıysa siparişi kapat
            await updateTableStatus(currentTable.id!, "available", undefined);
            await updateOrderStatus(order.id!, "closed");
            setOrder(null);
            setSelectedItems(new Set());
            setShowMoveModal(false);
            setPendingMoveItems([]);
            setCurrentMoveItemIndex(0);
            setSelectedMoveQuantities(new Map());
            navigateToHome();
            return;
          }

          // Taşınan ürünleri movedItems'a ekle
          const currentOrder = await getOrder(order.id!);
          if (!currentOrder) return;

          const movedItems = currentOrder.movedItems || [];
          const movedAt = new Date();
          const movedItemsToAdd: OrderItem[] = itemsToMove.map((item) => ({
            ...item,
            addedAt: item.addedAt || new Date(),
            movedAt: movedAt,
            movedToTableId: targetTableId,
            movedToTableNumber: targetTable.tableNumber,
            movedFromTableId: currentTable.id,
            movedFromTableNumber: currentTable.tableNumber,
          }));
          movedItems.push(...movedItemsToAdd);

          // Toplam hesapla ve güncelle (updatedItems kullanarak)
          const subtotal = updatedItems.reduce(
            (sum, item) => sum + item.subtotal,
            0
          );
          const total = subtotal - (currentOrder.discount || 0);
          await updateOrder(order.id!, {
            items: updatedItems,
            subtotal: subtotal,
            total: total,
            movedItems: movedItems,
          });

          // Hedef masaya ürünleri ekle
          if (!effectiveCompanyId) {
            customAlert("Şirket bilgisi bulunamadı", "Hata", "error");
            setIsMovingItems(false);
            return;
          }

          const allOrders = await getOrdersByCompany(effectiveCompanyId, {
            branchId: effectiveBranchIdForHistory || undefined,
          });
          const targetOrder = allOrders.find(
            (o) => o.tableId === targetTableId && o.status === "active"
          );

          if (targetOrder) {
            // Mevcut siparişe ekle - taşınan ürünlere kaynak masa bilgisini ekle
            const existingItems = targetOrder.items || [];
            const itemsWithSourceInfo = itemsToMove.map((item) => ({
              ...item,
              movedFromTableId: currentTable.id,
              movedFromTableNumber: currentTable.tableNumber,
              movedAt: movedAt,
            }));
            const mergedItems = [...existingItems, ...itemsWithSourceInfo];
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
            // Yeni sipariş oluştur - taşınan ürünlere kaynak masa bilgisini ekle
            const itemsWithSourceInfo = itemsToMove.map((item) => ({
              ...item,
              movedFromTableId: currentTable.id,
              movedFromTableNumber: currentTable.tableNumber,
              movedAt: movedAt,
            }));

            await addOrder({
              companyId: effectiveCompanyId,
              branchId: effectiveBranchIdForHistory || targetTable.branchId,
              tableId: targetTableId,
              tableNumber: targetTable.tableNumber,
              items: itemsWithSourceInfo,
              sentItems: itemsWithSourceInfo.map((item) => item.menuId),
              createdBy: userData!.id!,
              status: "active",
              paymentStatus: "unpaid",
            });
          }

          // Siparişi yeniden yükle ve state'i güncelle
          const updatedOrderAfterMove = await getOrder(order.id!);
          if (updatedOrderAfterMove) {
            setOrder(updatedOrderAfterMove);
          }

          // State temizle ve modal kapat
          setSelectedItems(new Set());
          setShowMoveModal(false);
          setPendingMoveItems([]);
          setCurrentMoveItemIndex(0);
          setSelectedMoveQuantities(new Map());

          // Navigation ayarını kontrol et
          const navSettings = localStorage.getItem("navigationSettings");
          if (navSettings) {
            try {
              const settings = JSON.parse(navSettings);
              if (settings.returnAfterItemMove) {
                navigateToHome();
                return;
              }
            } catch (error) {
              // Hata durumunda varsayılan davranış (masalara dön)
            }
          }
          // Ayar yoksa veya returnAfterItemMove false ise burada kal
          return;
        } else {
          // Normal taşı işlemi - tüm seçili ürünleri taşı
          itemsToMove = order.items.filter((_, index) =>
            selectedItems.has(index)
          );
        }

        // Hedef masayı al
        const targetTable = await getTable(targetTableId);
        if (!targetTable) {
          alert("Hedef masa bulunamadı");
          return;
        }

        // Hedef masada aktif sipariş var mı kontrol et
        const effectiveCompanyId = companyId || userData?.companyId;
        const effectiveBranchId = branchId || userData?.assignedBranchId;

        // Masa geçmişine kaydet - Her taşınan ürün için (normal taşı işlemi için, return'den önce)
        if (pendingMoveItems.length === 0 && effectiveCompanyId) {
          const effectiveBranchIdForHistory =
            branchId || userData?.assignedBranchId;
          try {
            for (const item of itemsToMove) {
              // Kaynak masanın geçmişine kaydet
              await addTableHistory(
                effectiveCompanyId,
                currentTable.id!,
                currentTable.tableNumber,
                "item_moved",
                `${item.menuName} Masa ${targetTable.tableNumber}'ya taşındı`,
                {
                  menuId: item.menuId,
                  menuName: item.menuName,
                  quantity: item.quantity,
                  subtotal: item.subtotal,
                  movedFromTableNumber: currentTable.tableNumber,
                  movedToTableNumber: targetTable.tableNumber,
                },
                effectiveBranchIdForHistory || undefined
              );

              // Hedef masanın geçmişine kaydet
              await addTableHistory(
                effectiveCompanyId,
                targetTableId,
                targetTable.tableNumber,
                "item_added",
                `${item.menuName} Masa ${currentTable.tableNumber}'dan taşındı`,
                {
                  menuId: item.menuId,
                  menuName: item.menuName,
                  quantity: item.quantity,
                  subtotal: item.subtotal,
                  movedFromTableNumber: currentTable.tableNumber,
                  movedToTableNumber: targetTable.tableNumber,
                },
                effectiveBranchIdForHistory || undefined
              );
            }
          } catch (error) {}
        }

        // Taşınan ürünleri movedItems'a ekle
        const currentOrder = await getOrder(order.id!);
        if (!currentOrder) return;

        const movedItems = currentOrder.movedItems || [];
        const movedAt = new Date();
        const movedItemsToAdd: OrderItem[] = itemsToMove.map((item) => ({
          ...item,
          addedAt: item.addedAt || new Date(),
          movedAt: movedAt,
          movedToTableId: targetTableId,
          movedToTableNumber: targetTable.tableNumber,
          movedFromTableId: currentTable.id,
          movedFromTableNumber: currentTable.tableNumber,
        }));
        movedItems.push(...movedItemsToAdd);

        const allOrders = await getOrdersByCompany(effectiveCompanyId!, {
          branchId: effectiveBranchId || undefined,
        });
        const targetOrder = allOrders.find(
          (o) => o.tableId === targetTableId && o.status === "active"
        );

        if (targetOrder) {
          // Mevcut siparişe ekle - taşınan ürünlere kaynak masa bilgisini ekle
          const existingItems = targetOrder.items || [];
          const itemsWithSourceInfo = itemsToMove.map((item) => ({
            ...item,
            movedFromTableId: currentTable.id,
            movedFromTableNumber: currentTable.tableNumber,
            movedAt: movedAt,
          }));
          const mergedItems = [...existingItems, ...itemsWithSourceInfo];
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
          // Yeni sipariş oluştur - taşınan ürünlere kaynak masa bilgisini ekle
          const itemsWithSourceInfo = itemsToMove.map((item) => ({
            ...item,
            movedFromTableId: currentTable.id,
            movedFromTableNumber: currentTable.tableNumber,
            movedAt: movedAt,
          }));

          await addOrder({
            companyId: effectiveCompanyId!,
            branchId: effectiveBranchId || targetTable.branchId,
            tableId: targetTableId,
            tableNumber: targetTable.tableNumber,
            items: itemsWithSourceInfo,
            sentItems: itemsWithSourceInfo.map((item) => item.menuId),
            createdBy: userData!.id!,
            status: "active",
            paymentStatus: "unpaid",
          });
        }

        // Masa geçmişine kaydet - Her taşınan ürün için (normal taşı işlemi için)
        if (pendingMoveItems.length === 0 && effectiveCompanyId) {
          const effectiveBranchIdForHistory =
            branchId || userData?.assignedBranchId;
          try {
            for (const item of itemsToMove) {
              // Kaynak masanın geçmişine kaydet
              await addTableHistory(
                effectiveCompanyId,
                currentTable.id!,
                currentTable.tableNumber,
                "item_moved",
                `${item.menuName} Masa ${targetTable.tableNumber}'ya taşındı`,
                {
                  menuId: item.menuId,
                  menuName: item.menuName,
                  quantity: item.quantity,
                  subtotal: item.subtotal,
                  movedFromTableNumber: currentTable.tableNumber,
                  movedToTableNumber: targetTable.tableNumber,
                },
                effectiveBranchIdForHistory || undefined
              );

              // Hedef masanın geçmişine kaydet
              await addTableHistory(
                effectiveCompanyId,
                targetTableId,
                targetTable.tableNumber,
                "item_added",
                `${item.menuName} Masa ${currentTable.tableNumber}'dan taşındı`,
                {
                  menuId: item.menuId,
                  menuName: item.menuName,
                  quantity: item.quantity,
                  subtotal: item.subtotal,
                  movedFromTableNumber: currentTable.tableNumber,
                  movedToTableNumber: targetTable.tableNumber,
                },
                effectiveBranchIdForHistory || undefined
              );
            }
          } catch (error) {}
        }

        // Eğer adet seçim modalından gelmediyse, mevcut siparişten seçili ürünleri çıkar
        if (pendingMoveItems.length === 0) {
          const updatedItems = order.items.filter(
            (_, index) => !selectedItems.has(index)
          );

          if (updatedItems.length === 0) {
            // Hiç ürün kalmadıysa siparişi kapat
            await updateTableStatus(currentTable.id!, "available", undefined);
            await updateOrderStatus(order.id!, "closed");
            // MovedItems'ı kaydet
            await updateOrder(order.id!, { movedItems: movedItems });
            setOrder(null);
            setSelectedItems(new Set());
            setShowMoveModal(false);
            setPendingMoveItems([]);
            setCurrentMoveItemIndex(0);
            setSelectedMoveQuantities(new Map());
            navigateToHome();
            return;
          }

          // Toplam hesapla
          const subtotal = updatedItems.reduce(
            (sum, item) => sum + item.subtotal,
            0
          );
          const total = subtotal - (order.discount || 0);

          await updateOrder(order.id!, {
            items: updatedItems,
            subtotal: subtotal,
            total: total,
            movedItems: movedItems,
          });
        } else {
          // Adet seçim modalından geliyorsa, movedItems'ı kaydet
          await updateOrder(order.id!, { movedItems: movedItems });
        }

        // Siparişi yeniden yükle
        const updatedOrder = await getOrder(order.id!);
        if (updatedOrder) {
          setOrder(updatedOrder);
        }
        setSelectedItems(new Set());
        setShowMoveModal(false);

        // Navigation ayarını kontrol et
        const navSettings = localStorage.getItem("navigationSettings");
        if (navSettings) {
          try {
            const settings = JSON.parse(navSettings);
            if (settings.returnAfterItemMove) {
              navigateToHome();
            }
          } catch (error) {
            // Hata durumunda varsayılan davranış (masalara dön)
            navigateToHome();
          }
        } else {
          // Ayar yoksa varsayılan davranış (masalara dön)
          navigateToHome();
        }
      } catch (error) {
        customAlert("Ürünler taşınırken bir hata oluştu", "Hata", "error");
      } finally {
        setIsMovingItems(false);
      }
    },
    [
      order,
      selectedItems,
      currentTable,
      userData,
      navigate,
      pendingMoveItems,
      selectedMoveQuantities,
    ]
  );

  // Not ekleme modalı açıldığında Textarea'ya focus ver (sadece touch event'lerinde klavyeyi aç)
  useEffect(() => {
    if (showAddNoteModal && itemNoteTextareaRef.current) {
      // Kısa bir gecikme ile focus ver (modal render olması için)
      setTimeout(() => {
        if (itemNoteTextareaRef.current) {
          itemNoteTextareaRef.current.focus();
          // Sadece gerçek touch event'lerinde klavyeyi aç
          const lastEventWasTouch = (window as any).__lastTouchEvent;
          if (lastEventWasTouch) {
            const currentValue = itemNoteTextareaRef.current.value || "";
            openKeyboard(
              itemNoteTextareaRef as React.RefObject<HTMLTextAreaElement>,
              "text",
              currentValue
            );
          }
        }
      }, 100);
    }
  }, [showAddNoteModal, openKeyboard]);

  // Cari modalı açıldığında carileri ve cari masalarını yükle
  useEffect(() => {
    const loadCustomersAndTables = async () => {
      if (!showCustomerModal) return;

      const effectiveCompanyId = companyId || userData?.companyId;
      const effectiveBranchId = branchId || userData?.assignedBranchId;

      if (!effectiveCompanyId) return;

      setIsLoadingCustomers(true);
      try {
        // Carileri yükle
        const customersData = await getCustomersByCompany(
          effectiveCompanyId,
          effectiveBranchId || undefined
        );
        setCustomers(customersData);

        // Cari masalarını yükle
        const tablesData = await getTablesByCompany(
          effectiveCompanyId,
          effectiveBranchId || undefined
        );
        const cariTables = tablesData.filter((t) => t.area === "Cari");
        setCustomerTables(cariTables);
      } catch (error) {
        customAlert("Cariler yüklenirken bir hata oluştu", "Hata", "error");
      } finally {
        setIsLoadingCustomers(false);
      }
    };

    loadCustomersAndTables();
  }, [showCustomerModal, companyId, branchId, userData]);

  // Yeni cari ekle ve masa oluştur
  const handleCreateCustomerAndTable = useCallback(async () => {
    if (!newCustomerName.trim()) {
      customAlert("Lütfen müşteri adını girin", "Uyarı", "warning");
      return;
    }

    const effectiveCompanyId = companyId || userData?.companyId;
    const effectiveBranchId = branchId || userData?.assignedBranchId;

    if (!effectiveCompanyId) {
      customAlert("Şirket bilgisi bulunamadı", "Hata", "error");
      return;
    }

    setIsCreatingCustomer(true);
    try {
      // Yeni cari oluştur
      await addCustomer({
        companyId: effectiveCompanyId,
        branchId: effectiveBranchId || undefined,
        name: newCustomerName.trim(),
        balance: 0,
        isActive: true,
      });

      // Cari için masa oluştur
      const tableId = await addTable({
        companyId: effectiveCompanyId,
        branchId: effectiveBranchId || undefined,
        area: "Cari",
        tableNumber: newCustomerName.trim(),
        status: "available",
      });

      // Carileri ve cari masalarını yeniden yükle
      const customersData = await getCustomersByCompany(
        effectiveCompanyId,
        effectiveBranchId || undefined
      );
      setCustomers(customersData);

      const tablesData = await getTablesByCompany(
        effectiveCompanyId,
        effectiveBranchId || undefined
      );
      const cariTables = tablesData.filter((t) => t.area === "Cari");
      setCustomerTables(cariTables);

      // Yeni oluşturulan cariyi seç
      setNewCustomerName("");

      // Eğer mevcut sipariş varsa, siparişi yeni cari masasına taşı
      if (order && order.items.length > 0) {
        try {
          // Hedef masayı al
          const targetTable = await getTable(tableId);
          if (!targetTable) {
            throw new Error("Hedef masa bulunamadı");
          }

          // Hedef masada aktif sipariş var mı kontrol et
          const allOrders = await getOrdersByCompany(effectiveCompanyId, {
            branchId: effectiveBranchId || undefined,
          });
          const targetOrder = allOrders.find(
            (o) => o.tableId === tableId && o.status === "active"
          );

          if (targetOrder) {
            // Mevcut siparişe ekle
            const existingItems = targetOrder.items || [];
            const mergedItems = [...existingItems, ...order.items];
            const subtotal = mergedItems.reduce(
              (sum, item) => sum + item.subtotal,
              0
            );
            const total = subtotal - (targetOrder.discount || 0);

            // Gönderilen ürün ID'lerini ekle (yeni eklenenler)
            const existingSentItems = targetOrder.sentItems || [];
            const newSentItemIds = order.items.map((item) => item.menuId);
            const updatedSentItems = Array.from(
              new Set([...existingSentItems, ...newSentItemIds])
            );

            await updateOrder(targetOrder.id!, {
              items: mergedItems,
              subtotal: subtotal,
              total: total,
              sentItems: updatedSentItems, // Gönderilen ürünleri güncelle
            });
          } else {
            // Yeni sipariş oluştur
            await addOrder({
              companyId: effectiveCompanyId,
              branchId: effectiveBranchId || targetTable.branchId,
              tableId: tableId,
              tableNumber: targetTable.tableNumber,
              items: order.items,
              sentItems:
                order.sentItems || order.items.map((item) => item.menuId),
              createdBy: userData!.id!,
              status: "active",
              paymentStatus: "unpaid",
              discount: order.discount,
            });
          }

          // Müşterinin lastOrderAt alanını güncelle
          try {
            const customer = customersData.find(
              (c) => c.name === newCustomerName.trim()
            );
            if (customer?.id) {
              await updateCustomer(customer.id, {
                lastOrderAt: new Date(),
              });
            }
          } catch (error) {
            // Müşteri güncelleme hatası kritik değil, devam et
            console.error("Müşteri tarihi güncellenirken hata:", error);
          }

          // Mevcut masadan siparişi kaldır ve kapat
          await updateOrder(order.id!, {
            items: [],
            subtotal: 0,
            total: 0,
          });

          // Masa durumunu güncelle ve siparişi kapat
          await updateTableStatus(currentTable.id!, "available", undefined);
          await updateOrderStatus(order.id!, "closed");

          // Order state'ini güncelle
          setOrder(null);

          // Modal'ları kapat
          setShowPaymentModal(false);
          setShowFullScreenPayment(false);
          setShowCustomerModal(false);
          // URL'den payment parametresini kaldır
          navigate({
            to: "/table/$tableId",
            params: { tableId: tableId },
            search: (prev) => ({
              area: prev?.area ?? undefined,
              activeOnly: prev?.activeOnly ?? false,
              payment: undefined,
            }),
            replace: true,
          });

          customAlert(
            "Cari oluşturuldu ve sipariş cari masasına taşındı",
            "Başarılı",
            "success"
          );
        } catch (error: any) {
          customAlert(
            `Sipariş taşınırken bir hata oluştu: ${error?.message || "Bilinmeyen hata"}`,
            "Hata",
            "error"
          );
        }
      } else {
        customAlert("Cari başarıyla oluşturuldu", "Başarılı", "success");
      }

      // Masaya yönlendir
      navigate({
        to: "/table/$tableId",
        params: { tableId },
        search: { area: undefined, activeOnly: false, payment: undefined },
      });
    } catch (error: any) {
      const errorMessage = error?.message || "Bilinmeyen bir hata oluştu";
      customAlert(
        `Cari oluşturulurken bir hata oluştu: ${errorMessage}`,
        "Hata",
        "error"
      );
    } finally {
      setIsCreatingCustomer(false);
      setShowNewCustomerModal(false);
    }
  }, [
    newCustomerName,
    companyId,
    branchId,
    userData,
    navigate,
    order,
    currentTable,
  ]);

  // Cari masaya kaydet (seçili ürünler veya tüm masa)
  const handleSaveToCustomerTable = useCallback(
    async (tableId: string) => {
      const effectiveCompanyId = companyId || userData?.companyId;
      const effectiveBranchId = branchId || userData?.assignedBranchId;

      if (!effectiveCompanyId) {
        customAlert("Şirket bilgisi bulunamadı", "Hata", "error");
        return;
      }

      if (!order || order.items.length === 0) {
        customAlert("Kaydedilecek ürün bulunamadı", "Uyarı", "warning");
        return;
      }

      try {
        // Hedef masayı al
        const targetTable = await getTable(tableId);
        if (!targetTable) {
          customAlert("Hedef masa bulunamadı", "Hata", "error");
          return;
        }

        // Seçili ürünler var mı kontrol et
        const hasSelectedItems = pendingPaymentItems.length > 0 && 
          Array.from(selectedQuantities.values()).some(qty => qty > 0);

        let itemsToSave: OrderItem[] = [];

        if (hasSelectedItems) {
          // Seçili ürünleri kaydet
          pendingPaymentItems.forEach((paymentItem) => {
            const selectedQty = selectedQuantities.get(paymentItem.menuId) || 0;
            if (selectedQty > 0) {
              let remainingQty = selectedQty;
              for (const index of paymentItem.indices) {
                if (remainingQty <= 0) break;
                const item = order.items[index];
                if (!item || item.menuId !== paymentItem.menuId) continue;

                const qtyToSave = Math.min(item.quantity, remainingQty);
                const pricePerUnit = item.subtotal / item.quantity;
                itemsToSave.push({
                  ...item,
                  quantity: qtyToSave,
                  subtotal: pricePerUnit * qtyToSave,
                });
                remainingQty -= qtyToSave;
              }
            }
          });
        } else {
          // Tüm masayı kaydet
          itemsToSave = [...order.items];
        }

        if (itemsToSave.length === 0) {
          customAlert("Kaydedilecek ürün bulunamadı", "Uyarı", "warning");
          return;
        }

        // Hedef masada aktif sipariş var mı kontrol et
        const allOrders = await getOrdersByCompany(effectiveCompanyId, {
          branchId: effectiveBranchId || undefined,
        });
        const targetOrder = allOrders.find(
          (o) => o.tableId === tableId && o.status === "active"
        );

        if (targetOrder) {
          // Mevcut siparişe ekle
          const existingItems = targetOrder.items || [];
          const mergedItems = [...existingItems, ...itemsToSave];
          const subtotal = mergedItems.reduce(
            (sum, item) => sum + item.subtotal,
            0
          );
          const total = subtotal - (targetOrder.discount || 0);

          // Gönderilen ürün ID'lerini ekle (yeni eklenenler)
          const existingSentItems = targetOrder.sentItems || [];
          const newSentItemIds = itemsToSave.map((item) => item.menuId);
          const updatedSentItems = Array.from(
            new Set([...existingSentItems, ...newSentItemIds])
          );

          await updateOrder(targetOrder.id!, {
            items: mergedItems,
            subtotal: subtotal,
            total: total,
            sentItems: updatedSentItems, // Gönderilen ürünleri güncelle
          });
        } else {
          // Yeni sipariş oluştur
          await addOrder({
            companyId: effectiveCompanyId,
            branchId: effectiveBranchId || targetTable.branchId,
            tableId: tableId,
            tableNumber: targetTable.tableNumber,
            items: itemsToSave,
            sentItems: itemsToSave.map((item) => item.menuId),
            createdBy: userData!.id!,
            status: "active",
            paymentStatus: "unpaid",
            discount: 0,
          });
        }

        // Müşterinin lastOrderAt alanını güncelle
        try {
          const allCustomers = await getCustomersByCompany(
            effectiveCompanyId,
            effectiveBranchId || undefined
          );
          const customer = allCustomers.find(
            (c) => c.name === targetTable.tableNumber
          );
          if (customer?.id) {
            await updateCustomer(customer.id, {
              lastOrderAt: new Date(),
            });
          }
        } catch (error) {
          // Müşteri güncelleme hatası kritik değil, devam et
          console.error("Müşteri tarihi güncellenirken hata:", error);
        }

        // Seçili ürünler kaydedildiyse, mevcut masadan kaldır
        if (hasSelectedItems) {
          const updatedItems = order.items.map((item, index) => {
            let remainingQty = item.quantity;
            
            pendingPaymentItems.forEach((paymentItem) => {
              if (paymentItem.menuId === item.menuId && paymentItem.indices.includes(index)) {
                const selectedQty = selectedQuantities.get(paymentItem.menuId) || 0;
                if (selectedQty > 0) {
                  let qtyToRemove = selectedQty;
                  for (const idx of paymentItem.indices) {
                    if (idx === index && qtyToRemove > 0) {
                      const qty = Math.min(item.quantity, qtyToRemove);
                      remainingQty -= qty;
                      qtyToRemove -= qty;
                    }
                  }
                }
              }
            });

            if (remainingQty <= 0) {
              return null; // Bu item tamamen kaldırılacak
            }

            const pricePerUnit = item.subtotal / item.quantity;
            return {
              ...item,
              quantity: remainingQty,
              subtotal: pricePerUnit * remainingQty,
            };
          }).filter((item): item is OrderItem => item !== null);

          const newSubtotal = updatedItems.reduce((sum, item) => sum + item.subtotal, 0);
          const newTotal = newSubtotal - (order.discount || 0);

          await updateOrder(order.id!, {
            items: updatedItems,
            subtotal: newSubtotal,
            total: newTotal,
          });

          // Order'ı yeniden yükle
          const refreshedOrder = await getOrder(order.id!);
          if (refreshedOrder) {
            setOrder(refreshedOrder);
          }
        } else {
          // Tüm masa kaydedildiyse, mevcut masadan siparişi kaldır ve kapat
          await updateOrder(order.id!, {
            items: [],
            subtotal: 0,
            total: 0,
          });
          await updateTableStatus(currentTable.id!, "available", undefined);
          await updateOrderStatus(order.id!, "closed");
          setOrder(null);
        }

        // Cari masalarını yeniden yükle
        const tablesData = await getTablesByCompany(
          effectiveCompanyId,
          effectiveBranchId || undefined
        );
        const cariTables = tablesData.filter((t) => t.area === "Cari");
        setCustomerTables(cariTables);

        customAlert(
          hasSelectedItems 
            ? "Seçili ürünler cari masasına kaydedildi"
            : "Masa cari masasına kaydedildi",
          "Başarılı",
          "success"
        );

        setShowCustomerModal(false);
        setShowPaymentModal(false);
      } catch (error: any) {
        customAlert(
          `Kaydetme işlemi sırasında bir hata oluştu: ${error?.message || "Bilinmeyen hata"}`,
          "Hata",
          "error"
        );
      }
    },
    [companyId, branchId, userData, order, currentTable, pendingPaymentItems, selectedQuantities]
  );

  // Cari seç ve masaya yönlendir
  const handleSelectCustomer = useCallback(
    async (customerId: string) => {
      const effectiveCompanyId = companyId || userData?.companyId;
      const effectiveBranchId = branchId || userData?.assignedBranchId;

      if (!effectiveCompanyId) {
        customAlert("Şirket bilgisi bulunamadı", "Hata", "error");
        return;
      }

      try {
        // Cari bilgisini al
        const customer = await getCustomer(customerId);
        if (!customer) {
          customAlert("Cari bulunamadı", "Hata", "error");
          return;
        }

        // Cari için masa var mı kontrol et
        const allTables = await getTablesByCompany(
          effectiveCompanyId,
          effectiveBranchId || undefined
        );

        let customerTable = allTables.find(
          (t) => t.area === "Cari" && t.tableNumber === customer.name
        );

        // Masa yoksa oluştur
        if (!customerTable) {
          const tableId = await addTable({
            companyId: effectiveCompanyId,
            branchId: effectiveBranchId || undefined,
            area: "Cari",
            tableNumber: customer.name,
            status: "available",
          });
          const table = await getTable(tableId);
          customerTable = table || undefined;
        }

        if (!customerTable) {
          customAlert("Masa oluşturulamadı", "Hata", "error");
          return;
        }

        // Eğer mevcut sipariş varsa, siparişi cari masasına taşı
        if (order && order.items.length > 0) {
          try {
            // Hedef masada aktif sipariş var mı kontrol et
            const allOrders = await getOrdersByCompany(effectiveCompanyId, {
              branchId: effectiveBranchId || undefined,
            });
            const targetOrder = allOrders.find(
              (o) => o.tableId === customerTable!.id && o.status === "active"
            );

            if (targetOrder) {
              // Mevcut siparişe ekle
              const existingItems = targetOrder.items || [];
              const mergedItems = [...existingItems, ...order.items];
              const subtotal = mergedItems.reduce(
                (sum, item) => sum + item.subtotal,
                0
              );
              const total = subtotal - (targetOrder.discount || 0);

              // Gönderilen ürün ID'lerini ekle (yeni eklenenler)
              const existingSentItems = targetOrder.sentItems || [];
              const newSentItemIds = order.items.map((item) => item.menuId);
              const updatedSentItems = Array.from(
                new Set([...existingSentItems, ...newSentItemIds])
              );

              await updateOrder(targetOrder.id!, {
                items: mergedItems,
                subtotal: subtotal,
                total: total,
                sentItems: updatedSentItems, // Gönderilen ürünleri güncelle
              });
            } else {
              // Yeni sipariş oluştur
              await addOrder({
                companyId: effectiveCompanyId,
                branchId: effectiveBranchId || customerTable.branchId,
                tableId: customerTable.id!,
                tableNumber: customerTable.tableNumber,
                items: order.items,
                sentItems:
                  order.sentItems || order.items.map((item) => item.menuId),
                createdBy: userData!.id!,
                status: "active",
                paymentStatus: "unpaid",
                discount: order.discount,
              });
            }

            // Mevcut masadan siparişi kaldır ve kapat
            await updateOrder(order.id!, {
              items: [],
              subtotal: 0,
              total: 0,
            });

            // Masa durumunu güncelle ve siparişi kapat
            await updateOrderStatus(order.id!, "closed");
            await updateTableStatus(currentTable.id!, "available", undefined);

            // Müşterinin lastOrderAt alanını güncelle
            try {
              await updateCustomer(customerId, {
                lastOrderAt: new Date(),
              });
            } catch (error) {
              // Müşteri güncelleme hatası kritik değil, devam et
              console.error("Müşteri tarihi güncellenirken hata:", error);
            }

            customAlert(
              "Cari seçildi ve sipariş cari masasına taşındı",
              "Başarılı",
              "success"
            );
          } catch (error: any) {
            customAlert(
              `Sipariş taşınırken bir hata oluştu: ${error?.message || "Bilinmeyen hata"}`,
              "Hata",
              "error"
            );
          }
        }

        // Masaya yönlendir
        navigate({
          to: "/table/$tableId",
          params: { tableId: customerTable.id! },
          search: { area: undefined, activeOnly: false, payment: undefined },
        });

        setShowCustomerModal(false);
      } catch (error) {
        customAlert("Cari seçilirken bir hata oluştu", "Hata", "error");
      }
    },
    [companyId, branchId, userData, navigate, order, currentTable]
  );

  // Taşı modalı açıldığında masaları yükle
  useEffect(() => {
    if (showMoveModal && userData?.companyId) {
      const loadTables = async () => {
        try {
          const effectiveCompanyId = companyId || userData?.companyId;
          const effectiveBranchId = branchId || userData?.assignedBranchId;

          const tables = await getTablesByCompany(
            effectiveCompanyId || "",
            effectiveBranchId || undefined
          );
          // Mevcut masayı hariç tut
          const filteredTables = tables.filter((t) => t.id !== currentTable.id);
          setAvailableTables(filteredTables);
          // İlk alanı seç (varsa)
          if (filteredTables.length > 0) {
            const firstArea = filteredTables[0].area;
            setSelectedArea(firstArea);
          }
        } catch (error) {
          // Error loading tables
        }
      };
      loadTables();
    } else {
      setSelectedArea("");
    }
  }, [showMoveModal, userData, currentTable]);

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
    <div className="h-full bg-gray-50 dark:bg-gray-900 flex flex-col lg:flex-row overflow-hidden select-none">
      {/* Header - Mobile */}
      <div className="lg:hidden bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-3 py-2 sticky top-0 z-40 flex-shrink-0">
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={navigateToHome}
            className="h-10 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 font-semibold"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Geri
          </Button>
          <h1 className="text-base font-bold text-gray-900 dark:text-white">
            Masa {currentTable.tableNumber}
          </h1>
          <button
            onClick={() => setShowCart(!showCart)}
            className="relative p-2"
          >
            <ShoppingCart className="h-5 w-5 text-gray-700 dark:text-gray-300" />
            {cart.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {cart.reduce((sum, item) => sum + item.quantity, 0)}
              </span>
            )}
          </button>
        </div>
      </div>
      {/* Left Sidebar - Order (Desktop) */}
      <div
        className="hidden lg:flex lg:flex-none lg:w-[550px] flex-col overflow-hidden border-l-4 border-r-4 border-purple-600"
        style={{ backgroundColor: "rgba(0, 0, 0, 0.2)" }}
      >
        <div className="p-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                Sipariş -{" "}
                {(() => {
                  // Masa adını formatla: "Masa Salon 1" -> "Salon 1", "Masa Bahçe 1" -> "Bahçe 1"
                  const tableName = currentTable.tableNumber.toString();
                  if (tableName.toLowerCase().startsWith("masa ")) {
                    return tableName.substring(5); // "Masa " kısmını kaldır
                  }
                  return tableName;
                })()}
              </h2>
              {order && currentTable.area === "Cari" && (
                <div className="flex items-center gap-1 mt-1">
                  <Clock className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {order.createdAt 
                      ? new Date(order.createdAt).toLocaleDateString("tr-TR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : order.updatedAt
                        ? new Date(order.updatedAt).toLocaleDateString("tr-TR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : ""}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Cart Items veya Aktif Sipariş */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {isRefreshingOrder ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Loader2 className="h-12 w-12 animate-spin text-purple-600 mx-auto mb-4" />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Masa yenileniyor...
                </p>
              </div>
            </div>
          ) : order ? (
            <>
              {/* Ödemesi Alınan ve İptal Edilen Ürünler */}
              {(() => {
                // Ödenen ürünler ve iptal edilen ürünler her zaman gösterilmeli
                // order.items boş olsa bile (tüm ürünler ödendiyse)
                // Ürün bazlı olmayan ödemeleri topla (paidItems undefined olanlar)
                const generalPayments: Array<{
                  method: string;
                  amount: number;
                  methodName: string;
                }> = [];
                order.payments?.forEach((payment) => {
                  // Eğer paidItems yoksa, bu genel bir ödeme (ürün bazlı değil)
                  if (!payment.paidItems || payment.paidItems.length === 0) {
                    const methodName =
                      paymentMethods.find((pm) => pm.code === payment.method)
                        ?.name ||
                      (payment.method === "cash"
                        ? "Nakit"
                        : payment.method === "card"
                          ? "Kart"
                          : payment.method);
                    generalPayments.push({
                      method: payment.method,
                      amount: payment.amount,
                      methodName: methodName,
                    });
                  }
                });

                // Tüm ödemelerden ödenen ürünleri birleştir (ikramlar hariç)
                // Ödenen ürünler order.items'dan kaldırılmış olabilir, bu yüzden paidItems'dan direkt al
                
                // İkram edilen ürünleri ayrı olarak topla
                const giftItemsMap = new Map<
                  string,
                  { menuName: string; quantity: number; menuPrice: number; subtotal: number; originalTotal: number }
                >();
                
                // Ödeme grupları - aynı ödeme işleminden gelen indirimli ürünleri grupla
                const paymentGroups: Array<{
                  paymentId: string;
                  items: Array<{ menuName: string; quantity: number; menuPrice: number; subtotal: number; originalTotal: number }>;
                  totalOriginal: number;
                  totalDiscounted: number;
                  hasDiscount: boolean;
                }> = [];
                
                // İndirimsiz ürünler için ayrı map (eski mantık)
                const paidItemsMap = new Map<
                  string,
                  { menuName: string; quantity: number; menuPrice: number; subtotal: number; originalTotal: number }
                >();
                
                order.payments?.forEach((payment, paymentIndex) => {
                  if (!payment.paidItems || payment.paidItems.length === 0) return;
                  
                  // İkram edilen ürünleri ayrı map'e ekle
                  if (payment.isGift) {
                    payment.paidItems.forEach((paidItem) => {
                      const existing = giftItemsMap.get(paidItem.menuId);
                      if (existing) {
                        existing.quantity += paidItem.quantity;
                        existing.subtotal += paidItem.subtotal;
                        existing.originalTotal = existing.menuPrice * existing.quantity;
                      } else {
                        const menuPrice = paidItem.menuPrice || 0;
                        const originalTotal = menuPrice * paidItem.quantity;
                        giftItemsMap.set(paidItem.menuId, {
                          menuName: paidItem.menuName,
                          quantity: paidItem.quantity,
                          menuPrice: menuPrice,
                          subtotal: paidItem.subtotal,
                          originalTotal: originalTotal,
                        });
                      }
                    });
                    return;
                  }
                  
                  // Normal ödenen ürünler - indirimli olanları grupla
                  const groupItems: Array<{ menuName: string; quantity: number; menuPrice: number; subtotal: number; originalTotal: number }> = [];
                  let groupHasDiscount = false;
                  
                  payment.paidItems.forEach((paidItem) => {
                    const menuPrice = paidItem.menuPrice || 0;
                    const originalTotal = menuPrice * paidItem.quantity;
                    const hasDiscount = originalTotal > paidItem.subtotal;
                    
                    if (hasDiscount) {
                      // İndirimli ürün - gruba ekle
                      groupItems.push({
                        menuName: paidItem.menuName,
                        quantity: paidItem.quantity,
                        menuPrice: menuPrice,
                        subtotal: paidItem.subtotal,
                        originalTotal: originalTotal,
                      });
                      groupHasDiscount = true;
                    } else {
                      // İndirimsiz ürün - eski mantıkla ekle
                      const existing = paidItemsMap.get(paidItem.menuId);
                      if (existing) {
                        existing.quantity += paidItem.quantity;
                        existing.subtotal += paidItem.subtotal;
                        existing.originalTotal = existing.menuPrice * existing.quantity;
                      } else {
                        paidItemsMap.set(paidItem.menuId, {
                          menuName: paidItem.menuName,
                          quantity: paidItem.quantity,
                          menuPrice: menuPrice,
                          subtotal: paidItem.subtotal,
                          originalTotal: originalTotal,
                        });
                      }
                    }
                  });
                  
                  // Eğer bu ödemede indirimli ürün varsa, gruba ekle
                  if (groupItems.length > 0) {
                    const totalOriginal = groupItems.reduce((sum, item) => sum + item.originalTotal, 0);
                    const totalDiscounted = groupItems.reduce((sum, item) => sum + item.subtotal, 0);
                    
                    paymentGroups.push({
                      paymentId: `payment-${paymentIndex}-${payment.paidAt?.getTime() || Date.now()}`,
                      items: groupItems,
                      totalOriginal,
                      totalDiscounted,
                      hasDiscount: groupHasDiscount,
                    });
                  }
                });
                
                // Cari masaya atanan ürünleri topla
                const customerItemsMap = new Map<
                  string,
                  { menuName: string; quantity: number; menuPrice: number; subtotal: number; movedToTableNumber?: string }
                >();
                
                if (order.movedItems && order.movedItems.length > 0) {
                  order.movedItems.forEach((movedItem) => {
                    if (movedItem.movedToTableNumber) {
                      // Bu masa cari masası mı kontrol et
                      const targetTable = allTablesForCheck.find(
                        (t) => t.tableNumber === movedItem.movedToTableNumber && t.area === "Cari"
                      );
                      
                      if (targetTable) {
                        // Cari masaya atanan ürün
                        const existing = customerItemsMap.get(movedItem.menuId);
                        if (existing) {
                          existing.quantity += movedItem.quantity;
                          existing.subtotal += movedItem.subtotal;
                        } else {
                          customerItemsMap.set(movedItem.menuId, {
                            menuName: movedItem.menuName,
                            quantity: movedItem.quantity,
                            menuPrice: movedItem.menuPrice,
                            subtotal: movedItem.subtotal,
                            movedToTableNumber: movedItem.movedToTableNumber,
                          });
                        }
                      }
                    }
                  });
                }

                // İptal edilen ürünleri birleştir
                const canceledItemsMap = new Map<
                  string,
                  { menuName: string; quantity: number; subtotal: number }
                >();
                
                // order.items içindeki iptal edilen ürünleri ekle
                (order.items || []).forEach((item) => {
                  if (item.canceledAt) {
                    const existing = canceledItemsMap.get(item.menuId);
                    if (existing) {
                      existing.quantity += item.quantity;
                      existing.subtotal += item.subtotal;
                    } else {
                      canceledItemsMap.set(item.menuId, {
                        menuName: item.menuName,
                        quantity: item.quantity,
                        subtotal: item.subtotal,
                      });
                    }
                  }
                });
                
                // order.canceledItems array'indeki iptal edilen ürünleri de ekle
                if (order.canceledItems && order.canceledItems.length > 0) {
                  order.canceledItems.forEach((item) => {
                    const existing = canceledItemsMap.get(item.menuId);
                    if (existing) {
                      existing.quantity += item.quantity;
                      existing.subtotal += item.subtotal;
                    } else {
                      canceledItemsMap.set(item.menuId, {
                        menuName: item.menuName,
                        quantity: item.quantity,
                        subtotal: item.subtotal,
                      });
                    }
                  });
                }

                return (
                  <>
                    {/* Alınan Ödemeler (Ürün Bazlı Olmayan) */}
                    {generalPayments.length > 0 && (
                      <div className="mb-4 pb-4 border-b-2 border-blue-300">
                        <div className="text-sm font-bold text-blue-700 mb-3 flex items-center gap-2">
                          <CheckCircle className="h-4 w-4" />
                          Alınan Ödeme
                        </div>
                        <div className="text-base font-semibold text-blue-900 dark:text-blue-200">
                          {generalPayments
                            .map(
                              (payment) =>
                                `${payment.amount.toFixed(2).replace(".", ",")}₺ ${payment.methodName}`
                            )
                            .join(" - ")}
                        </div>
                      </div>
                    )}

                    {/* İkram Edilen Ürünler */}
                    {Array.from(giftItemsMap.values()).length > 0 && (
                      <div className="mb-4 pb-4 border-b-2 border-orange-300">
                        <div className="text-sm font-bold text-orange-700 mb-3 flex items-center gap-2">
                          <Utensils className="h-4 w-4" />
                          İkram
                        </div>
                        <div className="space-y-3">
                          {Array.from(giftItemsMap.values()).map((item) => {
                            const hasDiscount = item.originalTotal > item.subtotal;
                            return (
                              <div
                                key={item.menuName}
                                className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4 border border-orange-200 dark:border-orange-800"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-base font-semibold text-orange-900 dark:text-orange-200 truncate">
                                      {item.menuName}
                                    </p>
                                    <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                                      {item.quantity} adet
                                    </p>
                                  </div>
                                  <div className="flex flex-col items-end ml-2">
                                    {hasDiscount && (
                                      <span className="text-sm text-gray-500 dark:text-gray-400 line-through mb-1">
                                        ₺{item.originalTotal.toFixed(2).replace(".", ",")}
                                      </span>
                                    )}
                                    <span className="font-bold text-base text-orange-900 dark:text-orange-200">
                                      ₺{item.subtotal.toFixed(2).replace(".", ",")}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Cariye Atanan Ürünler */}
                    {Array.from(customerItemsMap.values()).length > 0 && (
                      <div className="mb-4 pb-4 border-b-2 border-purple-300">
                        <div className="text-sm font-bold text-purple-700 mb-3 flex items-center gap-2">
                          <CreditCard className="h-4 w-4" />
                          Cariye Atandı
                        </div>
                        <div className="space-y-3">
                          {Array.from(customerItemsMap.values()).map((item) => (
                            <div
                              key={item.menuName}
                              className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                  <p className="text-base font-semibold text-purple-900 dark:text-purple-200 truncate">
                                    {item.menuName}
                                  </p>
                                  <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">
                                    {item.quantity} adet
                                    {item.movedToTableNumber && (
                                      <span className="ml-2 text-xs">
                                        → {item.movedToTableNumber}
                                      </span>
                                    )}
                                  </p>
                                </div>
                                <div className="flex flex-col items-end ml-2">
                                  <span className="font-bold text-base text-purple-900 dark:text-purple-200">
                                    ₺{item.subtotal.toFixed(2).replace(".", ",")}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Ödenen Ürünler - İndirimli Gruplar */}
                    {paymentGroups.length > 0 && (
                      <div className="mb-4 pb-4 border-b-2 border-green-400 px-4">
                        <div className="text-sm font-bold text-green-500 mb-3 flex items-center gap-2">
                          <CheckCircle className="h-4 w-4" />
                          Ödenen Ürünler
                        </div>
                        <div className="space-y-3">
                          {paymentGroups.map((group) => (
                            <div
                              key={group.paymentId}
                              className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-300 dark:border-green-700"
                            >
                              {/* Grup içindeki ürünler - sadece isim ve miktar */}
                              <div className="space-y-2 mb-3">
                                {group.items.map((item, idx) => (
                                  <div key={`${group.paymentId}-${item.menuName}-${idx}`} className="flex items-center">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-semibold text-green-600 dark:text-green-300 truncate">
                                        {item.menuName}
                                      </p>
                                      <p className="text-xs text-green-500 dark:text-green-400 mt-0.5">
                                        {item.quantity} adet
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              
                              {/* Grup toplamı - sağ tarafta */}
                              {group.hasDiscount && (
                                <div className="pt-3 border-t border-green-300 dark:border-green-700 flex items-center justify-between">
                                  <p className="text-sm font-bold text-green-600 dark:text-green-300">
                                    Toplam
                                  </p>
                                  <div className="flex flex-col items-end">
                                    <span className="text-sm text-gray-500 dark:text-gray-400 line-through mb-1">
                                      ₺{group.totalOriginal.toFixed(2).replace(".", ",")}
                                    </span>
                                    <span className="text-base font-bold text-green-600 dark:text-green-300">
                                      ₺{group.totalDiscounted.toFixed(2).replace(".", ",")}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Ödenen Ürünler - İndirimsiz */}
                    {Array.from(paidItemsMap.values()).length > 0 && (
                      <div className="mb-4 pb-4 border-b-2 border-green-400 px-4">
                        <div className="text-sm font-bold text-green-500 mb-3 flex items-center gap-2">
                          <CheckCircle className="h-4 w-4" />
                          Ödenen Ürünler
                        </div>
                        <div className="space-y-3">
                          {Array.from(paidItemsMap.values()).map((item) => {
                            const hasDiscount = item.originalTotal > item.subtotal;
                            return (
                              <div
                                key={item.menuName}
                                className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-300 dark:border-green-700"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-base font-semibold text-green-600 dark:text-green-300 truncate">
                                      {item.menuName}
                                    </p>
                                    <p className="text-sm text-green-500 dark:text-green-400 mt-1">
                                      {item.quantity} adet
                                    </p>
                                  </div>
                                  <div className="flex flex-col items-end ml-2">
                                    {hasDiscount && (
                                      <span className="text-sm text-gray-500 dark:text-gray-400 line-through mb-1">
                                        ₺{item.originalTotal.toFixed(2).replace(".", ",")}
                                      </span>
                                    )}
                                    <span className="font-bold text-base text-green-600 dark:text-green-300">
                                      ₺{item.subtotal.toFixed(2).replace(".", ",")}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* İptal Edilen Ürünler */}
                    {Array.from(canceledItemsMap.values()).length > 0 && (
                      <div className="mb-4 pb-4 border-b-2 border-red-400 px-4">
                        <div className="text-sm font-bold text-red-500 mb-3 flex items-center gap-2">
                          <X className="h-4 w-4" />
                          İptal Edilen Ürünler
                        </div>
                        <div className="space-y-3">
                          {Array.from(canceledItemsMap.values()).map((item) => (
                            <div
                              key={item.menuName}
                              className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border border-red-300 dark:border-red-700"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                  <p className="text-base font-semibold text-red-600 dark:text-red-300 truncate">
                                    {item.menuName}
                                  </p>
                                  <p className="text-sm text-red-500 dark:text-red-400 mt-1">
                                    {item.quantity} adet • ₺
                                    {(item.subtotal / item.quantity).toFixed(2)}{" "}
                                    birim fiyat
                                  </p>
                                </div>
                                <span className="font-bold text-base text-red-600 dark:text-red-300 line-through ml-2">
                                  ₺{item.subtotal.toFixed(2)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Aktif Ürünler */}
                    {order.items && order.items.filter((item) => !item.canceledAt).length >
                      0 && (
                      <div className="mb-4">
                        <div className="space-y-0 border-t border-gray-200 dark:border-gray-700">
                          {(() => {
                            // Cari masalarda tarihe göre grupla, diğer masalarda normal birleştir
                            if (currentTable.area === "Cari") {
                              // Tarihe göre grupla
                              const itemsByDate = new Map<
                                string,
                                Array<{ item: OrderItem; indices: number[] }>
                              >();
                              
                              order.items.forEach((item, index) => {
                                if (!item.canceledAt) {
                                  // Tarih anahtarı oluştur (sadece tarih, saat değil)
                                  const dateKey = item.addedAt
                                    ? new Date(item.addedAt).toLocaleDateString("tr-TR", {
                                        day: "2-digit",
                                        month: "2-digit",
                                        year: "numeric",
                                      })
                                    : "Tarih Bilinmiyor";
                                  
                                  if (!itemsByDate.has(dateKey)) {
                                    itemsByDate.set(dateKey, []);
                                  }
                                  
                                  // Aynı menuId'ye sahip ürünleri birleştir (aynı tarih grubu içinde)
                                  const dateGroup = itemsByDate.get(dateKey)!;
                                  const existingInGroup = dateGroup.find(
                                    (g) => g.item.menuId === item.menuId
                                  );
                                  
                                  if (existingInGroup) {
                                    existingInGroup.item.quantity += item.quantity;
                                    existingInGroup.item.subtotal += item.subtotal;
                                    existingInGroup.indices.push(index);
                                    // En eski eklenme tarihini koru
                                    if (item.addedAt && existingInGroup.item.addedAt) {
                                      existingInGroup.item.addedAt = 
                                        item.addedAt < existingInGroup.item.addedAt 
                                          ? item.addedAt 
                                          : existingInGroup.item.addedAt;
                                    } else if (item.addedAt && !existingInGroup.item.addedAt) {
                                      existingInGroup.item.addedAt = item.addedAt;
                                    }
                                  } else {
                                    dateGroup.push({
                                      item: { ...item },
                                      indices: [index],
                                    });
                                  }
                                }
                              });
                              
                              // Tarihleri sırala (en yeni en üstte)
                              const sortedDates = Array.from(itemsByDate.keys()).sort((a, b) => {
                                if (a === "Tarih Bilinmiyor") return 1;
                                if (b === "Tarih Bilinmiyor") return -1;
                                const dateA = new Date(a.split(".").reverse().join("-"));
                                const dateB = new Date(b.split(".").reverse().join("-"));
                                return dateB.getTime() - dateA.getTime();
                              });
                              
                              // Her tarih grubunu göster
                              return sortedDates.map((dateKey) => {
                                const dateGroup = itemsByDate.get(dateKey)!;
                                return (
                                  <div key={dateKey} className="mb-4">
                                    {/* Tarih Başlığı */}
                                    <div className="px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                                      <p className="text-sm font-bold text-gray-700 dark:text-gray-300">
                                        {dateKey}
                                      </p>
                                    </div>
                                    {/* Bu tarihe ait ürünler */}
                                    {dateGroup.map(({ item, indices }, _idx) => {
                                      return (
                                        <div key={`${dateKey}-${item.menuId}-${_idx}`}>
                                          {(() => {
                                            const isSelected = indices.some((idx) =>
                                              selectedItems.has(idx)
                                            );
                                            // Gönderilmemiş ürün mü kontrol et
                                            const isUnsent = !order.sentItems?.includes(
                                              item.menuId
                                            );

                                            return (
                                              <div
                                                key={item.menuId}
                                                className={`relative ${
                                                  isSelected
                                                    ? "bg-blue-50 dark:bg-blue-900/20"
                                                    : ""
                                                }`}
                                              >
                                                <div
                                                  onClick={() => {
                                                    // Eğer gönderilmemiş ürünse, seçim yapma, sadece butonlara tıklanabilir
                                                    if (isUnsent) return;

                                                    // Eğer ödeme modalı açıksa, selectedQuantities'yi güncelle
                                                    if (showPaymentModal) {
                                                      // Önce pendingPaymentItems içinde bu ürün var mı kontrol et
                                                      let existingInPending =
                                                        pendingPaymentItems.find(
                                                          (p) => p.menuId === item.menuId
                                                        );

                                                      // Eğer yoksa, pendingPaymentItems'a ekle
                                                      if (!existingInPending) {
                                                        // Aynı menuId'ye sahip tüm item'ları bul ve topla
                                                        const allSameItems =
                                                          order.items.filter(
                                                            (o) => o.menuId === item.menuId
                                                          );
                                                        const totalQty =
                                                          allSameItems.reduce(
                                                            (sum, o) => sum + o.quantity,
                                                            0
                                                          );
                                                        const indices = order.items
                                                          .map((o, idx) =>
                                                            o.menuId === item.menuId
                                                              ? idx
                                                              : -1
                                                          )
                                                          .filter((idx) => idx !== -1);

                                                        const newPendingItem = {
                                                          menuId: item.menuId,
                                                          menuName: item.menuName,
                                                          totalQuantity: totalQty,
                                                          menuPrice: item.menuPrice,
                                                          indices: indices,
                                                        };

                                                        setPendingPaymentItems((prev) => {
                                                          const newList = [...prev];
                                                          newList.push(newPendingItem);
                                                          return newList;
                                                        });

                                                        existingInPending = newPendingItem;
                                                      }

                                                      // selectedQuantities'yi güncelle
                                                      const currentQty =
                                                        selectedQuantities.get(
                                                          item.menuId
                                                        ) || 0;
                                                      const newQty = Math.min(
                                                        existingInPending.totalQuantity,
                                                        currentQty + 1
                                                      );
                                                      setSelectedQuantities((prev) => {
                                                        const newMap = new Map(prev);
                                                        newMap.set(item.menuId, newQty);
                                                        return newMap;
                                                      });
                                                      return;
                                                    }

                                                    // Normal seçim (ödeme modalı kapalıysa)
                                                    // Tüm indices'leri toggle et
                                                    const newSet = new Set(selectedItems);
                                                    indices.forEach((idx) => {
                                                      if (newSet.has(idx)) {
                                                        newSet.delete(idx);
                                                      } else {
                                                        newSet.add(idx);
                                                      }
                                                    });
                                                    setSelectedItems(newSet);
                                                  }}
                                                  className={`flex items-center justify-between py-5 px-4 border-b border-gray-200 dark:border-gray-700 ${
                                                    isUnsent
                                                      ? ""
                                                      : "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
                                                  } ${
                                                    isSelected ||
                                                    (showPaymentModal &&
                                                      (selectedQuantities.get(
                                                        item.menuId
                                                      ) || 0) > 0)
                                                      ? "bg-blue-50 dark:bg-blue-900/20"
                                                      : ""
                                                  }`}
                                                >
                                                  <div className="flex items-center gap-3 flex-1 min-w-0">
                                                    <span className="text-lg font-bold text-pink-600 dark:text-pink-400 shrink-0">
                                                      {item.quantity}x
                                                    </span>
                                                    <div className="flex-1 min-w-0">
                                                      <p className="text-base font-semibold text-gray-900 dark:text-white truncate">
                                                        {item.menuName}
                                                      </p>
                                                      {item.addedAt && currentTable.area === "Cari" && (
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                          {new Date(item.addedAt).toLocaleDateString("tr-TR", {
                                                            day: "2-digit",
                                                            month: "2-digit",
                                                            year: "numeric",
                                                            hour: "2-digit",
                                                            minute: "2-digit",
                                                          })}
                                                        </p>
                                                      )}
                                                    </div>
                                                  </div>

                                                  {/* Gönderilmemiş ürünler için butonlar - Cari masalarda gösterilmez */}
                                                  {isUnsent && currentTable.area !== "Cari" ? (
                                                    <div
                                                      className="flex items-center gap-2 shrink-0"
                                                      onClick={(e) => e.stopPropagation()}
                                                    >
                                                      <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => {
                                                          const index = indices[0];
                                                          if (index !== undefined) {
                                                            handleIncreaseQuantity(index);
                                                          }
                                                        }}
                                                        className="h-8 w-8 p-0"
                                                      >
                                                        <Plus className="h-4 w-4" />
                                                      </Button>
                                                      <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => {
                                                          const index = indices[0];
                                                          if (index !== undefined) {
                                                            handleDecreaseQuantity(index);
                                                          }
                                                        }}
                                                        className="h-8 w-8 p-0"
                                                      >
                                                        <Minus className="h-4 w-4" />
                                                      </Button>
                                                      <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => {
                                                          const index = indices[0];
                                                          if (index !== undefined) {
                                                            handleRemoveItem(index);
                                                          }
                                                        }}
                                                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                                      >
                                                        <Trash2 className="h-4 w-4" />
                                                      </Button>
                                                    </div>
                                                  ) : (
                                                    <div className="flex items-center gap-2 shrink-0">
                                                      <span className="text-lg font-bold text-gray-900 dark:text-white">
                                                        ₺{item.subtotal.toFixed(2).replace(".", ",")}
                                                      </span>
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                            );
                                          })()}
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              });
                            } else {
                              // Normal masalarda aynı menuId'ye sahip ürünleri birleştir
                              const mergedItems = new Map<
                                string,
                                { item: OrderItem; indices: number[] }
                              >();
                              order.items.forEach((item, index) => {
                                if (!item.canceledAt) {
                                  const existing = mergedItems.get(item.menuId);
                                  if (existing) {
                                    existing.item.quantity += item.quantity;
                                    existing.item.subtotal += item.subtotal;
                                    existing.indices.push(index);
                                    // En eski eklenme tarihini koru
                                    if (item.addedAt && existing.item.addedAt) {
                                      existing.item.addedAt = 
                                        item.addedAt < existing.item.addedAt 
                                          ? item.addedAt 
                                          : existing.item.addedAt;
                                    } else if (item.addedAt && !existing.item.addedAt) {
                                      existing.item.addedAt = item.addedAt;
                                    }
                                  } else {
                                    mergedItems.set(item.menuId, {
                                      item: { ...item },
                                      indices: [index],
                                    });
                                  }
                                }
                              });

                              return Array.from(mergedItems.values()).map(
                                ({ item, indices }, _idx) => {
                                  const isSelected = indices.some((idx) =>
                                    selectedItems.has(idx)
                                  );
                                  // Gönderilmemiş ürün mü kontrol et
                                  const isUnsent = !order.sentItems?.includes(
                                    item.menuId
                                  );

                                  return (
                                    <div
                                      key={item.menuId}
                                      className={`relative ${
                                        isSelected
                                          ? "bg-blue-50 dark:bg-blue-900/20"
                                          : ""
                                      }`}
                                    >
                                      <div
                                        onClick={() => {
                                          // Eğer gönderilmemiş ürünse, seçim yapma, sadece butonlara tıklanabilir
                                          if (isUnsent) return;

                                          // Eğer ödeme modalı açıksa, selectedQuantities'yi güncelle
                                          if (showPaymentModal) {
                                            // Önce pendingPaymentItems içinde bu ürün var mı kontrol et
                                            let existingInPending =
                                              pendingPaymentItems.find(
                                                (p) => p.menuId === item.menuId
                                              );

                                            // Eğer yoksa, pendingPaymentItems'a ekle
                                            if (!existingInPending) {
                                              // Aynı menuId'ye sahip tüm item'ları bul ve topla
                                              const allSameItems =
                                                order.items.filter(
                                                  (o) => o.menuId === item.menuId
                                                );
                                              const totalQty =
                                                allSameItems.reduce(
                                                  (sum, o) => sum + o.quantity,
                                                  0
                                                );
                                              const indices = order.items
                                                .map((o, idx) =>
                                                  o.menuId === item.menuId
                                                    ? idx
                                                    : -1
                                                )
                                                .filter((idx) => idx !== -1);

                                              const newPendingItem = {
                                                menuId: item.menuId,
                                                menuName: item.menuName,
                                                totalQuantity: totalQty,
                                                menuPrice: item.menuPrice,
                                                indices: indices,
                                              };

                                              setPendingPaymentItems((prev) => {
                                                const newList = [...prev];
                                                newList.push(newPendingItem);
                                                return newList;
                                              });

                                              existingInPending = newPendingItem;
                                            }

                                            // selectedQuantities'yi güncelle
                                            const currentQty =
                                              selectedQuantities.get(
                                                item.menuId
                                              ) || 0;
                                            const newQty = Math.min(
                                              existingInPending.totalQuantity,
                                              currentQty + 1
                                            );
                                            setSelectedQuantities((prev) => {
                                              const newMap = new Map(prev);
                                              newMap.set(item.menuId, newQty);
                                              return newMap;
                                            });
                                            return;
                                          }

                                          // Normal seçim (ödeme modalı kapalıysa)
                                          // Eğer ürün iptal edilebilir durumdaysa (gönderilmemiş), iptal modalını aç
                                          if (isUnsent && !item.canceledAt) {
                                            // Aynı menuId'ye sahip tüm item'ları bul ve topla
                                            const allSameItems = order.items.filter(
                                              (o) => o.menuId === item.menuId && !o.canceledAt && !order.sentItems?.includes(o.menuId)
                                            );
                                            const totalQty = allSameItems.reduce(
                                              (sum, o) => sum + o.quantity,
                                              0
                                            );
                                            const itemIndices = order.items
                                              .map((o, idx) =>
                                                o.menuId === item.menuId && !o.canceledAt && !order.sentItems?.includes(o.menuId)
                                                  ? idx
                                                  : -1
                                              )
                                              .filter((idx) => idx !== -1);

                                            const newPendingCancelItem = {
                                              menuId: item.menuId,
                                              menuName: item.menuName,
                                              totalQuantity: totalQty,
                                              indices: itemIndices,
                                            };

                                            setPendingCancelItems([newPendingCancelItem]);
                                            setSelectedCancelQuantities(new Map());
                                            setCurrentCancelItemIndex(0);
                                            setQuantitySelectionAction("cancel");
                                            setShowQuantitySelectionModal(true);
                                            return;
                                          }

                                          // Normal seçim - Tüm indices'leri toggle et
                                          const newSet = new Set(selectedItems);
                                          indices.forEach((idx) => {
                                            if (newSet.has(idx)) {
                                              newSet.delete(idx);
                                            } else {
                                              newSet.add(idx);
                                            }
                                          });
                                          setSelectedItems(newSet);
                                        }}
                                        className={`flex items-center justify-between py-5 px-4 border-b border-gray-200 dark:border-gray-700 ${
                                          isUnsent
                                            ? ""
                                            : "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
                                        } ${
                                          isSelected ||
                                          (showPaymentModal &&
                                            (selectedQuantities.get(
                                              item.menuId
                                            ) || 0) > 0)
                                            ? "bg-blue-50 dark:bg-blue-900/20"
                                            : ""
                                        }`}
                                      >
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                          <span className="text-lg font-bold text-pink-600 dark:text-pink-400 shrink-0">
                                            {item.quantity}x
                                          </span>
                                          <div className="flex-1 min-w-0">
                                            <p className="text-base font-semibold text-gray-900 dark:text-white truncate">
                                              {item.menuName}
                                            </p>
                                            {item.addedAt && currentTable.area === "Cari" && (
                                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                {new Date(item.addedAt).toLocaleDateString("tr-TR", {
                                                  day: "2-digit",
                                                  month: "2-digit",
                                                  year: "numeric",
                                                  hour: "2-digit",
                                                  minute: "2-digit",
                                                })}
                                              </p>
                                            )}
                                          </div>
                                        </div>

                                        {/* Gönderilmemiş ürünler için butonlar - Cari masalarda gösterilmez */}
                                        {isUnsent && currentTable.area !== "Cari" ? (
                                          <div
                                            className="flex items-center gap-3 ml-2"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <button
                                              onClick={() =>
                                                decreaseUnsentItemQuantity(
                                                  item.menuId
                                                )
                                              }
                                              className="p-2.5 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                                              disabled={item.quantity <= 1}
                                            >
                                              <Minus className="h-5 w-5" />
                                            </button>
                                            <button
                                              onClick={() =>
                                                increaseUnsentItemQuantity(
                                                  item.menuId
                                                )
                                              }
                                              className="p-2.5 rounded-lg bg-green-500 hover:bg-green-600 text-white transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                                            >
                                              <Plus className="h-5 w-5" />
                                            </button>
                                            <button
                                              onClick={() =>
                                                removeUnsentItem(item.menuId)
                                              }
                                              className="p-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                                            >
                                              <Trash2 className="h-5 w-5" />
                                            </button>
                                          </div>
                                        ) : (
                                          <span className="text-base font-semibold text-gray-900 dark:text-white ml-2 shrink-0">
                                            ₺
                                            {(item.menuPrice * item.quantity)
                                              .toFixed(2)
                                              .replace(".", ",")}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                }
                              );
                            }
                          })()}
                        </div>
                      </div>
                    )}

                    {/* Cart içindeki yeni eklenen ürünler */}
                    {cart.length > 0 && (
                      <div className="mb-4 mt-4">
                        <div className="text-sm font-bold text-blue-700 dark:text-blue-400 mb-3 flex items-center gap-2">
                          <ShoppingCart className="h-4 w-4" />
                          Yeni Eklenen Ürünler
                        </div>
                        <div className="space-y-0 border-t border-gray-200 dark:border-gray-700">
                          {(() => {
                            // Aynı menuId'ye sahip ürünleri birleştir
                            const mergedItems = new Map<
                              string,
                              { item: OrderItem; cartItemIds: string[] }
                            >();

                            cart.forEach((item) => {
                              const existing = mergedItems.get(item.menuId);
                              if (existing) {
                                // Aynı ürün varsa miktar ve toplamı birleştir
                                existing.item.quantity += item.quantity;
                                existing.item.subtotal += item.subtotal;
                                existing.cartItemIds.push(
                                  item.cartItemId || item.menuId
                                );
                              } else {
                                // Yeni ürün ekle
                                mergedItems.set(item.menuId, {
                                  item: { ...item },
                                  cartItemIds: [item.cartItemId || item.menuId],
                                });
                              }
                            });

                            return Array.from(mergedItems.values()).map(
                              ({ item, cartItemIds }, _idx) => {
                                const isSelected = cartItemIds.some((id) =>
                                  selectedCartItems.has(id)
                                );
                                return (
                                  <div
                                    key={item.menuId}
                                    className={`relative ${
                                      isSelected
                                        ? "bg-blue-50 dark:bg-blue-900/20"
                                        : ""
                                    }`}
                                  >
                                    <div
                                      onClick={() => {
                                        // Tüm cartItemIds'leri toggle et
                                        const newSet = new Set(
                                          selectedCartItems
                                        );
                                        cartItemIds.forEach((id) => {
                                          if (newSet.has(id)) {
                                            newSet.delete(id);
                                          } else {
                                            newSet.add(id);
                                          }
                                        });
                                        setSelectedCartItems(newSet);
                                      }}
                                      className={`flex items-center justify-between py-5 px-4 border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
                                        isSelected
                                          ? "bg-blue-50 dark:bg-blue-900/20"
                                          : ""
                                      }`}
                                    >
                                      <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <span className="text-lg font-bold text-pink-600 dark:text-pink-400 shrink-0">
                                          {item.quantity}x
                                        </span>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-base font-semibold text-gray-900 dark:text-white truncate">
                                            {item.menuName}
                                          </p>
                                          {item.addedAt && currentTable.area === "Cari" && (
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                              {new Date(item.addedAt).toLocaleDateString("tr-TR", {
                                                day: "2-digit",
                                                month: "2-digit",
                                                year: "numeric",
                                                hour: "2-digit",
                                                minute: "2-digit",
                                              })}
                                            </p>
                                          )}
                                        </div>
                                      </div>

                                      {/* Cart ürünleri için butonlar */}
                                      <div
                                        className="flex items-center gap-3 ml-2"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <button
                                          onClick={() =>
                                            decreaseCartItemQuantity(
                                              item.menuId
                                            )
                                          }
                                          className="p-2.5 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                                          disabled={item.quantity <= 1}
                                        >
                                          <Minus className="h-5 w-5" />
                                        </button>
                                        <button
                                          onClick={() =>
                                            increaseCartItemQuantity(
                                              item.menuId
                                            )
                                          }
                                          className="p-2.5 rounded-lg bg-green-500 hover:bg-green-600 text-white transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                                        >
                                          <Plus className="h-5 w-5" />
                                        </button>
                                        <button
                                          onClick={() =>
                                            removeCartItem(item.menuId)
                                          }
                                          className="p-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                                        >
                                          <Trash2 className="h-5 w-5" />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              }
                            );
                          })()}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </>
          ) : cart.length > 0 ? (
            <div className="space-y-0 border-t border-gray-200 dark:border-gray-700">
              {(() => {
                // Aynı menuId'ye sahip ürünleri birleştir
                const mergedItems = new Map<
                  string,
                  { item: OrderItem; cartItemIds: string[] }
                >();

                cart.forEach((item) => {
                  const existing = mergedItems.get(item.menuId);
                  if (existing) {
                    // Aynı ürün varsa miktar ve toplamı birleştir
                    existing.item.quantity += item.quantity;
                    existing.item.subtotal += item.subtotal;
                    existing.cartItemIds.push(item.cartItemId || item.menuId);
                  } else {
                    // Yeni ürün ekle
                    mergedItems.set(item.menuId, {
                      item: { ...item },
                      cartItemIds: [item.cartItemId || item.menuId],
                    });
                  }
                });

                return Array.from(mergedItems.values()).map(
                  ({ item, cartItemIds }, _idx) => {
                    const isSelected = cartItemIds.some((id) =>
                      selectedCartItems.has(id)
                    );
                    return (
                      <div
                        key={item.menuId}
                        className={`relative ${
                          isSelected ? "bg-blue-50 dark:bg-blue-900/20" : ""
                        }`}
                      >
                        <div
                          onClick={() => {
                            // Tüm cartItemIds'leri toggle et
                            const newSet = new Set(selectedCartItems);
                            cartItemIds.forEach((id) => {
                              if (newSet.has(id)) {
                                newSet.delete(id);
                              } else {
                                newSet.add(id);
                              }
                            });
                            setSelectedCartItems(newSet);
                          }}
                          className={`flex items-center justify-between py-5 px-4 border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
                            isSelected ? "bg-blue-50 dark:bg-blue-900/20" : ""
                          }`}
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <span className="text-lg font-bold text-pink-600 dark:text-pink-400 shrink-0">
                              {item.quantity}x
                            </span>
                            <p className="text-base font-semibold text-gray-900 dark:text-white truncate">
                              {item.menuName}
                            </p>
                          </div>

                          {/* Cart ürünleri için butonlar */}
                          <div
                            className="flex items-center gap-3 ml-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() =>
                                decreaseCartItemQuantity(item.menuId)
                              }
                              className="p-2.5 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                              disabled={item.quantity <= 1}
                            >
                              <Minus className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() =>
                                increaseCartItemQuantity(item.menuId)
                              }
                              className="p-2.5 rounded-lg bg-green-500 hover:bg-green-600 text-white transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                            >
                              <Plus className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => removeCartItem(item.menuId)}
                              className="p-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                            >
                              <Trash2 className="h-5 w-5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  }
                );
              })()}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-500 dark:text-gray-400">
              <ShoppingCart className="h-10 w-10 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
              <p className="text-xs">Sepet boş</p>
              <p className="text-xs mt-1">Ürünlere tıklayarak ekleyin</p>
            </div>
          )}
        </div>

        {/* Bottom Actions */}
        <div className="p-3 flex-shrink-0 space-y-2">
          {/* Seçili ürünler için butonlar - Ödeme Al butonunun üzerinde */}
          {order && order.items.length > 0 && selectedItems.size > 0 && (
            <div className="flex gap-2 mb-2">
              <Button
                onClick={() => {
                  customAlert(
                    "Taşıma özelliği yakında eklenecek",
                    "Bilgi",
                    "info"
                  );
                }}
                className="flex-1 h-10 bg-blue-600 hover:bg-blue-700 text-white text-sm"
              >
                <ArrowRight className="h-4 w-4 mr-2" />
                Taşı
              </Button>
              <Button
                onClick={async () => {
                  if (!order || selectedItems.size === 0) return;
                  
                  // Direkt iptal et - seçili ürünlerin tamamını iptal et
                  setIsCanceling(true);
                  try {
                    const canceledItems = order.canceledItems || [];
                    const updatedItems: OrderItem[] = [];
                    const itemsToCancel: OrderItem[] = [];

                    // Seçili ürünleri iptal et
                    order.items.forEach((item, index) => {
                      if (selectedItems.has(index) && !item.canceledAt) {
                        // İptal edilen ürünü canceledItems'a ekle
                        const canceledItem = {
                          ...item,
                          addedAt: item.addedAt || new Date(),
                          canceledAt: new Date(),
                        };
                        canceledItems.push(canceledItem);
                        itemsToCancel.push(canceledItem);
                      } else if (!item.canceledAt) {
                        // İptal edilmeyecek, olduğu gibi ekle
                        updatedItems.push(item);
                      }
                    });

                    // Eğer hiç ürün kalmadıysa siparişi kapat
                    if (updatedItems.length === 0) {
                      await updateOrder(order.id!, {
                        items: updatedItems,
                        canceledItems: canceledItems,
                        subtotal: 0,
                        total: 0,
                      });

                      if (currentTable.id) {
                        try {
                          await updateTableStatus(currentTable.id, "available", undefined);
                          await updateOrderStatus(order.id!, "closed");
                          const updatedTable = await getTable(currentTable.id);
                          if (updatedTable) {
                            setCurrentTable(updatedTable);
                          }
                        } catch (error) {
                          console.error("Masa güncellenirken hata:", error);
                        }
                      }
                      setOrder(null);
                      setSelectedItems(new Set());
                      setIsCanceling(false);
                      return;
                    }

                    // Toplam hesapla
                    const subtotal = updatedItems.reduce(
                      (sum, item) => sum + item.subtotal,
                      0
                    );
                    const total = subtotal - (order.discount || 0);

                    await updateOrder(order.id!, {
                      items: updatedItems,
                      canceledItems: canceledItems,
                      subtotal: subtotal,
                      total: total,
                    });

                    // İptal edilen ürünleri yazdır
                    try {
                      if (itemsToCancel.length > 0) {
                        for (const canceledItem of itemsToCancel) {
                          const menuItem = menus.find((m) => m.id === canceledItem.menuId);
                          if (menuItem && menuItem.category) {
                            const category = categories.find(
                              (c) => c.name === menuItem.category
                            );
                            if (category) {
                              const categoryPrinters = getPrintersForCategories(
                                printers,
                                categories,
                                [category.id || ""]
                              );

                              for (const printer of categoryPrinters) {
                                const printContent = formatPrintContent(
                                  "cancel",
                                  [canceledItem],
                                  currentTable.tableNumber,
                                  order.orderNumber,
                                  {
                                    companyName: companyData?.name || "",
                                    paperWidth: printer.paperWidth || 48,
                                  }
                                );
                                await printToPrinter(printer.name, printContent, "cancel");
                              }
                            }
                          }
                        }
                      }
                    } catch (error) {
                      // Yazdırma hatası iptal işlemini etkilemesin
                    }

                    // Masa geçmişine kaydet
                    const effectiveCompanyId = companyId || userData?.companyId;
                    const effectiveBranchId = branchId || userData?.assignedBranchId;
                    if (effectiveCompanyId) {
                      try {
                        for (const canceledItem of itemsToCancel) {
                          await addTableHistory(
                            effectiveCompanyId,
                            currentTable.id!,
                            currentTable.tableNumber,
                            "item_cancelled",
                            `${canceledItem.menuName} iptal edildi`,
                            {
                              menuId: canceledItem.menuId,
                              menuName: canceledItem.menuName,
                              quantity: canceledItem.quantity,
                              subtotal: canceledItem.subtotal,
                            },
                            effectiveBranchId || undefined
                          );
                        }
                      } catch (error) {
                        // Error saving table history
                      }
                    }

                    // Siparişi yeniden yükle
                    const updatedOrder = await getOrder(order.id!);
                    setOrder(updatedOrder);
                    setSelectedItems(new Set());
                  } catch (error) {
                    customAlert("Ürünler iptal edilirken bir hata oluştu", "Hata", "error");
                  } finally {
                    setIsCanceling(false);
                  }
                }}
                className="flex-1 h-10 bg-red-600 hover:bg-red-700 text-white text-sm"
                disabled={isCanceling}
              >
                {isCanceling ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    İptal ediliyor...
                  </>
                ) : (
                  <>
                    <X className="h-4 w-4 mr-2" />
                    İptal
                  </>
                )}
              </Button>
            </div>
          )}
          {cart.length > 0 && selectedCartItems.size > 0 && (
            <div className="flex gap-2 mb-2">
              <Button
                onClick={() => {
                  customAlert(
                    "Taşıma özelliği yakında eklenecek",
                    "Bilgi",
                    "info"
                  );
                }}
                className="flex-1 h-10 bg-blue-600 hover:bg-blue-700 text-white text-sm"
              >
                <ArrowRight className="h-4 w-4 mr-2" />
                Taşı
              </Button>
              <Button
                onClick={() => {
                  // Seçili cart item'ları sil
                  selectedCartItems.forEach((cartItemId) => {
                    removeFromCart(cartItemId);
                  });
                  setSelectedCartItems(new Set());
                }}
                className="flex-1 h-10 bg-red-600 hover:bg-red-700 text-white text-sm"
              >
                <X className="h-4 w-4 mr-2" />
                İptal
              </Button>
            </div>
          )}
          {cart.length > 0 && (
            <Button
              onClick={handleSendOrder}
              disabled={isSendingOrder || isRefreshingOrder}
              className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white text-base font-semibold"
            >
              {isSendingOrder ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Gönderiliyor...
                </>
              ) : (
                <>
                  <Send className="h-5 w-5 mr-2" />
                  Siparişi Gönder ({cartTotal.toFixed(2)}₺)
                </>
              )}
            </Button>
          )}
          {order &&
            order.items.length > 0 &&
            order.status !== "closed" &&
            (() => {
              // İptal edilmemiş ürünleri filtrele
              const activeItems = order.items.filter((item) => !item.canceledAt);
              
              // Eğer aktif ürün yoksa buton gösterilmesin
              if (activeItems.length === 0) {
                return null;
              }

              // Ödenmemiş ürünlerin toplam tutarını hesapla
              // NOT: Ödeme yapıldığında ödenen ürünler order.items'dan kaldırılıyor veya miktarları azaltılıyor
              // Bu yüzden order.items zaten sadece ödenmemiş ürünleri içeriyor
              // Direkt olarak order.items içindeki aktif ürünlerin toplamını hesaplamalıyız
              let unpaidSubtotal = 0;
              let unpaidOriginalAmount = 0;
              
              activeItems.forEach((item) => {
                // order.items içindeki tüm aktif ürünler zaten ödenmemiş ürünlerdir
                // Çünkü ödeme yapıldığında ödenen ürünler kaldırılıyor veya miktarları azaltılıyor
                unpaidOriginalAmount += item.menuPrice * item.quantity;
                unpaidSubtotal += item.subtotal;
              });
              
              // Order'da genel bir indirim varsa (order.discount), bunu da dikkate al
              // Ancak bu indirim tüm sipariş için olabilir, kalan ürünler için orantılı olarak uygulanmalı
              // Basit yaklaşım: order.total kullan (zaten güncel olmalı)
              // Ama order.total güncel olmayabilir, o yüzden manuel hesaplayalım
              const orderDiscount = order.discount || 0;
              const orderSubtotal = (order.items || []).reduce((sum, item) => sum + item.subtotal, 0);
              
              // Eğer order'da indirim varsa ve orderSubtotal > 0 ise, indirimi orantılı olarak uygula
              let unpaidTotalAmount = unpaidSubtotal;
              if (orderDiscount > 0 && orderSubtotal > 0) {
                // İndirim oranını hesapla
                const discountRatio = orderDiscount / orderSubtotal;
                // Kalan ürünlere orantılı indirim uygula
                unpaidTotalAmount = Math.max(0, unpaidSubtotal - (unpaidSubtotal * discountRatio));
              }

              // Eğer ödenmemiş tutar yoksa, buton ve toplam gösterilmesin
              if (unpaidTotalAmount <= 0) {
                return null;
              }

              return (
                <div className="flex items-center gap-3">
                  {/* Toplam */}
                  <div className="flex-1 h-14 px-3 bg-gray-50 dark:bg-gray-800 rounded-lg flex items-center justify-between">
                    <span className="text-sm text-purple-700 dark:text-purple-400">
                      TOPLAM
                    </span>
                    <div className="flex flex-col items-end">
                      {unpaidOriginalAmount > unpaidTotalAmount ? (
                        <>
                          <span className="text-sm font-medium text-gray-500 dark:text-gray-400 line-through">
                            ₺
                            {unpaidOriginalAmount
                              .toFixed(2)
                              .replace(".", ",")}
                          </span>
                          <span className="text-xl font-bold text-purple-700 dark:text-purple-400">
                            ₺
                            {unpaidTotalAmount
                              .toFixed(2)
                              .replace(".", ",")}
                          </span>
                        </>
                      ) : (
                        <span className="text-xl font-bold text-purple-700 dark:text-purple-400">
                          ₺
                          {unpaidTotalAmount
                            .toFixed(2)
                            .replace(".", ",")}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    onClick={() => {
                      // Ödeme modalı açıldığında selectedItems'ı temizle
                      // Çünkü artık ödeme modalında ürün seçimi yapılacak
                      setSelectedItems(new Set());

                      setShowPaymentModal(true);
                      setPaymentMethod("");
                      // URL'e payment parametresi ekle
                      navigate({
                        to: "/table/$tableId",
                        params: { tableId: tableId },
                        search: (prev) => ({
                          area: (prev?.area ?? undefined) as string | undefined,
                          activeOnly: prev?.activeOnly ?? false,
                          payment: "true",
                        }),
                        replace: true,
                      });
                    }}
                    className="h-14 bg-green-600 hover:bg-green-700 text-white text-base font-semibold px-6"
                  >
                    <CreditCard className="h-5 w-5 mr-2" />
                    Ödeme Al
                  </Button>
                </div>
              );
            })()}
        </div>
      </div>
      {/* Main Content - Products */}
      <div className="flex-1 flex flex-col">
        {/* Categories - Mobile (Horizontal Scroll) */}
        <div className="lg:hidden bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-3 py-2 overflow-x-auto flex-shrink-0">
          <div className="flex gap-2 min-w-max">
            {categories.map((category) => {
              const isSelected = selectedCategoryId === category.id;
              return (
                <button
                  key={category.id}
                  onClick={() => {
                    setSelectedCategoryId(category.id!);
                    setSelectedCategoryName(category.name);
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                    isSelected
                      ? "bg-blue-600 text-white shadow-md"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                  }`}
                >
                  {category.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Products Grid */}
        <div className="flex-1 p-3 lg:p-4 overflow-y-auto relative">
          {filteredMenus.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">
                Bu kategoride ürün bulunmuyor
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3">
              {filteredMenus.map((menu) => {
                return (
                  <div
                    key={menu.id}
                    className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all duration-200 overflow-hidden cursor-pointer"
                    onClick={() => !isRefreshingOrder && handleAddToCart(menu)}
                    onMouseDown={() =>
                      !isRefreshingOrder && handleLongPressStart(menu)
                    }
                    onMouseUp={handleLongPressEnd}
                    onMouseLeave={handleLongPressEnd}
                    onTouchStart={() =>
                      !isRefreshingOrder && handleLongPressStart(menu)
                    }
                    onTouchEnd={handleLongPressEnd}
                    onTouchCancel={handleLongPressEnd}
                    style={{
                      pointerEvents: isRefreshingOrder ? "none" : "auto",
                      opacity: isRefreshingOrder ? 0.5 : 1,
                    }}
                  >
                    {menu.image && (
                      <div className="aspect-square overflow-hidden">
                        <img
                          src={menu.image}
                          alt={menu.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="p-2">
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-1 text-xs sm:text-sm line-clamp-2">
                        {menu.name}
                      </h3>
                      <div className="flex items-center justify-between">
                        <span className="text-sm sm:text-base font-bold text-blue-600 dark:text-blue-400">
                          ₺{menu.price.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Ödeme Paneli - Sipariş Listesinin Yanında */}
      {showPaymentModal &&
        order &&
        order.items &&
        order.items.length > 0 &&
        (() => {
          // Seçili miktarlara göre kalan tutarı hesapla
          // Sipariş listesindeki toplam tutar ile aynı olmalı
          let remaining: number;
          let originalTotal: number; // İndirim öncesi toplam (üstü çizili fiyat için)
          
          // Sipariş listesindeki toplam tutarı hesapla (order.items içindeki tüm item'ların toplamı)
          // Bu, sipariş listesinde gösterilen TOPLAM ile aynı olmalı
          // Orijinal fiyat için menuPrice * quantity kullanıyoruz
          const orderListTotal = (order.items || []).reduce(
            (sum, item) => sum + (item.menuPrice * item.quantity),
            0
          );
          const orderDiscount = order.discount || 0;
          const orderListTotalWithDiscount = order.total || orderListTotal - orderDiscount;

          // BASIT: Seçili ürünler varsa, sadece seçili ürünlerin toplamını al, indirim uygula, göster
          // Seçili ürün kontrolü: selectedQuantities içinde seçili miktar olmalı
          const hasSelectedItems = pendingPaymentItems.length > 0 && 
            Array.from(selectedQuantities.values()).some(qty => qty > 0);
          
          let discount = 0;
          if (hasSelectedItems) {
            // Seçili ürünlerin toplam fiyatını hesapla (orijinal fiyat)
            originalTotal = pendingPaymentItems.reduce((sum, paymentItem) => {
              const selectedQty = selectedQuantities.get(paymentItem.menuId) || 0;
              if (selectedQty > 0) {
                return sum + (selectedQty * paymentItem.menuPrice);
              }
              return sum;
            }, 0);
            
            // İndirim hesapla
            if (discountType === "percentage" && discountValue && discountValue.trim() !== "") {
              const percentage = parseFloat(discountValue);
              if (!isNaN(percentage) && percentage > 0) {
                discount = (originalTotal * percentage) / 100;
              }
            } else if (discountType === "amount" && discountValue && discountValue.trim() !== "") {
              const amount = parseFloat(discountValue);
              if (!isNaN(amount) && amount > 0) {
                discount = Math.min(amount, originalTotal);
              }
            }
            
            // Kalan tutar = Seçili ürünlerin toplamı - İndirim
            remaining = Math.max(0, originalTotal - discount);
          } else {
            // Seçili ürün yoksa, tüm masanın toplamını kullan
            originalTotal = orderListTotal;
            if (discountType === "percentage" && discountValue && discountValue.trim() !== "") {
              const percentage = parseFloat(discountValue);
              if (!isNaN(percentage) && percentage > 0) {
                discount = (originalTotal * percentage) / 100;
              }
            } else if (discountType === "amount" && discountValue && discountValue.trim() !== "") {
              const amount = parseFloat(discountValue);
              if (!isNaN(amount) && amount > 0) {
                discount = Math.min(amount, originalTotal);
              }
            }
            remaining = orderListTotalWithDiscount;
          }

          return (
            <>
              {/* Overlay */}
              <div
                className="fixed top-[80px] bottom-0 left-0 right-0 bg-black/50 z-40 lg:left-[550px] lg:right-0"
                onClick={async () => {
                  setShowPaymentModal(false);
                  setPaymentAmount("");
                  setPaymentMethod("");
                  setDiscountType("percentage");
                  setDiscountValue("");
                  // URL'den payment parametresini kaldır
                  navigate({
                    to: "/table/$tableId",
                    params: { tableId: tableId },
                    search: (prev) => ({
                      area: (prev?.area ?? undefined) as string | undefined,
                      activeOnly: prev?.activeOnly ?? false,
                      payment: undefined,
                    }),
                    replace: true,
                  });
                  setSelectedCourierId("");
                  setPackageCount("1");
                  setChangeAmount("0");
                  setAppliedPayments([]);
                  // Order'ı refresh et ki ödeme al butonu görünsün
                  if (order?.id) {
                    setIsRefreshingOrder(true);
                    try {
                      const refreshedOrder = await getOrder(order.id);
                      if (refreshedOrder) {
                        setOrder(refreshedOrder);
                      }
                    } catch (error) {
                      console.error("Order refresh error:", error);
                    } finally {
                      setIsRefreshingOrder(false);
                    }
                  }
                }}
              />
              {/* Ödeme Paneli */}
              <div className="fixed top-[80px] bottom-0 left-0 right-0 lg:left-[550px] lg:right-0 bg-white dark:bg-gray-800 z-50 flex transform transition-transform duration-300 ease-in-out">
                {/* Sol Sidebar - Seçili Ürünler */}
                <div
                  className="hidden lg:flex lg:flex-none lg:w-80 flex-col overflow-hidden"
                  style={{ backgroundColor: "rgba(0, 0, 0, 0.2)" }}
                >
                  <div className="p-3 flex-shrink-0 border-b border-gray-700">
                    <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <ShoppingCart className="h-4 w-4" />
                      Seçili Ürünler
                    </h2>
                  </div>
                  <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                    {(() => {
                      const selectedItemsList = pendingPaymentItems.filter(
                        (item) => (selectedQuantities.get(item.menuId) || 0) > 0
                      );

                      // Seçili ürünlerin toplam fiyatını hesapla
                      const selectedItemsTotal = selectedItemsList.reduce((sum, paymentItem) => {
                        const selectedQty = selectedQuantities.get(paymentItem.menuId) || 0;
                        return sum + (selectedQty * paymentItem.menuPrice);
                      }, 0);

                      if (selectedItemsList.length === 0) {
                        return (
                          <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                            <ShoppingCart className="h-10 w-10 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                            <p className="text-xs">Seçili ürün yok</p>
                            <p className="text-xs mt-1">
                              Sipariş listesinden ürün seçin
                            </p>
                          </div>
                        );
                      }

                      return (
                        <>
                          <div className="flex-1 overflow-y-auto min-h-0">
                            <div className="space-y-2 p-3">
                              {selectedItemsList.map((paymentItem) => {
                                const selectedQty =
                                  selectedQuantities.get(paymentItem.menuId) || 0;
                                const itemTotal =
                                  selectedQty * paymentItem.menuPrice;
                                return (
                                  <div
                                    key={paymentItem.menuId}
                                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
                                  >
                                    <div className="flex-1 min-w-0">
                                      <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                        {paymentItem.menuName}
                                      </div>
                                      <div className="flex items-center gap-2 mt-1">
                                        <span className="text-xs text-gray-600 dark:text-gray-400">
                                          {selectedQty} /{" "}
                                          {paymentItem.totalQuantity} adet
                                        </span>
                                        <span className="text-xs font-semibold text-green-600 dark:text-green-400">
                                          ₺{itemTotal.toFixed(2).replace(".", ",")}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 ml-3">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const newQty = Math.max(
                                            0,
                                            selectedQty - 1
                                          );
                                          setSelectedQuantities((prev) => {
                                            const newMap = new Map(prev);
                                            if (newQty === 0) {
                                              newMap.delete(paymentItem.menuId);
                                            } else {
                                              newMap.set(
                                                paymentItem.menuId,
                                                newQty
                                              );
                                            }
                                            return newMap;
                                          });
                                        }}
                                        className="w-9 h-9 rounded-lg bg-red-500 hover:bg-red-600 text-white font-bold text-base flex items-center justify-center transition-all active:scale-95"
                                      >
                                        -
                                      </button>
                                      <div className="w-12 text-center text-base font-bold text-gray-900 dark:text-white">
                                        {selectedQty}
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const newQty = Math.min(
                                            paymentItem.totalQuantity,
                                            selectedQty + 1
                                          );
                                          setSelectedQuantities((prev) => {
                                            const newMap = new Map(prev);
                                            newMap.set(paymentItem.menuId, newQty);
                                            return newMap;
                                          });
                                        }}
                                        className="w-9 h-9 rounded-lg bg-green-500 hover:bg-green-600 text-white font-bold text-base flex items-center justify-center transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                        disabled={
                                          selectedQty >= paymentItem.totalQuantity
                                        }
                                      >
                                        +
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                          {/* Seçili Ürünler Toplamı - Sabit */}
                          <div className="flex-shrink-0 p-3 border-t border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                Seçili Ürünler Toplamı
                              </span>
                              <span className="text-lg font-bold text-purple-700 dark:text-purple-400">
                                ₺{selectedItemsTotal.toFixed(2).replace(".", ",")}
                              </span>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Ana Ödeme Alanı */}
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="p-5 flex-shrink-0 border-b-2 border-gray-200 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
                    <div className="flex items-center justify-between">
                      <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white">
                        Ödeme Al
                      </h2>
                      <button
                        onClick={async () => {
                          setShowPaymentModal(false);
                          setPaymentAmount("");
                          setDiscountType("percentage");
                          setDiscountValue("");
                          setSelectedCourierId("");
                          setPackageCount("1");
                          setChangeAmount("0");
                          setAppliedPayments([]);
                          // URL'den payment parametresini kaldır
                          navigate({
                            to: "/table/$tableId",
                            params: { tableId: tableId },
                            search: (prev) => ({
                              area: (prev?.area ?? undefined) as string | undefined,
                              activeOnly: prev?.activeOnly ?? false,
                              payment: undefined,
                            }),
                            replace: true,
                          });
                          // Order'ı refresh et ki ödeme al butonu görünsün
                          if (order?.id) {
                            setIsRefreshingOrder(true);
                            try {
                              const refreshedOrder = await getOrder(order.id);
                              if (refreshedOrder) {
                                setOrder(refreshedOrder);
                              }
                            } catch (error) {
                              console.error("Order refresh error:", error);
                            } finally {
                              setIsRefreshingOrder(false);
                            }
                          }
                        }}
                        className="p-2.5 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-all active:scale-95"
                      >
                        <X className="h-7 w-7 text-gray-600 dark:text-gray-400" />
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Üst Sabit Alan - Numerik Tuşlarla Yazılan Tutarların Tag'ları */}
                    <div className="px-8 pt-4 pb-4 border-b-2 border-gray-200 dark:border-gray-700 bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 flex-shrink-0 min-h-[200px]">
                      {/* Uygulanan Ödemeler */}
                      {appliedPayments.length > 0 ? (
                        <div className="flex items-center gap-3 mb-0 flex-wrap">
                          {appliedPayments.map((payment) => (
                            <div
                              key={payment.id}
                              className="flex items-center gap-2 px-5 py-2.5 bg-purple-100 dark:bg-purple-900/50 rounded-xl text-base font-semibold shadow-md border border-purple-200 dark:border-purple-800"
                            >
                              <span className="text-gray-900 dark:text-white">
                                {payment.methodName} ₺
                                {payment.amount.toFixed(2).replace(".", ",")}
                              </span>
                              <button
                                onClick={() => {
                                  setAppliedPayments((prev) =>
                                    prev.filter((p) => p.id !== payment.id)
                                  );
                                }}
                                className="ml-1 hover:bg-purple-200 dark:hover:bg-purple-800 rounded-full p-1.5 transition-all active:scale-95"
                              >
                                <X className="h-4 w-4 text-gray-700 dark:text-gray-300" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="h-full flex items-center">
                          <span className="text-sm text-gray-400 dark:text-gray-500">
                            Numerik tuşlarla tutar girin
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Ödeme Bilgileri - Ödenen Tutar, Toplam Ödeme ve Buton */}
                    <div className="w-full px-8 py-4 border-b-2 border-gray-200 dark:border-gray-700 bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 flex-shrink-0">
                      <div className="flex items-center justify-between gap-6 w-full">
                        <div className="text-right flex-1">
                          <div className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">
                            ÖDENEN TUTAR
                          </div>
                          <div className="text-4xl font-extrabold text-gray-900 dark:text-white">
                            ₺
                            {(
                              (order.payments || []).reduce(
                                (sum, p) => sum + p.amount,
                                0
                              ) +
                              appliedPayments.reduce(
                                (sum, p) => sum + p.amount,
                                0
                              )
                            )
                              .toFixed(2)
                              .replace(".", ",")}
                          </div>
                        </div>
                        <div className="text-right flex-1">
                          <div className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">
                            TOPLAM ÖDEME
                          </div>
                          <div className="text-4xl font-extrabold text-green-600 dark:text-green-400">
                            ₺
                            {(
                              (order.payments || []).reduce(
                                (sum, p) => sum + p.amount,
                                0
                              ) +
                              appliedPayments.reduce(
                                (sum, p) => sum + p.amount,
                                0
                              )
                            )
                              .toFixed(2)
                              .replace(".", ",")}
                          </div>
                        </div>
                        <div className="text-right flex-1">
                          <div className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">
                            KALAN TUTAR
                          </div>
                          <div className="flex flex-col items-end">
                            {discount > 0 ? (
                              <>
                                <span className="text-lg font-medium text-gray-500 dark:text-gray-400 line-through">
                                  ₺
                                  {(
                                    // İndirim öncesi toplam (orijinal fiyat)
                                    originalTotal
                                  )
                                    .toFixed(2)
                                    .replace(".", ",")}
                                </span>
                                <div className="text-4xl font-extrabold text-red-600 dark:text-red-400">
                                  ₺
                                  {(
                                    remaining -
                                    appliedPayments.reduce(
                                      (sum, p) => sum + p.amount,
                                      0
                                    )
                                  )
                                    .toFixed(2)
                                    .replace(".", ",")}
                                </div>
                              </>
                            ) : (
                              <div className="text-4xl font-extrabold text-red-600 dark:text-red-400">
                                ₺
                                {(
                                  remaining -
                                  appliedPayments.reduce(
                                    (sum, p) => sum + p.amount,
                                    0
                                  )
                                )
                                  .toFixed(2)
                                  .replace(".", ",")}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex-1 flex justify-end">
                          <Button
                            type="button"
                            onClick={async () => {
                              setIsProcessingPayment(true);
                              try {
                                // Tag'ların toplam tutarını hesapla
                                const totalTagAmount = appliedPayments.reduce(
                                  (sum, p) => sum + p.amount,
                                  0
                                );

                                // Eğer tag'lar varsa, sadece tag'ları işle (kısmi ödeme)
                                if (appliedPayments.length > 0) {
                                  // Tüm tag'ları tek bir ödeme olarak işle (masanın toplam ücretinden düş)
                                  // handlePayment içinde zaten refresh yapılıyor
                                  await handlePayment(
                                    totalTagAmount.toString(),
                                    undefined, // Ürün bazlı değil, masanın toplam ücretinden düş
                                    undefined,
                                    undefined,
                                    appliedPayments[0].method // İlk tag'ın ödeme yöntemini kullan
                                  );

                                  // Tag'ları temizle
                                  setAppliedPayments([]);
                                  setPaymentAmount("0");
                                  setPaymentMethod("");

                                  // Modal'ı kapatma, kullanıcı kalan tutarı da alabilir
                                  setIsProcessingPayment(false);
                                  return;
                                }

                                // Tag'lar yoksa, kalan tutarı işle
                                const remainingAmount =
                                  remaining -
                                  appliedPayments.reduce(
                                    (sum, p) => sum + p.amount,
                                    0
                                  );

                                // Eğer ödeme yöntemi seçilmediyse uyarı göster
                                if (!paymentMethod) {
                                  customAlert(
                                    "Lütfen bir ödeme yöntemi seçin",
                                    "Uyarı",
                                    "warning"
                                  );
                                  setIsProcessingPayment(false);
                                  return;
                                }

                                // Eğer seçili ürün varsa (selectedQuantities veya pendingPaymentItems), sadece seçili ürünlerin ödemesini al
                                // Eğer seçili ürün yoksa, tüm masanın ödemesini al
                                const hasSelectedItems = 
                                  (selectedQuantities.size > 0 && pendingPaymentItems.length > 0) ||
                                  pendingPaymentItems.length > 0;

                                // Kalan tutarı seçilen ödeme yöntemi ile al
                                // Eğer selectedQuantities ile ürün seçildiyse, onları kullan
                                // handlePayment içinde zaten refresh yapılıyor, burada sadece çağırıyoruz
                                await handlePayment(
                                  remainingAmount.toString(),
                                  undefined, // itemsToUse handlePayment içinde selectedQuantities'den oluşturulacak
                                  hasSelectedItems && pendingPaymentItems.length > 0
                                    ? pendingPaymentItems
                                    : undefined,
                                  hasSelectedItems && selectedQuantities.size > 0
                                    ? selectedQuantities
                                    : undefined,
                                  paymentMethod
                                );

                                // Tüm işlemler tamamlandı, modal'ı kapat
                                setPaymentAmount("0");
                                setPaymentMethod("");
                                setAppliedPayments([]);
                                setShowPaymentModal(false);
                                // URL'den payment parametresini kaldır
                                navigate({
                                  to: "/table/$tableId",
                                  params: { tableId: tableId },
                                  search: (prev) => ({
                                    area: (prev?.area ?? undefined) as string | undefined,
                                    activeOnly: prev?.activeOnly ?? false,
                                    payment: undefined,
                                  }),
                                  replace: true,
                                });
                              } catch (error) {
                                customAlert(
                                  "Ödeme işlenirken bir hata oluştu",
                                  "Hata",
                                  "error"
                                );
                              } finally {
                                setIsProcessingPayment(false);
                              }
                            }}
                            className="h-16 flex-1 max-w-md text-lg font-bold bg-green-600 hover:bg-green-700 text-white rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95 disabled:bg-gray-400 disabled:hover:bg-gray-400"
                            disabled={isProcessingPayment}
                          >
                            {appliedPayments.length > 0 ? (
                              <>
                                Tag ödemelerini al ₺
                                {appliedPayments
                                  .reduce((sum, p) => sum + p.amount, 0)
                                  .toFixed(2)
                                  .replace(".", ",")}
                              </>
                            ) : (
                              <>
                                Kalan tutarı al ₺
                                {(
                                  remaining -
                                  appliedPayments.reduce(
                                    (sum, p) => sum + p.amount,
                                    0
                                  )
                                )
                                  .toFixed(2)
                                  .replace(".", ",")}
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Alt Kısım - Butonlar */}
                    <div className="flex-1 flex items-stretch overflow-hidden px-8 pb-0 min-h-0 flex-shrink-0">
                      {/* Ödeme Yöntemi Butonları, İşlem Butonları, Numerik Ekran ve Numerik Tuşlar */}
                      <div className="flex-1 flex items-stretch overflow-hidden">
                        {/* Sol Sütun - Ödeme Yöntemleri */}
                        <div className="w-56 pl-0 pr-4 pt-0 pb-0 flex flex-col gap-1.5 h-full relative">
                          <label className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider pt-4 leading-tight flex-shrink-0">
                            Ödeme Yöntemi
                          </label>
                          {paymentMethods.length === 0 ? (
                            <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
                              Bulunamadı
                            </div>
                          ) : (
                            <div className="flex flex-col gap-1.5 flex-1 min-h-0">
                              {paymentMethods.map((pm) => (
                                <Button
                                  key={pm.id}
                                  type="button"
                                  onClick={() => {
                                    setPaymentMethod(pm.code);
                                  }}
                                  className={`w-full h-10 text-sm font-bold rounded-xl transition-all shadow-md hover:shadow-lg active:scale-95 ${
                                    paymentMethod === pm.code
                                      ? "text-white"
                                      : "bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-900 dark:text-white border-2 border-gray-300 dark:border-gray-600"
                                  }`}
                                  style={
                                    paymentMethod === pm.code
                                      ? {
                                          backgroundColor:
                                            pm.color || "#16a34a",
                                        }
                                      : {}
                                  }
                                >
                                  {pm.name}
                                </Button>
                              ))}
                            </div>
                          )}
                          {/* Border'ı alta tam temas ettirmek için absolute positioned border */}
                          <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700 pointer-events-none"></div>
                        </div>

                        {/* Orta Sütun - İşlem Butonları ve Numerik Keypad */}
                        <div className="flex-1 flex flex-col pt-0 px-4 pb-0 min-h-0 h-full">
                          {/* Numerik Keypad - Kalan Alana Sığdırılmış */}
                          <div className="flex flex-col flex-1 min-h-0">
                            <div className="flex flex-col px-4 pb-0 flex-1 min-h-0">
                              {/* İşlem Butonları - Numerik Ekranın Üstünde */}
                              <div className="w-full mb-3 flex-shrink-0">
                                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider block pt-4 leading-tight flex-shrink-0">
                                  İşlemler
                                </label>
                                <div className="grid grid-cols-4 gap-2.5">
                                  <Button
                                    type="button"
                                    onClick={() => setShowDiscountModal(true)}
                                    className="h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                                  >
                                    <Minus className="h-4 w-4" />
                                    İndirim
                                  </Button>
                                  <Button
                                    type="button"
                                    onClick={() => {
                                      setShowCustomerModal(true);
                                    }}
                                    className="h-12 bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                                  >
                                    <CreditCard className="h-4 w-4" />
                                    Cari
                                  </Button>
                                  <Button
                                    type="button"
                                    onClick={async () => {
                                      if (!order || !order.items || order.items.length === 0) {
                                        customAlert(
                                          "Sipariş bulunamadı",
                                          "Uyarı",
                                          "warning"
                                        );
                                        return;
                                      }

                                      // Seçili ürünler var mı kontrol et
                                      const hasSelectedItems = 
                                        (selectedQuantities.size > 0 && pendingPaymentItems.length > 0) ||
                                        selectedItems.size > 0;

                                      // Seçili ürünler varsa sadece onları, yoksa tüm masayı ikram olarak işaretle
                                      if (hasSelectedItems) {
                                        // Seçili ürünlerin toplam tutarını hesapla
                                        let giftAmount = 0;
                                        
                                        if (selectedQuantities.size > 0 && pendingPaymentItems.length > 0) {
                                          // Miktar seçimi yapılmışsa
                                          pendingPaymentItems.forEach((paymentItem) => {
                                            const selectedQty = selectedQuantities.get(paymentItem.menuId) || 0;
                                            if (selectedQty > 0) {
                                              giftAmount += selectedQty * paymentItem.menuPrice;
                                            }
                                          });
                                        } else if (selectedItems.size > 0) {
                                          // Ürün seçimi yapılmışsa
                                          const selectedItemsArray = Array.from(selectedItems);
                                          selectedItemsArray.forEach((index) => {
                                            const item = order.items[index];
                                            if (item) {
                                              giftAmount += item.subtotal;
                                            }
                                          });
                                        }

                                        // İndirim oranını hesapla
                                        const orderSubtotal = order.items.reduce(
                                          (sum, item) => sum + item.subtotal,
                                          0
                                        );
                                        const orderDiscount = order.discount || 0;
                                        const discountRatio = orderSubtotal > 0 ? orderDiscount / orderSubtotal : 0;
                                        const finalGiftAmount = Math.max(0, giftAmount - (giftAmount * discountRatio));

                                        // İkram ödemesi yap
                                        await handlePayment(
                                          finalGiftAmount.toString(),
                                          selectedItems.size > 0 ? selectedItems : undefined,
                                          pendingPaymentItems.length > 0 ? pendingPaymentItems : undefined,
                                          selectedQuantities.size > 0 ? selectedQuantities : undefined,
                                          "cash", // İkram için ödeme yöntemi
                                          undefined,
                                          undefined,
                                          undefined,
                                          true // isGift = true
                                        );
                                      } else {
                                        // Tüm masayı ikram olarak işaretle
                                        const totalAmount = order.total || 0;
                                        
                                        await handlePayment(
                                          totalAmount.toString(),
                                          undefined,
                                          undefined,
                                          undefined,
                                          "cash", // İkram için ödeme yöntemi
                                          undefined,
                                          undefined,
                                          undefined,
                                          true // isGift = true
                                        );
                                      }
                                    }}
                                    className="h-12 bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                                  >
                                    <Utensils className="h-4 w-4" />
                                    İkram
                                  </Button>
                                  <Button
                                    type="button"
                                    onClick={() => {
                                      setPaymentMethod("unpaid");
                                    }}
                                    className="h-12 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                                  >
                                    <X className="h-4 w-4" />
                                    Ödenmez
                                  </Button>
                                </div>
                              </div>
                              {/* Numerik Giriş Gösterimi - 7,8,9 tuşlarının hemen üzerinde */}
                              <div className="w-full mb-3 flex-shrink-0">
                                <div className="rounded-xl p-4 border-2 shadow-lg bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-800 border-gray-200 dark:border-gray-700">
                                  <div className="flex items-center gap-3">
                                    {paymentMethod && (
                                      <ArrowRight className="h-6 w-6 text-red-600 dark:text-red-400 flex-shrink-0" />
                                    )}
                                    <span className="text-2xl font-extrabold text-gray-900 dark:text-white">
                                      {(() => {
                                        const amount = paymentAmount || "0";
                                        const formattedAmount = (() => {
                                          if (!amount.includes(".")) {
                                            return parseFloat(amount)
                                              .toFixed(2)
                                              .replace(".", ",");
                                          }
                                          const parts = amount.split(".");
                                          if (parts[1] && parts[1].length > 2) {
                                            return parseFloat(amount)
                                              .toFixed(2)
                                              .replace(".", ",");
                                          }
                                          return amount
                                            .padEnd(
                                              amount.indexOf(".") + 3,
                                              "0"
                                            )
                                            .replace(".", ",");
                                        })();

                                        // Eğer ödeme yöntemi seçildiyse, sayıyı ve yöntemi göster
                                        if (
                                          paymentMethod &&
                                          parseFloat(amount) > 0
                                        ) {
                                          const methodName =
                                            paymentMethods.find(
                                              (pm) => pm.code === paymentMethod
                                            )?.name || "";
                                          return `${methodName ? `${methodName} - ` : ""}₺${formattedAmount}`;
                                        }

                                        // Sadece sayıyı göster
                                        return `₺${formattedAmount}`;
                                      })()}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="grid grid-cols-4 gap-2.5 w-full auto-rows-fr">
                                {/* 7, 8, 9 */}
                                {[7, 8, 9].map((num) => (
                                  <Button
                                    key={num}
                                    type="button"
                                    onClick={() => {
                                      const current = paymentAmount || "0";
                                      if (current.includes(".")) {
                                        setPaymentAmount(
                                          current + num.toString()
                                        );
                                      } else {
                                        const newValue =
                                          current === "0"
                                            ? num.toString()
                                            : current + num.toString();
                                        setPaymentAmount(newValue);
                                      }
                                    }}
                                    className="aspect-square w-full min-h-[90px] p-0 text-5xl font-extrabold bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center justify-center"
                                  >
                                    {num}
                                  </Button>
                                ))}
                                {/* Sil (Delete) */}
                                <Button
                                  type="button"
                                  onClick={() => {
                                    const current = paymentAmount || "0";
                                    if (current.length > 1) {
                                      setPaymentAmount(current.slice(0, -1));
                                    } else {
                                      setPaymentAmount("0");
                                    }
                                  }}
                                  className="aspect-square w-full min-h-[90px] p-0 bg-red-500 dark:bg-red-600 hover:bg-red-600 dark:hover:bg-red-700 rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center justify-center"
                                >
                                  <Delete className="h-16 w-16 text-white" />
                                </Button>
                                {/* 4, 5, 6 */}
                                {[4, 5, 6].map((num) => (
                                  <Button
                                    key={num}
                                    type="button"
                                    onClick={() => {
                                      const current = paymentAmount || "0";
                                      if (current.includes(".")) {
                                        setPaymentAmount(
                                          current + num.toString()
                                        );
                                      } else {
                                        const newValue =
                                          current === "0"
                                            ? num.toString()
                                            : current + num.toString();
                                        setPaymentAmount(newValue);
                                      }
                                    }}
                                    className="aspect-square w-full min-h-[90px] p-0 text-5xl font-extrabold bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center justify-center"
                                  >
                                    {num}
                                  </Button>
                                ))}
                                {/* C (Clear) */}
                                <Button
                                  type="button"
                                  onClick={() => {
                                    setPaymentAmount("0");
                                  }}
                                  className="aspect-square w-full min-h-[90px] p-0 text-5xl font-extrabold bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-900 dark:text-white rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center justify-center"
                                >
                                  C
                                </Button>
                                {/* 1, 2, 3 */}
                                {[1, 2, 3].map((num) => (
                                  <Button
                                    key={num}
                                    type="button"
                                    onClick={() => {
                                      const current = paymentAmount || "0";
                                      if (current.includes(".")) {
                                        setPaymentAmount(
                                          current + num.toString()
                                        );
                                      } else {
                                        const newValue =
                                          current === "0"
                                            ? num.toString()
                                            : current + num.toString();
                                        setPaymentAmount(newValue);
                                      }
                                    }}
                                    className="aspect-square w-full min-h-[90px] p-0 text-5xl font-extrabold bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center justify-center"
                                  >
                                    {num}
                                  </Button>
                                ))}
                                {/* Enter - 2 satır yüksekliğinde */}
                                <Button
                                  type="button"
                                  onClick={async () => {
                                    // Ödeme yöntemi seçilmemişse uyarı göster
                                    if (!paymentMethod) {
                                      customAlert(
                                        "Lütfen bir ödeme yöntemi seçin",
                                        "Uyarı",
                                        "warning"
                                      );
                                      return;
                                    }

                                    // Tutar girilmemişse uyarı göster
                                    const amount = parseFloat(
                                      paymentAmount || "0"
                                    );
                                    if (amount <= 0) {
                                      customAlert(
                                        "Lütfen bir tutar girin",
                                        "Uyarı",
                                        "warning"
                                      );
                                      return;
                                    }

                                    // Tag olarak ekle (ödeme alma)
                                    const methodName =
                                      paymentMethods.find(
                                        (pm) => pm.code === paymentMethod
                                      )?.name || "";

                                    setAppliedPayments((prev) => [
                                      ...prev,
                                      {
                                        method: paymentMethod,
                                        methodName: methodName,
                                        amount: amount,
                                        id: `${paymentMethod}-${Date.now()}-${Math.random()}`,
                                      },
                                    ]);

                                    // Numerik ekranı temizle
                                    setPaymentAmount("0");
                                    setPaymentMethod("");
                                  }}
                                  disabled={
                                    isProcessingPayment ||
                                    !paymentAmount ||
                                    parseFloat(paymentAmount || "0") <= 0
                                  }
                                  className="row-span-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:hover:bg-gray-400 text-white dark:text-white rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center justify-center p-0 w-full min-h-[calc(180px+10px)]"
                                >
                                  {isProcessingPayment ? (
                                    <Loader2 className="h-12 w-12 animate-spin" />
                                  ) : (
                                    <ArrowRight className="h-12 w-12" />
                                  )}
                                </Button>
                                {/* 0 */}
                                <Button
                                  type="button"
                                  onClick={() => {
                                    const current = paymentAmount || "0";
                                    if (current !== "0") {
                                      setPaymentAmount(current + "0");
                                    }
                                  }}
                                  className="aspect-square w-full min-h-[90px] p-0 text-5xl font-extrabold bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center justify-center"
                                >
                                  0
                                </Button>
                                {/* 00 */}
                                <Button
                                  type="button"
                                  onClick={() => {
                                    const current = paymentAmount || "0";
                                    if (current !== "0") {
                                      setPaymentAmount(current + "00");
                                    }
                                  }}
                                  className="aspect-square w-full min-h-[90px] p-0 text-5xl font-extrabold bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center justify-center"
                                >
                                  00
                                </Button>
                                {/* . */}
                                <Button
                                  type="button"
                                  onClick={() => {
                                    const current = paymentAmount || "0";
                                    if (!current.includes(".")) {
                                      setPaymentAmount(current + ".");
                                    }
                                  }}
                                  className="aspect-square w-full min-h-[90px] p-0 text-5xl font-extrabold bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center justify-center"
                                >
                                  .
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          );
        })()}

      {/* İndirim Modalı */}
      {showDiscountModal &&
        order &&
        order.items &&
        order.items.length > 0 &&
        (() => {
          // Seçili miktarlara göre kalan tutarı hesapla
          let remaining: number;
          if (pendingPaymentItems.length > 0) {
            // Seçili miktarlara göre hesapla (sadece seçili miktar > 0 olanlar)
            remaining = pendingPaymentItems.reduce((sum, paymentItem) => {
              const selectedQty =
                selectedQuantities.get(paymentItem.menuId) || 0;
              if (selectedQty > 0) {
                return sum + selectedQty * paymentItem.menuPrice;
              }
              return sum;
            }, 0);

            // Eğer hiç seçili ürün yoksa, tüm ürünlerin toplamını göster
            if (remaining === 0) {
              remaining = (order.items || []).reduce(
                (sum, item) => sum + item.subtotal,
                0
              );
            }
          } else {
            // Eğer pendingPaymentItems yoksa, tüm ürünlerin toplamını kullan
            remaining = (order.items || []).reduce(
              (sum, item) => sum + item.subtotal,
              0
            );
          }

          // İndirim hesaplaması için seçili ürünler varsa onların toplamını, yoksa tüm siparişin toplamını kullan
          let orderSubtotal: number;
          let selectedItemsIndices: Set<number> = new Set();
          
          if (pendingPaymentItems.length > 0) {
            // Seçili ürünlerin toplamını hesapla (orijinal fiyatlardan)
            orderSubtotal = pendingPaymentItems.reduce((sum, paymentItem) => {
              const selectedQty = selectedQuantities.get(paymentItem.menuId) || 0;
              if (selectedQty > 0) {
                // Seçili ürünlerin index'lerini topla
                paymentItem.indices.forEach(idx => selectedItemsIndices.add(idx));
                return sum + selectedQty * paymentItem.menuPrice;
              }
              return sum;
            }, 0);
            
            // Eğer hiç seçili ürün yoksa, tüm ürünlerin toplamını kullan
            if (orderSubtotal === 0) {
              orderSubtotal = (order.items || []).reduce(
                (sum, item) => sum + (item.menuPrice * item.quantity),
                0
              );
              selectedItemsIndices = new Set(order.items.map((_, idx) => idx));
            } else {
              // Seçili ürünlerin index'lerini topla
              pendingPaymentItems.forEach(paymentItem => {
                paymentItem.indices.forEach(idx => selectedItemsIndices.add(idx));
              });
            }
          } else if (selectedItems.size > 0) {
            // selectedItems varsa, seçili ürünlerin toplamını hesapla
            orderSubtotal = Array.from(selectedItems).reduce((sum, index) => {
              const item = order.items[index];
              if (item) {
                selectedItemsIndices.add(index);
                return sum + (item.menuPrice * item.quantity);
              }
              return sum;
            }, 0);
          } else {
            // Seçili ürün yoksa, tüm ürünlerin toplamını kullan (orijinal fiyatlardan)
            orderSubtotal = (order.items || []).reduce(
              (sum, item) => sum + (item.menuPrice * item.quantity),
              0
            );
            selectedItemsIndices = new Set(order.items.map((_, idx) => idx));
          }

          const calculateDiscount = () => {
            if (discountType === "percentage" && discountValue) {
              const percentage = parseFloat(discountValue);
              return (orderSubtotal * percentage) / 100;
            } else if (discountType === "amount" && discountValue) {
              return Math.min(parseFloat(discountValue), orderSubtotal);
            }
            return 0;
          };
          const discount = calculateDiscount();

          return (
            <>
              {/* Overlay */}
              <div
                className="fixed inset-0 bg-black/70 z-[60]"
                onClick={() => setShowDiscountModal(false)}
              />
              {/* Modal */}
              <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      İndirim
                    </h3>
                    <button
                      onClick={() => setShowDiscountModal(false)}
                      className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    {/* İndirim Türü Seçimi */}
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={
                          discountType === "percentage" ? "default" : "outline"
                        }
                        onClick={() => {
                          setDiscountType("percentage");
                          setDiscountValue("");
                        }}
                        className="flex-1"
                      >
                        Oran (%)
                      </Button>
                      <Button
                        type="button"
                        variant={
                          discountType === "amount" ? "default" : "outline"
                        }
                        onClick={() => {
                          setDiscountType("amount");
                          setDiscountValue("");
                        }}
                        className="flex-1"
                      >
                        Fiyat (₺)
                      </Button>
                    </div>

                    {/* Manuel Giriş Alanı */}
                    <div>
                      <Input
                        type="text"
                        value={discountValue}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^0-9.,]/g, "");
                          setDiscountValue(value);
                          if (value) {
                            const numValue = parseFloat(value.replace(",", ".")) || 0;
                            if (discountType === "percentage") {
                              const discountAmount = (orderSubtotal * numValue) / 100;
                              setPaymentAmount(
                                Math.max(0, orderSubtotal - discountAmount).toFixed(2)
                              );
                            } else {
                              setPaymentAmount(
                                Math.max(0, orderSubtotal - numValue).toFixed(2)
                              );
                            }
                          } else {
                            setPaymentAmount(orderSubtotal.toFixed(2));
                          }
                        }}
                        placeholder={
                          discountType === "percentage"
                            ? "İndirim oranı (%)"
                            : "İndirim tutarı (₺)"
                        }
                        className="dark:bg-gray-700 dark:text-white dark:border-gray-600 text-lg font-semibold text-center"
                      />
                    </div>

                    {/* Hazır Oran/Fiyat Seçenekleri */}
                    <div className="grid grid-cols-4 gap-2 mb-2">
                      {discountType === "percentage" ? (
                        // Hazır yüzde seçenekleri
                        [5, 10, 15, 20].map((percent) => (
                          <Button
                            key={percent}
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setDiscountValue(percent.toString());
                              const discountAmount = (orderSubtotal * percent) / 100;
                              setPaymentAmount(
                                Math.max(0, orderSubtotal - discountAmount).toFixed(2)
                              );
                            }}
                            className="h-12 text-sm font-semibold bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border-gray-300 dark:border-gray-600"
                          >
                            %{percent}
                          </Button>
                        ))
                      ) : (
                        // Hazır fiyat seçenekleri
                        [5, 10, 25, 50].map((amount) => (
                          <Button
                            key={amount}
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setDiscountValue(amount.toString());
                              setPaymentAmount(
                                Math.max(0, orderSubtotal - amount).toFixed(2)
                              );
                            }}
                            className="h-12 text-sm font-semibold bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border-gray-300 dark:border-gray-600"
                          >
                            ₺{amount}
                          </Button>
                        ))
                      )}
                    </div>

                    {/* Numerik Keypad */}
                    <div className="grid grid-cols-4 gap-2">
                      {/* 7, 8, 9 */}
                      {[7, 8, 9].map((num) => (
                        <Button
                          key={num}
                          type="button"
                          onClick={() => {
                            const current = discountValue || "";
                            const newValue = current + num.toString();
                            setDiscountValue(newValue);
                            if (newValue) {
                              const numValue = parseFloat(newValue.replace(",", ".")) || 0;
                              if (discountType === "percentage") {
                                const discountAmount = (orderSubtotal * numValue) / 100;
                                setPaymentAmount(
                                  Math.max(0, orderSubtotal - discountAmount).toFixed(2)
                                );
                              } else {
                                setPaymentAmount(
                                  Math.max(0, orderSubtotal - numValue).toFixed(2)
                                );
                              }
                            } else {
                              setPaymentAmount(orderSubtotal.toFixed(2));
                            }
                          }}
                          className="aspect-square min-h-[70px] text-3xl font-extrabold bg-gray-800 dark:bg-gray-700 hover:bg-gray-700 dark:hover:bg-gray-600 text-white rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95"
                        >
                          {num}
                        </Button>
                      ))}
                      {/* Sil (X) */}
                      <Button
                        type="button"
                        onClick={() => {
                          const current = discountValue || "";
                          if (current.length > 0) {
                            const newValue = current.slice(0, -1);
                            setDiscountValue(newValue);
                            if (newValue) {
                              const numValue = parseFloat(newValue.replace(",", ".")) || 0;
                              if (discountType === "percentage") {
                                const discountAmount = (orderSubtotal * numValue) / 100;
                                setPaymentAmount(
                                  Math.max(0, orderSubtotal - discountAmount).toFixed(2)
                                );
                              } else {
                                setPaymentAmount(
                                  Math.max(0, orderSubtotal - numValue).toFixed(2)
                                );
                              }
                            } else {
                              setPaymentAmount(orderSubtotal.toFixed(2));
                            }
                          }
                        }}
                        className="aspect-square min-h-[70px] bg-red-500 dark:bg-red-600 hover:bg-red-600 dark:hover:bg-red-700 rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center justify-center"
                      >
                        <X className="h-6 w-6 text-white font-bold" />
                      </Button>
                      {/* 4, 5, 6 */}
                      {[4, 5, 6].map((num) => (
                        <Button
                          key={num}
                          type="button"
                          onClick={() => {
                            const current = discountValue || "";
                            const newValue = current + num.toString();
                            setDiscountValue(newValue);
                            if (newValue) {
                              const numValue = parseFloat(newValue.replace(",", ".")) || 0;
                              if (discountType === "percentage") {
                                const discountAmount = (orderSubtotal * numValue) / 100;
                                setPaymentAmount(
                                  Math.max(0, orderSubtotal - discountAmount).toFixed(2)
                                );
                              } else {
                                setPaymentAmount(
                                  Math.max(0, orderSubtotal - numValue).toFixed(2)
                                );
                              }
                            } else {
                              setPaymentAmount(orderSubtotal.toFixed(2));
                            }
                          }}
                          className="aspect-square min-h-[70px] text-3xl font-extrabold bg-gray-800 dark:bg-gray-700 hover:bg-gray-700 dark:hover:bg-gray-600 text-white rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95"
                        >
                          {num}
                        </Button>
                      ))}
                      {/* C (Clear) */}
                      <Button
                        type="button"
                        onClick={() => {
                          setDiscountValue("");
                          setPaymentAmount(orderSubtotal.toFixed(2));
                        }}
                        className="aspect-square min-h-[70px] text-xl font-bold bg-gray-400 dark:bg-gray-600 hover:bg-gray-500 dark:hover:bg-gray-500 text-white rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95"
                      >
                        C
                      </Button>
                      {/* 1, 2, 3 */}
                      {[1, 2, 3].map((num) => (
                        <Button
                          key={num}
                          type="button"
                          onClick={() => {
                            const current = discountValue || "";
                            const newValue = current + num.toString();
                            setDiscountValue(newValue);
                            if (newValue) {
                              const numValue = parseFloat(newValue.replace(",", ".")) || 0;
                              if (discountType === "percentage") {
                                const discountAmount = (orderSubtotal * numValue) / 100;
                                setPaymentAmount(
                                  Math.max(0, orderSubtotal - discountAmount).toFixed(2)
                                );
                              } else {
                                setPaymentAmount(
                                  Math.max(0, orderSubtotal - numValue).toFixed(2)
                                );
                              }
                            } else {
                              setPaymentAmount(orderSubtotal.toFixed(2));
                            }
                          }}
                          className="aspect-square min-h-[70px] text-3xl font-extrabold bg-gray-800 dark:bg-gray-700 hover:bg-gray-700 dark:hover:bg-gray-600 text-white rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95"
                        >
                          {num}
                        </Button>
                      ))}
                      {/* Nokta/Virgül */}
                      <Button
                        type="button"
                        onClick={() => {
                          const current = discountValue || "";
                          if (!current.includes(".") && !current.includes(",")) {
                            const newValue = current + (discountType === "amount" ? "," : "");
                            setDiscountValue(newValue);
                          }
                        }}
                        className="aspect-square min-h-[70px] text-3xl font-extrabold bg-gray-800 dark:bg-gray-700 hover:bg-gray-700 dark:hover:bg-gray-600 text-white rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95"
                      >
                        ,
                      </Button>
                      {/* 0 */}
                      <Button
                        type="button"
                        onClick={() => {
                          const current = discountValue || "";
                          const newValue = current + "0";
                          setDiscountValue(newValue);
                          if (newValue) {
                            const numValue = parseFloat(newValue.replace(",", ".")) || 0;
                            if (discountType === "percentage") {
                              const discountAmount = (orderSubtotal * numValue) / 100;
                              setPaymentAmount(
                                Math.max(0, orderSubtotal - discountAmount).toFixed(2)
                              );
                            } else {
                              setPaymentAmount(
                                Math.max(0, orderSubtotal - numValue).toFixed(2)
                              );
                            }
                          } else {
                            setPaymentAmount(orderSubtotal.toFixed(2));
                          }
                        }}
                        className="aspect-square min-h-[70px] text-3xl font-extrabold bg-gray-800 dark:bg-gray-700 hover:bg-gray-700 dark:hover:bg-gray-600 text-white rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95 col-span-2"
                      >
                        0
                      </Button>
                      {/* 00 */}
                      <Button
                        type="button"
                        onClick={() => {
                          const current = discountValue || "";
                          const newValue = current + "00";
                          setDiscountValue(newValue);
                          if (newValue) {
                            const numValue = parseFloat(newValue.replace(",", ".")) || 0;
                            if (discountType === "percentage") {
                              const discountAmount = (orderSubtotal * numValue) / 100;
                              setPaymentAmount(
                                Math.max(0, orderSubtotal - discountAmount).toFixed(2)
                              );
                            } else {
                              setPaymentAmount(
                                Math.max(0, orderSubtotal - numValue).toFixed(2)
                              );
                            }
                          } else {
                            setPaymentAmount(orderSubtotal.toFixed(2));
                          }
                        }}
                        className="aspect-square min-h-[70px] text-2xl font-extrabold bg-gray-800 dark:bg-gray-700 hover:bg-gray-700 dark:hover:bg-gray-600 text-white rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95"
                      >
                        00
                      </Button>
                    </div>

                    {/* İndirim Özeti */}
                    <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          İndirim:
                        </span>
                        <span className="text-lg font-semibold text-red-600 dark:text-red-400">
                          -₺{discount.toFixed(2)}
                        </span>
                      </div>
                      {/* Uygulanan İndirim Bilgisi */}
                      {order.discount && order.discount > 0 && (
                        <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-600">
                          <span>Uygulanan İndirim:</span>
                          <span>-₺{order.discount.toFixed(2)}</span>
                        </div>
                      )}
                    </div>

                    {/* Butonlar */}
                    <div className="flex gap-2 pt-2">
                      {/* İndirimi İptal Et Butonu */}
                      {order.discount && order.discount > 0 && (
                        <Button
                          variant="destructive"
                          onClick={async () => {
                            // Tüm indirimleri kaldır
                            const updatedItems = order.items.map((item) => {
                              // Orijinal subtotal'ı geri yükle
                              const originalSubtotal = item.menuPrice * item.quantity;
                              return {
                                ...item,
                                subtotal: originalSubtotal,
                              };
                            });

                            // Yeni toplamları hesapla
                            const newSubtotal = updatedItems.reduce(
                              (sum, item) => sum + (item.menuPrice * item.quantity),
                              0
                            );
                            const newTotal = newSubtotal; // İndirim yok

                            // Siparişi güncelle
                            await updateOrder(order.id!, {
                              items: updatedItems,
                              subtotal: newSubtotal,
                              discount: 0,
                              total: newTotal,
                            });

                            // Güncellenmiş siparişi al
                            const updatedOrder = await getOrder(order.id!);
                            if (updatedOrder) {
                              setOrder(updatedOrder);
                            }

                            // Ödeme tutarını güncelle
                            const newRemaining = Math.max(
                              0,
                              newTotal -
                                (updatedOrder?.payments?.reduce(
                                  (sum, p) => sum + p.amount,
                                  0
                                ) || 0)
                            );
                            setPaymentAmount(newRemaining.toFixed(2));

                            // İndirim state'lerini sıfırla
                            setDiscountType("percentage");
                            setDiscountValue("");
                            setShowDiscountModal(false);
                          }}
                          className="flex-1"
                        >
                          İndirimi İptal Et
                        </Button>
                      )}
                      <Button
                        onClick={async () => {
                          if (discount > 0) {
                            // Seçili ürünlerin index'lerini belirle (dışarıda da kullanılacak)
                            let selectedIndices: Set<number> = new Set();
                            let selectedItemsOriginalSubtotal = 0;
                            let hasSelectedItems = false; // Seçili ürün var mı kontrolü için
                            
                            if (pendingPaymentItems.length > 0) {
                              // Seçili ürünlerin toplamını hesapla (orijinal fiyatlardan)
                              pendingPaymentItems.forEach(paymentItem => {
                                const selectedQty = selectedQuantities.get(paymentItem.menuId) || 0;
                                if (selectedQty > 0) {
                                  paymentItem.indices.forEach(idx => selectedIndices.add(idx));
                                  selectedItemsOriginalSubtotal += selectedQty * paymentItem.menuPrice;
                                }
                              });
                              
                              // Eğer hiç seçili ürün yoksa, tüm ürünleri seç
                              if (selectedIndices.size === 0) {
                                selectedIndices = new Set(order.items.map((_, idx) => idx));
                                selectedItemsOriginalSubtotal = (order.items || []).reduce(
                                  (sum, item) => sum + (item.menuPrice * item.quantity),
                                  0
                                );
                                hasSelectedItems = false;
                              } else {
                                hasSelectedItems = true;
                              }
                            } else if (selectedItems.size > 0) {
                              // selectedItems varsa, seçili ürünlerin toplamını hesapla
                              selectedIndices = new Set(selectedItems);
                              selectedItemsOriginalSubtotal = Array.from(selectedItems).reduce((sum, index) => {
                                const item = order.items[index];
                                if (item) {
                                  return sum + (item.menuPrice * item.quantity);
                                }
                                return sum;
                              }, 0);
                              hasSelectedItems = true;
                            } else {
                              // Seçili ürün yoksa, tüm ürünleri seç
                              selectedIndices = new Set(order.items.map((_, idx) => idx));
                              selectedItemsOriginalSubtotal = (order.items || []).reduce(
                                (sum, item) => sum + (item.menuPrice * item.quantity),
                                0
                              );
                              hasSelectedItems = false;
                            }

                            // Orijinal subtotal'ı al (eğer yoksa items'tan hesapla)
                            const originalSubtotal =
                              order.subtotal ||
                              (order.items || []).reduce(
                                (sum, item) => sum + (item.menuPrice * item.quantity),
                                0
                              );

                            // Eğer seçili ürünler varsa, indirimi sadece seçili ürünlere uygula
                            if (selectedIndices.size > 0 && selectedIndices.size < order.items.length) {
                              // Seçili ürünlere indirim uygula
                              const discountRatio = selectedItemsOriginalSubtotal > 0
                                ? discount / selectedItemsOriginalSubtotal
                                : 0;

                              const updatedItems = order.items.map((item, index) => {
                                if (selectedIndices.has(index)) {
                                  // Seçili ürün: indirim uygula
                                  const originalItemSubtotal = item.menuPrice * item.quantity;
                                  const itemDiscount = originalItemSubtotal * discountRatio;
                                  return {
                                    ...item,
                                    subtotal: Math.max(0, originalItemSubtotal - itemDiscount),
                                  };
                                } else {
                                  // Seçili olmayan ürün: değiştirme
                                  return item;
                                }
                              });

                              // Yeni toplamları hesapla
                              const newSubtotal = updatedItems.reduce(
                                (sum, item) => sum + (item.menuPrice * item.quantity),
                                0
                              );
                              const newTotal = updatedItems.reduce(
                                (sum, item) => sum + item.subtotal,
                                0
                              );

                              // Siparişi güncelle
                              await updateOrder(order.id!, {
                                items: updatedItems,
                                subtotal: newSubtotal,
                                total: newTotal,
                              });
                            } else {
                              // Tüm ürünlere indirim uygula
                              // Toplam indirim = mevcut indirim + yeni indirim
                              const totalDiscount =
                                (order.discount || 0) + discount;

                              // Yeni toplam = orijinal subtotal - toplam indirim
                              const newTotal = Math.max(
                                0,
                                originalSubtotal - totalDiscount
                              );

                              // Toplam indirim oranını hesapla
                              const totalDiscountRatio =
                                originalSubtotal > 0
                                  ? totalDiscount / originalSubtotal
                                  : 0;

                              // Ürünlerin subtotal değerlerini orantılı olarak güncelle
                              const updatedItems = order.items.map((item) => {
                                // Orijinal item subtotal'ı hesapla
                                let originalItemSubtotal = item.menuPrice * item.quantity;
                                if (
                                  order.subtotal &&
                                  order.discount &&
                                  order.discount > 0
                                ) {
                                  // Daha önce indirim uygulanmışsa, orijinal değeri geri yükle
                                  const previousDiscountRatio =
                                    order.subtotal > 0
                                      ? order.discount / order.subtotal
                                      : 0;
                                  originalItemSubtotal =
                                    item.subtotal / (1 - previousDiscountRatio);
                                }
                                // Yeni indirimli subtotal (toplam indirim oranı ile)
                                const newItemSubtotal = Math.max(
                                  0,
                                  originalItemSubtotal * (1 - totalDiscountRatio)
                                );
                                return {
                                  ...item,
                                  subtotal: newItemSubtotal,
                                };
                              });

                              // Yeni subtotal'ı hesapla (güncellenmiş ürünlerden)
                              // const _newSubtotal = updatedItems.reduce(
                              //   (sum, item) => sum + item.subtotal,
                              //   0
                              // );

                              // Siparişi güncelle (ürünlerin subtotal'ları da güncellenmiş)
                              await updateOrder(order.id!, {
                                items: updatedItems,
                                discount: totalDiscount,
                                subtotal: originalSubtotal, // Orijinal subtotal değişmez
                                total: newTotal,
                              });

                              // Güncellenmiş siparişi al
                              const updatedOrder = await getOrder(order.id!);
                              if (updatedOrder) {
                                setOrder(updatedOrder);
                                // Seçili ürünlerin state'ini koru (indirim uygulandıktan sonra kaldırma)
                                // selectedItems, pendingPaymentItems ve selectedQuantities state'leri korunuyor
                                
                                // Eğer seçili ürünler varsa, pendingPaymentItems'ı güncelle (yeni order'a göre)
                                if (hasSelectedItems && selectedIndices.size > 0 && selectedIndices.size < updatedOrder.items.length) {
                                  // Seçili ürünlerin menuId'lerini topla
                                  const selectedMenuIds = new Set<string>();
                                  selectedIndices.forEach(index => {
                                    const item = updatedOrder.items[index];
                                    if (item) {
                                      selectedMenuIds.add(item.menuId);
                                    }
                                  });
                                  
                                  // pendingPaymentItems'ı güncelle (yeni order'a göre)
                                  if (selectedMenuIds.size > 0) {
                                    const newPendingItems = updatedOrder.items
                                      .map((item, index) => {
                                        if (selectedMenuIds.has(item.menuId) && selectedIndices.has(index)) {
                                          // Aynı menuId'ye sahip tüm item'ları bul
                                          const allSameItems = updatedOrder.items.filter(
                                            (o) => o.menuId === item.menuId
                                          );
                                          const totalQty = allSameItems.reduce(
                                            (sum, o) => sum + o.quantity,
                                            0
                                          );
                                          const indices = updatedOrder.items
                                            .map((o, idx) =>
                                              o.menuId === item.menuId
                                                ? idx
                                                : -1
                                            )
                                            .filter((idx) => idx !== -1);
                                          
                                          return {
                                            menuId: item.menuId,
                                            menuName: item.menuName,
                                            totalQuantity: totalQty,
                                            menuPrice: item.menuPrice,
                                            indices: indices,
                                          };
                                        }
                                        return null;
                                      })
                                      .filter((item): item is NonNullable<typeof item> => item !== null);
                                    
                                    // Aynı menuId'ye sahip item'ları birleştir
                                    const mergedPendingItems = new Map<string, typeof newPendingItems[0]>();
                                    newPendingItems.forEach(item => {
                                      const existing = mergedPendingItems.get(item.menuId);
                                      if (existing) {
                                        existing.totalQuantity += item.totalQuantity;
                                        existing.indices = [...new Set([...existing.indices, ...item.indices])];
                                      } else {
                                        mergedPendingItems.set(item.menuId, { ...item });
                                      }
                                    });
                                    
                                    setPendingPaymentItems(Array.from(mergedPendingItems.values()));
                                    
                                    // selectedQuantities'yi koru (zaten doğru değerler var)
                                  }
                                }

                                // Ödeme tutarını güncelle (kalan tutar)
                                const newRemaining = Math.max(
                                  0,
                                  newTotal -
                                    (updatedOrder?.payments?.reduce(
                                      (sum, p) => sum + p.amount,
                                      0
                                    ) || 0)
                                );
                                setPaymentAmount(newRemaining.toFixed(2));
                              }
                            }
                          }

                          // İndirim modal'ını kapat (ama discountValue'yu koru - kalan tutar kısmında gösterilmek için)
                          setShowDiscountModal(false);
                          // NOT: discountValue, discountType, selectedItems, pendingPaymentItems ve selectedQuantities state'leri korunuyor
                        }}
                        className="flex-1"
                        disabled={discount === 0}
                      >
                        Uygula
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setDiscountType("percentage");
                          setDiscountValue("");
                          setPaymentAmount(remaining.toFixed(2));
                          setShowDiscountModal(false);
                        }}
                        className="flex-1"
                      >
                        İptal
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          );
        })()}

      {/* Right Sidebar - Categories (Desktop) */}
      <div
        className="hidden lg:flex lg:w-64 flex-col h-full overflow-hidden backdrop-blur-sm"
        style={{ backgroundColor: "rgba(0, 0, 0, 0.2)" }}
      >
        <div className="flex-1 overflow-y-auto p-3">
          <h2 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">
            Kategoriler
          </h2>
          <div className="space-y-1.5">
            {categories.length === 0 ? (
              <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-xs">
                Kategori bulunamadı
              </div>
            ) : (
              categories.map((category) => {
                const isSelected = selectedCategoryId === category.id;
                return (
                  <button
                    key={category.id}
                    onClick={() => {
                      setSelectedCategoryId(category.id!);
                      setSelectedCategoryName(category.name);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-all duration-200 text-sm ${
                      isSelected
                        ? "bg-blue-600 dark:bg-blue-500 text-white shadow-md"
                        : "bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                  >
                    <div className="font-medium">{category.name}</div>
                    {category.description && (
                      <div
                        className={`text-xs mt-1 ${
                          isSelected
                            ? "text-blue-100"
                            : "text-gray-500 dark:text-gray-400"
                        }`}
                      >
                        {category.description}
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Miktar Seçim Modalı - İptal için */}
      {showQuantitySelectionModal &&
        quantitySelectionAction === "cancel" &&
        pendingCancelItems.length > 0 && (
          <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  İptal Edilecek Miktar
                </h3>
                <button
                  onClick={() => {
                    setShowQuantitySelectionModal(false);
                    setQuantitySelectionAction(null);
                    setPendingCancelItems([]);
                    setSelectedCancelQuantities(new Map());
                    setCurrentCancelItemIndex(0);
                  }}
                  className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                </button>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  {pendingCancelItems[currentCancelItemIndex]?.menuName}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  Toplam: {pendingCancelItems[currentCancelItemIndex]?.totalQuantity} adet
                </p>
              </div>

              <div className="flex items-center justify-center gap-4 mb-6">
                <button
                  onClick={() => {
                    const currentQty =
                      selectedCancelQuantities.get(
                        pendingCancelItems[currentCancelItemIndex]?.menuId
                      ) || 0;
                    if (currentQty > 0) {
                      setSelectedCancelQuantities((prev) => {
                        const newMap = new Map(prev);
                        newMap.set(
                          pendingCancelItems[currentCancelItemIndex]?.menuId,
                          currentQty - 1
                        );
                        return newMap;
                      });
                    }
                  }}
                  className="w-12 h-12 rounded-lg bg-red-500 hover:bg-red-600 text-white font-bold text-xl flex items-center justify-center transition-all active:scale-95"
                  disabled={
                    (selectedCancelQuantities.get(
                      pendingCancelItems[currentCancelItemIndex]?.menuId
                    ) || 0) === 0
                  }
                >
                  -
                </button>
                <div className="w-20 text-center">
                  <span className="text-3xl font-bold text-gray-900 dark:text-white">
                    {selectedCancelQuantities.get(
                      pendingCancelItems[currentCancelItemIndex]?.menuId
                    ) || 0}
                  </span>
                </div>
                <button
                  onClick={() => {
                    const currentQty =
                      selectedCancelQuantities.get(
                        pendingCancelItems[currentCancelItemIndex]?.menuId
                      ) || 0;
                    const maxQty =
                      pendingCancelItems[currentCancelItemIndex]?.totalQuantity || 0;
                    if (currentQty < maxQty) {
                      setSelectedCancelQuantities((prev) => {
                        const newMap = new Map(prev);
                        newMap.set(
                          pendingCancelItems[currentCancelItemIndex]?.menuId,
                          currentQty + 1
                        );
                        return newMap;
                      });
                    }
                  }}
                  className="w-12 h-12 rounded-lg bg-green-500 hover:bg-green-600 text-white font-bold text-xl flex items-center justify-center transition-all active:scale-95"
                  disabled={
                    (selectedCancelQuantities.get(
                      pendingCancelItems[currentCancelItemIndex]?.menuId
                    ) || 0) >=
                    (pendingCancelItems[currentCancelItemIndex]?.totalQuantity || 0)
                  }
                >
                  +
                </button>
              </div>

              <div className="flex gap-2">
                {currentCancelItemIndex > 0 && (
                  <Button
                    onClick={() => {
                      setCurrentCancelItemIndex(currentCancelItemIndex - 1);
                    }}
                    variant="outline"
                    className="flex-1"
                  >
                    Önceki
                  </Button>
                )}
                {currentCancelItemIndex < pendingCancelItems.length - 1 ? (
                  <Button
                    onClick={() => {
                      setCurrentCancelItemIndex(currentCancelItemIndex + 1);
                    }}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Sonraki
                  </Button>
                ) : (
                  <Button
                    onClick={async () => {
                      // Tüm seçilen miktarları topla ve iptal et
                      const allIndices: number[] = [];
                      pendingCancelItems.forEach((item) => {
                        allIndices.push(...item.indices);
                      });
                      await handleCancelSelectedItemsWithQuantities(
                        selectedCancelQuantities,
                        allIndices
                      );
                      // Modal'ı kapat
                      setShowQuantitySelectionModal(false);
                      setQuantitySelectionAction(null);
                      setPendingCancelItems([]);
                      setSelectedCancelQuantities(new Map());
                      setCurrentCancelItemIndex(0);
                    }}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                    disabled={isCanceling}
                  >
                    {isCanceling ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        İptal ediliyor...
                      </>
                    ) : (
                      "İptal Et"
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

      {/* Cari Masaları Modalı */}
      {showCustomerModal && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/50 z-50"
            onClick={() => {
              setShowCustomerModal(false);
              setShowNewCustomerModal(false);
              setNewCustomerName("");
            }}
          />
          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Cari Masaları
                </h2>
                <button
                  onClick={() => {
                    setShowCustomerModal(false);
                    setShowNewCustomerModal(false);
                    setNewCustomerName("");
                  }}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <X className="h-6 w-6 text-gray-600 dark:text-gray-400" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {isLoadingCustomers ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
                  </div>
                ) : (
                  <>
                    {/* Yeni Cari Masa Oluştur Butonu */}
                    {!showNewCustomerModal && (
                      <Button
                        onClick={() => setShowNewCustomerModal(true)}
                        className="w-full mb-4 bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <Plus className="h-5 w-5 mr-2" />
                        Yeni Cari Masa Oluştur
                      </Button>
                    )}

                    {/* Yeni Cari Masa Formu */}
                    {showNewCustomerModal && (
                      <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                          Yeni Cari Masa Oluştur
                        </h3>
                        <div className="flex gap-2">
                          <Input
                            value={newCustomerName}
                            onChange={(e) => setNewCustomerName(e.target.value)}
                            placeholder="Masa sahibinin adı"
                            className="flex-1"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleCreateCustomerAndTable();
                              }
                            }}
                          />
                          <Button
                            onClick={handleCreateCustomerAndTable}
                            disabled={!newCustomerName.trim() || isCreatingCustomer}
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            {isCreatingCustomer ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Oluşturuluyor...
                              </>
                            ) : (
                              <>
                                <Check className="h-4 w-4 mr-2" />
                                Oluştur
                              </>
                            )}
                          </Button>
                          <Button
                            onClick={() => {
                              setShowNewCustomerModal(false);
                              setNewCustomerName("");
                            }}
                            variant="outline"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Cari Masaları Listesi */}
                    {customerTables.length === 0 ? (
                      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                        <CreditCard className="h-12 w-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                        <p className="text-lg font-medium">Henüz cari masa yok</p>
                        <p className="text-sm mt-1">Yeni cari masa oluşturun</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {customerTables.map((table) => {
                          const customer = customers.find(
                            (c) => c.name === table.tableNumber
                          );
                          return (
                            <div
                              key={table.id}
                              className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            >
                              <div className="flex-1">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                  {table.tableNumber}
                                </h3>
                                {customer && (
                                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                    Bakiye: ₺{customer.balance.toFixed(2).replace(".", ",")}
                                  </p>
                                )}
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  onClick={() => {
                                    if (customer?.id) {
                                      handleSelectCustomer(customer.id);
                                    } else {
                                      // Masa var ama cari yoksa, masaya direkt git
                                      navigate({
                                        to: "/table/$tableId",
                                        params: { tableId: table.id! },
                                        search: { area: undefined, activeOnly: false, payment: undefined },
                                      });
                                      setShowCustomerModal(false);
                                    }
                                  }}
                                  variant="outline"
                                  className="text-sm"
                                >
                                  Masaya Git
                                </Button>
                                {(order && order.items.length > 0) && (
                                  <Button
                                    onClick={() => handleSaveToCustomerTable(table.id!)}
                                    className="bg-green-600 hover:bg-green-700 text-white text-sm"
                                  >
                                    {pendingPaymentItems.length > 0 && 
                                     Array.from(selectedQuantities.values()).some(qty => qty > 0)
                                      ? "Seçili Ürünleri Kaydet"
                                      : "Masayı Kaydet"}
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
