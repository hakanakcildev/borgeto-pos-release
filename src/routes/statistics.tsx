import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getOrdersByCompany } from "@/lib/firebase/orders";
import { clearAllStatistics } from "@/lib/firebase/statistics";
import { getPaymentMethodsByCompany } from "@/lib/firebase/paymentMethods";
import { getCourierAssignmentsByCompany } from "@/lib/firebase/couriers";
import type { Order, OrderItem, Payment, PaymentMethodConfig } from "@/lib/firebase/types";
import { BarChart3, TrendingUp, Package, Calendar, Trash2, AlertTriangle, CreditCard, Percent, Bike } from "lucide-react";
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

type PeriodType = "daily" | "weekly" | "monthly" | "custom";

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

function StatisticsContent() {
  const { userData, companyId, branchId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>("daily");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodConfig[]>([]);
  const [courierAssignments, setCourierAssignments] = useState<any[]>([]);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // Tarih aralığını hesapla
  const getDateRange = useCallback((period: PeriodType): { start: Date; end: Date } => {
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
  }, [startDate, endDate]);

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
        
        const [allOrders, paymentMethodsData, courierAssignmentsData] = await Promise.all([
          // Hem kapalı hem de kısmi ödemesi alınmış (hala açık) siparişleri getiriyoruz.
          // Satış istatistiklerinde sadece gerçekten ödenmiş ürünleri hesaba katıyoruz.
          getOrdersByCompany(effectiveCompanyId, {
            branchId: effectiveBranchId || undefined,
            startDate: start,
            endDate: end,
          }),
          getPaymentMethodsByCompany(effectiveCompanyId, effectiveBranchId || undefined).catch(() => []),
          getCourierAssignmentsByCompany(
            effectiveCompanyId,
            effectiveBranchId || undefined,
            start,
            end
          ).catch(() => []),
        ]);

        setOrders(allOrders);
        setPaymentMethods(paymentMethodsData);
        setCourierAssignments(courierAssignmentsData);
      } catch (error) {
        // Error loading data
      } finally {
        setLoading(false);
      }
    };

    loadOrders();
  }, [companyId, branchId, userData?.companyId, userData?.assignedBranchId, selectedPeriod, startDate, endDate, getDateRange]);

  // İstatistikleri hesapla
  const calculateStats = useCallback(() => {
    // Yardımcı: Bir siparişte gerçekten ödenmiş tüm ürünleri (kısmi ve tam) topla
    const getPaidItemsForOrder = (order: Order) => {
      const paidItems: Array<{ menuId: string; menuName: string; quantity: number; subtotal: number }> = [];

      const paymentsWithItems =
        order.payments?.filter((p) => p.paidItems && p.paidItems.length > 0) ?? [];

      if (paymentsWithItems.length > 0) {
        // Kısmi veya item bazlı ödemelerde, paidItems'ları ekle
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
      if (order.status === "closed" && order.items && order.items.length > 0) {
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

    // Tüm siparişlerden ödenmiş ürünleri topla
    const allPaidItems = orders.flatMap(getPaidItemsForOrder);

    // Toplam satışlar: Ödemesi alınan tüm ürünler
    const totalRevenue = allPaidItems.reduce((sum, item) => sum + item.subtotal, 0);
    
    // Toplam ürün sayısı: Ödemesi alınan tüm ürünler
    const totalOrders = allPaidItems.reduce((sum, item) => sum + item.quantity, 0);
    
    // Ödemesi alınan sipariş sayısı (ortalama hesaplamak için)
    const paidOrderCount = orders.filter((order) => 
      getPaidItemsForOrder(order).length > 0
    ).length;
    
    const averageOrderValue = paidOrderCount > 0 ? totalRevenue / paidOrderCount : 0;

    // En çok satılan ürünler: Ödemesi alınan tüm ürünler
    const productMap = new Map<string, ProductStats>();
    allPaidItems.forEach((item) => {
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
    const topProducts = Array.from(productMap.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

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
                  paidItemsMap.set(paidItem.menuId, currentQty + paidItem.quantity);
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
              cancelledRevenue += (unpaidQuantity * item.menuPrice);
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
    
    // Sonra siparişlerden gelen ödemeleri ekle
    orders.forEach((order) => {
      if (order.payments && order.payments.length > 0) {
        order.payments.forEach((payment: Payment) => {
          const existing = paymentMethodMap.get(payment.method);
          if (existing) {
            existing.total += payment.amount;
            existing.count += 1;
          } else {
            // Eğer yöntem listede yoksa ekle
            const methodName = 
              payment.method === "cash" ? "Nakit" :
              payment.method === "card" ? "Kart" :
              payment.method === "mealCard" ? "Yemek Kartı" :
              payment.method;
            
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
    
    const paymentMethodStats = Array.from(paymentMethodMap.values())
      .sort((a, b) => b.total - a.total);

    // Toplam indirim: Ödemesi alınan siparişlerdeki indirimlerin toplamı
    let totalDiscount = 0;
    orders.forEach((order) => {
      const paidItems = getPaidItemsForOrder(order);
      // Eğer bu siparişte ödenmiş ürün varsa, indirimini say
      if (paidItems.length > 0 && order.discount) {
        totalDiscount += order.discount;
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

    return {
      totalRevenue,
      totalOrders,
      averageOrderValue,
      topProducts,
      cancelledOrders: cancelledItemCount,
      cancelledRevenue,
      paymentMethodStats,
      totalDiscount,
      totalCourierPackages,
      totalCourierPackageAmount,
    };
  }, [orders, paymentMethods, courierAssignments]);

  const stats = calculateStats();

  // Tüm verileri temizle
  const handleClearAll = async () => {
    const effectiveCompanyId = companyId || userData?.companyId;
    const effectiveBranchId = branchId || userData?.assignedBranchId;
    
    if (!effectiveCompanyId) return;

    try {
      setIsClearing(true);
      await clearAllStatistics(effectiveCompanyId, effectiveBranchId || undefined);
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
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-2 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">Toplam Ciro</p>
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
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">Toplam Ürün</p>
              <p className="text-base font-bold text-green-600 dark:text-green-400">{Math.round(stats.totalOrders)}</p>
            </div>
            <Package className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-2 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">Ortalama</p>
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
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">İptal</p>
              <p className="text-base font-bold text-red-600 dark:text-red-400">{Math.round(stats.cancelledOrders)}</p>
            </div>
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-2 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">İndirim</p>
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
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">Paket</p>
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
      </div>

      {/* Ödeme Yöntemine Göre İstatistikler */}
      {stats.paymentMethodStats.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Ödeme Yöntemine Göre Toplam
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
            {stats.paymentMethodStats.map((method, index) => (
              <div
                key={index}
                className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2 border border-gray-200 dark:border-gray-600"
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="font-medium text-gray-900 dark:text-white text-xs truncate">{method.methodName}</p>
                  <span className="text-[10px] text-gray-600 dark:text-gray-400 flex-shrink-0 ml-1">{Math.round(method.count)}</span>
                </div>
                <p className="text-sm font-bold text-blue-600 dark:text-blue-400">
                  ₺{method.total.toFixed(2)}
                </p>
                {stats.totalRevenue > 0 && (
                  <p className="text-[10px] text-gray-600 dark:text-gray-400 mt-0.5">
                    %{((method.total / stats.totalRevenue) * 100).toFixed(1)}
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
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">En Çok Satılan Ürünler</h2>
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
                    <p className="font-medium text-gray-900 dark:text-white text-xs truncate">{product.menuName}</p>
                    <p className="text-[10px] text-gray-600 dark:text-gray-400">
                      {Math.round(product.quantity)}x • ₺{product.revenue.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Boş Durum */}
      {orders.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8 text-center">
          <BarChart3 className="h-12 w-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
          <p className="text-gray-500 dark:text-gray-400">Henüz istatistik bulunmuyor</p>
          <p className="text-sm mt-2 text-gray-400 dark:text-gray-500">
            Siparişler kapandıkça istatistikler burada görünecek
          </p>
        </div>
      )}

      {/* Tüm Verileri Temizle Onay Modalı */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Tüm Verileri Temizle</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Bu işlem tüm istatistik verilerini kalıcı olarak silecektir. Bu işlem geri alınamaz. Emin misiniz?
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
