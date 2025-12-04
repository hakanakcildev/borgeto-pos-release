// QR Menü sistemi ile paylaşılan type'lar
export interface Company {
  id?: string;
  name: string;
  slug: string;
  address: string;
  phone: string;
  email: string;
  website?: string;
  ownerName: string;
  description?: string;
  logo?: string;
  status: "active" | "inactive";
  price: number;
  createdAt: Date;
  updatedAt: Date;
  menuSettings?: {
    showPrices: boolean;
    showImages: boolean;
    showDescriptions: boolean;
    showIngredients: boolean;
    showAllergens: boolean;
    showCalories: boolean;
    theme: string;
  };
  supportedLanguages?: string[];
}

export interface Branch {
  id?: string;
  companyId: string;
  name: string;
  slug: string;
  address?: string;
  phone?: string;
  email?: string;
  description?: string;
  isActive: boolean;
  isDefault: boolean;
  passwordHash?: string; // Hashed password for branch login
  createdAt: Date;
  updatedAt: Date;
}

export interface MenuExtra {
  id: string; // Unique ID for the extra
  name: string; // Extra name (e.g., "Ekstra Peynir", "Ekstra Sos")
  price: number; // Extra price
  isRequired?: boolean; // Is this extra required?
}

export interface Menu {
  id?: string;
  companyId: string;
  branchId?: string;
  name: string;
  description?: string;
  orijinalDil?: string;
  isim_tr?: string;
  isim_en?: string;
  isim_de?: string;
  isim_es?: string;
  isim_fr?: string;
  aciklama_tr?: string;
  aciklama_en?: string;
  aciklama_de?: string;
  aciklama_es?: string;
  aciklama_fr?: string;
  image?: string;
  video?: string;
  price: number;
  category: string;
  isAvailable: boolean;
  ingredients?: string[];
  allergens?: string[];
  calories?: number;
  extras?: MenuExtra[]; // Ekstra malzemeler listesi
  createdAt: Date;
  updatedAt: Date;
}

