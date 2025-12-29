import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getOrdersByCompany } from "@/lib/firebase/orders";
import { getBillsByCompany } from "@/lib/firebase/bills";
import { clearAllStatistics } from "@/lib/firebase/statistics";
import { getPaymentMethodsByCompany } from "@/lib/firebase/paymentMethods";
import { getCourierAssignmentsByCompany } from "@/lib/firebase/couriers";
import { getUsersByCompany } from "@/lib/firebase/users";
import type {
  Order,
  OrderItem,
  Payment,
  PaymentMethodConfig,
  User,
  Bill,
} from "@/lib/firebase/types";
import {
  BarChart3,
  TrendingUp,
  Package,
  Calendar,
  Trash2,
  AlertTriangle,
  CreditCard,
  Percent,
  Bike,
  Users,
  ChevronRight,
  X,
  Utensils,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { POSLayout } from "@/components/layouts/POSLayout";

export const Route = createFileRoute("/statistics")({
  component: Statistics,
});

function Statistics() {
  return (
    <POSLayout>
      <StatisticsContent />
    </POSLayout>
  );
}

type PeriodType = "daily" | "weekly" | "monthly" | "yearly" | "custom";

interface ProductStats {
  menuId: string;
  menuName: string;
  quantity: number;
  revenue: number;
}

interface PaymentMethodStats {
  method: string;
  methodName: string;
  total: number;
  count: number;
}

interface WaiterProductStats {
  waiterId: string;
  waiterName: string;
  products: Array<{
    menuId: string;
    menuName: string;
    quantity: number;
    revenue: number;
  }>;
  totalQuantity: number;
  totalRevenue: number;
}

function StatisticsContent() {
  const { userData, companyId, branchId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>("daily");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodConfig[]>(
    []
  );
  const [courierAssignments, setCourierAssignments] = useState<any[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [selectedWaiter, setSelectedWaiter] =
    useState<WaiterProductStats | null>(null);
  const [waiterDetailPeriod, setWaiterDetailPeriod] =
    useState<PeriodType>("daily");
  const [showWaiterDetail, setShowWaiterDetail] = useState(false);
  const [showAllProducts, setShowAllProducts] = useState(false);

  // Tarih aralığını hesapla
  const getDateRange = useCallback(
    (period: PeriodType): { start: Date; end: Date } => {
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      let start = new Date();

      if (period === "daily") {
        start.setHours(0, 0, 0, 0);
      } else if (period === "weekly") {
        start.setDate(start.getDate() - 7);
        start.setHours(0, 0, 0, 0);
      } else if (period === "monthly") {
        start.setMonth(start.getMonth() - 1);
        start.setHours(0, 0, 0, 0);
      } else if (period === "yearly") {
        start.setFullYear(start.getFullYear() - 1);
        start.setHours(0, 0, 0, 0);
      } else if (period === "custom") {
        if (startDate && endDate) {
          start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          end.setTime(new Date(endDate).getTime());
          end.setHours(23, 59, 59, 999);
        } else {
          start.setHours(0, 0, 0, 0);
        }
      }

      return { start, end };
    },
    [startDate, endDate]
  );

  // Siparişleri yükle
  useEffect(() => {
    const loadOrders = async () => {
      const effectiveCompanyId = companyId || userData?.companyId;
      const effectiveBranchId = branchId || userData?.assignedBranchId;

      if (!effectiveCompanyId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const { start, end } = getDateRange(selectedPeriod);

        const [
          allOrders,
          allBills,
          paymentMethodsData,
          courierAssignmentsData,
          usersData,
        ] = await Promise.all([
          // Hem kapalı hem de kısmi ödemesi alınmış (hala açık) siparişleri getiriyoruz.
          // Satış istatistiklerinde sadece gerçekten ödenmiş ürünleri hesaba katıyoruz.
          getOrdersByCompany(effectiveCompanyId, {
            branchId: effectiveBranchId || undefined,
            startDate: start,
            endDate: end,
          }),
          // Bills'ları tarih aralığına göre filtrele
          getBillsByCompany(effectiveCompanyId, {
            branchId: effectiveBranchId || undefined,
          }).then((bills) => {
            // Tarih aralığına göre filtrele
            return bills.filter((bill) => {
              const billDate = bill.createdAt instanceof Date 
                ? bill.createdAt 
                : new Date(bill.createdAt);
              return billDate >= start && billDate <= end;
            });
          }).catch(() => []),
          getPaymentMethodsByCompany(
            effectiveCompanyId,
            effectiveBranchId || undefined
          ).catch(() => []),
          getCourierAssignmentsByCompany(
            effectiveCompanyId,
            effectiveBranchId || undefined,
            start,
            end
          ).catch(() => []),
          getUsersByCompany(
            effectiveCompanyId,
            effectiveBranchId || undefined
          ).catch(() => []),
        ]);

        setOrders(allOrders);
        setBills(allBills);
        setPaymentMethods(paymentMethodsData);
        setCourierAssignments(courierAssignmentsData);
        setUsers(usersData);
      } catch (error) {
        // Error loading data
      } finally {
        setLoading(false);
      }
    };

    loadOrders();
  }, [
    companyId,
    branchId,
    userData?.companyId,
    userData?.assignedBranchId,
    selectedPeriod,
    startDate,
    endDate,
    getDateRange,
  ]);

  // İstatistikleri hesapla
  const calculateStats = useCallback(() => {
    // Yardımcı: Bir siparişte gerçekten ödenmiş tüm ürünleri (kısmi ve tam) topla (ikramlar hariç)
    const getPaidItemsForOrder = (order: Order) => {
      const paidItems: Array<{
        menuId: string;
        menuName: string;
        quantity: number;
        subtotal: number;
      }> = [];

      const paymentsWithItems =
        order.payments?.filter(
          (p) => p.paidItems && p.paidItems.length > 0 && !p.isGift
        ) ?? [];

      if (paymentsWithItems.length > 0) {
        // Kısmi veya item bazlı ödemelerde, paidItems'ları ekle (ikramlar hariç)
        paymentsWithItems.forEach((payment) => {
          payment.paidItems!.forEach((pi) => {
            paidItems.push({
              menuId: pi.menuId,
              menuName: pi.menuName,
              quantity: pi.quantity,
              subtotal: pi.subtotal,
            });
          });
        });
      }

      // Sipariş kapandıysa, kapanış anında kalan ürünler de artık tamamen ödenmiş demektir.
      // (Kısmi ödemelerde, daha önce ödenen kısımlar zaten items'tan düşürülmüş durumda.)
      // Ancak eğer son ödeme ikram ise, bu ürünleri ekleme
      if (order.status === "closed" && order.items && order.items.length > 0) {
        // Son ödemenin ikram olup olmadığını kontrol et
        const lastPayment =
          order.payments && order.payments.length > 0
          ? order.payments[order.payments.length - 1] 
          : null;
        const isLastPaymentGift = lastPayment?.isGift || false;
        
        if (!isLastPaymentGift) {
          order.items.forEach((item) => {
            paidItems.push({
              menuId: item.menuId,
              menuName: item.menuName,
              quantity: item.quantity,
              subtotal: item.subtotal,
            });
          });
        }
      }

      return paidItems;
    };

    // Tüm siparişlerden ödenmiş ürünleri topla
    const allPaidItems = orders.flatMap(getPaidItemsForOrder);

    // İkram ödemelerini ayrı olarak topla
    let totalGiftRevenue = 0;
    let totalGiftCount = 0;
    orders.forEach((order) => {
      if (order.payments && order.payments.length > 0) {
        order.payments.forEach((payment: Payment) => {
          if (payment.isGift) {
            // Eğer kısmi ödeme ise, paidItems'ları kullan
            if (payment.paidItems && payment.paidItems.length > 0) {
              payment.paidItems.forEach((paidItem) => {
                totalGiftRevenue += paidItem.subtotal;
                totalGiftCount += paidItem.quantity;
              });
            } else {
              // Tam ödeme ise, amount'u kullan
              totalGiftRevenue += payment.amount;
            }
          }
        });
      }
    });

    // Toplam satışlar: Ödemesi alınan tüm ödemelerin toplamı (ikramlar hariç)
    let totalRevenue = 0;
    orders.forEach((order) => {
      if (order.payments && order.payments.length > 0) {
        order.payments.forEach((payment: Payment) => {
          // İkram ödemelerini toplam ciraya dahil etme
          if (!payment.isGift) {
            totalRevenue += payment.amount;
          }
        });
      }
    });

    // Toplam ürün sayısı: Ödemesi alınan tüm ürünler
    // Önce bills'dan say (bills ödenmiş siparişlerin kesin kayıtlarıdır)
    let totalProductCount = 0;
    
    bills.forEach((bill) => {
      // İkram ödemelerini hariç tut
      const hasNonGiftPayment = bill.payments && bill.payments.some((p) => !p.isGift);
      if (!hasNonGiftPayment && bill.payments && bill.payments.length > 0) {
        // Tüm payments ikram ise, bu bill'ı atla
        return;
      }
      
      bill.items.forEach((item) => {
        totalProductCount += item.quantity;
      });
    });
    
    // Bills'ı olmayan orders'dan da ürün sayısını ekle (kısmi ödemeler için)
    // Önce bill order ID'lerini topla
    const billOrderIdsForProducts = new Set<string>();
    bills.forEach((bill) => {
      if (bill.orderId) {
        billOrderIdsForProducts.add(bill.orderId);
      }
    });
    
    orders.forEach((order) => {
      if (!billOrderIdsForProducts.has(order.id || "")) {
        const paidItems = getPaidItemsForOrder(order);
        paidItems.forEach((item) => {
          totalProductCount += item.quantity;
        });
      }
    });

    // Ödemesi alınan adisyon sayısı (ortalama hesaplamak için - bills sayısı)
    const paidBillCount = bills.filter((bill) => {
      // İkram ödemelerini hariç tut
      const hasNonGiftPayment = bill.payments && bill.payments.some((p) => !p.isGift);
      return hasNonGiftPayment || !bill.payments || bill.payments.length === 0;
    }).length;

    const averageOrderValue =
      paidBillCount > 0 ? totalRevenue / paidBillCount : 0;

    // En çok satılan ürünler: Bills'dan tüm ödenen ürünleri topla (ikramlar hariç)
    const productMap = new Map<string, ProductStats>();
    
    // Bills'dan tüm ödenen ürünleri topla (ikramlar hariç)
    bills.forEach((bill) => {
      // Eğer tüm payments ikram ise, bu bill'ı atla
      const hasNonGiftPayment = bill.payments && bill.payments.some((p) => !p.isGift);
      if (!hasNonGiftPayment && bill.payments && bill.payments.length > 0) {
        // Tüm payments ikram ise, bu bill'ı atla
        return;
      }
      
      bill.items.forEach((item) => {
        const existing = productMap.get(item.menuId);
        if (existing) {
          existing.quantity += item.quantity;
          existing.revenue += item.subtotal;
        } else {
          productMap.set(item.menuId, {
            menuId: item.menuId,
            menuName: item.menuName,
            quantity: item.quantity,
            revenue: item.subtotal,
          });
        }
      });
    });
    
    // Sırala ve standart olarak 10 ürün al (kullanıcı daha fazlasını görebilir)
    const sortedProducts = Array.from(productMap.values())
      .sort((a, b) => b.quantity - a.quantity);
    const topProducts = showAllProducts 
      ? sortedProducts 
      : sortedProducts.slice(0, 10);

    // İptal edilen ürünleri hesapla: canceledItems + ödemesi alınmayan ürünler
    let cancelledItemCount = 0;
    let cancelledRevenue = 0;

    orders.forEach((order) => {
      // canceledItems'ları ekle
      if (order.canceledItems && order.canceledItems.length > 0) {
        order.canceledItems.forEach((item: OrderItem) => {
          cancelledItemCount += item.quantity;
          cancelledRevenue += item.subtotal;
        });
      }

      // Ödemesi alınmayan ürünleri iptal olarak say
      // Eğer sipariş kapalıysa ve ödemesi alınmamış ürünler varsa
      if (order.status === "closed") {
        // Eğer tam ödeme alındıysa, hiçbir ürün iptal olarak sayılmaz
        if (order.paymentStatus === "paid") {
          // Tam ödeme alındı, iptal edilen ürün yok (sadece canceledItems sayılır)
        }
        // Eğer kısmi ödeme alındıysa, ödenmemiş ürünleri iptal olarak say
        else if (order.paymentStatus === "partial") {
          // Tüm ödenen ürünleri topla
          const paidItemsMap = new Map<string, number>();
          if (order.payments && order.payments.length > 0) {
            order.payments.forEach((payment: Payment) => {
              if (payment.paidItems && payment.paidItems.length > 0) {
                payment.paidItems.forEach((paidItem) => {
                  const currentQty = paidItemsMap.get(paidItem.menuId) || 0;
                  paidItemsMap.set(
                    paidItem.menuId,
                    currentQty + paidItem.quantity
                  );
                });
              }
            });
          }

          // Items içindeki her ürün için kontrol et
          order.items.forEach((item: OrderItem) => {
            const paidQuantity = paidItemsMap.get(item.menuId) || 0;
            const unpaidQuantity = item.quantity - paidQuantity;

            if (unpaidQuantity > 0) {
              // Ödemesi alınmayan miktar var, iptal olarak say
              cancelledItemCount += unpaidQuantity;
              cancelledRevenue += unpaidQuantity * item.menuPrice;
            }
          });
        }
        // Eğer hiç ödeme alınmadıysa, tüm ürünler iptal olarak sayılır
        else if (order.paymentStatus === "unpaid") {
          order.items.forEach((item: OrderItem) => {
            cancelledItemCount += item.quantity;
            cancelledRevenue += item.subtotal;
          });
        }
      }
    });

    // Ödeme yöntemine göre toplam fiyatlar
    const paymentMethodMap = new Map<string, PaymentMethodStats>();

    // Önce tüm ödeme yöntemlerini map'e ekle (0 değerleriyle)
    paymentMethods.forEach((method) => {
      if (method.isActive) {
        paymentMethodMap.set(method.code, {
          method: method.code,
          methodName: method.name,
          total: 0,
          count: 0,
        });
      }
    });

    // Sonra siparişlerden gelen ödemeleri ekle (ikramlar hariç)
    orders.forEach((order) => {
      if (order.payments && order.payments.length > 0) {
        order.payments.forEach((payment: Payment) => {
          // İkram ödemelerini ödeme yöntemi istatistiklerine dahil etme
          if (payment.isGift) return;
          
          const existing = paymentMethodMap.get(payment.method);
          if (existing) {
            existing.total += payment.amount;
            existing.count += 1;
          } else {
            // Eğer yöntem listede yoksa ekle
            const methodName =
              payment.method === "cash"
                ? "Nakit"
                : payment.method === "card"
                  ? "Kart"
                  : payment.method === "mealCard"
                    ? "Yemek Kartı"
                    : payment.method;

            paymentMethodMap.set(payment.method, {
              method: payment.method,
              methodName,
              total: payment.amount,
              count: 1,
            });
          }
        });
      }
    });

    const paymentMethodStats = Array.from(paymentMethodMap.values()).sort(
      (a, b) => b.total - a.total
    );

    // Tüm ödeme yöntemlerinin toplamını hesapla (yüzde hesaplaması için)
    const totalPaymentAmount = paymentMethodStats.reduce(
      (sum, method) => sum + method.total,
      0
    );

    // Toplam indirim: Ödemesi alınan siparişlerdeki indirimlerin toplamı
    let totalDiscount = 0;
    
    // Önce bills'dan indirimleri topla (bills ödenmiş siparişlerin kesin kayıtlarıdır)
    const billOrderIds = new Set<string>();
    bills.forEach((bill) => {
      // İkram ödemelerini hariç tut
      const hasNonGiftPayment = bill.payments && bill.payments.some((p) => !p.isGift);
      if (!hasNonGiftPayment && bill.payments && bill.payments.length > 0) {
        // Tüm payments ikram ise, bu bill'ı atla
        return;
      }
      
      // Bill'den indirim hesapla
      if (bill.orderId) {
        billOrderIds.add(bill.orderId);
      }
      
      // bill.discount varsa onu kullan
      if (bill.discount !== undefined && bill.discount !== null && bill.discount > 0) {
        totalDiscount += bill.discount;
      } else {
        // bill.discount yoksa veya 0 ise, bill.items'dan hesapla
        // bill.items içindeki item.subtotal'ları topla (indirimli toplam)
        const billItemsSubtotalTotal = bill.items.reduce(
          (sum, item) => sum + (item.subtotal || 0),
          0
        );
        
        // Orijinal toplamı hesapla (ekstra malzemeler dahil)
        let billItemsOriginalTotal = 0;
        bill.items.forEach((item) => {
          const extrasTotal = (item.selectedExtras || []).reduce(
            (sum, extra) => sum + extra.price,
            0
          );
          const itemOriginalPrice = ((item.menuPrice || 0) + extrasTotal) * item.quantity;
          billItemsOriginalTotal += itemOriginalPrice;
        });
        
        // İndirim = Orijinal toplam - İndirimli toplam (item.subtotal toplamı)
        const calculatedDiscount = billItemsOriginalTotal - billItemsSubtotalTotal;
        if (calculatedDiscount > 0) {
          totalDiscount += calculatedDiscount;
        }
      }
    });
    
    // Orders'dan sadece bill'ı olmayan siparişlerin indirimlerini topla
    // (kısmi ödeme durumları için - henüz bill oluşturulmamış)
    orders.forEach((order) => {
      // Eğer bu sipariş için bill yoksa, payment'lardan indirimi hesapla
      if (!billOrderIds.has(order.id || "")) {
        const paidItems = getPaidItemsForOrder(order);
        // Eğer bu siparişte ödenmiş ürün varsa, indirimini say
        if (paidItems.length > 0) {
          // Payment'lar yoksa veya paidItems yoksa, order.discount'u kullan (eski siparişler için)
          // Ama dikkat: order.discount tüm sipariş için, sadece ödenen kısım için değil
          // Bu yüzden ödenen kısım için orantılı indirim hesaplamalıyız
          if (order.payments && order.payments.length > 0) {
            // Payment'larda paidItems varsa, onlardan indirim hesapla
            let hasPaidItems = false;
            order.payments.forEach((payment) => {
              // İkram ödemelerini hariç tut
              if (payment.isGift) return;
              
              if (payment.paidItems && payment.paidItems.length > 0) {
                hasPaidItems = true;
                // paidItems'lardan indirim hesaplama - bu kısım yanlış olabilir
                // Çünkü paidItem.subtotal zaten indirimli fiyat, ama ekstra malzemeleri de içeriyor
                // Bu yüzden bu kısmı atlayalım, sadece order.discount kullan
              }
            });
            
            // Eğer paidItems yoksa ve order.discount varsa, orantılı indirim hesapla
            if (!hasPaidItems && order.discount && order.discount > 0) {
              // Ödenen ürünlerin toplam fiyatına göre orantılı indirim
              const orderSubtotal = (order.items || []).reduce(
                (sum, item) => sum + item.subtotal,
                0
              );
              const paidSubtotal = paidItems.reduce(
                (sum, item) => sum + item.subtotal,
                0
              );
              
              if (orderSubtotal > 0) {
                const discountRatio = order.discount / orderSubtotal;
                const paidDiscount = paidSubtotal * discountRatio;
                totalDiscount += paidDiscount;
              }
            }
          } else if (order.discount) {
            // Payment'lar yoksa, order.discount'u kullan (eski siparişler için)
            // Ama sadece ödenen kısım için orantılı indirim
            const orderSubtotal = (order.items || []).reduce(
              (sum, item) => sum + item.subtotal,
              0
            );
            const paidSubtotal = paidItems.reduce(
              (sum, item) => sum + item.subtotal,
              0
            );
            
            if (orderSubtotal > 0) {
              const discountRatio = order.discount / orderSubtotal;
              const paidDiscount = paidSubtotal * discountRatio;
              totalDiscount += paidDiscount;
            }
          }
        }
      }
    });

    // Kurye paket sayısı ve toplam tutarı: Kurye atanan ve ödemesi alınan siparişlerdeki toplam paket sayısı ve tutarı
    const totalCourierPackages = courierAssignments.reduce(
      (sum, assignment) => sum + (assignment.packageCount || 0),
      0
    );
    const totalCourierPackageAmount = courierAssignments.reduce(
      (sum, assignment) => sum + (assignment.totalAmount || 0),
      0
    );

    // Garson istatistikleri: Her garson için hangi üründen kaç tane satış yapmış
    const waiterStatsMap = new Map<string, WaiterProductStats>();

    orders.forEach((order) => {
      if (!order.createdBy) return;

      const paidItems = getPaidItemsForOrder(order);
      if (paidItems.length === 0) return;

      const waiter = users.find((u) => u.id === order.createdBy);
      if (!waiter) return;

      let waiterStats = waiterStatsMap.get(order.createdBy);
      if (!waiterStats) {
        waiterStats = {
          waiterId: order.createdBy,
          waiterName: waiter.displayName || waiter.username || "Bilinmeyen",
          products: [],
          totalQuantity: 0,
          totalRevenue: 0,
        };
        waiterStatsMap.set(order.createdBy, waiterStats);
      }

      paidItems.forEach((item) => {
        const existingProduct = waiterStats.products.find(
          (p) => p.menuId === item.menuId
        );
        if (existingProduct) {
          existingProduct.quantity += item.quantity;
          existingProduct.revenue += item.subtotal;
        } else {
          waiterStats.products.push({
            menuId: item.menuId,
            menuName: item.menuName,
            quantity: item.quantity,
            revenue: item.subtotal,
          });
        }
        waiterStats.totalQuantity += item.quantity;
        waiterStats.totalRevenue += item.subtotal;
      });
    });

    const waiterStats = Array.from(waiterStatsMap.values())
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .map((waiter) => ({
        ...waiter,
        products: waiter.products.sort((a, b) => b.quantity - a.quantity),
      }));

    return {
      totalRevenue,
      totalGiftRevenue,
      totalGiftCount,
      totalOrders: totalProductCount,
      averageOrderValue,
      topProducts,
      allProductsCount: sortedProducts.length,
      cancelledOrders: cancelledItemCount,
      cancelledRevenue,
      paymentMethodStats,
      totalDiscount,
      totalCourierPackages,
      totalCourierPackageAmount,
      waiterStats,
      totalPaymentAmount,
    };
  }, [orders, bills, paymentMethods, courierAssignments, users, showAllProducts]);

  const stats = calculateStats();

  // Period'a göre tarih aralığı hesapla (modal için)
  const getDateRangeForPeriod = useCallback(
    (period: PeriodType): { start: Date; end: Date } => {
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      let start = new Date();

      if (period === "daily") {
        start.setHours(0, 0, 0, 0);
      } else if (period === "weekly") {
        start.setDate(start.getDate() - 7);
        start.setHours(0, 0, 0, 0);
      } else if (period === "monthly") {
        start.setMonth(start.getMonth() - 1);
        start.setHours(0, 0, 0, 0);
      } else if (period === "yearly") {
        start.setFullYear(start.getFullYear() - 1);
        start.setHours(0, 0, 0, 0);
      }

      return { start, end };
    },
    []
  );

  // Garson detay istatistiklerini hesapla (period'a göre)
  const getWaiterDetailStats = useCallback(
    (waiterId: string, period: PeriodType) => {
      const { start, end } = getDateRangeForPeriod(period);

      // Yardımcı: Bir siparişte gerçekten ödenmiş tüm ürünleri (kısmi ve tam) topla
      const getPaidItemsForOrder = (order: Order) => {
        const paidItems: Array<{
          menuId: string;
          menuName: string;
          quantity: number;
          subtotal: number;
        }> = [];

        const paymentsWithItems =
          order.payments?.filter(
            (p) => p.paidItems && p.paidItems.length > 0
          ) ?? [];

        if (paymentsWithItems.length > 0) {
          paymentsWithItems.forEach((payment) => {
            payment.paidItems!.forEach((pi) => {
              paidItems.push({
                menuId: pi.menuId,
                menuName: pi.menuName,
                quantity: pi.quantity,
                subtotal: pi.subtotal,
              });
            });
          });
        }

        if (
          order.status === "closed" &&
          order.items &&
          order.items.length > 0
        ) {
          order.items.forEach((item) => {
            paidItems.push({
              menuId: item.menuId,
              menuName: item.menuName,
              quantity: item.quantity,
              subtotal: item.subtotal,
            });
          });
        }

        return paidItems;
      };

      // Seçili garsonun ve period'a uygun siparişlerini filtrele
      const filteredOrders = orders.filter((order) => {
        if (order.createdBy !== waiterId) return false;

        // createdAt zaten Date objesi olarak geliyor (convertTimestamp ile)
        const orderDate =
          order.createdAt instanceof Date ? order.createdAt : new Date();
        return orderDate >= start && orderDate <= end;
      });

      // Ürün istatistiklerini hesapla
      const productMap = new Map<string, ProductStats>();
      let totalQuantity = 0;
      let totalRevenue = 0;

      filteredOrders.forEach((order) => {
        const paidItems = getPaidItemsForOrder(order);
        paidItems.forEach((item) => {
          const existing = productMap.get(item.menuId);
          if (existing) {
            existing.quantity += item.quantity;
            existing.revenue += item.subtotal;
          } else {
            productMap.set(item.menuId, {
              menuId: item.menuId,
              menuName: item.menuName,
              quantity: item.quantity,
              revenue: item.subtotal,
            });
          }
          totalQuantity += item.quantity;
          totalRevenue += item.subtotal;
        });
      });

      const products = Array.from(productMap.values()).sort(
        (a, b) => b.quantity - a.quantity
      );

      return {
        products,
        totalQuantity,
        totalRevenue,
      };
    },
    [orders, getDateRange]
  );

  // Tüm verileri temizle
  const handleClearAll = async () => {
    const effectiveCompanyId = companyId || userData?.companyId;
    const effectiveBranchId = branchId || userData?.assignedBranchId;

    if (!effectiveCompanyId) return;

    try {
      setIsClearing(true);
      await clearAllStatistics(
        effectiveCompanyId,
        effectiveBranchId || undefined
      );
      setShowClearConfirm(false);
      // State'i temizle - sayfayı yeniden yükleme
      setOrders([]);
      setPaymentMethods([]);
    } catch (error) {
      alert("İstatistikler temizlenirken bir hata oluştu");
    } finally {
      setIsClearing(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gray-50 dark:bg-gray-900 p-3 lg:p-4 overflow-y-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="h-8 w-8" />
            İstatistikler
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
            Satış istatistikleri ve raporlar
          </p>
        </div>
        <Button
          onClick={() => setShowClearConfirm(true)}
          variant="destructive"
          size="sm"
          className="flex items-center gap-2"
        >
          <Trash2 className="h-4 w-4" />
          Tüm Verileri Temizle
        </Button>
      </div>

      {/* Period Selector */}
      <div className="mb-6">
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
          <button
            onClick={() => setSelectedPeriod("daily")}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              selectedPeriod === "daily"
                ? "bg-blue-600 text-white shadow-md"
                : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700"
            }`}
          >
            <Calendar className="h-4 w-4 inline mr-2" />
            Günlük
          </button>
          <button
            onClick={() => setSelectedPeriod("weekly")}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              selectedPeriod === "weekly"
                ? "bg-blue-600 text-white shadow-md"
                : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700"
            }`}
          >
            <Calendar className="h-4 w-4 inline mr-2" />
            Haftalık
          </button>
          <button
            onClick={() => setSelectedPeriod("monthly")}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              selectedPeriod === "monthly"
                ? "bg-blue-600 text-white shadow-md"
                : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700"
            }`}
          >
            <Calendar className="h-4 w-4 inline mr-2" />
            Aylık
          </button>
          <button
            onClick={() => setSelectedPeriod("yearly")}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              selectedPeriod === "yearly"
                ? "bg-blue-600 text-white shadow-md"
                : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700"
            }`}
          >
            <Calendar className="h-4 w-4 inline mr-2" />
            Yıllık
          </button>
          <button
            onClick={() => setSelectedPeriod("custom")}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              selectedPeriod === "custom"
                ? "bg-blue-600 text-white shadow-md"
                : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700"
            }`}
          >
            <Calendar className="h-4 w-4 inline mr-2" />
            Tarih Aralığı
          </button>
        </div>

        {/* Tarih Aralığı Seçimi */}
        {selectedPeriod === "custom" && (
          <div className="flex gap-4 items-center bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Başlangıç Tarihi
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Bitiş Tarihi
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-2 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">
                Toplam Ciro
              </p>
              <p className="text-base font-bold text-blue-600 dark:text-blue-400 truncate">
                ₺{stats.totalRevenue.toFixed(2)}
              </p>
            </div>
            <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-2 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">
                Toplam Ürün
              </p>
              <p className="text-base font-bold text-green-600 dark:text-green-400">
                {stats.totalOrders}
              </p>
            </div>
            <Package className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-2 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">
                Ortalama
              </p>
              <p className="text-base font-bold text-purple-600 dark:text-purple-400 truncate">
                ₺{stats.averageOrderValue.toFixed(2)}
              </p>
            </div>
            <BarChart3 className="h-5 w-5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-2 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">
                İptal
              </p>
              <p className="text-sm font-bold text-red-600 dark:text-red-400">
                {Math.round(stats.cancelledOrders)}
              </p>
              <p className="text-[10px] font-semibold text-red-600 dark:text-red-400 mt-0.5 truncate">
                ₺{stats.cancelledRevenue.toFixed(2)}
              </p>
            </div>
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-2 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">
                İndirim
              </p>
              <p className="text-base font-bold text-orange-600 dark:text-orange-400 truncate">
                ₺{stats.totalDiscount.toFixed(2)}
              </p>
            </div>
            <Percent className="h-5 w-5 text-orange-600 dark:text-orange-400 flex-shrink-0" />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-2 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">
                Paket
              </p>
              <p className="text-sm font-bold text-cyan-600 dark:text-cyan-400">
                {Math.round(stats.totalCourierPackages)}
              </p>
              <p className="text-[10px] font-semibold text-cyan-600 dark:text-cyan-400 mt-0.5 truncate">
                ₺{stats.totalCourierPackageAmount.toFixed(2)}
              </p>
            </div>
            <Bike className="h-5 w-5 text-cyan-600 dark:text-cyan-400 flex-shrink-0" />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-2 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">
                İkramlar
              </p>
              <p className="text-sm font-bold text-orange-600 dark:text-orange-400">
                {Math.round(stats.totalGiftCount || 0)}
              </p>
              <p className="text-[10px] font-semibold text-orange-600 dark:text-orange-400 mt-0.5 truncate">
                ₺{stats.totalGiftRevenue.toFixed(2)}
              </p>
            </div>
            <Utensils className="h-5 w-5 text-orange-600 dark:text-orange-400 shrink-0" />
          </div>
        </div>
      </div>

      {/* Ödeme Yöntemine Göre İstatistikler */}
      {stats.paymentMethodStats.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Ödeme Yöntemine Göre Toplam
          </h2>
          <div className="flex flex-wrap gap-2 justify-between">
            {stats.paymentMethodStats.map((method, index) => (
              <div
                key={index}
                className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2 border border-gray-200 dark:border-gray-600 flex-1 min-w-[120px] max-w-[200px]"
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="font-medium text-gray-900 dark:text-white text-xs truncate">
                    {method.methodName}
                  </p>
                  <span className="text-[10px] text-gray-600 dark:text-gray-400 flex-shrink-0 ml-1">
                    {Math.round(method.count)}
                  </span>
                </div>
                <p className="text-sm font-bold text-blue-600 dark:text-blue-400">
                  ₺{method.total.toFixed(2)}
                </p>
                {stats.totalPaymentAmount > 0 && (
                  <p className="text-[10px] text-gray-600 dark:text-gray-400 mt-0.5">
                    %
                    {((method.total / stats.totalPaymentAmount) * 100).toFixed(
                      1
                    )}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Products */}
      {stats.topProducts.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              En Çok Satılan Ürünler
            </h2>
            {stats.allProductsCount > 10 && (
              <Button
                onClick={() => setShowAllProducts(!showAllProducts)}
                variant="outline"
                size="sm"
                className="text-xs"
              >
                {showAllProducts 
                  ? `10 Ürün Göster (${stats.allProductsCount} toplam)`
                  : `Tümünü Göster (${stats.allProductsCount})`}
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {stats.topProducts.map((product, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="w-6 h-6 bg-blue-600 dark:bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-[10px] flex-shrink-0">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white text-xs truncate">
                      {product.menuName}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-[10px] font-semibold text-gray-700 dark:text-gray-300">
                        {product.quantity} adet
                      </p>
                      <span className="text-[10px] text-gray-500 dark:text-gray-400">•</span>
                      <p className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                        ₺{product.revenue.toFixed(2)}
                    </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Waiter Statistics */}
      {stats.waiterStats && stats.waiterStats.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Users className="h-5 w-5" />
            Garson İstatistikleri
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {stats.waiterStats.map((waiter) => (
              <div
                key={waiter.waiterId}
                className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 border border-gray-200 dark:border-gray-600 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-gray-900 dark:text-white text-sm">
                    {waiter.waiterName}
                  </h3>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                  {Math.round(waiter.totalQuantity)} ürün • ₺
                  {waiter.totalRevenue.toFixed(2)}
                </p>
                <Button
                  onClick={() => {
                    setSelectedWaiter(waiter);
                    setWaiterDetailPeriod("daily");
                    setShowWaiterDetail(true);
                  }}
                  variant="outline"
                  size="sm"
                  className="w-full flex items-center justify-center gap-2"
                >
                  Detay
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Boş Durum */}
      {orders.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8 text-center">
          <BarChart3 className="h-12 w-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
          <p className="text-gray-500 dark:text-gray-400">
            Henüz istatistik bulunmuyor
          </p>
          <p className="text-sm mt-2 text-gray-400 dark:text-gray-500">
            Siparişler kapandıkça istatistikler burada görünecek
          </p>
        </div>
      )}

      {/* Garson Detay Modalı */}
      {showWaiterDetail && selectedWaiter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Users className="h-5 w-5" />
                {selectedWaiter.waiterName} - Detaylı İstatistikler
              </h2>
              <button
                onClick={() => setShowWaiterDetail(false)}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Period Seçimi */}
            <div className="mb-6">
              <div className="flex gap-2 overflow-x-auto pb-2">
                <button
                  onClick={() => setWaiterDetailPeriod("daily")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                    waiterDetailPeriod === "daily"
                      ? "bg-blue-600 text-white shadow-md"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600"
                  }`}
                >
                  <Calendar className="h-4 w-4 inline mr-2" />
                  Günlük
                </button>
                <button
                  onClick={() => setWaiterDetailPeriod("weekly")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                    waiterDetailPeriod === "weekly"
                      ? "bg-blue-600 text-white shadow-md"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600"
                  }`}
                >
                  <Calendar className="h-4 w-4 inline mr-2" />
                  Haftalık
                </button>
                <button
                  onClick={() => setWaiterDetailPeriod("monthly")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                    waiterDetailPeriod === "monthly"
                      ? "bg-blue-600 text-white shadow-md"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600"
                  }`}
                >
                  <Calendar className="h-4 w-4 inline mr-2" />
                  Aylık
                </button>
                <button
                  onClick={() => setWaiterDetailPeriod("yearly")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                    waiterDetailPeriod === "yearly"
                      ? "bg-blue-600 text-white shadow-md"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600"
                  }`}
                >
                  <Calendar className="h-4 w-4 inline mr-2" />
                  Yıllık
                </button>
              </div>
            </div>

            {/* Detay İstatistikler */}
            {(() => {
              const detailStats = getWaiterDetailStats(
                selectedWaiter.waiterId,
                waiterDetailPeriod
              );
              return (
                <>
                  {/* Özet Bilgiler */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                        Toplam Ürün
                      </p>
                      <p className="text-xl font-bold text-green-600 dark:text-green-400">
                        {Math.round(detailStats.totalQuantity)}
                      </p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                        Toplam Ciro
                      </p>
                      <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                        ₺{detailStats.totalRevenue.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {/* Ürün Listesi */}
                  {detailStats.products.length > 0 ? (
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
                        Satılan Ürünler
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {detailStats.products.map((product) => (
                          <div
                            key={product.menuId}
                            className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 border border-gray-200 dark:border-gray-600"
                          >
                            <p className="font-medium text-gray-900 dark:text-white text-sm mb-1">
                              {product.menuName}
                            </p>
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              {Math.round(product.quantity)}x • ₺
                              {product.revenue.toFixed(2)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Package className="h-12 w-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                      <p className="text-gray-500 dark:text-gray-400">
                        Bu dönemde satış bulunmuyor
                      </p>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Tüm Verileri Temizle Onay Modalı */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Tüm Verileri Temizle
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Bu işlem tüm istatistik verilerini kalıcı olarak silecektir. Bu
              işlem geri alınamaz. Emin misiniz?
            </p>
            <div className="flex gap-3">
              <Button
                onClick={handleClearAll}
                disabled={isClearing}
                variant="destructive"
                className="flex-1"
              >
                {isClearing ? "Temizleniyor..." : "Evet, Temizle"}
              </Button>
              <Button
                onClick={() => setShowClearConfirm(false)}
                variant="outline"
                className="flex-1"
              >
                İptal
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
