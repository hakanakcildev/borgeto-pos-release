import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import type { SalesStats, Order } from "./types";
import { getOrdersByCompany } from "./orders";
import { clearAllBills } from "./bills";

const COLLECTION_NAME = "sales_stats";

// Convert Firestore timestamp to Date
const convertTimestamp = (data: any) => ({
  ...data,
  createdAt: data.createdAt?.toDate() || new Date(),
  updatedAt: data.updatedAt?.toDate() || new Date(),
});

// Convert Date to Firestore timestamp
const convertToFirestore = (data: Partial<SalesStats>) => {
  const filteredData = Object.fromEntries(
    Object.entries(data).filter(([_, value]) => value !== undefined)
  );

  return {
    ...filteredData,
    createdAt:
      filteredData.createdAt && filteredData.createdAt instanceof Date
        ? Timestamp.fromDate(filteredData.createdAt)
        : Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
};

// Siparişten istatistik hesapla
const calculateStatsFromOrders = (orders: Order[]) => {
  // Yardımcı: Bir siparişte gerçekten ödenmiş tüm ürünleri (kısmi ve tam) topla (ikramlar ve iptaller hariç)
  const getPaidItemsForOrder = (order: Order) => {
    const paidItems: Array<{
      menuId: string;
      menuName: string;
      quantity: number;
      subtotal: number;
    }> = [];

    // Kısmi ödemelerde paidItems'ları ekle (ikramlar hariç)
    const paymentsWithItems =
      order.payments?.filter(
        (p) => p.paidItems && p.paidItems.length > 0 && !p.isGift
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

    // Sipariş kapandıysa, kapanış anında kalan ürünler de artık tamamen ödenmiş demektir
    // (İkram ödemeleri hariç ve iptal edilen ürünler hariç)
    if (order.status === "closed" && order.items && order.items.length > 0) {
      // Son ödemenin ikram olup olmadığını kontrol et
      const lastPayment =
        order.payments && order.payments.length > 0
          ? order.payments[order.payments.length - 1]
          : null;
      const isLastPaymentGift = lastPayment?.isGift || false;

      if (!isLastPaymentGift) {
        // İptal edilen ürünleri hariç tut
        order.items.forEach((item) => {
          if (!item.canceledAt) {
            paidItems.push({
              menuId: item.menuId,
              menuName: item.menuName,
              quantity: item.quantity,
              subtotal: item.subtotal,
            });
          }
        });
      }
    }

    return paidItems;
  };

  // Ödemesi alınan tüm ürünleri topla
  const allPaidItems = orders.flatMap(getPaidItemsForOrder);

  // Satılan ürün adedi (toplam quantity)
  const totalItemsSold = allPaidItems.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  // Ödemesi alınan sipariş sayısı
  const totalOrders = orders.filter(
    (order) => getPaidItemsForOrder(order).length > 0
  ).length;

  // Toplam satışlar: Ödemesi alınan tüm ödemelerin toplamı (ikramlar hariç)
  let totalRevenue = 0;
  orders.forEach((order) => {
    if (order.payments && order.payments.length > 0) {
      order.payments.forEach((payment) => {
        if (!payment.isGift) {
          totalRevenue += payment.amount;
        }
      });
    }
  });

  const averageOrderValue =
    totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // Toplam indirim: Ödemesi alınan siparişlerdeki indirimlerin toplamı
  let totalDiscount = 0;
  orders.forEach((order) => {
    const paidItems = getPaidItemsForOrder(order);
    // Eğer bu siparişte ödenmiş ürün varsa, indirimini say
    if (paidItems.length > 0 && order.discount) {
      totalDiscount += order.discount;
    }
  });

  // En çok satılan ürünleri hesapla (ödenmiş ürünlerden)
  const productMap = new Map<string, { menuId: string; menuName: string; quantity: number; revenue: number }>();
  
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
    .slice(0, 10); // En çok satılan 10 ürün

  return {
    totalOrders,
    totalItemsSold,
    totalRevenue,
    totalDiscount,
    averageOrderValue,
    topProducts,
  };
};

// Günlük istatistik kaydet/güncelle
export const saveDailyStats = async (
  companyId: string,
  date: string, // YYYY-MM-DD
  branchId?: string
): Promise<void> => {
  try {
    // O günün siparişlerini getir
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    const allOrders = await getOrdersByCompany(companyId, { branchId });
    const dailyOrders = allOrders.filter(
      (order) =>
        order.closedAt &&
        order.closedAt >= startDate &&
        order.closedAt <= endDate &&
        order.status === "closed"
    );

    const stats = calculateStatsFromOrders(dailyOrders);

    // Mevcut istatistiği kontrol et
    let q = query(
      collection(db, COLLECTION_NAME),
      where("companyId", "==", companyId),
      where("date", "==", date),
      where("period", "==", "daily")
    );
    
    if (branchId) {
      q = query(q, where("branchId", "==", branchId));
    }

    const querySnapshot = await getDocs(q);
    
    const statsData: Partial<SalesStats> = {
      companyId,
      branchId,
      createdBy: branchId ?? undefined,
      date,
      period: "daily",
      ...stats,
    };

    if (querySnapshot.empty) {
      // Yeni istatistik oluştur
      await addDoc(collection(db, COLLECTION_NAME), convertToFirestore(statsData));
    } else {
      // Mevcut istatistiği güncelle
      const docRef = doc(db, COLLECTION_NAME, querySnapshot.docs[0].id);
      await updateDoc(docRef, convertToFirestore(statsData));
    }
  } catch (error) {
    throw error;
  }
};

// Haftalık istatistik kaydet/güncelle
export const saveWeeklyStats = async (
  companyId: string,
  weekStartDate: string, // YYYY-MM-DD (haftanın ilk günü)
  branchId?: string
): Promise<void> => {
  try {
    const startDate = new Date(weekStartDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);
    endDate.setHours(23, 59, 59, 999);

    const allOrders = await getOrdersByCompany(companyId, { branchId });
    const weeklyOrders = allOrders.filter(
      (order) =>
        order.closedAt &&
        order.closedAt >= startDate &&
        order.closedAt <= endDate &&
        order.status === "closed"
    );

    const stats = calculateStatsFromOrders(weeklyOrders);

    // Mevcut istatistiği kontrol et
    let q = query(
      collection(db, COLLECTION_NAME),
      where("companyId", "==", companyId),
      where("date", "==", weekStartDate),
      where("period", "==", "weekly")
    );
    
    if (branchId) {
      q = query(q, where("branchId", "==", branchId));
    }

    const querySnapshot = await getDocs(q);
    
    const statsData: Partial<SalesStats> = {
      companyId,
      branchId,
      createdBy: branchId ?? undefined,
      date: weekStartDate,
      period: "weekly",
      ...stats,
    };

    if (querySnapshot.empty) {
      await addDoc(collection(db, COLLECTION_NAME), convertToFirestore(statsData));
    } else {
      const docRef = doc(db, COLLECTION_NAME, querySnapshot.docs[0].id);
      await updateDoc(docRef, convertToFirestore(statsData));
    }
  } catch (error) {
    throw error;
  }
};

// Aylık istatistik kaydet/güncelle
export const saveMonthlyStats = async (
  companyId: string,
  monthDate: string, // YYYY-MM formatında
  branchId?: string
): Promise<void> => {
  try {
    const [year, month] = monthDate.split("-").map(Number);
    const startDate = new Date(year, month - 1, 1);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(year, month, 0);
    endDate.setHours(23, 59, 59, 999);

    const allOrders = await getOrdersByCompany(companyId, { branchId });
    const monthlyOrders = allOrders.filter(
      (order) =>
        order.closedAt &&
        order.closedAt >= startDate &&
        order.closedAt <= endDate &&
        order.status === "closed"
    );

    const stats = calculateStatsFromOrders(monthlyOrders);

    // Mevcut istatistiği kontrol et
    let q = query(
      collection(db, COLLECTION_NAME),
      where("companyId", "==", companyId),
      where("date", "==", monthDate),
      where("period", "==", "monthly")
    );
    
    if (branchId) {
      q = query(q, where("branchId", "==", branchId));
    }

    const querySnapshot = await getDocs(q);
    
    const statsData: Partial<SalesStats> = {
      companyId,
      branchId,
      createdBy: branchId ?? undefined,
      date: monthDate,
      period: "monthly",
      ...stats,
    };

    if (querySnapshot.empty) {
      await addDoc(collection(db, COLLECTION_NAME), convertToFirestore(statsData));
    } else {
      const docRef = doc(db, COLLECTION_NAME, querySnapshot.docs[0].id);
      await updateDoc(docRef, convertToFirestore(statsData));
    }
  } catch (error) {
    throw error;
  }
};

// İstatistikleri getir
export const getStats = async (
  companyId: string,
  period: "daily" | "weekly" | "monthly",
  date?: string,
  branchId?: string
): Promise<SalesStats[]> => {
  try {
    let q = query(
      collection(db, COLLECTION_NAME),
      where("companyId", "==", companyId),
      where("period", "==", period)
    );

    if (branchId) {
      q = query(q, where("branchId", "==", branchId));
    }

    if (date) {
      q = query(q, where("date", "==", date));
    }

    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...convertTimestamp(doc.data()),
        }) as SalesStats
    );
  } catch (error) {
    throw error;
  }
};

