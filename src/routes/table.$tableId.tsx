import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getTable,
  updateTableStatus,
  getTablesByCompany,
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
  getMenusByCompany,
  getCategoriesByCompany,
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
import type { Courier } from "@/lib/firebase/types";
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
import { Textarea } from "@/components/ui/textarea";
import { useTouchKeyboard } from "@/contexts/TouchKeyboardContext";
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  Minus,
  Trash2,
  Send,
  ShoppingCart,
  Edit,
  X,
  CreditCard,
  Check,
  Clock,
  Loader2,
  Utensils,
  Delete,
  Printer,
} from "lucide-react";
import { POSLayout } from "@/components/layouts/POSLayout";

export const Route = createFileRoute("/table/$tableId")({
  component: TableDetail,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      area: (search.area as string) || undefined,
      activeOnly: search.activeOnly === "true" || search.activeOnly === true,
    };
  },
  loader: async ({ params }) => {
    const table = await getTable(params.tableId);
    if (!table) {
      throw new Error("Table not found");
    }
    return { table };
  },
});

function TableDetail() {
  return (
    <POSLayout>
      <TableDetailContent />
    </POSLayout>
  );
}

function TableDetailContent() {
  const { table } = Route.useLoaderData();
  const navigate = useNavigate();
  const { userData, companyId, branchId, currentUser, companyData } = useAuth();
  const [currentTable, setCurrentTable] = useState<Table>(table);

  // Anasayfaya yönlendirirken search params'ı koru
  const search = Route.useSearch();
  const navigateToHome = useCallback(() => {
    navigate({
      to: "/",
      search: {
        area: search.area,
        activeOnly: search.activeOnly,
      },
    });
  }, [navigate, search]);

  // Zaman farkını hesapla ve "X dakika önce" formatında göster
  const getTimeAgo = useCallback((date: Date | undefined): string => {
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
  const [showQuantityModal, setShowQuantityModal] = useState(false);
  const [selectedMenuForQuantity, setSelectedMenuForQuantity] = useState<Menu | null>(null);
  const [quantityInput, setQuantityInput] = useState("");
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ekstra malzeme seçimi için state'ler
  const [showExtraModal, setShowExtraModal] = useState(false);
  const [selectedMenuForExtra, setSelectedMenuForExtra] = useState<Menu | null>(null);
  const [selectedExtras, setSelectedExtras] = useState<Set<string>>(new Set());

  // Sipariş yönetimi state'leri
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showFullScreenPayment, setShowFullScreenPayment] = useState(false);
  const [showCancelItemModal, setShowCancelItemModal] = useState(false);
  const [showAddNoteModal, setShowAddNoteModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<OrderItem | null>(null);
  const [selectedMenuForNote, setSelectedMenuForNote] = useState<Menu | null>(
    null
  );
  const [itemNote, setItemNote] = useState("");
  const itemNoteTextareaRef = useRef<HTMLTextAreaElement>(null);
  const { openKeyboard } = useTouchKeyboard();
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodConfig[]>(
    []
  );
  const [cancelItemOptions, setCancelItemOptions] = useState<
    Array<{ item: OrderItem; index: number }>
  >([]);
  const [discountType, setDiscountType] = useState<
    "percentage" | "amount" | "manual"
  >("percentage");
  const [discountValue, setDiscountValue] = useState<string>("");
  const [manualDiscount, setManualDiscount] = useState<string>("");
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set()); // Seçili ürün index'leri
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [selectedCourierId, setSelectedCourierId] = useState<string>("");
  const [packageCount, setPackageCount] = useState<string>("1");
  const [changeAmount, setChangeAmount] = useState<string>("0");
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [availableTables, setAvailableTables] = useState<Table[]>([]);
  const [selectedArea, setSelectedArea] = useState<string>("");
  const [showQuantitySelectionModal, setShowQuantitySelectionModal] =
    useState(false);
  const [quantitySelectionAction, setQuantitySelectionAction] = useState<
    "cancel" | "move" | "payment" | null
  >(null);
  const [selectedItemForQuantity, setSelectedItemForQuantity] = useState<{
    menuId: string;
    menuName: string;
    totalQuantity: number;
    indices: number[];
  } | null>(null);
  const [selectedQuantity, setSelectedQuantity] = useState<number>(1);
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
      indices: number[];
    }>
  >([]);
  const [currentPaymentItemIndex, setCurrentPaymentItemIndex] =
    useState<number>(0);
  const [selectedQuantities, setSelectedQuantities] = useState<
    Map<string, number>
  >(new Map());

  // Tam ekran ödeme ekranı için state'ler
  const [paymentScreenSelectedItems, setPaymentScreenSelectedItems] = useState<
    Set<number>
  >(new Set());
  const [paymentScreenSelectedQuantities, setPaymentScreenSelectedQuantities] =
    useState<Map<number, number>>(new Map()); // key: item index, value: selected quantity
  const [_paymentScreenAmount, setPaymentScreenAmount] = useState<string>("");
  const [paymentScreenDiscountType, setPaymentScreenDiscountType] = useState<
    "percentage" | "amount" | "manual"
  >("percentage");
  const [paymentScreenDiscountValue, setPaymentScreenDiscountValue] =
    useState<string>("");
  const [paymentScreenManualDiscount, setPaymentScreenManualDiscount] =
    useState<string>("");
  const [showPaymentScreenDiscountModal, setShowPaymentScreenDiscountModal] =
    useState(false);
  const [, setSelectedNumericKey] = useState<number | null>(
    null
  );
  const [paymentScreenQuantityInput, setPaymentScreenQuantityInput] = useState<string>("");
  // Paket masaları için kurye atama state'leri
  const [paymentScreenSelectedCourierId, setPaymentScreenSelectedCourierId] = useState<string>("");
  const [paymentScreenChangeAmount, setPaymentScreenChangeAmount] = useState<string>("0");
  const [showPaymentScreenCourierModal, setShowPaymentScreenCourierModal] = useState(false);
  const [showPaymentScreenChangeAmountModal, setShowPaymentScreenChangeAmountModal] = useState(false);

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

  // Taşıma için state'ler (ödeme gibi)
  const [pendingMoveItems, setPendingMoveItems] = useState<
    Array<{
      menuId: string;
      menuName: string;
      totalQuantity: number;
      indices: number[];
    }>
  >([]);
  const [currentMoveItemIndex, setCurrentMoveItemIndex] = useState<number>(0);
  const [selectedMoveQuantities, setSelectedMoveQuantities] = useState<
    Map<string, number>
  >(new Map());

  // Loading states
  const [isSendingOrder, setIsSendingOrder] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [processingPaymentMethodId, setProcessingPaymentMethodId] = useState<
    string | null
  >(null);
  const [isCanceling, setIsCanceling] = useState(false);
  const [isMovingItems, setIsMovingItems] = useState(false);
  
  // Yazıcılar için state
  const [printers, setPrinters] = useState<Array<{
    id: string;
    name: string;
    type: "serial" | "usb" | "network" | "system";
    port?: string;
    vendorId?: number;
    productId?: number;
    isConnected: boolean;
    assignedCategories?: string[];
  }>>([]);
  const [selectedPrinterId, setSelectedPrinterId] = useState<string | null>(null);

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

        const [
          menusData,
          categoriesData,
          tableData,
          allOrders,
          paymentMethodsData,
        ] = await Promise.all([
          getMenusByCompany(
            effectiveCompanyId,
            effectiveBranchId || undefined
          ).catch(() => {
            return [];
          }),
          getCategoriesByCompany(
            effectiveCompanyId,
            effectiveBranchId || undefined
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

        setMenus(menusData);
        setCategories(categoriesData);
        if (tableData) {
          setCurrentTable(tableData);
        }
        
        // Yazıcıları yükle
        try {
          const savedPrinters = localStorage.getItem(`printers_${effectiveCompanyId}`);
          if (savedPrinters) {
            const printersData = JSON.parse(savedPrinters);
            setPrinters(printersData);
            
            const selected = localStorage.getItem(`selectedPrinter_${effectiveCompanyId}`);
            if (selected) {
              setSelectedPrinterId(selected);
            }
          }
        } catch (error) {
        }

        // Aktif ödeme yöntemlerini filtrele ve yükle
        const activePaymentMethods = paymentMethodsData.filter(
          (pm) => pm.isActive
        );
        setPaymentMethods(activePaymentMethods);

        // İlk ödeme yöntemini seç
        if (activePaymentMethods.length > 0 && !paymentMethod) {
          setPaymentMethod(activePaymentMethods[0].code);
        }

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
        if (categoriesData.length > 0 && !selectedCategoryId) {
          setSelectedCategoryId(categoriesData[0].id!);
          setSelectedCategoryName(categoriesData[0].name);
        }
      } catch (error) {
        // Error loading data
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
    table.id,
    currentTable.currentOrderId,
  ]);

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
  const addToCartWithNote = useCallback((menu: Menu, note?: string, extras?: SelectedExtra[]) => {
    const extrasTotal = extras?.reduce((sum, extra) => sum + extra.price, 0) || 0;
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
  }, []);

  // Ürün ekleme butonuna tıklandığında ekstra malzeme kontrolü yap
  const handleAddToCart = useCallback((menu: Menu) => {
    // Eğer üründe ekstra malzeme varsa modal göster
    if (menu.extras && menu.extras.length > 0) {
      setSelectedMenuForExtra(menu);
      // Zorunlu ekstraları otomatik seç
      const requiredExtras = new Set(
        menu.extras.filter(extra => extra.isRequired).map(extra => extra.id)
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
  }, []);

  // Ekstra malzemeleri seçip sepete ekle
  const handleAddToCartWithExtras = useCallback(() => {
    if (!selectedMenuForExtra) return;

    const selectedExtrasList: SelectedExtra[] = Array.from(selectedExtras)
      .map(extraId => {
        const extra = selectedMenuForExtra.extras?.find(e => e.id === extraId);
        return extra ? {
          id: extra.id,
          name: extra.name,
          price: extra.price,
        } : null;
      })
      .filter((e): e is SelectedExtra => e !== null);

    const extrasTotal = selectedExtrasList.reduce((sum, extra) => sum + extra.price, 0);
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
          selectedExtras: selectedExtrasList.length > 0 ? selectedExtrasList : undefined,
          addedAt: new Date(),
        },
      ];
    });

    // Modal'ı kapat ve state'leri temizle
    setShowExtraModal(false);
    setSelectedMenuForExtra(null);
    setSelectedExtras(new Set());
    setShowCart(true);
  }, [selectedMenuForExtra, selectedExtras]);

  // Long press başlat (miktar girme modalı için)
  const handleLongPressStart = useCallback((menu: Menu) => {
    longPressTimerRef.current = setTimeout(() => {
      setSelectedMenuForQuantity(menu);
      setQuantityInput("");
      // Eğer üründe ekstra malzeme varsa zorunlu olanları otomatik seç
      if (menu.extras && menu.extras.length > 0) {
        const requiredExtras = new Set(
          menu.extras.filter(extra => extra.isRequired).map(extra => extra.id)
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
  const handleAddWithQuantity = useCallback(() => {
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
      .map(extraId => {
        const extra = selectedMenuForQuantity.extras?.find(e => e.id === extraId);
        return extra ? {
          id: extra.id,
          name: extra.name,
          price: extra.price,
        } : null;
      })
      .filter((e): e is SelectedExtra => e !== null);

    const extrasTotal = selectedExtrasList.reduce((sum, extra) => sum + extra.price, 0);
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
          selectedExtras: selectedExtrasList.length > 0 ? selectedExtrasList : undefined,
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
  const updateQuantity = useCallback((cartItemId: string, delta: number) => {
    setCart((prev) => {
      const item = prev.find((i) => i.cartItemId === cartItemId);
      if (!item) return prev;

      const newQuantity = item.quantity + delta;
      if (newQuantity <= 0) {
        return prev.filter((i) => i.cartItemId !== cartItemId);
      }

      // Ekstra malzemelerin fiyatını da hesaba kat
      const extrasTotal = item.selectedExtras?.reduce((sum, extra) => sum + extra.price, 0) || 0;
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

  // Toplam hesapla
  const cartTotal = cart.reduce((sum, item) => sum + item.subtotal, 0);

  // Siparişi kaydet (aynı ürünleri birleştir)
  const handleSendOrder = useCallback(async () => {
    const effectiveCompanyId = companyId || userData?.companyId;
    const effectiveBranchId = branchId || userData?.assignedBranchId;

    if (!effectiveCompanyId || cart.length === 0) return;

    setIsSendingOrder(true);
    try {
      // Mevcut siparişin items'ını al (varsa)
      const existingItems = order?.items || [];

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
      const total = subtotal - (order?.discount || 0);

      // Gönderilen ürün ID'lerini kaydet (yeni eklenenler)
      const newItemIds = cart.map((item) => item.menuId);
      const existingSentItems = order?.sentItems || [];
      const sentItemIds = Array.from(
        new Set([...existingSentItems, ...newItemIds])
      );

      let updatedOrder: Order | null = null;
      if (order) {
        // Mevcut siparişi güncelle (eski + yeni ürünler)
        const updateData: any = {
          items: finalItems,
          subtotal: subtotal,
          total: total,
          sentItems: sentItemIds, // Gönderilen ürünleri kaydet
        };
        // Sadece notes varsa ekle (undefined gönderme)
        if (order.notes) {
          updateData.notes = order.notes;
        }
        await updateOrder(order.id!, updateData);
        updatedOrder = await getOrder(order.id!);
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

      // Siparişi güncelle ve sepeti temizle
      setOrder(updatedOrder);
      setCart([]);
      setNotes("");
      setShowCart(false);

      // Masayı dolu yap ve currentOrderId'yi güncelle
      if (updatedOrder) {
        await updateTableStatus(currentTable.id!, "occupied", updatedOrder.id);
        const tableData = await getTable(currentTable.id!);
        if (tableData) {
          setCurrentTable(tableData);
        }
        
        // Yeni eklenen ürünleri yazdır (kategori yazıcılarına)
        try {
          const newItems = cart; // Yeni eklenen ürünler
          if (newItems.length > 0) {
            // Her ürün için kategori bul ve ilgili yazıcılara yazdır
            for (const item of newItems) {
              const menuItem = menus.find((m) => m.id === item.menuId);
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
                      "order",
                      [item],
                      currentTable.tableNumber,
                      updatedOrder.orderNumber,
                      {
                        companyName: companyData?.name || "",
                      }
                    );
                    await printToPrinter(printer.name, printContent, "order");
                  }
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
  }, [userData, cart, order, notes, currentTable, navigate, menus, categories, printers, companyId, branchId, companyData]);

  // Ödeme alma
  const handlePayment = useCallback(
    async (
      overrideAmount?: string,
      overrideSelectedItems?: Set<number>,
      overridePendingPaymentItems?: Array<{
        menuId: string;
        menuName: string;
        totalQuantity: number;
        indices: number[];
      }>,
      overrideSelectedQuantities?: Map<string, number>,
      overridePaymentMethod?: string,
      overrideCourierId?: string,
      overridePackageCount?: string,
      overrideChangeAmount?: string
    ) => {
      // Eğer overrideAmount verilmişse onu kullan, yoksa state'ten oku
      const amountToUse = overrideAmount || paymentAmount;
      
      // Eğer overridePaymentMethod verilmişse onu kullan, yoksa state'ten oku
      const paymentMethodToUse = overridePaymentMethod || paymentMethod;

      // Eğer override değerler verilmişse onları kullan, yoksa state'ten oku
      const itemsToUse =
        overrideSelectedItems !== undefined
          ? overrideSelectedItems
          : selectedItems;
      const pendingItemsToUse =
        overridePendingPaymentItems !== undefined
          ? overridePendingPaymentItems
          : pendingPaymentItems;
      const quantitiesToUse =
        overrideSelectedQuantities !== undefined
          ? overrideSelectedQuantities
          : selectedQuantities;

      if (
        !order ||
        !order.items ||
        !amountToUse ||
        parseFloat(amountToUse) <= 0 ||
        isNaN(parseFloat(amountToUse))
      ) {
        customAlert("Lütfen geçerli bir ödeme tutarı girin", "Uyarı", "warning");
        return;
      }

      setIsProcessingPayment(true);
      try {
        const amount = parseFloat(amountToUse);
        const isPartialPayment = itemsToUse.size > 0;

        let remaining: number;
        let paidItems:
          | Array<{
              menuId: string;
              menuName: string;
              quantity: number;
              subtotal: number;
            }>
          | undefined;

        if (isPartialPayment) {
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

          // Ödenen ürünler listesi
          paidItems = Array.from(mergedSelectedItems.values()).map(
            ({ item, quantity, subtotal }) => ({
              menuId: item.menuId,
              menuName: item.menuName,
              quantity,
              subtotal,
            })
          );
        } else {
          // Tam ödeme: Mevcut ürünlerin toplamı (önceki ödemeler zaten kaldırılan ürünler için)
          remaining = (order.items || []).reduce(
            (sum, item) => sum + item.subtotal,
            0
          );
        }

        // İndirim hesapla (kalan tutara göre)
        let discountAmount = 0;
        if (discountType === "percentage" && discountValue) {
          const percentage = parseFloat(discountValue);
          discountAmount = (remaining * percentage) / 100;
        } else if (discountType === "amount" && discountValue) {
          discountAmount = Math.min(parseFloat(discountValue), remaining);
        } else if (discountType === "manual" && manualDiscount) {
          discountAmount = Math.min(parseFloat(manualDiscount), remaining);
        }

        // İndirim varsa siparişe uygula (sadece tam ödeme için)
        if (discountAmount > 0 && !isPartialPayment) {
          const currentDiscount = order.discount || 0;
          const newDiscount = currentDiscount + discountAmount;
          const newSubtotal = order.subtotal;
          const newTotal = Math.max(0, newSubtotal - newDiscount);

          await updateOrder(order.id!, {
            discount: newDiscount,
            total: newTotal,
          });
        }

        const payment: Payment = {
          amount,
          method: paymentMethodToUse, // overridePaymentMethod veya paymentMethod state'i
          paidAt: new Date(),
          paidItems: isPartialPayment ? paidItems : undefined,
        };

        // Kısmi ödeme ise seçili ürünleri order'dan kaldır (önce kaldır, sonra ödeme ekle)
        if (isPartialPayment && itemsToUse.size > 0) {
          const updatedItems = [...order.items];
          const itemsToUpdate: Array<{
            index: number;
            quantity: number;
            subtotal: number;
          }> = [];
          const indicesToRemove = new Set<number>();

          // Eğer birden fazla ürün için miktar seçildiyse, her ürün için seçilen miktar kadar kaldır
          const allPendingIndices = new Set<number>();

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

          // Diğer seçili ürünleri tamamen kaldır (pendingIndices içinde olmayan)
          const selectedItemsArray = Array.from(itemsToUse);
          const otherSelectedIndices = selectedItemsArray
            .filter((index) => !allPendingIndices.has(index))
            .sort((a, b) => b - a);

          otherSelectedIndices.forEach((index) => {
            if (index >= 0 && index < updatedItems.length) {
              indicesToRemove.add(index);
            }
          });

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
          const newTotal = Math.max(0, newSubtotal - (order.discount || 0));

          // Order'ı güncelle (ürünleri kaldır)
          await updateOrder(order.id!, {
            items: updatedItems,
            subtotal: newSubtotal,
            total: newTotal,
          });

          // Seçili ürünleri temizle
          setSelectedItems(new Set());
          setPendingPaymentQuantity(null);
          // NOT: pendingPaymentItems ve selectedQuantities ödeme işleminde kullanılacak, şimdi temizleme
        }

        // Ödemeyi ekle
        await addPayment(order.id!, payment);

        // Adisyon oluştur (her ödeme sonrası)
        const effectiveCompanyId = companyId || userData?.companyId;
        const effectiveBranchId = branchId || userData?.assignedBranchId;
        if (effectiveCompanyId) {
          try {
            // Ödenen ürünleri belirle
            let billItems: OrderItem[] = [];
            
            if (isPartialPayment && paidItems) {
              // Kısmi ödeme: Sadece ödenen ürünleri al
              // paidItems'dan OrderItem formatına dönüştür
              billItems = paidItems.map((paidItem) => {
                // Order'dan ilgili item'ı bul (menuId ve quantity'ye göre)
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
                // Eğer order'da bulunamazsa, paidItem'dan oluştur
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
            const billSubtotal = billItems.reduce((sum, item) => sum + item.subtotal, 0);
            const billDiscount = isPartialPayment ? 0 : (order.discount || 0);
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
        }

        // Masa geçmişine kaydet (geriye dönük uyumluluk için)
        if (effectiveCompanyId) {
          try {
            // Ödeme yöntemi adını bul
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
        }

        // Siparişi yeniden yükle (güncel haliyle)
        const updatedOrder = await getOrder(order.id!);

        // Kurye ataması yapıldıysa (paket masaları için)
        const courierIdToUse = overrideCourierId !== undefined ? overrideCourierId : selectedCourierId;
        const packageCountToUse = overridePackageCount !== undefined ? overridePackageCount : packageCount;
        const changeAmountToUse = overrideChangeAmount !== undefined ? overrideChangeAmount : changeAmount;
        
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

        // Ödeme alındığında ana yazıcıdan yazdır
        try {
          const defaultPrinter = getDefaultPrinter(printers, selectedPrinterId);
          if (defaultPrinter && updatedOrder) {
            // Ödenen ürünleri al (kısmi ödeme durumunda sadece ödenenler)
            const paidItems = isPartialPayment && pendingPaymentItems.length > 0
              ? updatedOrder.items.filter((item, index) => {
                  const paidItem = pendingPaymentItems.find(pi => pi.menuId === item.menuId);
                  return paidItem && paidItem.indices.includes(index);
                })
              : updatedOrder.items;
            
            if (paidItems.length > 0) {
              const paymentMethodName = paymentMethods.find(
                (pm) => pm.code === paymentMethodToUse
              )?.name || paymentMethodToUse;
              
              const printContent = formatPrintContent(
                "payment",
                paidItems,
                currentTable.tableNumber,
                updatedOrder.orderNumber,
                {
                  total: amount,
                  paymentMethod: paymentMethodName,
                  discount: updatedOrder.discount || 0,
                  subtotal: updatedOrder.subtotal || 0,
                  companyName: companyData?.name || "",
                }
              );
              await printToPrinter(defaultPrinter.name, printContent, "payment");
            }
          }
        } catch (error) {
          // Yazdırma hatası ödeme işlemini etkilemesin
        }

        // Eğer TAM ödeme alındıysa (ve partial ödeme değilse) veya tüm ürünler kaldırıldıysa siparişi kapat
        // Not: Kısmi ödemede (seçilen ürünlerin belli adetleri) masada ürün kaldığı sürece sipariş açık kalmalı
        // Kurye atandıysa siparişi kapat
        if (
          (!isPartialPayment && updatedOrder?.paymentStatus === "paid") ||
          (updatedOrder && updatedOrder.items.length === 0) ||
          courierIdToUse
        ) {
          // Tüm ürünler kaldırıldıysa ya da tam ödeme alındıysa veya kurye atandıysa siparişi kapat
          if (updatedOrder) {
            await updateOrderStatus(updatedOrder.id!, "closed");
            // Masa durumunu güncelle
            await updateTableStatus(currentTable.id!, "available", undefined);
            // Sipariş state'ini güncelle (masalara dönmese bile)
            setOrder(null);
          }

          // Navigation ayarını kontrol et
          const navSettings = localStorage.getItem("navigationSettings");
          if (navSettings) {
            try {
              const settings = JSON.parse(navSettings);
              if (settings.returnAfterPayment || settings.returnAfterOrderClose) {
          navigateToHome();
          return;
              }
              // Masalara dönmüyorsa bile state'i güncelle (zaten yukarıda güncellendi)
              return;
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
        }

        // Kısmi ödeme durumunda siparişi güncelle
        setOrder(updatedOrder);
        setShowPaymentModal(false);
        setPaymentAmount("");
        setDiscountType("percentage");
        setDiscountValue("");
        setManualDiscount("");

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
        if (navSettings) {
          try {
            const settings = JSON.parse(navSettings);
            if (settings.returnAfterPayment) {
              navigateToHome();
            }
      } catch (error) {
            // Hata durumunda yönlendirme yapma
          }
        }
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
      manualDiscount,
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
  const handleCancelItem = useCallback(async () => {
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
              if (settings.returnAfterProductCancel || settings.returnAfterOrderClose) {
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
          const updatedTable = await getTable(currentTable.id!);
          if (updatedTable) {
            setCurrentTable(updatedTable);
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
  const toggleItemSelection = useCallback((index: number) => {
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

  // Seçili ürünleri iptal et
  const handleCancelSelectedItems = useCallback(async () => {
    if (!order || selectedItems.size === 0) return;

    setIsCanceling(true);
    try {
      // Seçili ürünleri filtrele ve iptal edilenleri canceledItems'a ekle
      const canceledItems = order.canceledItems || [];
      const updatedItems = order.items.filter((_, index) => {
        if (selectedItems.has(index)) {
          // İptal edilen ürünü canceledItems'a ekle
          const canceledItem = order.items[index];
          canceledItems.push({
            ...canceledItem,
            addedAt: canceledItem.addedAt || new Date(),
            canceledAt: new Date(),
          });
          return false; // items'dan çıkar
        }
        return true; // items'da kal
      });

      // Eğer hiç ürün kalmadıysa siparişi kapat ve masayı müsait yap
      if (updatedItems.length === 0) {
        // Önce canceledItems'ı kaydet
        const subtotal = 0;
        const total = 0;
        await updateOrder(order.id!, {
          items: updatedItems,
          canceledItems: canceledItems,
          subtotal: subtotal,
          total: total,
        });

        await updateTableStatus(currentTable.id!, "available", undefined);
        await updateOrderStatus(order.id!, "closed");
        const updatedTable = await getTable(currentTable.id!);
        if (updatedTable) {
          setCurrentTable(updatedTable);
        }
        setOrder(null);
        setSelectedItems(new Set());
        // Ana sayfaya yönlendirme KALDIRILDI - kullanıcı masa sayfasında kalsın
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
        const canceledItemsForPrint = order.items.filter((_, index) =>
          selectedItems.has(index)
        );
        
        if (canceledItemsForPrint.length > 0) {
          // Her iptal edilen ürün için kategori bul ve ilgili yazıcılara yazdır
          for (const canceledItem of canceledItemsForPrint) {
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
          }
        }
      } catch (error) {
        // Yazdırma hatası iptal işlemini etkilemesin
      }

      // Masa geçmişine kaydet - Her iptal edilen ürün için
      const effectiveCompanyId = companyId || userData?.companyId;
      const effectiveBranchId = branchId || userData?.assignedBranchId;
      if (effectiveCompanyId) {
        try {
          const canceledItemsForHistory = order.items.filter((_, index) =>
            selectedItems.has(index)
          );
          for (const canceledItem of canceledItemsForHistory) {
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
  }, [
    order,
    selectedItems,
    menus,
    categories,
    printers,
    currentTable,
    companyId,
    branchId,
    userData,
    currentTable,
    navigate,
    companyId,
    branchId,
    userData,
  ]);

  // Seçili ürünleri taşı
  const handleMoveSelectedItems = useCallback(
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

          // Siparişi yeniden yükle ve state'i güncelle
          const updatedOrderAfterMove = await getOrder(order.id!);
          if (updatedOrderAfterMove) {
            setOrder(updatedOrderAfterMove);
          }
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
    <div className="h-[100dvh] bg-gray-50 dark:bg-gray-900 flex flex-col lg:flex-row overflow-hidden select-none">
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
      {/* Left Sidebar - Categories (Desktop) */}
      <div className="hidden lg:flex lg:w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex-col h-full overflow-hidden">
        <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <Button
            variant="outline"
            onClick={navigateToHome}
            className="w-full justify-start mb-4 h-10 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 font-semibold"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Geri
          </Button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Masa {currentTable.tableNumber}
          </h1>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <h2 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">
            Kategoriler
          </h2>
          <div className="space-y-1.5">
            {categories.map((category) => {
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
            })}
          </div>
        </div>
      </div>
      {/* Main Content - Products */}
      <div className="flex-1 flex flex-col lg:flex-row">
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
        <div className="flex-1 p-3 lg:p-4 overflow-y-auto">
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
                    onClick={() => handleAddToCart(menu)}
                    onMouseDown={() => handleLongPressStart(menu)}
                    onMouseUp={handleLongPressEnd}
                    onMouseLeave={handleLongPressEnd}
                    onTouchStart={() => handleLongPressStart(menu)}
                    onTouchEnd={handleLongPressEnd}
                    onTouchCancel={handleLongPressEnd}
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

        {/* Ödeme Paneli - Aşağıdan Yukarıya Kayarak */}
        {order &&
          order.items &&
          order.items.length > 0 &&
          (() => {
            // Eğer seçili ürünler varsa sadece onların toplamını hesapla
            let remaining: number;
            if (selectedItems.size > 0) {
              const selectedItemsArray = Array.from(selectedItems);
              const selectedItemsData = selectedItemsArray
                .map((index) => order.items[index])
                .filter(Boolean);

              // Seçili ürünleri menuId'ye göre birleştir
              const mergedSelectedItems = new Map<
                string,
                { quantity: number; subtotal: number }
              >();
              selectedItemsData.forEach((item) => {
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

              remaining = Array.from(mergedSelectedItems.values()).reduce(
                (sum, { subtotal }) => sum + subtotal,
                0
              );
            } else {
              // Tam ödeme: Mevcut ürünlerin toplamı (önceki ödemeler zaten kaldırılan ürünler için)
              remaining = (order.items || []).reduce(
                (sum, item) => sum + item.subtotal,
                0
              );
            }

            const calculateDiscount = () => {
              if (discountType === "percentage" && discountValue) {
                const percentage = parseFloat(discountValue);
                return (remaining * percentage) / 100;
              } else if (discountType === "amount" && discountValue) {
                return parseFloat(discountValue);
              } else if (discountType === "manual" && manualDiscount) {
                return parseFloat(manualDiscount);
              }
              return 0;
            };
            const discount = calculateDiscount();
            // const finalAmount = Math.max(0, remaining - discount);

            return (
              <div
                className={`absolute inset-0 bg-white dark:bg-gray-800 transform transition-transform duration-300 ease-in-out z-10 flex flex-col ${
                  showPaymentModal ? "translate-y-0" : "translate-y-full"
                }`}
              >
                <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <ArrowLeft
                        className="h-4 w-4 cursor-pointer"
                        onClick={() => {
                          setShowPaymentModal(false);
                          setPaymentAmount("");
                          setDiscountType("percentage");
                          setDiscountValue("");
                          setManualDiscount("");
                          setSelectedCourierId("");
                          setPackageCount("1");
                          setChangeAmount("0");
                        }}
                      />
                      Ödeme Al
                    </h2>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-3">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        İndirim
                      </label>
                      <div className="space-y-3">
                        {/* İndirim Türü Seçimi */}
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant={
                              discountType === "percentage"
                                ? "default"
                                : "outline"
                            }
                            onClick={() => {
                              setDiscountType("percentage");
                              setDiscountValue("");
                              setManualDiscount("");
                              setPaymentAmount(remaining.toFixed(2));
                            }}
                            className="flex-1 text-xs"
                          >
                            Oran
                          </Button>
                          <Button
                            type="button"
                            variant={
                              discountType === "amount" ? "default" : "outline"
                            }
                            onClick={() => {
                              setDiscountType("amount");
                              setDiscountValue("");
                              setManualDiscount("");
                              setPaymentAmount(remaining.toFixed(2));
                            }}
                            className="flex-1 text-xs"
                          >
                            Fiyat
                          </Button>
                          <Button
                            type="button"
                            variant={
                              discountType === "manual" ? "default" : "outline"
                            }
                            onClick={() => {
                              setDiscountType("manual");
                              setDiscountValue("");
                              setManualDiscount("");
                              setPaymentAmount(remaining.toFixed(2));
                            }}
                            className="flex-1 text-xs"
                          >
                            Manuel
                          </Button>
                        </div>

                        {/* Oran Bazlı İndirim */}
                        {discountType === "percentage" && (
                          <div>
                            <div className="flex gap-2 flex-wrap">
                              {[10, 20, 30, 40, 50].map((percent) => (
                                <Button
                                  key={percent}
                                  type="button"
                                  variant={
                                    discountValue === percent.toString()
                                      ? "default"
                                      : "outline"
                                  }
                                  onClick={() => {
                                    if (discountValue === percent.toString()) {
                                      setDiscountValue("");
                                      setPaymentAmount(remaining.toFixed(2));
                                    } else {
                                      setDiscountValue(percent.toString());
                                      const discountAmount =
                                        (remaining * percent) / 100;
                                      setPaymentAmount(
                                        Math.max(
                                          0,
                                          remaining - discountAmount
                                        ).toFixed(2)
                                      );
                                    }
                                  }}
                                  className="flex-1 min-w-[60px] text-xs"
                                >
                                  %{percent}
                                </Button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Fiyat Bazlı İndirim */}
                        {discountType === "amount" && (
                          <div>
                            <div className="flex gap-2 flex-wrap">
                              {[20, 50, 75, 100].map((amount) => (
                                <Button
                                  key={amount}
                                  type="button"
                                  variant={
                                    discountValue === amount.toString()
                                      ? "default"
                                      : "outline"
                                  }
                                  onClick={() => {
                                    if (discountValue === amount.toString()) {
                                      setDiscountValue("");
                                      setPaymentAmount(remaining.toFixed(2));
                                    } else {
                                      setDiscountValue(amount.toString());
                                      setPaymentAmount(
                                        Math.max(0, remaining - amount).toFixed(
                                          2
                                        )
                                      );
                                    }
                                  }}
                                  className="flex-1 min-w-[60px] text-xs"
                                >
                                  ₺{amount}
                                </Button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Manuel İndirim */}
                        {discountType === "manual" && (
                          <div>
                            <Input
                              type="number"
                              value={manualDiscount}
                              onChange={(e) => {
                                const value = e.target.value;
                                setManualDiscount(value);
                                const discountAmount = parseFloat(value) || 0;
                                setPaymentAmount(
                                  Math.max(
                                    0,
                                    remaining - discountAmount
                                  ).toFixed(2)
                                );
                              }}
                              placeholder="İndirim tutarı"
                              step="0.01"
                              min="0"
                              max={remaining}
                              className="dark:bg-gray-700 dark:text-white dark:border-gray-600"
                            />
                          </div>
                        )}

                        {/* İndirim Özeti */}
                        <div className="bg-gray-50 dark:bg-gray-700/50 p-2 rounded text-xs">
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">
                              İndirim:
                            </span>
                            <span className="font-medium text-red-600 dark:text-red-400">
                              -₺{discount.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Ödeme Tutarı
                      </label>
                      <Input
                        type="number"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                        max={remaining}
                        className="dark:bg-gray-700 dark:text-white dark:border-gray-600"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Kalan: ₺{remaining.toFixed(2)}
                        {discount > 0 && (
                          <span className="text-red-600 dark:text-red-400 ml-2">
                            (İndirim: -₺{discount.toFixed(2)})
                          </span>
                        )}
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Ödeme Yöntemi
                      </label>
                      {paymentMethods.length === 0 ? (
                        <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
                          Ödeme yöntemi bulunamadı
                        </div>
                      ) : (
                        <div className="flex gap-2 flex-wrap">
                          {paymentMethods.map((pm) => (
                            <Button
                              key={pm.id}
                              type="button"
                              variant={
                                paymentMethod === pm.code
                                  ? "default"
                                  : "outline"
                              }
                              onClick={() => setPaymentMethod(pm.code)}
                              className={`flex-1 min-w-[100px] h-10 ${
                                paymentMethod === pm.code
                                  ? "text-white"
                                  : "bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
                              }`}
                              style={
                                paymentMethod === pm.code
                                  ? { backgroundColor: pm.color || "#16a34a" }
                                  : {}
                              }
                            >
                              {pm.name}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Kurye Atama */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Kurye Atama (Opsiyonel)
                      </label>
                      {couriers.length === 0 ? (
                        <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
                          Aktif kurye bulunamadı
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <select
                            value={selectedCourierId}
                            onChange={(e) => {
                              setSelectedCourierId(e.target.value);
                              if (!e.target.value) {
                                setPackageCount("1");
                                setChangeAmount("0");
                              }
                            }}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          >
                            <option value="">Kurye Seçin</option>
                            {couriers.map((courier) => (
                              <option key={courier.id} value={courier.id}>
                                {courier.name} (₺
                                {courier.pricePerPackage.toFixed(2)}/paket)
                              </option>
                            ))}
                          </select>

                          {selectedCourierId && (
                            <>
                              <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                  Paket Sayısı
                                </label>
                                <Input
                                  type="number"
                                  min="1"
                                  value={packageCount}
                                  onChange={(e) =>
                                    setPackageCount(e.target.value)
                                  }
                                  placeholder="1"
                                  className="dark:bg-gray-700 dark:text-white dark:border-gray-600"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                  Para Üstü (₺)
                                </label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={changeAmount}
                                  onChange={(e) =>
                                    setChangeAmount(e.target.value)
                                  }
                                  placeholder="0.00"
                                  className="dark:bg-gray-700 dark:text-white dark:border-gray-600"
                                />
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button
                        onClick={() => handlePayment()}
                        disabled={isProcessingPayment}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white dark:text-white"
                      >
                        {isProcessingPayment ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            İşleniyor...
                          </>
                        ) : (
                          <>
                            <Check className="h-4 w-4 mr-2" />
                            Onayla
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowPaymentModal(false);
                          setPaymentAmount("");
                          setDiscountType("percentage");
                          setDiscountValue("");
                          setManualDiscount("");
                          setSelectedCourierId("");
                          setPackageCount("1");
                          setChangeAmount("0");
                        }}
                        className="flex-1"
                      >
                        <X className="h-4 w-4 mr-2" />
                        İptal
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

        {/* Normal Görünüm */}
        <div
          className={`flex-none w-80 flex flex-col transition-opacity duration-300 overflow-hidden border-l border-gray-200 dark:border-gray-700 ${
            showPaymentModal ? "opacity-0 pointer-events-none" : "opacity-100"
          }`}
          style={{ backgroundColor: "#1E2939" }}
        >
          <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                {order ? "Aktif Sipariş" : "Sipariş"}
              </h2>
            </div>
          </div>

          {/* Cart Items veya Aktif Sipariş */}
          <div className="flex-1 overflow-y-auto p-3 min-h-0">
            {order && order.items.length > 0 ? (
              <>
                {/* Ödemesi Alınan ve İptal Edilen Ürünler */}
                {(() => {
                  // Tüm ödemelerden ödenen ürünleri birleştir
                  const paidItemsMap = new Map<
                    string,
                    { menuName: string; quantity: number; subtotal: number }
                  >();

                  if (order.payments && order.payments.length > 0) {
                    order.payments.forEach((payment) => {
                      if (payment.paidItems) {
                        payment.paidItems.forEach((paidItem) => {
                          const existing = paidItemsMap.get(paidItem.menuId);
                          if (existing) {
                            existing.quantity += paidItem.quantity;
                            existing.subtotal += paidItem.subtotal;
                          } else {
                            paidItemsMap.set(paidItem.menuId, {
                              menuName: paidItem.menuName,
                              quantity: paidItem.quantity,
                              subtotal: paidItem.subtotal,
                            });
                          }
                        });
                      }
                    });
                  }

                  const paidItems = Array.from(paidItemsMap.values());
                  const hasPaidItems = paidItems.length > 0;
                  const hasCanceledItems =
                    order.canceledItems && order.canceledItems.length > 0;

                  if (!hasPaidItems && !hasCanceledItems) {
                    return null;
                  }

                  return (
                    <div className="mb-4 pb-4 border-b-2 border-gray-300 dark:border-gray-600">
                      {/* Ödemesi Alınan Ürünler */}
                      {hasPaidItems && (
                        <div className="mb-3">
                          <div className="text-xs font-bold text-green-700 dark:text-green-400 mb-2 flex items-center gap-1">
                            <Check className="h-3 w-3" />
                            Ödemesi Alınan Ürünler
                          </div>
                          <div className="space-y-1.5">
                            {paidItems.map((paidItem, idx) => (
                              <div
                                key={`paid-${idx}`}
                                className="rounded-lg p-1.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 w-full"
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex-1 min-w-0">
                                    <h4 className="font-medium text-green-900 dark:text-green-200 text-xs truncate">
                                      {paidItem.menuName}
                                    </h4>
                                  </div>
                                  <div className="flex flex-col items-end gap-0.5">
                                    <span className="font-bold text-green-900 dark:text-green-200 text-xs">
                                      ₺{paidItem.subtotal.toFixed(2)}
                                    </span>
                                    <span className="text-[10px] text-green-700 dark:text-green-300">
                                      {paidItem.quantity} adet
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* İptal Edilen Ürünler */}
                      {hasCanceledItems && (
                        <div className={hasPaidItems ? "mt-3" : ""}>
                          <div className="text-xs font-bold text-red-700 dark:text-red-400 mb-2 flex items-center gap-1">
                            <X className="h-3 w-3" />
                            İptal Edilen Ürünler
                          </div>
                          <div className="space-y-1.5">
                            {order.canceledItems!.map((canceledItem, idx) => (
                              <div
                                key={`canceled-${idx}`}
                                className="rounded-lg p-1.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 opacity-75 w-full"
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <h4 className="font-medium text-xs text-red-900 dark:text-red-200 line-through">
                                      {canceledItem.menuName}
                                    </h4>
                                    <p className="text-[10px] text-red-700 dark:text-red-300 mt-0.5">
                                      {canceledItem.quantity} adet • ₺
                                      {canceledItem.menuPrice.toFixed(2)} birim
                                      fiyat
                                    </p>
                                  </div>
                                  <span className="font-bold text-xs text-red-900 dark:text-red-200 line-through">
                                    ₺{canceledItem.subtotal.toFixed(2)}
                                  </span>
                                </div>
                                {canceledItem.canceledAt && (
                                  <div className="flex items-center gap-1 text-[10px] text-red-600 dark:text-red-400 pt-1 border-t border-red-200 dark:border-red-800 mt-1">
                                    <Clock className="h-2.5 w-2.5" />
                                    <span>
                                      {getTimeAgo(canceledItem.canceledAt)}{" "}
                                      iptal edildi
                                    </span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Taşınan Ürünler */}
                      {order.movedItems && order.movedItems.length > 0 && (
                        <div
                          className={
                            hasPaidItems || hasCanceledItems ? "mt-3" : ""
                          }
                        >
                          <div className="text-xs font-bold text-blue-700 dark:text-blue-400 mb-2 flex items-center gap-1">
                            <ArrowRight className="h-3 w-3" />
                            Taşınan Ürünler
                          </div>
                          <div className="space-y-1.5">
                            {order.movedItems.map((movedItem, idx) => (
                              <div
                                key={`moved-${idx}`}
                                className="rounded-lg p-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 opacity-75 w-full"
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <h4 className="font-medium text-xs text-blue-900 dark:text-blue-200">
                                      {movedItem.menuName}
                                    </h4>
                                    <p className="text-[10px] text-blue-700 dark:text-blue-300 mt-0.5">
                                      {movedItem.quantity} adet • ₺
                                      {movedItem.menuPrice.toFixed(2)} birim
                                      fiyat
                                    </p>
                                  </div>
                                  <span className="font-bold text-xs text-blue-900 dark:text-blue-200">
                                    ₺{movedItem.subtotal.toFixed(2)}
                                  </span>
                                </div>
                                {movedItem.movedAt && (
                                  <div className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 pt-1 border-t border-blue-200 dark:border-blue-800 mt-1">
                                    <ArrowRight className="h-2.5 w-2.5" />
                                    <span>
                                      {getTimeAgo(movedItem.movedAt)}{" "}
                                      {movedItem.movedFromTableNumber &&
                                      movedItem.movedToTableNumber
                                        ? `Masa ${movedItem.movedFromTableNumber}'den Masa ${movedItem.movedToTableNumber}'ye taşındı`
                                        : movedItem.movedFromTableNumber
                                          ? `Masa ${movedItem.movedFromTableNumber}'den taşındı`
                                          : movedItem.movedToTableNumber
                                            ? `Masa ${movedItem.movedToTableNumber}'ye taşındı`
                                            : "taşındı"}
                                    </span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div className="space-y-2">
                  {(() => {
                    // Aynı menuId'ye sahip ürünleri birleştir
                    const mergedItems = new Map<
                      string,
                      { item: OrderItem; indices: number[] }
                    >();
                    order.items.forEach((item, index) => {
                      const existing = mergedItems.get(item.menuId);
                      if (existing) {
                        existing.item.quantity += item.quantity;
                        existing.item.subtotal += item.subtotal;
                        existing.indices.push(index);
                      } else {
                        mergedItems.set(item.menuId, {
                          item: { ...item },
                          indices: [index],
                        });
                      }
                    });

                    return Array.from(mergedItems.values()).map(
                      ({ item, indices }) => {
                        const isSelected = indices.some((idx) =>
                          selectedItems.has(idx)
                        );
                        return (
                          <div
                            key={item.menuId}
                            onClick={() => {
                              // Tüm index'leri seç/seçimi kaldır
                              indices.forEach((idx) =>
                                toggleItemSelection(idx)
                              );
                            }}
                            className={`rounded-lg p-2 border-2 cursor-pointer transition-all w-full ${
                              isSelected
                                ? "border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/30"
                                : "border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700/50 hover:border-gray-300 dark:hover:border-gray-500"
                            }`}
                          >
                            <div className="flex items-start justify-between mb-1.5">
                              <div className="flex-1 min-w-0">
                                <h4
                                  className={`font-medium text-xs truncate ${
                                    isSelected
                                      ? "text-blue-900 dark:text-blue-200"
                                      : "text-gray-900 dark:text-white"
                                  }`}
                                >
                                  {item.menuName}
                                </h4>
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                <span
                                  className={`font-bold text-xs ${
                                    isSelected
                                      ? "text-blue-900 dark:text-blue-200"
                                      : "text-gray-900 dark:text-white"
                                  }`}
                                >
                                  ₺{item.subtotal.toFixed(2)}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                              {item.addedAt && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {getTimeAgo(item.addedAt)}
                                </p>
                              )}
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {item.quantity} adet
                              </span>
                            </div>
                          </div>
                        );
                      }
                    );
                  })()}
                </div>

                {cart.length > 0 && (
                  <>
                    <div className="mt-4 pt-4 border-t-2 border-green-300">
                      <div className="text-xs font-bold text-green-700 mb-2 flex items-center gap-1">
                        <Plus className="h-3 w-3" />
                        Yeni Eklenen Ürünler
                      </div>
                      <div className="space-y-2">
                        {(() => {
                          // Aynı menuId'ye sahip ürünleri birleştir
                          const mergedItems = new Map<
                            string,
                            { item: OrderItem; cartItemIds: string[] }
                          >();
                          cart.forEach((item) => {
                            const existing = mergedItems.get(item.menuId);
                            if (existing) {
                              existing.item.quantity += item.quantity;
                              existing.item.subtotal += item.subtotal;
                              existing.cartItemIds.push(
                                item.cartItemId || item.menuId
                              );
                              // Notları birleştir (varsa)
                              if (item.notes) {
                                if (existing.item.notes) {
                                  existing.item.notes = `${existing.item.notes}, ${item.notes}`;
                                } else {
                                  existing.item.notes = item.notes;
                                }
                              }
                            } else {
                              mergedItems.set(item.menuId, {
                                item: { ...item },
                                cartItemIds: [item.cartItemId || item.menuId],
                              });
                            }
                          });

                          return Array.from(mergedItems.values()).map(
                            ({ item, cartItemIds }) => {
                              const isNewItem =
                                item.cartItemId &&
                                !item.cartItemId.includes("-old-");

                              return (
                                <div
                                  key={item.menuId}
                                  className={`rounded-lg p-2 border-2 ${
                                    isNewItem
                                      ? "bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 shadow-sm"
                                      : "bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600"
                                  }`}
                                >
                                  <div className="flex items-start justify-between mb-1.5">
                                    <div className="flex-1 min-w-0">
                                      <h4 className="font-medium text-gray-900 dark:text-white text-xs truncate">
                                        {item.menuName}
                                      </h4>
                                      <p className="text-xs text-gray-600 dark:text-gray-400">
                                        ₺{item.menuPrice.toFixed(2)} x{" "}
                                        {item.quantity}
                                      </p>
                                      {item.notes && (
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">
                                          Not: {item.notes}
                                        </p>
                                      )}
                                    </div>
                                    <span className="font-bold text-gray-900 dark:text-white text-xs ml-2">
                                      ₺{item.subtotal.toFixed(2)}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between mt-2">
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          // İlk cartItemId'yi kullan
                                          updateQuantity(cartItemIds[0], -1);
                                        }}
                                        className="w-6 h-6 rounded-full bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-500"
                                      >
                                        <Minus className="h-2.5 w-2.5" />
                                      </button>
                                      <span className="font-semibold w-6 text-center text-xs">
                                        {item.quantity}
                                      </span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          // İlk cartItemId'yi kullan
                                          updateQuantity(cartItemIds[0], 1);
                                        }}
                                        className="w-6 h-6 rounded-full bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-500"
                                      >
                                        <Plus className="h-2.5 w-2.5" />
                                      </button>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          // Not ekleme/düzenleme için
                                          const menuItem = menus.find(
                                            (m) => m.id === item.menuId
                                          );
                                          if (menuItem) {
                                            setSelectedMenuForNote(menuItem);
                                            setItemNote(item.notes || "");
                                            setShowAddNoteModal(true);
                                          }
                                        }}
                                        className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100 flex items-center gap-1"
                                        title="Not ekle/düzenle"
                                      >
                                        <Edit className="h-3 w-3" />
                                        Not
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          // Tüm cartItemIds'leri sil
                                          cartItemIds.forEach((cartItemId) => {
                                            removeFromCart(cartItemId);
                                          });
                                        }}
                                        className="px-2 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100 flex items-center gap-1"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                        Sil
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
                  </>
                )}
              </>
            ) : cart.length === 0 ? (
              <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                <ShoppingCart className="h-10 w-10 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                <p className="text-xs">Sepet boş</p>
                <p className="text-xs mt-1">Ürünlere tıklayarak ekleyin</p>
              </div>
            ) : (
              <div className="space-y-2">
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
                    ({ item, cartItemIds }) => {
                      const isNewItem =
                        item.cartItemId && !item.cartItemId.includes("-old-");

                      return (
                        <div
                          key={item.menuId}
                          className={`rounded-lg p-2 border-2 ${
                            isNewItem
                              ? "bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 shadow-sm"
                              : "bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600"
                          }`}
                        >
                          <div className="flex items-start justify-between mb-1.5">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-gray-900 dark:text-white text-xs truncate">
                                {item.menuName}
                              </h4>
                              <p className="text-xs text-gray-600 dark:text-gray-400">
                                ₺{item.menuPrice.toFixed(2)} x {item.quantity}
                              </p>
                              {item.selectedExtras && item.selectedExtras.length > 0 && (
                                <div className="mt-1 space-y-0.5">
                                  {item.selectedExtras.map((extra, idx) => (
                                    <p key={idx} className="text-[10px] text-gray-500 dark:text-gray-400">
                                      + {extra.name} (+₺{extra.price.toFixed(2)})
                                    </p>
                                  ))}
                                </div>
                              )}
                              {item.notes && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">
                                  Not: {item.notes}
                                </p>
                              )}
                            </div>
                            <span className="font-bold text-gray-900 dark:text-white text-xs ml-2">
                              ₺{item.subtotal.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // İlk cartItemId'yi kullan
                                  updateQuantity(cartItemIds[0], -1);
                                }}
                                className="w-6 h-6 rounded-full bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-500"
                              >
                                <Minus className="h-2.5 w-2.5" />
                              </button>
                              <span className="font-semibold w-6 text-center text-xs">
                                {item.quantity}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // İlk cartItemId'yi kullan
                                  updateQuantity(cartItemIds[0], 1);
                                }}
                                className="w-6 h-6 rounded-full bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-500"
                              >
                                <Plus className="h-2.5 w-2.5" />
                              </button>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // Not ekleme/düzenleme için
                                  const menuItem = menus.find(
                                    (m) => m.id === item.menuId
                                  );
                                  if (menuItem) {
                                    setSelectedMenuForNote(menuItem);
                                    setItemNote(item.notes || "");
                                    setShowAddNoteModal(true);
                                  }
                                }}
                                className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100 flex items-center gap-1"
                                title="Not ekle/düzenle"
                              >
                                <Edit className="h-3 w-3" />
                                Not
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // Tüm cartItemIds'leri sil
                                  cartItemIds.forEach((cartItemId) => {
                                    removeFromCart(cartItemId);
                                  });
                                }}
                                className="px-2 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100 flex items-center gap-1"
                              >
                                <Trash2 className="h-3 w-3" />
                                Sil
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    }
                  );
                })()}
              </div>
            )}
          </div>

          {/* Totals & Actions */}
          <div className="border-t border-gray-200 dark:border-gray-700 p-3 space-y-3 flex-shrink-0">

            {order && order.items.length > 0 ? (
              // Aktif Sipariş İşlemleri
              <>
                <div className="space-y-2">
                  {/* Sadece yeni eklenen ürünlerin ara toplamı */}
                  {cart.length > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">
                        Ara Toplam:
                      </span>
                      <span className="font-medium text-green-700 dark:text-green-400">
                        ₺{cartTotal.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
                {/* Masada ürün varken yeni ürün eklenirse buton gösterme, sadece ara toplam göster */}
                {cart.length === 0 && (
                  <>
                    {/* Toplam Fiyat ve Ödeme Butonu */}
                    {order && order.items && order.items.length > 0 && (
                      <>
                        {(() => {
                          let totalAmount: number;
                          if (selectedItems.size > 0) {
                            // Seçili ürünlerin toplamı
                            const selectedItemsArray =
                              Array.from(selectedItems);
                            const selectedItemsData = selectedItemsArray
                              .map((index) => order.items[index])
                              .filter(Boolean);
                            const mergedSelectedItems = new Map<
                              string,
                              { quantity: number; subtotal: number }
                            >();
                            selectedItemsData.forEach((item) => {
                              const existing = mergedSelectedItems.get(
                                item.menuId
                              );
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
                            totalAmount = Array.from(
                              mergedSelectedItems.values()
                            ).reduce((sum, { subtotal }) => sum + subtotal, 0);
                          } else {
                            // Tüm ürünlerin toplamı
                            totalAmount = (order.items || []).reduce(
                              (sum, item) => sum + item.subtotal,
                              0
                            );
                          }

                          // Kısmi ödeme durumunda tahsil edilen tutarı hesapla
                          const totalPaidAmount =
                            order.paymentStatus === "partial" && order.payments
                              ? order.payments.reduce(
                                  (sum, payment) => sum + payment.amount,
                                  0
                                )
                              : 0;

                          return (
                            <>
                              {order.paymentStatus === "partial" &&
                                totalPaidAmount > 0 && (
                                  <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-200 dark:border-gray-700">
                                    <span className="text-xs font-medium text-green-600 dark:text-green-400">
                                      Tahsil Edilen:
                                    </span>
                                    <span className="text-sm font-bold text-green-600 dark:text-green-400">
                                      ₺{totalPaidAmount.toFixed(2)}
                                    </span>
                                  </div>
                                )}
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-sm font-medium text-gray-900 dark:text-white">
                                  Toplam:
                                </span>
                                <span className="text-lg font-bold text-gray-900 dark:text-white">
                                  ₺{totalAmount.toFixed(2)}
                                </span>
                              </div>
                            </>
                          );
                        })()}
                        {selectedItems.size > 0 ? (
                          <div className="flex gap-2">
                            <Button
                              onClick={() => {
                                // Seçili ürünlerden aynı üründen birden fazla olan var mı kontrol et
                                const selectedItemsArray =
                                  Array.from(selectedItems);
                                const itemsByMenuId = new Map<
                                  string,
                                  { item: OrderItem; indices: number[] }
                                >();

                                selectedItemsArray.forEach((index) => {
                                  const item = order.items[index];
                                  if (item) {
                                    const existing = itemsByMenuId.get(
                                      item.menuId
                                    );
                                    if (existing) {
                                      existing.indices.push(index);
                                    } else {
                                      itemsByMenuId.set(item.menuId, {
                                        item,
                                        indices: [index],
                                      });
                                    }
                                  }
                                });

                                // Birden fazla farklı ürün seçiliyse, her ürün için sırayla miktar seçim modalı aç
                                if (itemsByMenuId.size > 1) {
                                  // Tüm seçili ürünleri array'e koy
                                  const itemsArray = Array.from(
                                    itemsByMenuId.values()
                                  ).map((item) => {
                                    const totalQuantity = item.indices.reduce(
                                      (sum, idx) => {
                                        const orderItem = order.items[idx];
                                        return orderItem
                                          ? sum + orderItem.quantity
                                          : sum;
                                      },
                                      0
                                    );
                                    return {
                                      menuId: item.item.menuId,
                                      menuName: item.item.menuName,
                                      totalQuantity: totalQuantity,
                                      indices: item.indices,
                                    };
                                  });

                                  // İlk ürün için miktar seçim modalı aç
                                  setPendingCancelItems(itemsArray);
                                  setCurrentCancelItemIndex(0);
                                  setSelectedItemForQuantity(itemsArray[0]);
                                  setSelectedQuantity(1);
                                  setQuantitySelectionAction("cancel");
                                  setShowQuantitySelectionModal(true);
                                  return;
                                }

                                // Sadece tek bir ürün seçiliyse ve o ürünün toplam adedi > 1 ise miktar seçim modalı aç
                                if (itemsByMenuId.size === 1) {
                                  const singleItem = Array.from(
                                    itemsByMenuId.values()
                                  )[0];
                                  const totalQuantity =
                                    singleItem.indices.reduce((sum, idx) => {
                                      const item = order.items[idx];
                                      return item ? sum + item.quantity : sum;
                                    }, 0);

                                  if (totalQuantity > 1) {
                                    setSelectedItemForQuantity({
                                      menuId: singleItem.item.menuId,
                                      menuName: singleItem.item.menuName,
                                      totalQuantity: totalQuantity,
                                      indices: singleItem.indices,
                                    });
                                    setSelectedQuantity(1);
                                    setQuantitySelectionAction("cancel");
                                    setShowQuantitySelectionModal(true);
                                    return;
                                  }
                                }

                                // Tek adet veya farklı ürünler, direkt iptal et
                                handleCancelSelectedItems();
                              }}
                              disabled={isCanceling}
                              className="flex-1 h-12 text-base font-medium bg-red-600 hover:bg-red-700 text-white dark:text-white"
                            >
                              {isCanceling ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  İptal Ediliyor...
                                </>
                              ) : (
                                <>
                                  <X className="h-4 w-4 mr-2" />
                                  İptal
                                </>
                              )}
                            </Button>
                            <Button
                              onClick={() => {
                                // Seçili ürünlerden aynı üründen birden fazla olan var mı kontrol et
                                const selectedItemsArray =
                                  Array.from(selectedItems);
                                const itemsByMenuId = new Map<
                                  string,
                                  { item: OrderItem; indices: number[] }
                                >();

                                selectedItemsArray.forEach((index) => {
                                  const item = order.items[index];
                                  if (item) {
                                    const existing = itemsByMenuId.get(
                                      item.menuId
                                    );
                                    if (existing) {
                                      existing.indices.push(index);
                                    } else {
                                      itemsByMenuId.set(item.menuId, {
                                        item,
                                        indices: [index],
                                      });
                                    }
                                  }
                                });

                                // Birden fazla farklı ürün seçiliyse, her ürün için sırayla miktar seçim modalı aç
                                if (itemsByMenuId.size > 1) {
                                  // Tüm seçili ürünleri array'e koy
                                  const itemsArray = Array.from(
                                    itemsByMenuId.values()
                                  ).map((item) => {
                                    const totalQuantity = item.indices.reduce(
                                      (sum, idx) => {
                                        const orderItem = order.items[idx];
                                        return orderItem
                                          ? sum + orderItem.quantity
                                          : sum;
                                      },
                                      0
                                    );
                                    return {
                                      menuId: item.item.menuId,
                                      menuName: item.item.menuName,
                                      totalQuantity: totalQuantity,
                                      indices: item.indices,
                                    };
                                  });

                                  // İlk ürün için miktar seçim modalı aç
                                  setPendingMoveItems(itemsArray);
                                  setCurrentMoveItemIndex(0);
                                  setSelectedItemForQuantity(itemsArray[0]);
                                  setSelectedQuantity(1);
                                  setQuantitySelectionAction("move");
                                  setShowQuantitySelectionModal(true);
                                  return;
                                }

                                // Sadece tek bir ürün seçiliyse ve o ürünün toplam adedi > 1 ise miktar seçim modalı aç
                                if (itemsByMenuId.size === 1) {
                                  const singleItem = Array.from(
                                    itemsByMenuId.values()
                                  )[0];
                                  const totalQuantity =
                                    singleItem.indices.reduce((sum, idx) => {
                                      const item = order.items[idx];
                                      return item ? sum + item.quantity : sum;
                                    }, 0);

                                  if (totalQuantity > 1) {
                                    setSelectedItemForQuantity({
                                      menuId: singleItem.item.menuId,
                                      menuName: singleItem.item.menuName,
                                      totalQuantity: totalQuantity,
                                      indices: singleItem.indices,
                                    });
                                    setSelectedQuantity(1);
                                    setQuantitySelectionAction("move");
                                    setShowQuantitySelectionModal(true);
                                    return;
                                  }
                                }

                                // Tek adet veya farklı ürünler, direkt taşı modalını aç
                                setShowMoveModal(true);
                              }}
                              className="flex-1 h-12 text-base font-medium bg-blue-600 hover:bg-blue-700 text-white dark:text-white"
                            >
                              <ArrowLeft className="h-4 w-4 mr-2" />
                              Taşı
                            </Button>
                          </div>
                        ) : (
                          <div className="flex gap-2 w-full">
                            <Button
                              onClick={async () => {
                                const defaultPrinter = getDefaultPrinter(printers, selectedPrinterId);
                                if (!defaultPrinter) {
                                  customAlert("Varsayılan yazıcı bulunamadı.\nLütfen yazıcı ayarlarından varsayılan yazıcı seçin.", "Uyarı", "warning");
                                  return;
                                }

                                if (!order) {
                                  customAlert("Henüz sipariş bulunmuyor.", "Uyarı", "warning");
                                  return;
                                }

                                try {
                                  // Tüm ürünleri birleştir: mevcut + iptal + ödeme alınan
                                  const allItems: OrderItem[] = [];
                                  
                                  // 1. Aktif sipariş listesindeki mevcut ürünleri ekle
                                  if (order.items && order.items.length > 0) {
                                    const activeItems = order.items.filter(item => 
                                      !order.canceledItems?.some(canceled => canceled.menuId === item.menuId) &&
                                      !order.payments?.some(payment => 
                                        payment.paidItems?.some(paid => paid.menuId === item.menuId)
                                      )
                                    );
                                    allItems.push(...activeItems);
                                  }

                                  // 2. İptal edilen ürünleri ekle
                                  if (order.canceledItems && order.canceledItems.length > 0) {
                                    const canceledOrderItems: OrderItem[] = order.canceledItems.map(canceled => ({
                                      menuId: canceled.menuId,
                                      menuName: canceled.menuName,
                                      quantity: canceled.quantity,
                                      menuPrice: canceled.subtotal / canceled.quantity,
                                      subtotal: canceled.subtotal,
                                      notes: canceled.notes || "",
                                      selectedExtras: canceled.selectedExtras || [],
                                    }));
                                    allItems.push(...canceledOrderItems);
                                  }

                                  // 3. Ödemesi alınan ürünleri ekle
                                  if (order.payments && order.payments.length > 0) {
                                    for (const payment of order.payments) {
                                      if (payment.paidItems && payment.paidItems.length > 0) {
                                        const paidOrderItems: OrderItem[] = payment.paidItems.map(paid => ({
                                          menuId: paid.menuId,
                                          menuName: paid.menuName,
                                          quantity: paid.quantity,
                                          menuPrice: paid.subtotal / paid.quantity,
                                          subtotal: paid.subtotal,
                                          notes: "",
                                          selectedExtras: [],
                                        }));
                                        allItems.push(...paidOrderItems);
                                      }
                                    }
                                  }

                                  // Tüm ürünleri tek bir çıktıda yazdır
                                  if (allItems.length > 0) {
                                    // Toplam tutarı hesapla
                                    const totalAmount = allItems.reduce((sum, item) => sum + item.subtotal, 0);
                                    
                                    const content = formatPrintContent(
                                      "order",
                                      allItems,
                                      currentTable.tableNumber.toString(),
                                      order.id,
                                      {
                                        companyName: companyData?.name || "",
                                        total: totalAmount,
                                      }
                                    );
                                    await printToPrinter(defaultPrinter.name, content, "order");
                                  } else {
                                    customAlert("Yazdırılacak ürün bulunamadı.", "Uyarı", "warning");
                                  }
                                } catch (error) {
                                  customAlert("Yazdırma sırasında bir hata oluştu.", "Hata", "error");
                                }
                              }}
                              variant="outline"
                              disabled={!order}
                              className="h-12 px-6 text-sm font-medium border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Yazdır"
                            >
                              <Printer className="h-4 w-4" />
                            </Button>
                          <Button
                            onClick={() => {
                              // Aynı üründen birden fazla yoksa direkt ödeme modalını aç
                              let remaining: number;
                              // Tam ödeme: Mevcut ürünlerin toplamı (önceki ödemeler zaten kaldırılan ürünler için)
                              remaining = (order.items || []).reduce(
                                (sum, item) => sum + item.subtotal,
                                0
                              );
                              // Tam ekran ödeme ekranını aç
                              setPaymentScreenAmount(
                                remaining > 0 ? remaining.toFixed(2) : ""
                              );
                              setPaymentScreenDiscountType("percentage");
                              setPaymentScreenDiscountValue("");
                              setPaymentScreenManualDiscount("");
                              setPaymentScreenSelectedItems(new Set());
                              setPaymentScreenSelectedQuantities(new Map());
                              setPaymentMethod(""); // Ödeme yöntemini temizle
                              setShowFullScreenPayment(true);
                            }}
                              className="flex-1 h-12 text-base font-medium bg-green-600 hover:bg-green-700 text-white dark:text-white"
                          >
                            <CreditCard className="h-4 w-4 mr-2" />
                            Ödeme Al
                          </Button>
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
              </>
            ) : null}

            {/* Buton Alanı - Desktop (Sabit) */}
            {cart.length > 0 && (
                <Button
                  onClick={handleSendOrder}
                  disabled={cart.length === 0 || isSendingOrder}
                className="w-full h-12 text-base font-medium bg-green-600 hover:bg-green-700 text-white dark:text-white"
                >
                  {isSendingOrder ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Gönderiliyor...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Gönder
                    </>
                  )}
                </Button>
            )}
          </div>
        </div>

        {/* Cart Bottom Sheet - Mobile */}
        {showCart && (
          <div className="lg:hidden fixed inset-0 z-50">
            {/* Overlay */}
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setShowCart(false)}
            />

            {/* Cart Sheet */}
            <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-800 rounded-t-2xl shadow-2xl h-[85vh] flex flex-col relative overflow-hidden">
              {/* Detay Paneli - Sağdan Kayarak (Mobile) */}
              <div
                className={`absolute inset-0 bg-white dark:bg-gray-800 transform transition-transform duration-300 ease-in-out z-10 flex flex-col ${
                  false ? "translate-x-0" : "translate-x-full"
                }`}
              >
                <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
                  <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <ArrowLeft className="h-4 w-4 cursor-pointer" />
                    Sipariş Detayları
                  </h2>
                </div>
                <div className="flex-1 overflow-y-auto p-3">
                  <div className="space-y-3">
                    {/* Ödeme Geçmişi */}
                    {order && order.payments && order.payments.length > 0 && (
                      <div className="mb-4">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">
                          Ödeme Geçmişi
                        </h3>
                        <div className="space-y-2">
                          {order.payments.map((payment, paymentIndex) => (
                            <div
                              key={paymentIndex}
                              className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-blue-900 dark:text-blue-200">
                                  {paymentMethods.find(
                                    (pm) => pm.code === payment.method
                                  )?.name ||
                                    (payment.method === "cash"
                                      ? "Nakit"
                                      : payment.method === "card"
                                        ? "Kart"
                                        : payment.method === "mealCard"
                                          ? "Yemek Kartı"
                                          : "Diğer")}
                                </span>
                                <span className="text-sm font-bold text-blue-900 dark:text-blue-200">
                                  ₺{payment.amount.toFixed(2)}
                                </span>
                              </div>
                              {payment.paidItems &&
                                payment.paidItems.length > 0 && (
                                  <div className="mt-2 pt-2 border-t border-blue-200 dark:border-blue-800">
                                    <p className="text-xs text-blue-700 dark:text-blue-300 mb-1 font-medium">
                                      Ödenen Ürünler:
                                    </p>
                                    <div className="space-y-1">
                                      {payment.paidItems.map(
                                        (paidItem, itemIndex) => (
                                          <div
                                            key={itemIndex}
                                            className="flex items-center justify-between text-xs"
                                          >
                                            <span className="text-blue-600 dark:text-blue-400">
                                              {paidItem.menuName} x{" "}
                                              {paidItem.quantity}
                                            </span>
                                            <span className="text-blue-700 dark:text-blue-300 font-medium">
                                              ₺{paidItem.subtotal.toFixed(2)}
                                            </span>
                                          </div>
                                        )
                                      )}
                                    </div>
                                  </div>
                                )}
                              <div className="mt-2 pt-2 border-t border-blue-200 dark:border-blue-800">
                                <p className="text-xs text-blue-600 dark:text-blue-400">
                                  {getTimeAgo(payment.paidAt)}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Tüm Güncellemeler - Birleştirilmiş ve Sıralanmış (Mobile) */}
                    {order &&
                      (() => {
                        // Aktif ürünleri işle
                        const groupedItems: { [key: string]: OrderItem[] } = {};
                        order.items.forEach((item) => {
                          const timeKey = item.addedAt
                            ? new Date(item.addedAt).getTime().toString()
                            : "no-time";
                          const key = `${item.menuId}-${timeKey}`;
                          if (!groupedItems[key]) {
                            groupedItems[key] = [];
                          }
                          groupedItems[key].push(item);
                        });

                        const processedItems: Array<{
                          item: OrderItem;
                          addedAt?: Date;
                          type: "active";
                        }> = [];
                        Object.values(groupedItems).forEach((group) => {
                          if (group.length > 0) {
                            const firstItem = group[0];
                            if (group.length > 1) {
                              const totalQuantity = group.reduce(
                                (sum, item) => sum + item.quantity,
                                0
                              );
                              const totalSubtotal = group.reduce(
                                (sum, item) => sum + item.subtotal,
                                0
                              );
                              const combinedNotes = group
                                .map((item) => item.notes)
                                .filter(Boolean)
                                .join(", ");
                              processedItems.push({
                                item: {
                                  ...firstItem,
                                  quantity: totalQuantity,
                                  subtotal: totalSubtotal,
                                  notes: combinedNotes || undefined,
                                  // movedFromTableNumber ve movedAt bilgilerini koru
                                  movedFromTableId: firstItem.movedFromTableId,
                                  movedFromTableNumber:
                                    firstItem.movedFromTableNumber,
                                  movedAt: firstItem.movedAt,
                                },
                                addedAt: firstItem.addedAt,
                                type: "active",
                              });
                            } else {
                              processedItems.push({
                                item: firstItem,
                                addedAt: firstItem.addedAt,
                                type: "active",
                              });
                            }
                          }
                        });

                        // İptal edilen ürünleri işle - Her birini ayrı göster (orijinal miktarını hesapla)
                        const processedCanceledItems: Array<{
                          item: OrderItem;
                          addedAt?: Date;
                          canceledAt?: Date;
                          originalQuantity?: number; // Orijinal eklenme miktarı
                          type: "canceled";
                        }> = [];
                        if (order.canceledItems) {
                          order.canceledItems.forEach((canceledItem) => {
                            // Aynı menuId ve aynı addedAt zamanına sahip tüm ürünleri bul (aktif + iptal edilen)
                            const itemAddedAt = canceledItem.addedAt
                              ? new Date(canceledItem.addedAt).getTime()
                              : null;

                            let originalQuantity = canceledItem.quantity;

                            if (itemAddedAt) {
                              // Aktif ürünlerden aynı zamanda eklenenleri bul
                              const sameTimeActiveItems = order.items.filter(
                                (activeItem) => {
                                  if (activeItem.menuId !== canceledItem.menuId)
                                    return false;
                                  const activeAddedAt = activeItem.addedAt
                                    ? new Date(activeItem.addedAt).getTime()
                                    : null;
                                  // Zaman farkı 1 saniyeden az ise aynı kabul et (milisaniye farkları için)
                                  if (!activeAddedAt) return false;
                                  return (
                                    Math.abs(activeAddedAt - itemAddedAt) < 1000
                                  );
                                }
                              );

                              // İptal edilen ürünlerden aynı zamanda eklenenleri bul
                              const sameTimeCanceledItems = (
                                order.canceledItems || []
                              ).filter((ci) => {
                                if (ci.menuId !== canceledItem.menuId)
                                  return false;
                                const ciAddedAt = ci.addedAt
                                  ? new Date(ci.addedAt).getTime()
                                  : null;
                                // Zaman farkı 1 saniyeden az ise aynı kabul et (milisaniye farkları için)
                                if (!ciAddedAt) return false;
                                return Math.abs(ciAddedAt - itemAddedAt) < 1000;
                              });

                              // Toplam orijinal miktarı hesapla
                              const activeQuantity = sameTimeActiveItems.reduce(
                                (sum, item) => sum + item.quantity,
                                0
                              );
                              const canceledQuantity =
                                sameTimeCanceledItems.reduce(
                                  (sum, item) => sum + item.quantity,
                                  0
                                );
                              originalQuantity =
                                activeQuantity + canceledQuantity;
                            }

                            processedCanceledItems.push({
                              item: canceledItem,
                              addedAt: canceledItem.addedAt,
                              canceledAt: canceledItem.canceledAt,
                              originalQuantity: originalQuantity,
                              type: "canceled",
                            });
                          });
                        }

                        // Taşınan ürünleri işle - Sadece menuId + movedToTableId'ye göre grupla
                        const groupedMovedItems: {
                          [key: string]: OrderItem[];
                        } = {};
                        if (order.movedItems) {
                          order.movedItems.forEach((item) => {
                            // Aynı ürün aynı masaya taşınmışsa birleştir (movedAt'e bakmadan)
                            const key = `${item.menuId}-${item.movedToTableId || "no-table"}`;
                            if (!groupedMovedItems[key]) {
                              groupedMovedItems[key] = [];
                            }
                            groupedMovedItems[key].push(item);
                          });
                        }

                        const processedMovedItems: Array<{
                          item: OrderItem;
                          addedAt?: Date;
                          movedAt?: Date;
                          movedToTableId?: string;
                          movedToTableNumber?: string;
                          movedFromTableId?: string;
                          movedFromTableNumber?: string;
                          type: "moved";
                        }> = [];
                        Object.values(groupedMovedItems).forEach((group) => {
                          if (group.length > 0) {
                            const firstItem = group[0];
                            const totalQuantity = group.reduce(
                              (sum, item) => sum + item.quantity,
                              0
                            );
                            const totalSubtotal = group.reduce(
                              (sum, item) => sum + item.subtotal,
                              0
                            );
                            const latestMovedAt = group.reduce<
                              Date | undefined
                            >((latest, item) => {
                              if (!item.movedAt) return latest;
                              if (!latest) return item.movedAt;
                              return new Date(item.movedAt) > new Date(latest)
                                ? item.movedAt
                                : latest;
                            }, firstItem.movedAt);
                            const earliestAddedAt = group.reduce<
                              Date | undefined
                            >((earliest, item) => {
                              if (!item.addedAt) return earliest;
                              if (!earliest) return item.addedAt;
                              return new Date(item.addedAt) < new Date(earliest)
                                ? item.addedAt
                                : earliest;
                            }, firstItem.addedAt);

                            processedMovedItems.push({
                              item: {
                                ...firstItem,
                                quantity: totalQuantity,
                                subtotal: totalSubtotal,
                                movedAt: latestMovedAt,
                              },
                              addedAt: earliestAddedAt,
                              movedAt: latestMovedAt,
                              movedToTableId: firstItem.movedToTableId,
                              movedToTableNumber: firstItem.movedToTableNumber,
                              movedFromTableId: firstItem.movedFromTableId,
                              movedFromTableNumber:
                                firstItem.movedFromTableNumber,
                              type: "moved",
                            });
                          }
                        });

                        // Tüm güncellemeleri birleştir ve en yeni olanları en üstte sırala
                        type UpdateItem =
                          | { item: OrderItem; addedAt?: Date; type: "active" }
                          | {
                              item: OrderItem;
                              addedAt?: Date;
                              canceledAt?: Date;
                              originalQuantity?: number;
                              type: "canceled";
                            }
                          | {
                              item: OrderItem;
                              addedAt?: Date;
                              movedAt?: Date;
                              movedToTableId?: string;
                              movedToTableNumber?: string;
                              movedFromTableId?: string;
                              movedFromTableNumber?: string;
                              type: "moved";
                            };

                        const allUpdates: UpdateItem[] = [
                          ...processedItems,
                          ...processedCanceledItems,
                          ...processedMovedItems,
                        ];

                        // En yeni güncellemeye göre sırala
                        allUpdates.sort((a, b) => {
                          let aTime: Date | undefined;
                          let bTime: Date | undefined;

                          if (a.type === "active") {
                            aTime = a.addedAt;
                          } else if (a.type === "canceled") {
                            aTime = a.canceledAt || a.addedAt;
                          } else if (a.type === "moved") {
                            aTime = a.movedAt || a.addedAt;
                          }

                          if (b.type === "active") {
                            bTime = b.addedAt;
                          } else if (b.type === "canceled") {
                            bTime = b.canceledAt || b.addedAt;
                          } else if (b.type === "moved") {
                            bTime = b.movedAt || b.addedAt;
                          }

                          if (!aTime && !bTime) return 0;
                          if (!aTime) return 1;
                          if (!bTime) return -1;
                          return (
                            new Date(bTime).getTime() -
                            new Date(aTime).getTime()
                          );
                        });

                        return (
                          <div className="space-y-3">
                            {allUpdates.map((update, index) => {
                              const item = update.item;
                              if (update.type === "active") {
                                return (
                                  <div
                                    key={`active-${item.menuId}-${update.addedAt?.getTime() || index}`}
                                    className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 border border-gray-200 dark:border-gray-600"
                                  >
                                    <div className="flex items-start justify-between mb-2">
                                      <div className="flex-1">
                                        <h4 className="font-medium text-sm text-gray-900 dark:text-white">
                                          {item.menuName}
                                        </h4>
                                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                          {item.quantity} adet • ₺
                                          {item.menuPrice.toFixed(2)} birim
                                          fiyat
                                        </p>
                                      </div>
                                      <span className="font-bold text-sm text-gray-900 dark:text-white">
                                        ₺{item.subtotal.toFixed(2)}
                                      </span>
                                    </div>
                                    {item.movedFromTableNumber ||
                                    item.movedFromTableId ? (
                                      <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 pt-2 border-t border-gray-200 dark:border-gray-600">
                                        <ArrowRight className="h-3 w-3" />
                                        <span>
                                          {item.movedAt
                                            ? getTimeAgo(item.movedAt)
                                            : update.addedAt
                                              ? getTimeAgo(update.addedAt)
                                              : ""}{" "}
                                          Masa{" "}
                                          {item.movedFromTableNumber ||
                                            "Bilinmeyen"}
                                          'den Masa {currentTable.tableNumber}
                                          'ye taşındı
                                        </span>
                                      </div>
                                    ) : update.addedAt ? (
                                      <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-600">
                                        <Clock className="h-3 w-3" />
                                        <span>
                                          {getTimeAgo(update.addedAt)} eklendi
                                        </span>
                                      </div>
                                    ) : null}
                                    {item.notes && (
                                      <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                                        <p className="text-xs text-gray-600 dark:text-gray-400 italic">
                                          Not: {item.notes}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                );
                              } else if (update.type === "canceled") {
                                const displayQuantity =
                                  update.originalQuantity || item.quantity;
                                return (
                                  <div
                                    key={`canceled-${item.menuId}-${update.addedAt?.getTime() || index}`}
                                    className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 border border-red-200 dark:border-red-800 opacity-75"
                                  >
                                    <div className="flex items-start justify-between mb-2">
                                      <div className="flex-1">
                                        <h4 className="font-medium text-sm text-red-900 dark:text-red-200 line-through">
                                          {item.menuName}
                                        </h4>
                                        <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                                          {item.quantity} adet • ₺
                                          {item.menuPrice.toFixed(2)} birim
                                          fiyat
                                        </p>
                                      </div>
                                      <span className="font-bold text-sm text-red-900 dark:text-red-200 line-through">
                                        ₺{item.subtotal.toFixed(2)}
                                      </span>
                                    </div>
                                    <div className="flex flex-col gap-1 text-xs text-red-600 dark:text-red-400 pt-2 border-t border-red-200 dark:border-red-800">
                                      {update.addedAt && (
                                        <div className="flex items-center gap-1">
                                          <Clock className="h-3 w-3" />
                                          <span>
                                            {getTimeAgo(update.addedAt)}{" "}
                                            {displayQuantity} adet eklendi
                                          </span>
                                        </div>
                                      )}
                                      {update.canceledAt && (
                                        <div className="flex items-center gap-1">
                                          <Clock className="h-3 w-3" />
                                          <span>
                                            {getTimeAgo(update.canceledAt)}{" "}
                                            iptal edildi
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              } else if (update.type === "moved") {
                                return (
                                  <div
                                    key={`moved-${item.menuId}-${update.movedToTableId || "no-table"}`}
                                    className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800 opacity-75"
                                  >
                                    <div className="flex items-start justify-between mb-2">
                                      <div className="flex-1">
                                        <h4 className="font-medium text-sm text-blue-900 dark:text-blue-200">
                                          {item.menuName}
                                        </h4>
                                        <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                                          {item.quantity} adet • ₺
                                          {item.menuPrice.toFixed(2)} birim
                                          fiyat
                                        </p>
                                      </div>
                                      <span className="font-bold text-sm text-blue-900 dark:text-blue-200">
                                        ₺{item.subtotal.toFixed(2)}
                                      </span>
                                    </div>
                                    <div className="flex flex-col gap-1 text-xs text-blue-600 dark:text-blue-400 pt-2 border-t border-blue-200 dark:border-blue-800">
                                      {update.addedAt && (
                                        <div className="flex items-center gap-1">
                                          <Clock className="h-3 w-3" />
                                          <span>
                                            {getTimeAgo(update.addedAt)} eklendi
                                          </span>
                                        </div>
                                      )}
                                      {update.movedAt && (
                                        <div className="flex items-center gap-1">
                                          <ArrowRight className="h-3 w-3" />
                                          <span>
                                            {getTimeAgo(update.movedAt)}{" "}
                                            {update.movedFromTableNumber &&
                                            update.movedToTableNumber
                                              ? `Masa ${update.movedFromTableNumber}'den Masa ${update.movedToTableNumber}'ye taşındı`
                                              : update.movedFromTableNumber
                                                ? `Masa ${update.movedFromTableNumber}'den taşındı`
                                                : update.movedToTableNumber
                                                  ? `Masa ${update.movedToTableNumber}'ye taşındı`
                                                  : "taşındı"}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            })}
                          </div>
                        );
                      })()}
                  </div>
                </div>
              </div>

              {/* Ödeme Paneli - Aşağıdan Yukarıya Kayarak (Mobile) */}
              {order &&
                order.items &&
                order.items.length > 0 &&
                (() => {
                  // Eğer seçili ürünler varsa sadece onların toplamını hesapla
                  let remaining: number;
                  if (selectedItems.size > 0) {
                    const selectedItemsArray = Array.from(selectedItems);
                    const selectedItemsData = selectedItemsArray
                      .map((index) => order.items[index])
                      .filter(Boolean);

                    // Seçili ürünleri menuId'ye göre birleştir
                    const mergedSelectedItems = new Map<
                      string,
                      { quantity: number; subtotal: number }
                    >();
                    selectedItemsData.forEach((item) => {
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

                    remaining = Array.from(mergedSelectedItems.values()).reduce(
                      (sum, { subtotal }) => sum + subtotal,
                      0
                    );
                  } else {
                    // Tam ödeme: Mevcut ürünlerin toplamı (önceki ödemeler zaten kaldırılan ürünler için)
                    remaining = (order.items || []).reduce(
                      (sum, item) => sum + item.subtotal,
                      0
                    );
                  }

                  const calculateDiscount = () => {
                    if (discountType === "percentage" && discountValue) {
                      const percentage = parseFloat(discountValue);
                      return (remaining * percentage) / 100;
                    } else if (discountType === "amount" && discountValue) {
                      return parseFloat(discountValue);
                    } else if (discountType === "manual" && manualDiscount) {
                      return parseFloat(manualDiscount);
                    }
                    return 0;
                  };
                  const discount = calculateDiscount();
                  // const finalAmount = Math.max(0, remaining - discount);

                  return (
                    <div
                      className={`absolute inset-0 bg-white dark:bg-gray-800 transform transition-transform duration-300 ease-in-out z-10 flex flex-col ${
                        showPaymentModal ? "translate-y-0" : "translate-y-full"
                      }`}
                    >
                      <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
                        <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                          <ArrowLeft
                            className="h-4 w-4 cursor-pointer"
                            onClick={() => {
                              setShowPaymentModal(false);
                              setPaymentAmount("");
                              setDiscountType("percentage");
                              setDiscountValue("");
                              setManualDiscount("");
                            }}
                          />
                          Ödeme Al
                        </h2>
                      </div>
                      <div className="flex-1 overflow-y-auto p-3">
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              İndirim
                            </label>
                            <div className="space-y-3">
                              {/* İndirim Türü Seçimi */}
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  variant={
                                    discountType === "percentage"
                                      ? "default"
                                      : "outline"
                                  }
                                  onClick={() => {
                                    setDiscountType("percentage");
                                    setDiscountValue("");
                                    setManualDiscount("");
                                    setPaymentAmount(remaining.toFixed(2));
                                  }}
                                  className="flex-1 text-xs"
                                >
                                  Oran
                                </Button>
                                <Button
                                  type="button"
                                  variant={
                                    discountType === "amount"
                                      ? "default"
                                      : "outline"
                                  }
                                  onClick={() => {
                                    setDiscountType("amount");
                                    setDiscountValue("");
                                    setManualDiscount("");
                                    setPaymentAmount(remaining.toFixed(2));
                                  }}
                                  className="flex-1 text-xs"
                                >
                                  Fiyat
                                </Button>
                                <Button
                                  type="button"
                                  variant={
                                    discountType === "manual"
                                      ? "default"
                                      : "outline"
                                  }
                                  onClick={() => {
                                    setDiscountType("manual");
                                    setDiscountValue("");
                                    setManualDiscount("");
                                    setPaymentAmount(remaining.toFixed(2));
                                  }}
                                  className="flex-1 text-xs"
                                >
                                  Manuel
                                </Button>
                              </div>

                              {/* Oran Bazlı İndirim */}
                              {discountType === "percentage" && (
                                <div>
                                  <div className="flex gap-2 flex-wrap">
                                    {[10, 20, 30, 40, 50].map((percent) => (
                                      <Button
                                        key={percent}
                                        type="button"
                                        variant={
                                          discountValue === percent.toString()
                                            ? "default"
                                            : "outline"
                                        }
                                        onClick={() => {
                                          if (
                                            discountValue === percent.toString()
                                          ) {
                                            setDiscountValue("");
                                            setPaymentAmount(
                                              remaining.toFixed(2)
                                            );
                                          } else {
                                            setDiscountValue(
                                              percent.toString()
                                            );
                                            const discountAmount =
                                              (remaining * percent) / 100;
                                            setPaymentAmount(
                                              Math.max(
                                                0,
                                                remaining - discountAmount
                                              ).toFixed(2)
                                            );
                                          }
                                        }}
                                        className="flex-1 min-w-[60px] text-xs"
                                      >
                                        %{percent}
                                      </Button>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Fiyat Bazlı İndirim */}
                              {discountType === "amount" && (
                                <div>
                                  <div className="flex gap-2 flex-wrap">
                                    {[20, 50, 75, 100].map((amount) => (
                                      <Button
                                        key={amount}
                                        type="button"
                                        variant={
                                          discountValue === amount.toString()
                                            ? "default"
                                            : "outline"
                                        }
                                        onClick={() => {
                                          if (
                                            discountValue === amount.toString()
                                          ) {
                                            setDiscountValue("");
                                            setPaymentAmount(
                                              remaining.toFixed(2)
                                            );
                                          } else {
                                            setDiscountValue(amount.toString());
                                            setPaymentAmount(
                                              Math.max(
                                                0,
                                                remaining - amount
                                              ).toFixed(2)
                                            );
                                          }
                                        }}
                                        className="flex-1 min-w-[60px] text-xs"
                                      >
                                        ₺{amount}
                                      </Button>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Manuel İndirim */}
                              {discountType === "manual" && (
                                <div>
                                  <Input
                                    type="number"
                                    value={manualDiscount}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      setManualDiscount(value);
                                      const discountAmount =
                                        parseFloat(value) || 0;
                                      setPaymentAmount(
                                        Math.max(
                                          0,
                                          remaining - discountAmount
                                        ).toFixed(2)
                                      );
                                    }}
                                    placeholder="İndirim tutarı"
                                    step="0.01"
                                    min="0"
                                    max={remaining}
                                    className="dark:bg-gray-700 dark:text-white dark:border-gray-600"
                                  />
                                </div>
                              )}

                              {/* İndirim Özeti */}
                              <div className="bg-gray-50 dark:bg-gray-700/50 p-2 rounded text-xs">
                                <div className="flex justify-between">
                                  <span className="text-gray-600 dark:text-gray-400">
                                    İndirim:
                                  </span>
                                  <span className="font-medium text-red-600 dark:text-red-400">
                                    -₺{discount.toFixed(2)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Ödeme Tutarı
                            </label>
                            <Input
                              type="number"
                              value={paymentAmount}
                              onChange={(e) => setPaymentAmount(e.target.value)}
                              placeholder="0.00"
                              step="0.01"
                              min="0"
                              max={remaining}
                              className="dark:bg-gray-700 dark:text-white dark:border-gray-600"
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              Kalan: ₺{remaining.toFixed(2)}
                              {discount > 0 && (
                                <span className="text-red-600 dark:text-red-400 ml-2">
                                  (İndirim: -₺{discount.toFixed(2)})
                                </span>
                              )}
                            </p>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Ödeme Yöntemi
                            </label>
                            {paymentMethods.length === 0 ? (
                              <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
                                Ödeme yöntemi bulunamadı
                              </div>
                            ) : (
                              <div className="flex gap-2 flex-wrap">
                                {paymentMethods.map((pm) => (
                                  <Button
                                    key={pm.id}
                                    type="button"
                                    variant={
                                      paymentMethod === pm.code
                                        ? "default"
                                        : "outline"
                                    }
                                    onClick={() => setPaymentMethod(pm.code)}
                                    className={`flex-1 min-w-[100px] h-10 ${
                                      paymentMethod === pm.code
                                        ? "text-white"
                                        : "bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
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
                          </div>
                          <div className="flex gap-2 pt-2">
                            <Button
                              onClick={() => handlePayment()}
                              disabled={isProcessingPayment}
                              className="flex-1 bg-green-600 hover:bg-green-700 text-white dark:text-white"
                            >
                              {isProcessingPayment ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  İşleniyor...
                                </>
                              ) : (
                                <>
                                  <Check className="h-4 w-4 mr-2" />
                                  Onayla
                                </>
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => {
                                setShowPaymentModal(false);
                                setPaymentAmount("");
                                setDiscountType("percentage");
                                setDiscountValue("");
                                setManualDiscount("");
                              }}
                              className="flex-1"
                            >
                              <X className="h-4 w-4 mr-2" />
                              İptal
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

              {/* Normal Görünüm (Mobile) */}
              <div
                className={`flex-1 flex flex-col transition-opacity duration-300 overflow-hidden ${
                  showPaymentModal
                    ? "opacity-0 pointer-events-none"
                    : "opacity-100"
                }`}
              >
                <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
                  <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4" />
                    {order
                      ? "Aktif Sipariş"
                      : `Sipariş (${cart.reduce((sum, item) => sum + item.quantity, 0)})`}
                  </h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowCart(false)}
                      className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 p-1"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-3 min-h-0">
                  {order && order.items.length > 0 ? (
                    // Aktif Sipariş Göster (Mobile) - Aynı ürünleri birleştir
                    <div className="space-y-2">
                      {(() => {
                        // Aynı menuId'ye sahip ürünleri birleştir
                        const mergedItems = new Map<
                          string,
                          { item: OrderItem; indices: number[] }
                        >();
                        order.items.forEach((item, index) => {
                          const existing = mergedItems.get(item.menuId);
                          if (existing) {
                            existing.item.quantity += item.quantity;
                            existing.item.subtotal += item.subtotal;
                            existing.indices.push(index);
                          } else {
                            mergedItems.set(item.menuId, {
                              item: { ...item },
                              indices: [index],
                            });
                          }
                        });

                        return Array.from(mergedItems.values()).map(
                          ({ item, indices }) => {
                            const isSelected = indices.some((idx) =>
                              selectedItems.has(idx)
                            );
                            return (
                              <div
                                key={item.menuId}
                                onClick={() => {
                                  // Tüm index'leri seç/seçimi kaldır
                                  indices.forEach((idx) =>
                                    toggleItemSelection(idx)
                                  );
                                }}
                                className={`rounded-lg p-2 border-2 cursor-pointer transition-all ${
                                  isSelected
                                    ? "border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/30"
                                    : "border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700/50 hover:border-gray-300 dark:hover:border-gray-500"
                                }`}
                              >
                                <div className="flex items-start justify-between mb-1.5">
                                  <div className="flex-1 min-w-0">
                                    <h4
                                      className={`font-medium text-xs truncate ${
                                        isSelected
                                          ? "text-blue-900 dark:text-blue-200"
                                          : "text-gray-900 dark:text-white"
                                      }`}
                                    >
                                      {item.menuName}
                                    </h4>
                                  </div>
                                  <div className="flex flex-col items-end gap-1">
                                    <span
                                      className={`font-bold text-xs ${
                                        isSelected
                                          ? "text-blue-900 dark:text-blue-200"
                                          : "text-gray-900 dark:text-white"
                                      }`}
                                    >
                                      ₺{item.subtotal.toFixed(2)}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                                  {item.addedAt && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      {getTimeAgo(item.addedAt)}
                                    </p>
                                  )}
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {item.quantity} adet
                                  </span>
                                </div>
                              </div>
                            );
                          }
                        );
                      })()}
                    </div>
                  ) : cart.length === 0 ? (
                    <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                      <ShoppingCart className="h-10 w-10 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                      <p className="text-xs">Sepet boş</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {(() => {
                        // Aynı menuId'ye sahip ürünleri birleştir
                        const mergedItems = new Map<
                          string,
                          { item: OrderItem; cartItemIds: string[] }
                        >();
                        cart.forEach((item) => {
                          const existing = mergedItems.get(item.menuId);
                          if (existing) {
                            existing.item.quantity += item.quantity;
                            existing.item.subtotal += item.subtotal;
                            existing.cartItemIds.push(
                              item.cartItemId || item.menuId
                            );
                            // Notları birleştir (varsa)
                            if (item.notes) {
                              if (existing.item.notes) {
                                existing.item.notes = `${existing.item.notes}, ${item.notes}`;
                              } else {
                                existing.item.notes = item.notes;
                              }
                            }
                          } else {
                            mergedItems.set(item.menuId, {
                              item: { ...item },
                              cartItemIds: [item.cartItemId || item.menuId],
                            });
                          }
                        });

                        return Array.from(mergedItems.values()).map(
                          ({ item, cartItemIds }) => {
                            const isNewItem =
                              item.cartItemId &&
                              !item.cartItemId.includes("-old-");

                            return (
                              <div
                                key={item.menuId}
                                className={`rounded-lg p-2 border-2 ${
                                  isNewItem
                                    ? "bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 shadow-sm"
                                    : "bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600"
                                }`}
                              >
                                <div className="flex items-start justify-between mb-1.5">
                                  <div className="flex-1 min-w-0">
                                    <h4 className="font-medium text-gray-900 dark:text-white text-xs truncate">
                                      {item.menuName}
                                    </h4>
                                    <p className="text-xs text-gray-600 dark:text-gray-400">
                                      ₺{item.menuPrice.toFixed(2)} x{" "}
                                      {item.quantity}
                                    </p>
                                  </div>
                                  <button
                                    onClick={() => {
                                      // Tüm cartItemIds'leri sil
                                      cartItemIds.forEach((cartItemId) => {
                                        removeFromCart(cartItemId);
                                      });
                                    }}
                                    className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 p-0.5 flex-shrink-0"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      onClick={() => {
                                        // İlk cartItemId'yi kullan
                                        updateQuantity(cartItemIds[0], -1);
                                      }}
                                      className="w-6 h-6 rounded-full bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-500"
                                    >
                                      <Minus className="h-2.5 w-2.5" />
                                    </button>
                                    <span className="font-semibold w-6 text-center text-xs">
                                      {item.quantity}
                                    </span>
                                    <button
                                      onClick={() => {
                                        // İlk cartItemId'yi kullan
                                        updateQuantity(cartItemIds[0], 1);
                                      }}
                                      className="w-6 h-6 rounded-full bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-500"
                                    >
                                      <Plus className="h-2.5 w-2.5" />
                                    </button>
                                  </div>
                                  <span className="font-bold text-gray-900 dark:text-white text-xs">
                                    ₺{item.subtotal.toFixed(2)}
                                  </span>
                                </div>
                              </div>
                            );
                          }
                        );
                      })()}

                      {/* Gönder Butonu */}
                      {cart.length > 0 && (
                        <Button
                          onClick={handleSendOrder}
                          disabled={cart.length === 0 || isSendingOrder}
                          className="w-full h-10 text-sm font-medium bg-green-600 hover:bg-green-700 text-white dark:text-white mt-2"
                        >
                          {isSendingOrder ? (
                            <>
                              <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                              Gönderiliyor...
                            </>
                          ) : (
                            <>
                              <Send className="h-3 w-3 mr-2" />
                              Gönder
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {order && order.items.length > 0 ? (
                  // Aktif Sipariş İşlemleri (Mobile)
                  <div className="border-t border-gray-200 dark:border-gray-700 p-3 space-y-3 bg-gray-50 dark:bg-gray-700/30 flex-shrink-0">
                    <div className="space-y-2">
                      {/* Sadece yeni eklenen ürünlerin ara toplamı */}
                      {cart.length > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">
                            Ara Toplam:
                          </span>
                          <span className="font-medium text-green-700 dark:text-green-400">
                            ₺{cartTotal.toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>
                    {/* Toplam Fiyat ve Ödeme Butonu */}
                    {order && order.items && order.items.length > 0 && (
                      <>
                        {(() => {
                          let totalAmount: number;
                          if (selectedItems.size > 0) {
                            // Seçili ürünlerin toplamı
                            const selectedItemsArray =
                              Array.from(selectedItems);
                            const selectedItemsData = selectedItemsArray
                              .map((index) => order.items[index])
                              .filter(Boolean);
                            const mergedSelectedItems = new Map<
                              string,
                              { quantity: number; subtotal: number }
                            >();
                            selectedItemsData.forEach((item) => {
                              const existing = mergedSelectedItems.get(
                                item.menuId
                              );
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
                            totalAmount = Array.from(
                              mergedSelectedItems.values()
                            ).reduce((sum, { subtotal }) => sum + subtotal, 0);
                          } else {
                            // Tüm ürünlerin toplamı
                            totalAmount = (order.items || []).reduce(
                              (sum, item) => sum + item.subtotal,
                              0
                            );
                          }

                          return (
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-sm font-medium text-gray-900 dark:text-white">
                                Toplam:
                              </span>
                              <span className="text-lg font-bold text-gray-900 dark:text-white">
                                ₺{totalAmount.toFixed(2)}
                              </span>
                            </div>
                          );
                        })()}
                        {selectedItems.size > 0 ? (
                          <div className="flex gap-2">
                            <Button
                              onClick={() => {
                                // Seçili ürünlerden aynı üründen birden fazla olan var mı kontrol et
                                const selectedItemsArray =
                                  Array.from(selectedItems);
                                const itemsByMenuId = new Map<
                                  string,
                                  { item: OrderItem; indices: number[] }
                                >();

                                selectedItemsArray.forEach((index) => {
                                  const item = order.items[index];
                                  if (item) {
                                    const existing = itemsByMenuId.get(
                                      item.menuId
                                    );
                                    if (existing) {
                                      existing.indices.push(index);
                                    } else {
                                      itemsByMenuId.set(item.menuId, {
                                        item,
                                        indices: [index],
                                      });
                                    }
                                  }
                                });

                                // Birden fazla farklı ürün seçiliyse, her ürün için sırayla miktar seçim modalı aç
                                if (itemsByMenuId.size > 1) {
                                  // Tüm seçili ürünleri array'e koy
                                  const itemsArray = Array.from(
                                    itemsByMenuId.values()
                                  ).map((item) => {
                                    const totalQuantity = item.indices.reduce(
                                      (sum, idx) => {
                                        const orderItem = order.items[idx];
                                        return orderItem
                                          ? sum + orderItem.quantity
                                          : sum;
                                      },
                                      0
                                    );
                                    return {
                                      menuId: item.item.menuId,
                                      menuName: item.item.menuName,
                                      totalQuantity: totalQuantity,
                                      indices: item.indices,
                                    };
                                  });

                                  // İlk ürün için miktar seçim modalı aç
                                  setPendingCancelItems(itemsArray);
                                  setCurrentCancelItemIndex(0);
                                  setSelectedItemForQuantity(itemsArray[0]);
                                  setSelectedQuantity(1);
                                  setQuantitySelectionAction("cancel");
                                  setShowQuantitySelectionModal(true);
                                  return;
                                }

                                // Sadece tek bir ürün seçiliyse ve o ürünün toplam adedi > 1 ise miktar seçim modalı aç
                                if (itemsByMenuId.size === 1) {
                                  const singleItem = Array.from(
                                    itemsByMenuId.values()
                                  )[0];
                                  const totalQuantity =
                                    singleItem.indices.reduce((sum, idx) => {
                                      const item = order.items[idx];
                                      return item ? sum + item.quantity : sum;
                                    }, 0);

                                  if (totalQuantity > 1) {
                                    setSelectedItemForQuantity({
                                      menuId: singleItem.item.menuId,
                                      menuName: singleItem.item.menuName,
                                      totalQuantity: totalQuantity,
                                      indices: singleItem.indices,
                                    });
                                    setSelectedQuantity(1);
                                    setQuantitySelectionAction("cancel");
                                    setShowQuantitySelectionModal(true);
                                    return;
                                  }
                                }

                                // Tek adet veya farklı ürünler, direkt iptal et
                                handleCancelSelectedItems();
                              }}
                              disabled={isCanceling}
                              className="flex-1 h-10 text-sm font-medium bg-red-600 hover:bg-red-700 text-white dark:text-white"
                            >
                              {isCanceling ? (
                                <>
                                  <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                                  İptal Ediliyor...
                                </>
                              ) : (
                                <>
                                  <X className="h-3 w-3 mr-2" />
                                  İptal
                                </>
                              )}
                            </Button>
                            <Button
                              onClick={() => {
                                // Seçili ürünlerden aynı üründen birden fazla olan var mı kontrol et
                                const selectedItemsArray =
                                  Array.from(selectedItems);
                                const itemsByMenuId = new Map<
                                  string,
                                  { item: OrderItem; indices: number[] }
                                >();

                                selectedItemsArray.forEach((index) => {
                                  const item = order.items[index];
                                  if (item) {
                                    const existing = itemsByMenuId.get(
                                      item.menuId
                                    );
                                    if (existing) {
                                      existing.indices.push(index);
                                    } else {
                                      itemsByMenuId.set(item.menuId, {
                                        item,
                                        indices: [index],
                                      });
                                    }
                                  }
                                });

                                // Birden fazla farklı ürün seçiliyse, her ürün için sırayla miktar seçim modalı aç
                                if (itemsByMenuId.size > 1) {
                                  // Tüm seçili ürünleri array'e koy
                                  const itemsArray = Array.from(
                                    itemsByMenuId.values()
                                  ).map((item) => {
                                    const totalQuantity = item.indices.reduce(
                                      (sum, idx) => {
                                        const orderItem = order.items[idx];
                                        return orderItem
                                          ? sum + orderItem.quantity
                                          : sum;
                                      },
                                      0
                                    );
                                    return {
                                      menuId: item.item.menuId,
                                      menuName: item.item.menuName,
                                      totalQuantity: totalQuantity,
                                      indices: item.indices,
                                    };
                                  });

                                  // İlk ürün için miktar seçim modalı aç
                                  setPendingMoveItems(itemsArray);
                                  setCurrentMoveItemIndex(0);
                                  setSelectedItemForQuantity(itemsArray[0]);
                                  setSelectedQuantity(1);
                                  setQuantitySelectionAction("move");
                                  setShowQuantitySelectionModal(true);
                                  return;
                                }

                                // Sadece tek bir ürün seçiliyse ve o ürünün toplam adedi > 1 ise miktar seçim modalı aç
                                if (itemsByMenuId.size === 1) {
                                  const singleItem = Array.from(
                                    itemsByMenuId.values()
                                  )[0];
                                  const totalQuantity =
                                    singleItem.indices.reduce((sum, idx) => {
                                      const item = order.items[idx];
                                      return item ? sum + item.quantity : sum;
                                    }, 0);

                                  if (totalQuantity > 1) {
                                    setSelectedItemForQuantity({
                                      menuId: singleItem.item.menuId,
                                      menuName: singleItem.item.menuName,
                                      totalQuantity: totalQuantity,
                                      indices: singleItem.indices,
                                    });
                                    setSelectedQuantity(1);
                                    setQuantitySelectionAction("move");
                                    setShowQuantitySelectionModal(true);
                                    return;
                                  }
                                }

                                // Tek adet veya farklı ürünler, direkt taşı modalını aç
                                setShowMoveModal(true);
                              }}
                              className="flex-1 h-10 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white dark:text-white"
                            >
                              <ArrowLeft className="h-3 w-3 mr-2" />
                              Taşı
                            </Button>
                          </div>
                        ) : (
                          <Button
                            onClick={() => {
                              // Aynı üründen birden fazla yoksa direkt ödeme modalını aç
                              let remaining: number;
                              // Tam ödeme: Mevcut ürünlerin toplamı (önceki ödemeler zaten kaldırılan ürünler için)
                              remaining = (order.items || []).reduce(
                                (sum, item) => sum + item.subtotal,
                                0
                              );
                              // Tam ekran ödeme ekranını aç
                              setPaymentScreenAmount(
                                remaining > 0 ? remaining.toFixed(2) : ""
                              );
                              setPaymentScreenDiscountType("percentage");
                              setPaymentScreenDiscountValue("");
                              setPaymentScreenManualDiscount("");
                              setPaymentScreenSelectedItems(new Set());
                              setPaymentScreenSelectedQuantities(new Map());
                              setPaymentMethod(""); // Ödeme yöntemini temizle
                              setShowFullScreenPayment(true);
                            }}
                            className="w-full h-10 text-sm font-medium bg-green-600 hover:bg-green-700 text-white dark:text-white"
                          >
                            <CreditCard className="h-3 w-3 mr-2" />
                            Ödeme Al
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {/* Miktar Girme Modalı */}
        {showQuantityModal && selectedMenuForQuantity && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-sm w-full">
              <div className="p-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  Miktar Girin
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {selectedMenuForQuantity.name}
                </p>
                
                {/* Miktar Girişi */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Miktar (örn: 1, 0.5, 2.5)
                  </label>
                  <input
                    type="text"
                    value={quantityInput}
                    onChange={(e) => {
                      // Sadece rakam, virgül ve nokta kabul et
                      const value = e.target.value.replace(/[^0-9.,]/g, "");
                      setQuantityInput(value);
                    }}
                    placeholder="0"
                    className="w-full h-16 px-4 text-3xl font-bold text-center border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none"
                    autoFocus
                  />
                  
                  {/* Hesaplanan Fiyat */}
                  {quantityInput && (
                    <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Toplam Fiyat:
                        </span>
                        <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                          ₺{(
                            (selectedMenuForQuantity.price + 
                              Array.from(selectedExtras)
                                .map(extraId => {
                                  const extra = selectedMenuForQuantity.extras?.find(e => e.id === extraId);
                                  return extra ? extra.price : 0;
                                })
                                .reduce((sum, price) => sum + price, 0)
                            ) * parseFloat(quantityInput.replace(",", ".") || "0")
                          ).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center mt-1 text-xs text-gray-600 dark:text-gray-400">
                        <span>
                          {parseFloat(quantityInput.replace(",", ".") || "0")} × ₺{(selectedMenuForQuantity.price + 
                            Array.from(selectedExtras)
                              .map(extraId => {
                                const extra = selectedMenuForQuantity.extras?.find(e => e.id === extraId);
                                return extra ? extra.price : 0;
                              })
                              .reduce((sum, price) => sum + price, 0)
                          ).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Ekstra Malzemeler */}
                {selectedMenuForQuantity.extras && selectedMenuForQuantity.extras.length > 0 && (
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Ekstra Malzemeler
                    </label>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {selectedMenuForQuantity.extras.map((extra) => {
                        const isSelected = selectedExtras.has(extra.id);
                        const isRequired = extra.isRequired;
                        
                        return (
                          <div
                            key={extra.id}
                            onClick={() => {
                              if (isRequired) return;
                              const newSelected = new Set(selectedExtras);
                              if (isSelected) {
                                newSelected.delete(extra.id);
                              } else {
                                newSelected.add(extra.id);
                              }
                              setSelectedExtras(newSelected);
                            }}
                            className={`flex items-center justify-between p-2 rounded-lg border-2 transition-all cursor-pointer ${
                              isSelected
                                ? "bg-blue-50 dark:bg-blue-900/30 border-blue-500 dark:border-blue-400"
                                : "bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600"
                            } ${isRequired ? "border-orange-300 dark:border-orange-600 cursor-not-allowed" : ""}`}
                          >
                            <div className="flex items-center gap-2 flex-1">
                              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                                isSelected
                                  ? "bg-blue-600 dark:bg-blue-500 border-blue-600 dark:border-blue-500"
                                  : "border-gray-300 dark:border-gray-500"
                              } ${isRequired ? "opacity-50" : ""}`}>
                                {isSelected && (
                                  <Check className="h-2.5 w-2.5 text-white" />
                                )}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium text-gray-900 dark:text-white">
                                    {extra.name}
                                  </span>
                                  {isRequired && (
                                    <span className="text-[10px] px-1 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 rounded">
                                      Zorunlu
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-gray-600 dark:text-gray-400">
                                  +₺{extra.price.toFixed(2)}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Numerik Klavye */}
                <div className="mb-4">
                  <div className="grid grid-cols-3 gap-2">
                    {[7, 8, 9, 4, 5, 6, 1, 2, 3].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setQuantityInput((prev) => prev + num.toString())}
                        className="h-14 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 active:bg-gray-300 dark:active:bg-gray-500 rounded-lg text-2xl font-bold text-gray-900 dark:text-white transition-colors"
                      >
                        {num}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setQuantityInput((prev) => prev + ",")}
                      className="h-14 bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/40 active:bg-blue-300 dark:active:bg-blue-900/50 rounded-lg text-2xl font-bold text-gray-900 dark:text-white transition-colors"
                    >
                      ,
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuantityInput((prev) => prev + "0")}
                      className="h-14 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 active:bg-gray-300 dark:active:bg-gray-500 rounded-lg text-2xl font-bold text-gray-900 dark:text-white transition-colors"
                    >
                      0
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuantityInput((prev) => prev.slice(0, -1))}
                      className="h-14 bg-red-500 hover:bg-red-600 active:bg-red-700 rounded-lg flex items-center justify-center text-white transition-colors"
                    >
                      <Delete className="h-6 w-6" />
                    </button>
                  </div>
                </div>

                {/* Butonlar */}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowQuantityModal(false);
                      setSelectedMenuForQuantity(null);
                      setQuantityInput("");
                      setSelectedExtras(new Set());
                    }}
                    className="flex-1 h-12 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg font-medium text-gray-900 dark:text-white transition-colors"
                  >
                    İptal
                  </button>
                  <button
                    type="button"
                    onClick={handleAddWithQuantity}
                    disabled={!quantityInput || parseFloat(quantityInput.replace(",", ".") || "0") <= 0}
                    className="flex-1 h-12 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Sepete Ekle
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Ürün Not Ekleme Modalı */}
        {showAddNoteModal && selectedMenuForNote && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                {cart.find((item) => item.menuId === selectedMenuForNote.id)
                  ? "Ürün Notu Düzenle"
                  : "Ürün Notu Ekle"}
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Ürün: {selectedMenuForNote.name}
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Not (Opsiyonel)
                  </label>
                  <Textarea
                    ref={itemNoteTextareaRef}
                    value={itemNote}
                    onChange={(e) => setItemNote(e.target.value)}
                    placeholder="Örn: Az baharatlı, ekstra peynir..."
                    className="h-24"
                    showTouchKeyboard={true}
                    showKeyboardButton={true}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      const existingItem = cart.find(
                        (item) => item.menuId === selectedMenuForNote.id
                      );
                      if (existingItem) {
                        // Mevcut item'ı güncelle (not düzenle)
                        setCart((prev) => {
                          return prev.map((item) => {
                            if (item.cartItemId === existingItem.cartItemId) {
                              return {
                                ...item,
                                notes: itemNote || undefined,
                              };
                            }
                            return item;
                          });
                        });
                      } else {
                        // Yeni ürün ekle
                        addToCartWithNote(selectedMenuForNote, itemNote);
                      }
                      setShowAddNoteModal(false);
                      setSelectedMenuForNote(null);
                      setItemNote("");
                    }}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white dark:text-white"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    {cart.find((item) => item.menuId === selectedMenuForNote.id)
                      ? "Kaydet"
                      : "Sepete Ekle"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowAddNoteModal(false);
                      setSelectedMenuForNote(null);
                      setItemNote("");
                    }}
                    className="flex-1"
                  >
                    <X className="h-4 w-4 mr-2" />
                    İptal
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Ekstra Malzeme Seçimi Modalı */}
        {showExtraModal && selectedMenuForExtra && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Ekstra Malzemeler
              </h2>
              <div className="mb-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Ürün: <span className="font-semibold text-gray-900 dark:text-white">{selectedMenuForExtra.name}</span>
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Temel Fiyat: <span className="font-semibold text-blue-600 dark:text-blue-400">₺{selectedMenuForExtra.price.toFixed(2)}</span>
                </p>
              </div>

              {selectedMenuForExtra.extras && selectedMenuForExtra.extras.length > 0 ? (
                <div className="space-y-2 mb-4">
                  {selectedMenuForExtra.extras.map((extra) => {
                    const isSelected = selectedExtras.has(extra.id);
                    const isRequired = extra.isRequired;
                    
                    return (
                      <div
                        key={extra.id}
                        onClick={() => {
                          if (isRequired) return; // Zorunlu ekstralar seçilemez
                          const newSelected = new Set(selectedExtras);
                          if (isSelected) {
                            newSelected.delete(extra.id);
                          } else {
                            newSelected.add(extra.id);
                          }
                          setSelectedExtras(newSelected);
                        }}
                        className={`flex items-center justify-between p-3 rounded-lg border-2 transition-all cursor-pointer ${
                          isSelected
                            ? "bg-blue-50 dark:bg-blue-900/30 border-blue-500 dark:border-blue-400"
                            : "bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600"
                        } ${isRequired ? "border-orange-300 dark:border-orange-600 cursor-not-allowed" : ""}`}
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                            isSelected
                              ? "bg-blue-600 dark:bg-blue-500 border-blue-600 dark:border-blue-500"
                              : "border-gray-300 dark:border-gray-500"
                          } ${isRequired ? "opacity-50" : ""}`}>
                            {isSelected && (
                              <Check className="h-3 w-3 text-white" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-900 dark:text-white">
                                {extra.name}
                              </span>
                              {isRequired && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 rounded">
                                  Zorunlu
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-gray-600 dark:text-gray-400">
                              +₺{extra.price.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Bu ürün için ekstra malzeme bulunmuyor.
                </p>
              )}

              {/* Toplam Fiyat */}
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Toplam:
                  </span>
                  <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                    ₺{(
                      selectedMenuForExtra.price +
                      Array.from(selectedExtras)
                        .map(extraId => {
                          const extra = selectedMenuForExtra.extras?.find(e => e.id === extraId);
                          return extra ? extra.price : 0;
                        })
                        .reduce((sum, price) => sum + price, 0)
                    ).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowExtraModal(false);
                    setSelectedMenuForExtra(null);
                    setSelectedExtras(new Set());
                  }}
                  className="flex-1"
                >
                  <X className="h-4 w-4 mr-2" />
                  İptal
                </Button>
                <Button
                  onClick={handleAddToCartWithExtras}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Check className="h-4 w-4 mr-2" />
                  Sepete Ekle
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Ürün İptal Onay Modalı */}
        {showCancelItemModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
              {cancelItemOptions.length > 0 ? (
                // Aynı üründen birden fazla varsa seçim yapılabilmeli
                <>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                    Ürün İptal Et
                  </h2>
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      <strong>{cancelItemOptions[0].item.menuName}</strong>{" "}
                      ürününden birden fazla var. Hangisini iptal etmek
                      istersiniz?
                    </p>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {cancelItemOptions.map(({ item, index }) => (
                        <button
                          key={index}
                          onClick={async () => {
                            const itemWithIndex = {
                              ...item,
                              id: item.id || `${item.menuId}-${index}`,
                              _index: index,
                            };
                            setSelectedItem(itemWithIndex);
                            setCancelItemOptions([]);
                            setShowCancelItemModal(false);
                            // Direkt iptal et
                            await handleCancelItem();
                          }}
                          className="w-full text-left bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600"
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                Miktar: {item.quantity}
                              </div>
                              <div className="text-xs text-gray-600 dark:text-gray-400">
                                ₺{item.menuPrice.toFixed(2)} x {item.quantity} =
                                ₺{item.subtotal.toFixed(2)}
                              </div>
                            </div>
                            <X className="h-4 w-4 text-red-600 dark:text-red-400" />
                          </div>
                        </button>
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowCancelItemModal(false);
                        setSelectedItem(null);
                        setCancelItemOptions([]);
                      }}
                      className="w-full"
                    >
                      <X className="h-4 w-4 mr-2" />
                      İptal
                    </Button>
                  </div>
                </>
              ) : selectedItem ? (
                // Tek bir ürün varsa normal onay
                <>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                    Ürün İptal Et
                  </h2>
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      <strong>{selectedItem.menuName}</strong> ürününü iptal
                      etmek istediğinize emin misiniz?
                    </p>
                    <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600 dark:text-gray-400">
                          Miktar:
                        </span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {selectedItem.quantity}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">
                          Tutar:
                        </span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          ₺{selectedItem.subtotal.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleCancelItem}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white dark:text-white"
                      >
                        <Check className="h-4 w-4 mr-2" />
                        Onayla
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowCancelItemModal(false);
                          setSelectedItem(null);
                          setCancelItemOptions([]);
                        }}
                        className="flex-1"
                      >
                        <X className="h-4 w-4 mr-2" />
                        İptal
                      </Button>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        )}

        {/* Adet Seçim Modalı */}
        {showQuantitySelectionModal && selectedItemForQuantity && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div
              key={`quantity-modal-${selectedItemForQuantity.menuId}-${
                quantitySelectionAction === "payment"
                  ? currentPaymentItemIndex
                  : quantitySelectionAction === "cancel"
                    ? currentCancelItemIndex
                    : currentMoveItemIndex
              }`}
              className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4"
            >
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                {quantitySelectionAction === "cancel"
                  ? pendingCancelItems.length > 0
                    ? `Ürün İptal Et (${currentCancelItemIndex + 1}/${pendingCancelItems.length})`
                    : "Ürün İptal Et"
                  : quantitySelectionAction === "payment"
                    ? pendingPaymentItems.length > 0
                      ? `Ödeme Al (${currentPaymentItemIndex + 1}/${pendingPaymentItems.length})`
                      : "Ödeme Al"
                    : pendingMoveItems.length > 0
                      ? `Ürün Taşı (${currentMoveItemIndex + 1}/${pendingMoveItems.length})`
                      : "Ürün Taşı"}
              </h2>
              <div className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <strong>{selectedItemForQuantity.menuName}</strong> ürününden
                  toplam{" "}
                  <strong>{selectedItemForQuantity.totalQuantity} adet</strong>{" "}
                  seçili. Kaç adet{" "}
                  {quantitySelectionAction === "cancel"
                    ? "iptal"
                    : quantitySelectionAction === "payment"
                      ? "ödemesini almak"
                      : "taşımak"}{" "}
                  istersiniz?
                </p>

                <div className="flex items-center justify-center gap-4 py-4">
                  <button
                    onClick={() =>
                      setSelectedQuantity(Math.max(1, selectedQuantity - 1))
                    }
                    className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center justify-center font-bold"
                  >
                    <Minus className="h-5 w-5" />
                  </button>
                  <div className="text-3xl font-bold text-gray-900 dark:text-white min-w-[60px] text-center">
                    {selectedQuantity}
                  </div>
                  <button
                    onClick={() =>
                      setSelectedQuantity(
                        Math.min(
                          selectedItemForQuantity.totalQuantity,
                          selectedQuantity + 1
                        )
                      )
                    }
                    className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center justify-center font-bold"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={async () => {
                      if (!order || !selectedItemForQuantity) return;

                      if (quantitySelectionAction === "cancel") {
                        // İptal işlemi - seçilen miktar kadar ürünün iptalini al

                        // Eğer birden fazla ürün için miktar seçiliyorsa, bir sonraki ürün için modal aç
                        if (
                          pendingCancelItems.length > 0 &&
                          currentCancelItemIndex < pendingCancelItems.length - 1
                        ) {
                          // Bu ürünün miktarını kaydet (güncel map'i kullan)
                          const currentItem =
                            pendingCancelItems[currentCancelItemIndex];
                          const updatedQuantities = new Map(
                            selectedCancelQuantities
                          );
                          updatedQuantities.set(
                            currentItem.menuId,
                            selectedQuantity
                          );
                          setSelectedCancelQuantities(updatedQuantities);

                          // Bir sonraki ürün için modal aç
                          const nextIndex = currentCancelItemIndex + 1;
                          setCurrentCancelItemIndex(nextIndex);
                          setSelectedItemForQuantity(
                            pendingCancelItems[nextIndex]
                          );
                          setSelectedQuantity(1);
                          // Modal açık kalacak, sadece içeriği değişecek
                          return;
                        }

                        // Son ürün için miktar seçildi, iptal işlemini yap
                        try {
                          // Tüm seçilen miktarları bir map'te topla (state güncellemesinden önce)
                          const allSelectedQuantities = new Map(
                            selectedCancelQuantities
                          );
                          if (pendingCancelItems.length > 0) {
                            // Son ürünün miktarını da ekle
                            const lastItem =
                              pendingCancelItems[pendingCancelItems.length - 1];
                            allSelectedQuantities.set(
                              lastItem.menuId,
                              selectedQuantity
                            );

                            // State'i güncelle
                            setSelectedCancelQuantities(allSelectedQuantities);
                          }

                          // İptal işlemi - seçilen TÜM ürünlerden, her biri için seçilen miktar kadar iptal et
                          const indicesToCancel = new Set<number>();
                          const itemsToUpdate: Array<{
                            index: number;
                            quantity: number;
                            subtotal: number;
                          }> = [];

                          // Tüm seçili ürünler için işle
                          if (pendingCancelItems.length > 0) {
                            // Tüm ürünler için seçilen miktarları kullan
                            pendingCancelItems.forEach((cancelItem) => {
                              const selectedQty =
                                allSelectedQuantities.get(cancelItem.menuId) ||
                                cancelItem.totalQuantity;
                              let remainingQuantity = selectedQty;

                              for (const index of cancelItem.indices) {
                                if (remainingQuantity <= 0) break;
                                const item = order.items[index];
                                if (!item) continue;

                                const cancelQuantity = Math.min(
                                  remainingQuantity,
                                  item.quantity
                                );
                                if (cancelQuantity <= 0) continue;

                                if (cancelQuantity === item.quantity) {
                                  indicesToCancel.add(index);
                                } else {
                                  const newQuantity =
                                    item.quantity - cancelQuantity;
                                  const newSubtotal =
                                    newQuantity * item.menuPrice;
                                  itemsToUpdate.push({
                                    index,
                                    quantity: newQuantity,
                                    subtotal: newSubtotal,
                                  });
                                }

                                remainingQuantity -= cancelQuantity;
                              }
                            });
                          } else {
                            // Tek ürün seçiliyse
                            let remainingQuantity = selectedQuantity;
                            for (const index of selectedItemForQuantity.indices) {
                              if (remainingQuantity <= 0) break;
                              const item = order.items[index];
                              if (!item) continue;

                              const cancelQuantity = Math.min(
                                remainingQuantity,
                                item.quantity
                              );
                              if (cancelQuantity <= 0) continue;

                              if (cancelQuantity === item.quantity) {
                                indicesToCancel.add(index);
                              } else {
                                const newQuantity =
                                  item.quantity - cancelQuantity;
                                const newSubtotal =
                                  newQuantity * item.menuPrice;
                                itemsToUpdate.push({
                                  index,
                                  quantity: newQuantity,
                                  subtotal: newSubtotal,
                                });
                              }

                              remainingQuantity -= cancelQuantity;
                            }
                          }

                          // İptal edilecek index'leri siparişten çıkar ve canceledItems'a ekle
                          const currentOrder = await getOrder(order.id!);
                          if (!currentOrder) {
                            navigateToHome();
                            return;
                          }

                          // İptal edilen ürünleri topla
                          const canceledItems =
                            currentOrder.canceledItems || [];
                          const itemsToCancel: OrderItem[] = [];

                          const canceledAtTime = new Date();
                          indicesToCancel.forEach((index) => {
                            const item = currentOrder.items[index];
                            if (item) {
                              itemsToCancel.push({
                                ...item,
                                addedAt: item.addedAt || new Date(),
                                canceledAt: canceledAtTime,
                              });
                            }
                          });

                          // Kısmi iptal edilen ürünleri de ekle (quantity güncellemesi yapılanlar)
                          itemsToUpdate.forEach((update) => {
                            const item = currentOrder.items[update.index];
                            if (item) {
                              const canceledQuantity =
                                item.quantity - update.quantity;
                              if (canceledQuantity > 0) {
                                itemsToCancel.push({
                                  ...item,
                                  quantity: canceledQuantity,
                                  subtotal: canceledQuantity * item.menuPrice,
                                  addedAt: item.addedAt || new Date(),
                                  canceledAt: canceledAtTime,
                                });
                              }
                            }
                          });

                          // İptal edilen ürünleri canceledItems'a ekle
                          canceledItems.push(...itemsToCancel);

                          // Önce quantity güncellemelerini yap, sonra iptal edilenleri çıkar
                          let updatedItems = currentOrder.items.map(
                            (it, idx) => {
                              const update = itemsToUpdate.find(
                                (u) => u.index === idx
                              );
                              return update
                                ? {
                                    ...it,
                                    quantity: update.quantity,
                                    subtotal: update.subtotal,
                                  }
                                : it;
                            }
                          );

                          // İptal edilenleri çıkar
                          updatedItems = updatedItems.filter(
                            (_, index) => !indicesToCancel.has(index)
                          );

                          if (updatedItems.length === 0) {
                            // Hiç ürün kalmadıysa siparişi kapat
                            // Önce canceledItems'ı kaydet
                            const subtotal = 0;
                            const total = 0;
                            await updateOrder(order.id!, {
                              items: updatedItems,
                              canceledItems: canceledItems,
                              subtotal: subtotal,
                              total: total,
                            });

                            await updateTableStatus(
                              currentTable.id!,
                              "available",
                              undefined
                            );
                            await updateOrderStatus(order.id!, "closed");
                            const updatedTable = await getTable(
                              currentTable.id!
                            );
                            if (updatedTable) {
                              setCurrentTable(updatedTable);
                            }
                            setOrder(null);
                            setSelectedItems(new Set());
                            setShowQuantitySelectionModal(false);
                            setSelectedItemForQuantity(null);
                            // Ana sayfaya yönlendirme KALDIRILDI - kullanıcı masa sayfasında kalsın
                            return;
                          }

                          // Toplam hesapla ve güncelle
                          const subtotal = updatedItems.reduce(
                            (sum, item) => sum + item.subtotal,
                            0
                          );
                          const total = subtotal - (currentOrder.discount || 0);
                          await updateOrder(order.id!, {
                            items: updatedItems,
                            canceledItems: canceledItems,
                            subtotal: subtotal,
                            total: total,
                          });

                          const finalOrder = await getOrder(order.id!);
                          if (finalOrder) {
                            setOrder(finalOrder);
                          }

                          // Tüm seçili ürünler iptal edildi, seçimi temizle
                          setSelectedItems(new Set());
                          setShowQuantitySelectionModal(false);
                          setSelectedItemForQuantity(null);
                          setSelectedQuantity(1);
                          setQuantitySelectionAction(null);
                          setPendingCancelItems([]);
                          setCurrentCancelItemIndex(0);
                          setSelectedCancelQuantities(new Map());
                          // Ana sayfaya yönlendirme KALDIRILDI - kullanıcı masa sayfasında kalsın
                        } catch (error) {
                          customAlert("Ürünler iptal edilirken bir hata oluştu", "Hata", "error");
                          // Ana sayfaya yönlendirme KALDIRILDI
                        }
                      } else if (quantitySelectionAction === "payment") {
                        // Ödeme işlemi - seçilen miktar kadar ürünün ödemesini al

                        // Eğer birden fazla ürün için miktar seçiliyorsa, bir sonraki ürün için modal aç
                        if (
                          pendingPaymentItems.length > 0 &&
                          currentPaymentItemIndex <
                            pendingPaymentItems.length - 1
                        ) {
                          // Bu ürünün miktarını kaydet (güncel map'i kullan)
                          const currentItem =
                            pendingPaymentItems[currentPaymentItemIndex];
                          const updatedQuantities = new Map(selectedQuantities);
                          updatedQuantities.set(
                            currentItem.menuId,
                            selectedQuantity
                          );
                          setSelectedQuantities(updatedQuantities);

                          // Bir sonraki ürün için modal aç
                          const nextIndex = currentPaymentItemIndex + 1;
                          setCurrentPaymentItemIndex(nextIndex);
                          setSelectedItemForQuantity(
                            pendingPaymentItems[nextIndex]
                          );
                          setSelectedQuantity(1);
                          // Modal açık kalacak, sadece içeriği değişecek
                          return;
                        }

                        // Son ürün için miktar seçildi, ödeme modalını aç
                        setShowQuantitySelectionModal(false);

                        // Tüm seçilen miktarları bir map'te topla (state güncellemesinden önce)
                        const allSelectedQuantities = new Map(
                          selectedQuantities
                        );
                        if (pendingPaymentItems.length > 0) {
                          // Son ürünün miktarını da ekle
                          const lastItem =
                            pendingPaymentItems[pendingPaymentItems.length - 1];
                          allSelectedQuantities.set(
                            lastItem.menuId,
                            selectedQuantity
                          );

                          // State'i güncelle
                          setSelectedQuantities(allSelectedQuantities);

                          // Tüm seçilen miktarları pendingPaymentQuantity'ye kaydet (ilk ürün için)
                          const firstItem = pendingPaymentItems[0];
                          const firstQuantity =
                            allSelectedQuantities.get(firstItem.menuId) ||
                            firstItem.totalQuantity;
                          setPendingPaymentQuantity({
                            menuId: firstItem.menuId,
                            quantity: firstQuantity,
                            indices: firstItem.indices,
                          });
                        } else {
                          // Tek ürün seçiliyse
                          setPendingPaymentQuantity({
                            menuId: selectedItemForQuantity.menuId,
                            quantity: selectedQuantity,
                            indices: selectedItemForQuantity.indices,
                          });
                        }

                        // Ödeme tutarını hesapla (güncel selectedQuantities kullanarak)
                        let paymentTotal = 0;

                        // Tüm seçili ürünler için hesapla
                        if (pendingPaymentItems.length > 0) {
                          // Tüm ürünler için seçilen miktarları kullan (güncel map'ten)
                          pendingPaymentItems.forEach((item) => {
                            const quantity =
                              allSelectedQuantities.get(item.menuId) ||
                              item.totalQuantity;

                            let remainingQty = quantity;
                            item.indices.forEach((index) => {
                              if (remainingQty <= 0) return;
                              const orderItem = order.items[index];
                              if (!orderItem) return;

                              if (orderItem.quantity <= remainingQty) {
                                paymentTotal += orderItem.subtotal;
                                remainingQty -= orderItem.quantity;
                              } else {
                                const partialQty = remainingQty;
                                paymentTotal +=
                                  partialQty * orderItem.menuPrice;
                                remainingQty = 0;
                              }
                            });
                          });
                        } else {
                          // Tek ürün seçiliyse
                          let remainingQuantity = selectedQuantity;
                          for (const index of selectedItemForQuantity.indices) {
                            if (remainingQuantity <= 0) break;
                            const item = order.items[index];
                            if (!item) continue;

                            if (item.quantity <= remainingQuantity) {
                              paymentTotal += item.subtotal;
                              remainingQuantity -= item.quantity;
                            } else {
                              const partialQuantity = remainingQuantity;
                              paymentTotal += partialQuantity * item.menuPrice;
                              remainingQuantity = 0;
                            }
                          }
                        }

                        // Ödeme modalını aç
                        // NOT: Modal state'lerini temizleme, ödeme işlemi tamamlandıktan sonra yapılacak
                        setPaymentAmount(paymentTotal.toFixed(2));
                        setDiscountType("percentage");
                        setDiscountValue("");
                        setManualDiscount("");
                        setShowPaymentModal(true);

                        // Sadece quantity selection modal state'lerini temizle (ödeme modalı açıldı)
                        setSelectedItemForQuantity(null);
                        setSelectedQuantity(1);
                        setQuantitySelectionAction(null);
                      } else if (quantitySelectionAction === "move") {
                        // Taşı işlemi - seçilen miktar kadar ürünün taşınması

                        // Eğer birden fazla ürün için miktar seçiliyorsa, bir sonraki ürün için modal aç
                        if (
                          pendingMoveItems.length > 0 &&
                          currentMoveItemIndex < pendingMoveItems.length - 1
                        ) {
                          // Bu ürünün miktarını kaydet (güncel map'i kullan)
                          const currentItem =
                            pendingMoveItems[currentMoveItemIndex];
                          const updatedQuantities = new Map(
                            selectedMoveQuantities
                          );
                          updatedQuantities.set(
                            currentItem.menuId,
                            selectedQuantity
                          );
                          setSelectedMoveQuantities(updatedQuantities);

                          // Bir sonraki ürün için modal aç
                          const nextIndex = currentMoveItemIndex + 1;
                          setCurrentMoveItemIndex(nextIndex);
                          setSelectedItemForQuantity(
                            pendingMoveItems[nextIndex]
                          );
                          setSelectedQuantity(1);
                          // Modal açık kalacak, sadece içeriği değişecek
                          return;
                        }

                        // Son ürün için miktar seçildi, taşı modalını aç
                        setShowQuantitySelectionModal(false);

                        // Tüm seçilen miktarları bir map'te topla (state güncellemesinden önce)
                        const allSelectedQuantities = new Map(
                          selectedMoveQuantities
                        );
                        if (pendingMoveItems.length > 0) {
                          // Son ürünün miktarını da ekle
                          const lastItem =
                            pendingMoveItems[pendingMoveItems.length - 1];
                          allSelectedQuantities.set(
                            lastItem.menuId,
                            selectedQuantity
                          );

                          // State'i güncelle
                          setSelectedMoveQuantities(allSelectedQuantities);
                        }

                        // Taşı modalını aç (handleMoveSelectedItems içinde seçilen miktarlar kullanılacak)
                        setShowMoveModal(true);

                        // Modal state'lerini temizle
                        setSelectedItemForQuantity(null);
                        setSelectedQuantity(1);
                        setQuantitySelectionAction(null);
                      }

                      setShowQuantitySelectionModal(false);
                      setSelectedItemForQuantity(null);
                      setSelectedQuantity(1);
                      setQuantitySelectionAction(null);
                    }}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white dark:text-white"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Onayla
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowQuantitySelectionModal(false);
                      setSelectedItemForQuantity(null);
                      setSelectedQuantity(1);
                      setQuantitySelectionAction(null);
                    }}
                    className="flex-1"
                  >
                    <X className="h-4 w-4 mr-2" />
                    İptal
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tam Ekran Ödeme Ekranı */}
        {showFullScreenPayment && order && (
          <div className="fixed inset-0 z-50 bg-white dark:bg-gray-900 flex flex-col select-none">
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between flex-shrink-0">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Ödeme Al
              </h2>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    // Masaya dön (ödeme ekranını kapat)
                    setShowFullScreenPayment(false);
                    setPaymentScreenAmount("");
                    setPaymentScreenDiscountType("percentage");
                    setPaymentScreenDiscountValue("");
                    setPaymentScreenManualDiscount("");
                    setPaymentScreenSelectedItems(new Set());
                    setPaymentScreenSelectedQuantities(new Map());
                    setSelectedNumericKey(null);
                    setPaymentScreenQuantityInput("");
                  }}
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Geri Dön
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    // Anasayfaya dön
                    setShowFullScreenPayment(false);
                    setPaymentScreenAmount("");
                    setPaymentScreenDiscountType("percentage");
                    setPaymentScreenDiscountValue("");
                    setPaymentScreenManualDiscount("");
                    setPaymentScreenSelectedItems(new Set());
                    setPaymentScreenSelectedQuantities(new Map());
                    setPaymentScreenQuantityInput("");
                    setSelectedNumericKey(null);
                    navigateToHome();
                  }}
                  className="flex items-center gap-2"
                >
                  <Utensils className="h-4 w-4" />
                  Masalar
                </Button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden flex flex-col">
              {/* Üst Kısım - Ürünler ve Kısmi Ödeme Alanı */}
              <div className="flex-1 overflow-hidden flex border-b border-gray-200 dark:border-gray-700">
                {/* Sol Taraf - Tüm Ürünler */}
                <div className="flex-1 flex flex-col border-r border-gray-200 dark:border-gray-700">
                  <div className="flex-1 overflow-y-auto p-4">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                      Ürünler
                    </h3>
                    <div className="space-y-2">
                      {order.items.map((item, index) => {
                        const itemQuantity = item.quantity;

                        return (
                          <div
                            key={index}
                            onClick={() => {
                              const newSelected = new Set(
                                paymentScreenSelectedItems
                              );
                              const newQuantities = new Map(
                                paymentScreenSelectedQuantities
                              );

                              let quantityToAdd = 0.5;
                              
                              // Miktar girişi varsa onu kullan
                              if (paymentScreenQuantityInput) {
                                // Virgülü noktaya çevir ve parse et
                                const quantityStr = paymentScreenQuantityInput.replace(",", ".");
                                const parsedQuantity = parseFloat(quantityStr);
                                if (!isNaN(parsedQuantity) && parsedQuantity > 0) {
                                  quantityToAdd = parsedQuantity;
                                }
                              } else {
                                // Miktar girişi yoksa akıllı seçim yap
                                if (newSelected.has(index)) {
                                  // Zaten seçiliyse, 1 adet artır
                                  quantityToAdd = 1;
                                  } else {
                                    // Yeni seçiliyorsa
                                    // Eğer ürünün miktarı tam sayı ise, 1 adet seç
                                    // Eğer küsüratlı ise, küsürat kadar seç
                                    const roundedQuantity = Math.round(itemQuantity * 100) / 100;
                                    if (roundedQuantity % 1 === 0) {
                                      // Tam sayı (1, 2, 3, 4, vb.)
                                      quantityToAdd = 1;
                                    } else {
                                      // Küsüratlı sayı (1.5, 1.25, 2.75, vb.)
                                      // Küsüratı bul ve yuvarla (örn: 1.5 → 0.5, 1.25 → 0.25, 0.8799999 → 0.88)
                                      const fractionalPart = roundedQuantity % 1;
                                      quantityToAdd = Math.round(fractionalPart * 100) / 100;
                                    }
                                  }
                              }

                              // Eğer zaten seçiliyse, adetini artır
                              if (newSelected.has(index)) {
                                const currentQty =
                                  newQuantities.get(index) || 0;
                                const roundedCurrentQty = Math.round(currentQty * 100) / 100;
                                const roundedItemQty = Math.round(itemQuantity * 100) / 100;
                                const newQty = Math.min(
                                  roundedCurrentQty + quantityToAdd,
                                  roundedItemQty
                                );
                                // Yuvarlanmış değeri kaydet
                                newQuantities.set(index, Math.round(newQty * 100) / 100);
                              } else {
                                // Yeni seçiliyorsa, seçilen sayı kadar ekle
                                const roundedItemQty = Math.round(itemQuantity * 100) / 100;
                                const finalQty = Math.min(
                                  quantityToAdd,
                                  roundedItemQty
                                );
                                newSelected.add(index);
                                // Yuvarlanmış değeri kaydet
                                newQuantities.set(index, Math.round(finalQty * 100) / 100);
                              }

                              setPaymentScreenSelectedItems(newSelected);
                              setPaymentScreenSelectedQuantities(newQuantities);

                              // Miktar girişini temizle (kullanıldı)
                              setPaymentScreenQuantityInput("");

                              // Seçili ürünlerin toplamını hesapla
                              const selectedTotal = Array.from(
                                newSelected
                              ).reduce((sum, idx) => {
                                const item = order.items[idx];
                                const selectedQty = newQuantities.get(idx) || 1;
                                const actualQty = Math.min(
                                  selectedQty,
                                  item.quantity
                                );
                                return sum + actualQty * item.menuPrice;
                              }, 0);
                              setPaymentScreenAmount(selectedTotal.toFixed(2));
                            }}
                            className="rounded-lg p-3 border-2 cursor-pointer transition-all border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700/50 hover:border-gray-300 dark:hover:border-gray-500"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <h4 className="font-medium text-sm text-gray-900 dark:text-white">
                                  {item.menuName}
                                </h4>
                                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                  {itemQuantity} adet • ₺
                                  {item.menuPrice.toFixed(2)} birim fiyat
                                </p>
                              </div>
                              <span className="font-bold text-lg text-gray-900 dark:text-white">
                                ₺{item.subtotal.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Tüm Ürünler Toplamı */}
                  <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700/50 min-h-[80px] flex items-center">
                    <div className="space-y-1 w-full">
                      <div className="flex justify-between items-center gap-4">
                        {/* Miktar Göstergesi */}
                        <div className="flex items-center gap-3">
                          <div className="px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg border-2 border-gray-300 dark:border-gray-600 flex items-center gap-3 min-w-[200px]">
                            <div className="flex-1">
                              <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                                Miktar
                              </div>
                              <div className="text-xl font-bold text-gray-900 dark:text-white">
                                {paymentScreenQuantityInput || "0"}
                              </div>
                            </div>
                            {/* C (Temizle) Tuşu */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                // Tümünü temizle
                                setPaymentScreenQuantityInput("");
                              }}
                              className="h-8 w-8 p-0"
                            >
                              C
                            </Button>
                          </div>
                        </div>
                        {/* Toplam / Alınacak Ödeme */}
                        <div className="flex justify-end items-center gap-2">
                          <span className={`text-sm font-medium ${
                            paymentScreenSelectedItems.size === 0 
                              ? "text-green-600 dark:text-green-400" 
                              : "text-gray-700 dark:text-gray-300"
                          }`}>
                            {paymentScreenSelectedItems.size === 0 ? "Alınacak Ödeme" : "Toplam"}
                          </span>
                          <span className="text-xl font-bold text-gray-900 dark:text-white">
                            ₺
                            {order.items
                              .reduce((sum, item) => sum + item.subtotal, 0)
                              .toFixed(2)}
                          </span>
                        </div>
                      </div>
                      {(() => {
                        const baseAmount = order.items.reduce(
                          (sum, item) => sum + item.subtotal,
                          0
                        );

                        let discountAmount = 0;
                        if (
                          paymentScreenDiscountType === "percentage" &&
                          paymentScreenDiscountValue
                        ) {
                          discountAmount =
                            (baseAmount *
                              parseFloat(paymentScreenDiscountValue)) /
                            100;
                        } else if (
                          paymentScreenDiscountType === "amount" &&
                          paymentScreenDiscountValue
                        ) {
                          discountAmount = parseFloat(
                            paymentScreenDiscountValue
                          );
                        }

                        const finalAmount = Math.max(
                          0,
                          baseAmount - discountAmount
                        );

                        return discountAmount > 0 ? (
                          <div className="text-xs text-gray-600 dark:text-gray-400 flex justify-end">
                            <div>
                              <div className="line-through">
                                ₺{baseAmount.toFixed(2)}
                              </div>
                              <div className="text-red-600 dark:text-red-400">
                                -₺{discountAmount.toFixed(2)} İndirim
                              </div>
                              <div className="text-lg font-bold text-green-600 dark:text-green-400 mt-1">
                                ₺{finalAmount.toFixed(2)}
                              </div>
                            </div>
                          </div>
                        ) : null;
                      })()}
                    </div>
                  </div>
                </div>

                {/* Sağ Taraf - Kısmi Ödeme Alanı */}
                <div className="w-96 flex flex-col bg-gray-50 dark:bg-gray-800">
                  <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Kısmi Ödeme Alanı
                    </h3>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4">
                    {paymentScreenSelectedItems.size === 0 ? (
                      <div className="text-center text-gray-500 dark:text-gray-400 text-sm py-8">
                        Kısmi ödeme için ürün seçilmedi
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {Array.from(paymentScreenSelectedItems).map((index) => {
                          const item = order.items[index];
                          const rawSelectedQty =
                            paymentScreenSelectedQuantities.get(index) || 1;
                          // Miktarı 2 ondalık basamağa yuvarla
                          const selectedQty = Math.round(rawSelectedQty * 100) / 100;
                          const itemPrice = selectedQty * item.menuPrice;

                          return (
                            <div
                              key={index}
                              className="rounded-lg p-3 border-2 border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/30"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="font-medium text-sm text-blue-900 dark:text-blue-200">
                                  {item.menuName}
                                </h4>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const newSelected = new Set(
                                      paymentScreenSelectedItems
                                    );
                                    const newQuantities = new Map(
                                      paymentScreenSelectedQuantities
                                    );

                                    newSelected.delete(index);
                                    newQuantities.delete(index);

                                    setPaymentScreenSelectedItems(newSelected);
                                    setPaymentScreenSelectedQuantities(
                                      newQuantities
                                    );

                                    // Toplamı güncelle
                                    if (newSelected.size > 0) {
                                      const selectedTotal = Array.from(
                                        newSelected
                                      ).reduce((sum, idx) => {
                                        const item = order.items[idx];
                                        const rawSelectedQty =
                                          newQuantities.get(idx) || 1;
                                        // Miktarı yuvarla
                                        const selectedQty = Math.round(rawSelectedQty * 100) / 100;
                                        const roundedItemQty = Math.round(item.quantity * 100) / 100;
                                        const actualQty = Math.min(
                                          selectedQty,
                                          roundedItemQty
                                        );
                                        return sum + actualQty * item.menuPrice;
                                      }, 0);
                                      setPaymentScreenAmount(
                                        selectedTotal.toFixed(2)
                                      );
                                    } else {
                                      setPaymentScreenAmount("0.00");
                                    }
                                  }}
                                  className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                              <div className="flex items-center justify-between">
                                <p className="text-xs text-blue-700 dark:text-blue-300">
                                  {selectedQty} adet × ₺
                                  {item.menuPrice.toFixed(2)}
                                </p>
                                <span className="font-bold text-sm text-blue-900 dark:text-blue-200">
                                  ₺{itemPrice.toFixed(2)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Kısmi Ödeme Alanı Toplamı */}
                  <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700/50 min-h-[80px] flex items-center">
                    <div className="space-y-1 w-full">
                      <div className="flex justify-end items-center gap-2">
                        <span className={`text-sm font-medium ${
                          paymentScreenSelectedItems.size > 0 
                            ? "text-green-600 dark:text-green-400" 
                            : "text-gray-700 dark:text-gray-300"
                        }`}>
                          {paymentScreenSelectedItems.size > 0 ? "Alınacak Ödeme" : "Toplam"}
                        </span>
                        <span className="text-xl font-bold text-gray-900 dark:text-white">
                          ₺
                          {(() => {
                            if (paymentScreenSelectedItems.size > 0) {
                              const selectedTotal = Array.from(
                                paymentScreenSelectedItems
                              ).reduce((sum, idx) => {
                                const item = order.items[idx];
                                const rawSelectedQty =
                                  paymentScreenSelectedQuantities.get(idx) || 1;
                                // Miktarı yuvarla
                                const selectedQty = Math.round(rawSelectedQty * 100) / 100;
                                const roundedItemQty = Math.round(item.quantity * 100) / 100;
                                const actualQty = Math.min(
                                  selectedQty,
                                  roundedItemQty
                                );
                                return sum + actualQty * item.menuPrice;
                              }, 0);
                              return selectedTotal.toFixed(2);
                            }
                            return "0.00";
                          })()}
                        </span>
                      </div>
                      {(() => {
                        const baseAmount =
                          paymentScreenSelectedItems.size > 0
                            ? Array.from(paymentScreenSelectedItems).reduce(
                                (sum, idx) => {
                                  const item = order.items[idx];
                                  const rawSelectedQty =
                                    paymentScreenSelectedQuantities.get(idx) ||
                                    1;
                                  // Miktarı yuvarla
                                  const selectedQty = Math.round(rawSelectedQty * 100) / 100;
                                  const roundedItemQty = Math.round(item.quantity * 100) / 100;
                                  const actualQty = Math.min(
                                    selectedQty,
                                    roundedItemQty
                                  );
                                  return sum + actualQty * item.menuPrice;
                                },
                                0
                              )
                            : 0;

                        let discountAmount = 0;
                        if (
                          paymentScreenDiscountType === "percentage" &&
                          paymentScreenDiscountValue
                        ) {
                          discountAmount =
                            (baseAmount *
                              parseFloat(paymentScreenDiscountValue)) /
                            100;
                        } else if (
                          paymentScreenDiscountType === "amount" &&
                          paymentScreenDiscountValue
                        ) {
                          discountAmount = parseFloat(
                            paymentScreenDiscountValue
                          );
                        } else if (
                          paymentScreenDiscountType === "manual" &&
                          paymentScreenManualDiscount
                        ) {
                          discountAmount =
                            parseFloat(paymentScreenManualDiscount) || 0;
                        }

                        const finalAmount = Math.max(
                          0,
                          baseAmount - discountAmount
                        );

                        return discountAmount > 0 ? (
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            <div className="line-through">
                              ₺{baseAmount.toFixed(2)}
                            </div>
                            <div className="text-red-600 dark:text-red-400">
                              -₺{discountAmount.toFixed(2)} İndirim
                            </div>
                            <div className="text-lg font-bold text-green-600 dark:text-green-400 mt-1">
                              ₺{finalAmount.toFixed(2)}
                            </div>
                          </div>
                        ) : null;
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Alt Kısım - Numeric Keypad ve Ödeme Butonları */}
              <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4 flex-shrink-0">
                <div className="flex gap-4">
                  {/* Sol Taraf - Numeric Keypad */}
                  <div className="w-80">
                    <div className="grid grid-cols-3 gap-3">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                        <Button
                          key={num}
                          variant="outline"
                          onClick={() => {
                            // Sayı ekle
                            setPaymentScreenQuantityInput((prev) => prev + num.toString());
                          }}
                          className="h-14 text-xl font-semibold"
                        >
                          {num}
                        </Button>
                      ))}
                      {/* Virgül tuşu */}
                      <Button
                        variant="outline"
                        onClick={() => {
                          // Virgül ekle (eğer yoksa)
                          setPaymentScreenQuantityInput((prev) => {
                            if (prev.includes(",") || prev.includes(".")) {
                              return prev;
                            }
                            return prev === "" ? "0," : prev + ",";
                          });
                        }}
                        className="h-14 text-xl font-semibold"
                      >
                        ,
                      </Button>
                      {/* 0 tuşu */}
                      <Button
                        variant="outline"
                        onClick={() => {
                          // 0 ekle
                          setPaymentScreenQuantityInput((prev) => prev + "0");
                        }}
                        className="h-14 text-xl font-semibold"
                      >
                        0
                      </Button>
                      {/* Silme tuşu */}
                      <Button
                        variant="outline"
                        onClick={() => {
                          // Son karakteri sil
                          setPaymentScreenQuantityInput((prev) => prev.slice(0, -1));
                        }}
                        className="h-14 text-xl font-semibold text-red-600 dark:text-red-400"
                      >
                        <Delete className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>

                  {/* Orta - İskonto, Cari ve Paket Masaları için Kurye/Para Üstü */}
                  <div className="w-48 flex flex-col gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowPaymentScreenDiscountModal(true)}
                      className="flex-1 h-14"
                    >
                      İskonto
                    </Button>
                    <Button
                      variant="outline"
                      onClick={async () => {
                        const defaultPrinter = getDefaultPrinter(printers, selectedPrinterId);
                        if (!defaultPrinter) {
                          alert("Varsayılan yazıcı bulunamadı. Lütfen yazıcı ayarlarından varsayılan yazıcı seçin.");
                          return;
                        }

                        if (!order) {
                          alert("Henüz sipariş bulunmuyor.");
                          return;
                        }

                        try {
                          // Tüm ürünleri birleştir: mevcut + iptal + ödeme alınan
                          const allItems: OrderItem[] = [];
                          
                          // 1. Aktif sipariş listesindeki mevcut ürünleri ekle
                          if (order.items && order.items.length > 0) {
                            const activeItems = order.items.filter(item => 
                              !order.canceledItems?.some(canceled => canceled.menuId === item.menuId) &&
                              !order.payments?.some(payment => 
                                payment.paidItems?.some(paid => paid.menuId === item.menuId)
                              )
                            );
                            allItems.push(...activeItems);
                          }

                          // 2. İptal edilen ürünleri ekle
                          if (order.canceledItems && order.canceledItems.length > 0) {
                            const canceledOrderItems: OrderItem[] = order.canceledItems.map(canceled => ({
                              menuId: canceled.menuId,
                              menuName: canceled.menuName,
                              quantity: canceled.quantity,
                              menuPrice: canceled.subtotal / canceled.quantity,
                              subtotal: canceled.subtotal,
                              notes: canceled.notes || "",
                              selectedExtras: canceled.selectedExtras || [],
                            }));
                            allItems.push(...canceledOrderItems);
                          }

                          // 3. Ödemesi alınan ürünleri ekle
                          if (order.payments && order.payments.length > 0) {
                            for (const payment of order.payments) {
                              if (payment.paidItems && payment.paidItems.length > 0) {
                                const paidOrderItems: OrderItem[] = payment.paidItems.map(paid => ({
                                  menuId: paid.menuId,
                                  menuName: paid.menuName,
                                  quantity: paid.quantity,
                                  menuPrice: paid.subtotal / paid.quantity,
                                  subtotal: paid.subtotal,
                                  notes: "",
                                  selectedExtras: [],
                                }));
                                allItems.push(...paidOrderItems);
                              }
                            }
                          }

                          // Tüm ürünleri tek bir çıktıda yazdır
                          if (allItems.length > 0) {
                            // Toplam tutarı hesapla
                            const totalAmount = allItems.reduce((sum, item) => sum + item.subtotal, 0);
                            
                            const content = formatPrintContent(
                              "order",
                              allItems,
                              currentTable.tableNumber.toString(),
                              order.id,
                              {
                                companyName: companyData?.name || "",
                                total: totalAmount,
                                paperWidth: defaultPrinter.paperWidth || 48,
                              }
                            );
                            await printToPrinter(defaultPrinter.name, content, "order");
                          } else {
                            alert("Yazdırılacak ürün bulunamadı.");
                          }
                        } catch (error) {
                          alert("Yazdırma sırasında bir hata oluştu.");
                        }
                      }}
                      className="flex-1 h-14"
                    >
                      <Printer className="h-4 w-4 mr-2" />
                      Yazdır
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        // Cari butonu - şimdilik placeholder
                        customAlert("Cari özelliği yakında eklenecek", "Bilgi", "info");
                      }}
                      className="flex-1 h-14"
                    >
                      Cari
                    </Button>
                    {/* Paket masaları için kurye atama ve para üstü */}
                    {currentTable.area === "Paket" && (
                      <>
                        <Button
                          variant="outline"
                          onClick={() => setShowPaymentScreenCourierModal(true)}
                          className="flex-1 h-14"
                        >
                          {paymentScreenSelectedCourierId
                            ? couriers.find((c) => c.id === paymentScreenSelectedCourierId)?.name || "Kurye Seç"
                            : "Kurye Seç"}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setShowPaymentScreenChangeAmountModal(true)}
                          className="flex-1 h-14"
                        >
                          {paymentScreenChangeAmount && parseFloat(paymentScreenChangeAmount) > 0
                            ? `Para Üstü: ₺${parseFloat(paymentScreenChangeAmount).toFixed(2)}`
                            : "Para Üstü"}
                        </Button>
                      </>
                    )}
                  </div>

                  {/* Sağ Taraf - Ödeme Yöntemleri */}
                  <div className="flex-1">
                    <div className="grid grid-cols-2 gap-2">
                      {paymentMethods.map((pm) => {
                        const isSelected = paymentMethod === pm.code;
                        const isLoading = processingPaymentMethodId === pm.id;

                        return (
                          <Button
                            key={pm.id}
                            variant="outline"
                            disabled={isProcessingPayment}
                            className={`h-14 ${isSelected ? "border-2 border-blue-500 dark:border-blue-400" : ""}`}
                            onClick={async () => {
                              setPaymentMethod(pm.code);
                              setProcessingPaymentMethodId(pm.id || null);

                              // Seçili ürün var mı kontrol et
                              const hasSelectedItems =
                                paymentScreenSelectedItems.size > 0;

                              // Ödeme tutarını hesapla
                              // Eğer seçili ürün varsa: sadece seçilen ürünlerin toplamı
                              // Eğer seçili ürün yoksa: tüm masanın toplamı (tam ödeme)
                              const baseAmount = hasSelectedItems
                                ? Array.from(paymentScreenSelectedItems).reduce(
                                    (sum, idx) => {
                                      const item = order.items[idx];
                                      const selectedQty =
                                        paymentScreenSelectedQuantities.get(
                                          idx
                                        ) || 1;
                                      const actualQty = Math.min(
                                        selectedQty,
                                        item.quantity
                                      );
                                      return sum + actualQty * item.menuPrice;
                                    },
                                    0
                                  )
                                : order.items.reduce(
                                    (sum, item) => sum + item.subtotal,
                                    0
                                  );

                              // İndirim hesapla
                              let discountAmount = 0;
                              if (
                                paymentScreenDiscountType === "percentage" &&
                                paymentScreenDiscountValue
                              ) {
                                discountAmount =
                                  (baseAmount *
                                    parseFloat(paymentScreenDiscountValue)) /
                                  100;
                              } else if (
                                paymentScreenDiscountType === "amount" &&
                                paymentScreenDiscountValue
                              ) {
                                discountAmount = parseFloat(
                                  paymentScreenDiscountValue
                                );
                              } else if (
                                paymentScreenDiscountType === "manual" &&
                                paymentScreenManualDiscount
                              ) {
                                discountAmount =
                                  parseFloat(paymentScreenManualDiscount) || 0;
                              }

                              const finalAmount = Math.max(
                                0,
                                baseAmount - discountAmount
                              );
                              const finalAmountString = finalAmount.toFixed(2);

                              // Ödeme state'lerini set et
                              setPaymentAmount(finalAmountString);
                              setDiscountType(paymentScreenDiscountType);
                              setDiscountValue(paymentScreenDiscountValue);
                              setManualDiscount(paymentScreenManualDiscount);

                              // Seçili ürünleri hazırla ve state'e set et
                              let pendingItems: Array<{
                                menuId: string;
                                menuName: string;
                                totalQuantity: number;
                                indices: number[];
                              }> = [];
                              let quantitiesMap: Map<string, number> =
                                new Map();

                              if (hasSelectedItems) {
                                // KISMI ÖDEME: Sadece seçilen ürünlerin ödemesi alınacak
                                setSelectedItems(paymentScreenSelectedItems);

                                // Seçilen adetleri menuId'ye göre grupla ve pendingPaymentItems formatına çevir
                                const itemsByMenuId = new Map<
                                  string,
                                  {
                                    item: OrderItem;
                                    indices: number[];
                                    quantities: number[];
                                  }
                                >();

                                paymentScreenSelectedItems.forEach((idx) => {
                                  const item = order.items[idx];
                                  if (item) {
                                    const selectedQty =
                                      paymentScreenSelectedQuantities.get(idx);
                                    const quantityToUse =
                                      selectedQty !== undefined
                                        ? selectedQty
                                        : 1;

                                    const existing = itemsByMenuId.get(
                                      item.menuId
                                    );
                                    if (existing) {
                                      existing.indices.push(idx);
                                      existing.quantities.push(quantityToUse);
                                    } else {
                                      itemsByMenuId.set(item.menuId, {
                                        item,
                                        indices: [idx],
                                        quantities: [quantityToUse],
                                      });
                                    }
                                  }
                                });

                                // pendingPaymentItems formatına çevir
                                pendingItems = Array.from(
                                  itemsByMenuId.values()
                                ).map(({ item, indices, quantities }) => {
                                  const totalQuantity = quantities.reduce(
                                    (sum, qty) => sum + qty,
                                    0
                                  );
                                  return {
                                    menuId: item.menuId,
                                    menuName: item.menuName,
                                    totalQuantity: totalQuantity,
                                    indices: indices,
                                  };
                                });

                                // selectedQuantities map'ini oluştur (menuId -> quantity)
                                itemsByMenuId.forEach(
                                  ({ item, quantities }) => {
                                    const totalQty = quantities.reduce(
                                      (sum, qty) => sum + qty,
                                      0
                                    );
                                    quantitiesMap.set(item.menuId, totalQty);
                                  }
                                );

                                setPendingPaymentItems(pendingItems);
                                setSelectedQuantities(quantitiesMap);
                              } else {
                                // TAM ÖDEME: Hiç seçim yapılmadı, tüm masanın ödemesi alınacak ve masa kapanacak
                                setSelectedItems(new Set());
                                setSelectedQuantities(new Map());
                                setPendingPaymentItems([]);
                              }

                              // Ödeme işlemini başlat
                              // handlePayment içinde:
                              // - Eğer selectedItems.size > 0 ise: kısmi ödeme (masa açık kalır)
                              // - Eğer selectedItems.size === 0 ise: tam ödeme (masa kapanır ve anasayfaya dönülür)
                              // Parametreleri direkt geçiyoruz, böylece state güncellemesi beklemeden ödeme yapılabilir
                              try {
                                await handlePayment(
                                  finalAmountString,
                                  hasSelectedItems
                                    ? paymentScreenSelectedItems
                                    : new Set(),
                                  hasSelectedItems ? pendingItems : [],
                                  hasSelectedItems ? quantitiesMap : new Map(),
                                  pm.code, // Ödeme yöntemi kodunu direkt geç
                                  // Paket masaları için kurye atama ve para üstü (paket sayısı otomatik 1)
                                  currentTable.area === "Paket" ? paymentScreenSelectedCourierId : undefined,
                                  currentTable.area === "Paket" ? "1" : undefined, // Her masa 1 paket
                                  currentTable.area === "Paket" ? paymentScreenChangeAmount : undefined
                                );

                                // Ekranı kapat
                                setShowFullScreenPayment(false);
                                setPaymentScreenAmount("");
                                setPaymentScreenDiscountType("percentage");
                                setPaymentScreenQuantityInput("");
                                setPaymentScreenDiscountValue("");
                                setPaymentScreenManualDiscount("");
                                setPaymentScreenSelectedItems(new Set());
                                setPaymentScreenSelectedQuantities(new Map());
                                setSelectedNumericKey(null);
                                // Paket masaları için state'leri temizle
                                setPaymentScreenSelectedCourierId("");
                                setPaymentScreenChangeAmount("0");
                              } finally {
                                // Loading state'i temizle
                                setProcessingPaymentMethodId(null);
                              }
                            }}
                          >
                            {isLoading ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                İşleniyor...
                              </>
                            ) : (
                              pm.name
                            )}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* İskonto Modalı */}
            {showPaymentScreenDiscountModal && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      İskonto
                    </h2>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowPaymentScreenDiscountModal(false)}
                      className="h-8 w-8"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="space-y-4">
                    {/* İndirim Türü Seçimi */}
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={
                          paymentScreenDiscountType === "percentage"
                            ? "default"
                            : "outline"
                        }
                        onClick={() => {
                          setPaymentScreenDiscountType("percentage");
                          setPaymentScreenDiscountValue("");
                          setPaymentScreenManualDiscount("");
                        }}
                        className="flex-1 h-12 text-base font-semibold"
                      >
                        Oran
                      </Button>
                      <Button
                        type="button"
                        variant={
                          paymentScreenDiscountType === "amount"
                            ? "default"
                            : "outline"
                        }
                        onClick={() => {
                          setPaymentScreenDiscountType("amount");
                          setPaymentScreenDiscountValue("");
                          setPaymentScreenManualDiscount("");
                        }}
                        className="flex-1 h-12 text-base font-semibold"
                      >
                        Fiyat
                      </Button>
                    </div>

                    {/* Oran Bazlı İndirim */}
                    {paymentScreenDiscountType === "percentage" && (
                      <div>
                        <div className="flex gap-2 flex-wrap mb-3">
                          {[10, 20, 30, 40, 50].map((percent) => (
                            <Button
                              key={percent}
                              type="button"
                              variant={
                                paymentScreenDiscountValue ===
                                percent.toString()
                                  ? "default"
                                  : "outline"
                              }
                              onClick={() => {
                                if (
                                  paymentScreenDiscountValue ===
                                  percent.toString()
                                ) {
                                  setPaymentScreenDiscountValue("");
                                } else {
                                  setPaymentScreenDiscountValue(
                                    percent.toString()
                                  );
                                }
                              }}
                              className="flex-1 min-w-[60px] h-12 text-base font-semibold"
                            >
                              %{percent}
                            </Button>
                          ))}
                        </div>
                        <Input
                          type="number"
                          value={paymentScreenDiscountValue}
                          onChange={(e) =>
                            setPaymentScreenDiscountValue(e.target.value)
                          }
                          placeholder="Manuel oran girin (%)"
                          step="0.01"
                          min="0"
                          max="100"
                          className="dark:bg-gray-700 dark:text-white dark:border-gray-600"
                        />
                      </div>
                    )}

                    {/* Fiyat Bazlı İndirim */}
                    {paymentScreenDiscountType === "amount" && (
                      <div>
                        <div className="flex gap-2 flex-wrap mb-3">
                          {[20, 50, 75, 100].map((amount) => (
                            <Button
                              key={amount}
                              type="button"
                              variant={
                                paymentScreenDiscountValue === amount.toString()
                                  ? "default"
                                  : "outline"
                              }
                              onClick={() => {
                                if (
                                  paymentScreenDiscountValue ===
                                  amount.toString()
                                ) {
                                  setPaymentScreenDiscountValue("");
                                } else {
                                  setPaymentScreenDiscountValue(
                                    amount.toString()
                                  );
                                }
                              }}
                              className="flex-1 min-w-[60px] h-12 text-base font-semibold"
                            >
                              ₺{amount}
                            </Button>
                          ))}
                        </div>
                        <Input
                          type="number"
                          value={paymentScreenDiscountValue}
                          onChange={(e) =>
                            setPaymentScreenDiscountValue(e.target.value)
                          }
                          placeholder="Manuel fiyat girin (₺)"
                          step="0.01"
                          min="0"
                          className="dark:bg-gray-700 dark:text-white dark:border-gray-600"
                        />
                      </div>
                    )}

                    {/* Numeric Keypad */}
                    <div>
                      <div className="grid grid-cols-3 gap-2">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                          <Button
                            key={num}
                            type="button"
                            variant="outline"
                            onClick={() => {
                              const currentValue =
                                paymentScreenDiscountValue || "";
                              setPaymentScreenDiscountValue(
                                currentValue + num.toString()
                              );
                            }}
                            className="h-12 text-lg font-semibold"
                          >
                            {num}
                          </Button>
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            const currentValue =
                              paymentScreenDiscountValue || "";
                            setPaymentScreenDiscountValue(
                              currentValue.slice(0, -1)
                            );
                          }}
                          className="h-12 text-lg font-semibold"
                        >
                          <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            const currentValue =
                              paymentScreenDiscountValue || "";
                            setPaymentScreenDiscountValue(currentValue + "0");
                          }}
                          className="h-12 text-lg font-semibold"
                        >
                          0
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            const currentValue =
                              paymentScreenDiscountValue || "";
                            if (!currentValue.includes(".")) {
                              setPaymentScreenDiscountValue(currentValue + ".");
                            }
                          }}
                          className="h-12 text-lg font-semibold"
                        >
                          .
                        </Button>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button
                        onClick={async () => {
                          if (!order || !order.items || order.items.length === 0) {
                            customAlert("Ödeme yapılacak ürün bulunamadı", "Uyarı", "warning");
                            return;
                          }

                          // Tüm ürünlerin toplam fiyatını hesapla
                          const baseAmount = order.items.reduce(
                            (sum, item) => sum + item.subtotal,
                            0
                          );

                          // İskonto hesapla
                          let discountAmount = 0;
                          if (
                            paymentScreenDiscountType === "percentage" &&
                            paymentScreenDiscountValue
                          ) {
                            discountAmount =
                              (baseAmount *
                                parseFloat(paymentScreenDiscountValue)) /
                              100;
                          } else if (
                            paymentScreenDiscountType === "amount" &&
                            paymentScreenDiscountValue
                          ) {
                            discountAmount = Math.min(
                              parseFloat(paymentScreenDiscountValue),
                              baseAmount
                            );
                          }

                          if (discountAmount <= 0) {
                            customAlert("Lütfen geçerli bir indirim girin", "Uyarı", "warning");
                            return;
                          }

                          // İskonto uygula
                          const currentDiscount = order.discount || 0;
                          const newDiscount = currentDiscount + discountAmount;
                          const newSubtotal = order.subtotal;
                          const newTotal = Math.max(0, newSubtotal - newDiscount);

                          try {
                            setIsProcessingPayment(true);

                            // Siparişe indirim uygula
                            await updateOrder(order.id!, {
                              discount: newDiscount,
                              total: newTotal,
                            });

                            // Siparişi yeniden yükle
                            const updatedOrder = await getOrder(order.id!);
                            if (updatedOrder) {
                              setOrder(updatedOrder);
                            }

                            // Modalı kapat ve ödeme ekranına geri dön
                            setShowPaymentScreenDiscountModal(false);
                          } catch (error) {
                            customAlert("İskonto uygulanırken bir hata oluştu", "Hata", "error");
                          } finally {
                            setIsProcessingPayment(false);
                          }
                        }}
                        className="flex-1 h-12 text-base font-semibold"
                        disabled={isProcessingPayment}
                      >
                        {isProcessingPayment ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            İşleniyor...
                          </>
                        ) : (
                          "Uygula"
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setPaymentScreenDiscountType("percentage");
                          setPaymentScreenDiscountValue("");
                          setPaymentScreenManualDiscount("");
                        }}
                        className="flex-1 h-12 text-base font-semibold"
                      >
                        Temizle
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Kurye Seçim Modalı */}
            {showPaymentScreenCourierModal && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      Kurye Seç
                    </h2>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowPaymentScreenCourierModal(false)}
                      className="h-8 w-8"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {couriers.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        Kurye bulunamadı
                      </div>
                    ) : (
                      couriers.map((courier) => (
                        <Button
                          key={courier.id}
                          variant={
                            paymentScreenSelectedCourierId === courier.id
                              ? "default"
                              : "outline"
                          }
                          onClick={() => {
                            setPaymentScreenSelectedCourierId(courier.id || "");
                            setShowPaymentScreenCourierModal(false);
                          }}
                          className="w-full h-12 text-base font-semibold justify-start"
                        >
                          {courier.name}
                        </Button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Para Üstü Modalı */}
            {showPaymentScreenChangeAmountModal && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      Para Üstü
                    </h2>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowPaymentScreenChangeAmountModal(false)}
                      className="h-8 w-8"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="space-y-4">
                    <Input
                      type="number"
                      value={paymentScreenChangeAmount}
                      onChange={(e) =>
                        setPaymentScreenChangeAmount(e.target.value)
                      }
                      placeholder="Para üstü tutarı girin (₺)"
                      step="0.01"
                      min="0"
                      className="dark:bg-gray-700 dark:text-white dark:border-gray-600 h-12 text-base"
                    />

                    {/* Numeric Keypad */}
                    <div>
                      <div className="grid grid-cols-3 gap-2">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                          <Button
                            key={num}
                            type="button"
                            variant="outline"
                            onClick={() => {
                              const currentValue =
                                paymentScreenChangeAmount || "";
                              setPaymentScreenChangeAmount(
                                currentValue + num.toString()
                              );
                            }}
                            className="h-12 text-lg font-semibold"
                          >
                            {num}
                          </Button>
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            const currentValue =
                              paymentScreenChangeAmount || "";
                            setPaymentScreenChangeAmount(
                              currentValue.slice(0, -1)
                            );
                          }}
                          className="h-12 text-lg font-semibold"
                        >
                          <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            const currentValue =
                              paymentScreenChangeAmount || "";
                            setPaymentScreenChangeAmount(currentValue + "0");
                          }}
                          className="h-12 text-lg font-semibold"
                        >
                          0
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            const currentValue =
                              paymentScreenChangeAmount || "";
                            if (!currentValue.includes(".")) {
                              setPaymentScreenChangeAmount(currentValue + ".");
                            }
                          }}
                          className="h-12 text-lg font-semibold"
                        >
                          .
                        </Button>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button
                        onClick={() => setShowPaymentScreenChangeAmountModal(false)}
                        className="flex-1 h-12 text-base font-semibold"
                      >
                        Tamam
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setPaymentScreenChangeAmount("0");
                        }}
                        className="flex-1 h-12 text-base font-semibold"
                      >
                        Temizle
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Taşı Modalı */}
        {showMoveModal &&
          (() => {
            // Alanları grupla
            const areas = Array.from(
              new Set(availableTables.map((t) => t.area))
            ).sort();
            const tablesByArea = availableTables.filter(
              (t) => t.area === selectedArea
            );

            return (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    {isMovingItems && (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    )}
                    Ürünleri Taşı
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    {selectedItems.size} ürün seçildi. Hangi masaya taşımak
                    istersiniz?
                  </p>

                  <div className="flex-1 flex flex-col min-h-0">
                    {/* Alanlar */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Alan Seçin
                      </label>
                      <div className="flex gap-2 flex-wrap">
                        {areas.map((area) => (
                          <Button
                            key={area}
                            type="button"
                            variant={
                              selectedArea === area ? "default" : "outline"
                            }
                            onClick={() => setSelectedArea(area)}
                            className={`${
                              selectedArea === area
                                ? "bg-blue-600 text-white hover:bg-blue-700"
                                : "bg-white hover:bg-gray-50"
                            }`}
                          >
                            {area}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Masalar */}
                    <div className="flex-1 overflow-y-auto">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                              onClick={() => handleMoveSelectedItems(table.id!)}
                              disabled={isMovingItems}
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

                  <div className="flex gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowMoveModal(false);
                        setSelectedArea("");
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
    </div>
  );
}