export interface Category {
  id?: string;
  companyId: string;
  branchId?: string;
  name: string;
  description?: string;
  orijinalDil?: string;
  isim_tr?: string;
  isim_en?: string;
  isim_de?: string;
  isim_es?: string;
  isim_fr?: string;
  image?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id?: string;
  email: string;
  displayName: string;
  phone?: string;
  role: "super_admin" | "admin" | "staff";
  companyId?: string;
  username?: string; // Username for login (for staff users)
  passwordHash?: string; // Hashed password (for staff users)
  assignedBranchId?: string; // Assigned branch ID for staff users
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// POS Sistemine özel type'lar

export interface Table {
  id?: string;
  companyId: string;
  branchId?: string;
  area: string; // Alan adı (örn: "Teras", "Salon", "Bahçe")
  tableNumber: string; // Otomatik oluşturulan masa numarası (örn: "Teras 1", "Salon 2")
  status: "available" | "occupied" | "reserved" | "cleaning"; // Masa durumu (varsayılan: "available")
  currentOrderId?: string; // Aktif sipariş ID'si
  qrCodeId?: string; // İlişkili QR kod ID'si
  position?: {
    x: number;
    y: number;
  }; // Masa planı için pozisyon (opsiyonel)
  createdAt: Date;
  updatedAt: Date;
}

export interface SelectedExtra {
  id: string; // MenuExtra.id
  name: string; // MenuExtra.name (snapshot)
  price: number; // MenuExtra.price (snapshot)
}

export interface OrderItem {
  id?: string;
  cartItemId?: string; // Sepetteki unique ID (yeni eklenen ürünleri ayırt etmek için)
  menuId: string;
  menuName: string; // Menü öğesi adı (snapshot)
  menuPrice: number; // Menü öğesi fiyatı (snapshot)
  quantity: number;
  notes?: string; // Özel notlar (örn: "az baharatlı", "ekstra peynir")
  selectedExtras?: SelectedExtra[]; // Seçilen ekstra malzemeler
  subtotal: number; // quantity * (menuPrice + selectedExtras toplam fiyatı)
  addedAt?: Date; // Ürünün eklendiği zaman
  canceledAt?: Date; // Ürünün iptal edildiği zaman (sadece iptal edilen ürünler için)
  movedAt?: Date; // Ürünün taşındığı zaman (sadece taşınan ürünler için)
  movedToTableId?: string; // Taşındığı masa ID'si (sadece taşınan ürünler için)
  movedToTableNumber?: string; // Taşındığı masa numarası (sadece taşınan ürünler için)
  movedFromTableId?: string; // Ürünün taşındığı kaynak masa ID'si
  movedFromTableNumber?: string; // Ürünün taşındığı kaynak masa numarası
}

export type OrderStatus = 
  | "active" // Aktif (açık sipariş)
  | "closed"; // Kapalı (kapatılmış sipariş)

export type PaymentStatus = 
  | "unpaid" // Ödenmedi
  | "partial" // Kısmi ödendi
  | "paid"; // Ödendi

export type PaymentMethod = 
  | "cash" // Nakit
  | "card" // Kart
  | "mealCard"; // Yemek Kartı

// Ödeme yöntemi yapılandırması (kullanıcı tanımlı)
export interface PaymentMethodConfig {
  id?: string;
  companyId: string;
  branchId?: string;
  code: string; // Benzersiz kod (örn: "cash", "card", "mealCard", "custom1")
  name: string; // Görünen ad (örn: "Nakit", "Kart", "Yemek Kartı")
  color?: string; // Buton rengi (hex veya Tailwind class)
  icon?: string; // İkon adı (opsiyonel)
  isDefault: boolean; // Standart ödeme yöntemi mi?
  isActive: boolean; // Aktif mi?
  order: number; // Sıralama
  createdAt: Date;
  updatedAt: Date;
}

export interface Payment {
  id?: string;
  amount: number;
  method: string; // Ödeme yöntemi kodu (PaymentMethodConfig.code)
  paidAt: Date;
  notes?: string;
  paidItems?: Array<{
    menuId: string;
    menuName: string;
    quantity: number;
    subtotal: number;
  }>; // Ödenen ürünler (kısmi ödeme için)
}

export interface Order {
  id?: string;
  companyId: string;
  branchId?: string;
  tableId: string;
  tableNumber: string; // Masa numarası (snapshot)
  orderNumber: string; // Sipariş numarası (örn: "ORD-2024-001")
  items: OrderItem[];
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  payments?: Payment[]; // Ödemeler (kısmi ödeme için)
  canceledItems?: OrderItem[]; // İptal edilen ürünler
  movedItems?: OrderItem[]; // Taşınan ürünler
  subtotal: number; // Ara toplam
  tax?: number; // Vergi (KDV)
  discount?: number; // İndirim
  total: number; // Toplam
  customerName?: string; // Müşteri adı (opsiyonel)
  customerPhone?: string; // Müşteri telefonu (opsiyonel)
  notes?: string; // Sipariş notları
  sentItems?: string[]; // Gönderilen ürün ID'leri (yeni eklenen ürünleri tespit etmek için)
  createdBy: string; // Kullanıcı ID'si
  createdAt: Date;
  updatedAt: Date;
  closedAt?: Date; // Kapanma tarihi
  courierId?: string; // Kurye ID'si (kurye atandıysa)
  courierName?: string; // Kurye adı (snapshot)
  changeAmount?: number; // Para üstü (kurye atandıysa)
}

// Kurye
export interface Courier {
  id?: string;
  companyId: string;
  branchId?: string;
  name: string;
  pricePerPackage: number; // Paket başı fiyat
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Kurye atama kaydı (Order'a bağlı)
export interface CourierAssignment {
  id?: string;
  companyId: string;
  branchId?: string;
  orderId: string;
  tableId: string;
  tableNumber: string;
  courierId: string;
  courierName: string;
  packageCount: number; // Paket sayısı
  changeAmount: number; // Para üstü
  paymentMethod: string; // Ödeme yöntemi kodu (PaymentMethodConfig.code)
  totalAmount: number; // Toplam tutar
  assignedAt: Date;
  assignedBy: string; // Kullanıcı ID'si
}

// Masa durumu istatistikleri
export interface TableStats {
  total: number;
  available: number;
  occupied: number;
  reserved: number;
  cleaning: number;
}

// Günlük satış istatistikleri
export interface DailyStats {
  date: string; // YYYY-MM-DD formatında
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  ordersByStatus: Record<OrderStatus, number>;
}

// Satış istatistikleri
export interface SalesStats {
  id?: string;
  companyId: string;
  branchId?: string;
  date: string; // YYYY-MM-DD formatında
  period: "daily" | "weekly" | "monthly"; // Günlük, haftalık, aylık
  totalOrders: number;
  totalRevenue: number;
  totalDiscount: number; // Toplam indirim tutarı
  averageOrderValue: number;
  topProducts: Array<{
    menuId: string;
    menuName: string;
    quantity: number;
    revenue: number;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

// Adisyon (Bill/Receipt)
export interface Bill {
  id?: string;
  companyId: string;
  branchId?: string;
  tableId: string;
  tableNumber: string; // Masa numarası (snapshot)
  orderId: string; // Hangi siparişten geldiği
  billNumber: string; // Adisyon numarası (örn: "AD-2024-001")
  items: OrderItem[]; // Ödenen ürünler
  subtotal: number; // Ara toplam
  discount?: number; // İndirim
  total: number; // Toplam
  payments: Payment[]; // Ödemeler
  customerName?: string; // Müşteri adı (opsiyonel)
  customerPhone?: string; // Müşteri telefonu (opsiyonel)
  notes?: string; // Notlar
  createdBy: string; // Kullanıcı ID'si
  createdAt: Date;
  closedAt: Date; // Ödeme alındığında
}

// Cari (Customer Account)
export interface CustomerAccount {
  id?: string;
  companyId: string;
  branchId?: string;
  name: string; // Müşteri adı
  phone?: string; // Telefon (opsiyonel)
  email?: string; // Email (opsiyonel)
  balance: number; // Bakiye (varsayılan: 0)
  isActive: boolean; // Aktif mi?
  createdAt: Date;
  updatedAt: Date;
  lastOrderAt?: Date; // Son sipariş tarihi
}

// Stok Yönetimi
export type StockMovementType = "in" | "out" | "adjustment"; // Giriş, Çıkış, Düzeltme

export interface StockMovement {
  id?: string;
  companyId: string;
  branchId?: string;
  stockId: string; // Hangi stok kalemine ait
  type: StockMovementType; // Giriş, çıkış veya düzeltme
  quantity: number; // Miktar (pozitif değer)
  unitType: "package" | "item"; // Koli/paket veya adet
  reason?: string; // Sebep (örn: "Satış", "Alış", "Sayım düzeltmesi")
  notes?: string; // Notlar
  createdBy: string; // Kullanıcı ID'si
  createdAt: Date;
}

export interface Stock {
  id?: string;
  companyId: string;
  branchId?: string;
  name: string; // Stok adı (örn: "Domates", "Peynir")
  description?: string; // Açıklama
  packageType: "koli" | "paket"; // Koli veya paket
  itemsPerPackage: number; // 1 kolide/pakette kaç adet ürün var
  currentQuantity: number; // Mevcut miktar (adet cinsinden)
  minQuantity: number; // Minimum stok seviyesi (adet cinsinden, uyarı için)
  maxQuantity?: number; // Maksimum stok seviyesi (adet cinsinden, opsiyonel)
  category?: string; // Kategori (opsiyonel, menü kategorileriyle ilişkilendirilebilir)
  menuId: string; // İlişkili menü ID'si (zorunlu, hangi menü ürünüyle eşleştiği)
  menuName?: string; // İlişkili menü adı (snapshot)
  cost?: number; // Birim maliyet (opsiyonel)
  location?: string; // Depo konumu (opsiyonel)
  isActive: boolean; // Aktif mi?
  createdAt: Date;
  updatedAt: Date;
}