// Sipariş kapandığında istatistikleri güncelle
export const updateStatsOnOrderClose = async (
  companyId: string,
  order: Order,
  branchId?: string
): Promise<void> => {
  try {
    if (!order.closedAt) return;

    // Günlük istatistik
    const dailyDate = order.closedAt.toISOString().split("T")[0]; // YYYY-MM-DD
    await saveDailyStats(companyId, dailyDate, branchId);

    // Haftalık istatistik (haftanın ilk günü)
    const weekStart = new Date(order.closedAt);
    const dayOfWeek = weekStart.getDay();
    const diff = weekStart.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Pazartesi
    weekStart.setDate(diff);
    const weekStartDate = weekStart.toISOString().split("T")[0];
    await saveWeeklyStats(companyId, weekStartDate, branchId);

    // Aylık istatistik
    const monthDate = `${order.closedAt.getFullYear()}-${String(order.closedAt.getMonth() + 1).padStart(2, "0")}`;
    await saveMonthlyStats(companyId, monthDate, branchId);
  } catch (error) {
    // Hata olsa bile devam et
  }
};

// Tüm istatistikleri temizle (veritabanından da siler: sales_stats, bills, orders)
export const clearAllStatistics = async (companyId: string, branchId?: string): Promise<void> => {
  const statsRef = collection(db, COLLECTION_NAME);

  // 1. sales_stats: companyId (+ branchId varsa) ile sil; şube seçiliyse createdBy ile de eşleşenleri sil
  const statsDocRefs = new Set<string>();

  let statsQuery = query(statsRef, where("companyId", "==", companyId));
  if (branchId) {
    statsQuery = query(statsRef, where("companyId", "==", companyId), where("branchId", "==", branchId));
  }
  const statsSnapshot = await getDocs(statsQuery);
  statsSnapshot.docs.forEach((d) => statsDocRefs.add(d.id));

  if (branchId) {
    const byCreatedBy = query(
      statsRef,
      where("companyId", "==", companyId),
      where("createdBy", "==", branchId)
    );
    const snapCreatedBy = await getDocs(byCreatedBy);
    snapCreatedBy.docs.forEach((d) => statsDocRefs.add(d.id));
  }

  const ordersCollection = collection(db, "orders");
  await Promise.all(
    Array.from(statsDocRefs).map((id) => deleteDoc(doc(db, COLLECTION_NAME, id)))
  );

  // 2. Adisyonları temizle (bills)
  await clearAllBills(companyId, branchId);

  // 3. Kapalı siparişleri sil
  let orderIds: Set<string>;
  if (branchId) {
    const withBranch = await getOrdersByCompany(companyId, { status: "closed", branchId });
    const allClosed = await getOrdersByCompany(companyId, { status: "closed" });
    orderIds = new Set(withBranch.map((o) => o.id).filter((id): id is string => Boolean(id)));
    allClosed.forEach((o) => {
      const data = o as Order & { createdBy?: string };
      if (data.createdBy === branchId || (o as Order).branchId === branchId) {
        if (o.id) orderIds.add(o.id);
      }
    });
  } else {
    const orders = await getOrdersByCompany(companyId, { status: "closed" });
    orderIds = new Set(orders.map((o) => o.id).filter((id): id is string => Boolean(id)));
  }
  await Promise.all(
    Array.from(orderIds).map((id) => deleteDoc(doc(ordersCollection, id)))
  );
};

