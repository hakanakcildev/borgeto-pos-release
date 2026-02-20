# POS Sistemi – Firestore CRUD ve Koleksiyon Raporu

Bu rapor, **borgeto-pos-win** POS uygulamasındaki tüm Firestore CRUD işlemlerini, kullanılan koleksiyonları ve kaydedilen alanları özetler.

---

## 1. Koleksiyon Özeti

| Koleksiyon | Amaç |
|------------|------|
| `orders` | Siparişler (aktif/kapalı), ürünler, ödemeler, iptal/taşınan ürünler |
| `bills` | Adisyonlar (ödenen ürünler, ödeme detayı, indirim) |
| `sales_stats` | Günlük/haftalık/aylık satış istatistikleri, en çok satılan ürünler |
| `tableHistory` | Masa geçmişi (ürün ekleme, iptal, taşıma, kısmi/tam ödeme) |
| `tables` | Masalar (alan, numara, durum, aktif sipariş) |
| `menus` | Ürünler (POS menü öğeleri) |
| `categories` | Kategoriler |
| `qrMenus` / `menuCategories` / `menuItems` | QR menü (okuma; POS bazen menuItems’tan günceller) |
| `paymentMethods` | Ödeme yöntemleri (nakit, kart, özel) |
| `customers` | Cari hesaplar (cari masaya gönderilen müşteriler) |
| `couriers` | Kuryeler |
| `courierAssignments` | Kurye atamaları (sipariş–kurye–paket sayısı, para üstü) |
| `stocks` | Stok kalemleri |
| `stockMovements` | Stok hareketleri (giriş/çıkış/düzeltme) |
| `recipes` | Reçeteler (menü–stok ilişkisi, maliyet) |
| `users` | Kullanıcılar (admin, manager, staff) |
| `branches` | Şubeler (auth tarafından okunur) |
| `companies` | Şirketler |
| `shiftSchedules` | Vardiya programları |
| `shiftOptions` | Vardiya seçenekleri (mesai türleri) |
| `shiftEmployees` | Vardiya çalışanları |
| `storeHours` | Mağaza çalışma saatleri |

---

## 2. Sipariş ve Ödeme Akışı

### 2.1 `orders` (Siparişler)

**Koleksiyon:** `orders`

| İşlem | Fonksiyon | Ne zaman |
|-------|-----------|----------|
| **Create** | `addOrder()` | Yeni sipariş açıldığında (masa seçilip ürün eklenince) |
| **Read** | `getOrder(id)`, `getOrdersByCompany()`, `getActiveOrders()` | Sipariş detayı, liste, aktif siparişler |
| **Update** | `updateOrder()`, `updateOrderStatus()` | Ürün ekleme/çıkarma, iptal, taşıma, ödeme, kapatma |
| **Delete** | (statistics içinde) `clearAllStatistics()` | İstatistik “verileri sil” ile kapalı siparişler silinir |

**Kaydedilen alanlar (özet):**

- `companyId`, `branchId`, `tableId`, `tableNumber`, `orderNumber`
- `items`: `menuId`, `menuName`, `menuPrice`, `quantity`, `subtotal`, `notes`, `addedAt`, `selectedExtras`, taşıma için `movedAt`, `movedToTableId`, `movedToTableNumber`, `movedFromTableId`, `movedFromTableNumber`
- `canceledItems`: iptal edilen ürünler; her biri `menuId`, `menuName`, `menuPrice`, `quantity`, `subtotal`, `notes`, `addedAt`, `canceledAt`, `selectedExtras`
- `movedItems`: başka masaya taşınan ürünler; `movedAt`, `movedToTableId`, `movedToTableNumber`, `movedFromTableId`, `movedFromTableNumber`
- `status`: `"active"` | `"closed"`
- `paymentStatus`: `"unpaid"` | `"partial"` | `"paid"`
- `payments`: her ödeme için `amount`, `method`, `paidAt`, `notes`, `isGift` (ikram), `paidItems` (kısmi ödeme: `menuId`, `menuName`, `quantity`, `menuPrice`, `subtotal`, `uniqueKey`, `selectedExtras`)
- `subtotal`, `tax`, `discount`, `total`
- `customerName`, `customerPhone`, `notes`
- `sentItems`: cari masaya gönderilen ürün ID’leri
- `createdBy`, `createdAt`, `updatedAt`, `closedAt`
- `courierId`, `courierName`, `changeAmount` (kurye atanmışsa)

**Önemli:**  
- Ödemesi alınan ürünler: `payments[].paidItems` (kısmi) veya sipariş kapatıldığında kalan `items` tam ödenmiş kabul edilir.  
- İptal edilen ürünler: `canceledItems` içinde, `canceledAt` dolu.  
- Cari masaya gönderilen ürünler: `sentItems` ve ilgili ürünler `items` içinde kalır (taşıma bilgisi varsa `movedItems`/taşınan masa tarafında takip edilir).

---

### 2.2 `bills` (Adisyonlar)

**Koleksiyon:** `bills`

| İşlem | Fonksiyon | Ne zaman |
|-------|-----------|----------|
| **Create** | `addBill()` | Sipariş kapatılırken (tam veya son kısmi ödeme) ödenen ürünler için tek adisyon oluşturulur |
| **Read** | `getBill(id)`, `getBillsByTable()`, `getBillsByCompany()`, `getTablesWithBills()` | Adisyon detayı, masaya/şirkete göre liste |
| **Delete** | `clearAllBills()` | İstatistik “verileri sil” ile |

**Kaydedilen alanlar:**

- `companyId`, `branchId`, `tableId`, `tableNumber`, `orderId`, `billNumber` (örn. AD-2024-xxx)
- `items`: ödenen ürünler (OrderItem: `menuId`, `menuName`, `menuPrice`, `quantity`, `subtotal`, `notes`, `addedAt`, `selectedExtras` vb.)
- `subtotal`, `discount`, `total`
- `payments`: `amount`, `method`, `paidAt`, `notes`, `paidItems` (hangi ürünlerin bu ödemeyle alındığı)
- `customerName`, `customerPhone`, `notes`
- `createdBy`, `createdAt`, `closedAt`

**İndirim:** Siparişteki indirim, kapatma anında hesaplanıp `discount` olarak adisyona yazılır.  
**Paket:** Fiziksel “paket” bilgisi doğrudan bills’da tutulmaz; kurye atamasında paket sayısı `courierAssignments`’ta tutulur (aşağıda).

---

### 2.3 `sales_stats` (Satış İstatistikleri)

**Koleksiyon:** `sales_stats`

| İşlem | Fonksiyon | Ne zaman |
|-------|-----------|----------|
| **Create** | `saveDailyStats()`, `saveWeeklyStats()`, `saveMonthlyStats()` | Sipariş kapatıldığında `updateStatsOnOrderClose()` ile günlük/haftalık/aylık doc yoksa oluşturulur |
| **Update** | Aynı fonksiyonlar | Aynı tarih/period için doc varsa güncellenir |
| **Read** | `getStats()` (POS), panel tarafında `getSalesStatsByBranchId()` | İstatistik sayfaları |
| **Delete** | `clearAllStatistics()` | “Tüm verileri temizle” |

**Kaydedilen alanlar:**

- `companyId`, `branchId`, `createdBy` (şube/branchId ile aynı)
- `date`: günlük `YYYY-MM-DD`, haftalık başlangıç tarihi, aylık `YYYY-MM`
- `period`: `"daily"` | `"weekly"` | `"monthly"`
- `totalOrders`, `totalItemsSold`, `totalRevenue`, `totalDiscount`, `averageOrderValue`
- `topProducts`: `{ menuId, menuName, quantity, revenue }[]` (en çok satılan ürünler)
- `createdAt`, `updatedAt`

**Hesaplama:** Kapalı siparişlerden; ödemesi alınan ürünler `payments[].paidItems` ve kapanış anındaki `items` (ikramlar hariç, iptaller hariç) üzerinden toplanır. İndirim, ödenen siparişlerdeki `order.discount` toplamı.

---

### 2.4 `tableHistory` (Masa Geçmişi)

**Koleksiyon:** `tableHistory`

| İşlem | Fonksiyon | Ne zaman |
|-------|-----------|----------|
| **Create** | `addTableHistory()` | Ürün eklendi, ürün iptal edildi, ürün taşındı, masa değişti, kısmi ödeme alındı, tam ödeme alındı |
| **Read** | `getTableHistory()`, `getAllTableHistory()`, `getTablesWithHistory()` | Masa/şirket bazlı geçmiş |
| **Delete** | `clearAllTableHistory()` | Günlük temizlik (örn. 03:00) veya manuel |

**Kaydedilen alanlar:**

- `companyId`, `branchId`, `tableId`, `tableNumber`
- `action`: `"item_added"` | `"item_cancelled"` | `"item_moved"` | `"table_moved"` | `"partial_payment"` | `"full_payment"`
- `description`: metin açıklama
- `details`: opsiyonel; `menuId`, `menuName`, `quantity`, `subtotal`, `movedFromTableNumber`, `movedToTableNumber`, `paymentAmount`, `paymentMethod`, `paidItems` vb.
- `createdAt`

Böylece **cari masaya gönderilen / iptal edilen / taşınan ürünler** ve **kısmi–tam ödemeler** masa bazında izlenir.

---

## 3. Masalar ve Cari

### 3.1 `tables`

**Koleksiyon:** `tables`

| İşlem | Fonksiyon |
|-------|-----------|
| Create | `addTable()`, `createDefaultTables()` (Paket, Hızlı Satış) |
| Read | `getTable(id)`, `getTablesByCompany()` |
| Update | `updateTable()`, `updateTableStatus()` (status, currentOrderId) |
| Delete | `deleteTable()` |

**Alanlar:** `companyId`, `branchId`, `area`, `tableNumber`, `status` (`available`|`occupied`|`reserved`|`cleaning`), `currentOrderId`, `qrCodeId`, `position`, `createdAt`, `updatedAt`.

---

### 3.2 `customers` (Cari Hesaplar)

**Koleksiyon:** `customers`

| İşlem | Fonksiyon |
|-------|-----------|
| Create | `addCustomer()` |
| Read | `getCustomer(id)`, `getCustomersByCompany()` |
| Update | `updateCustomer()` |
| Delete | `deleteCustomer()` (soft: `isActive: false`) |

**Alanlar:** `companyId`, `branchId`, `name`, `phone`, `email`, `balance`, `isActive`, `createdAt`, `updatedAt`, `lastOrderAt`.  
Cari masaya gönderilen siparişler `orders` içinde `customerName`/`customerPhone` ve `sentItems` ile ilişkilidir; cari bakiyesi `customers.balance` ile güncellenebilir.

---

## 4. En Çok Satılan Ürünler / İndirim / İkram / Paket

- **En çok satılan ürünler:**  
  - `sales_stats.topProducts` (menuId, menuName, quantity, revenue).  
  - Ayrıca `bills.items` ve `orders.payments[].paidItems` / `orders.items` kaynağıdır.

- **İndirim:**  
  - Siparişte: `orders.discount`.  
  - Adisyonda: `bills.discount`.  
  - Özet: `sales_stats.totalDiscount`.

- **İkram (gift):**  
  - `orders.payments[].isGift === true` olan ödemeler; istatistikte gelir/satılan ürün hesabına dahil edilmez (statistics.ts’te `!payment.isGift` ve `!p.isGift` kontrolleri).

- **Paket (kurye paket sayısı):**  
  - `courierAssignments.packageCount` (ve sipariş toplamı `courierAssignments.totalAmount`).  
  - Fiziksel “paket” masası `tables` içinde `area: "Paket"`, `tableNumber: "Paket"` ile tutulur.

---

## 5. Ödeme Yöntemleri

**Koleksiyon:** `paymentMethods`

| İşlem | Fonksiyon |
|-------|-----------|
| Create | `addPaymentMethod()` |
| Read | `getPaymentMethod(id)`, `getPaymentMethodsByCompany()` |
| Update | `updatePaymentMethod()` |
| Delete | `deletePaymentMethod()` |

**Alanlar:** `companyId`, `branchId`, `code`, `name`, `color`, `icon`, `isDefault`, `isActive`, `order`, `createdAt`, `updatedAt`.  
Sipariş/adisyondaki her ödeme `method` alanında bu `code` değerini kullanır.

---

## 6. Kurye ve Paket

### 6.1 `couriers`

| İşlem | Fonksiyon |
|-------|-----------|
| Create | `addCourier()` |
| Read | `getCourier(id)`, `getCouriersByCompany()` |
| Update | `updateCourier()` |
| Delete | `deleteCourier()` |

**Alanlar:** `companyId`, `branchId`, `name`, `pricePerPackage`, `isActive`, `createdAt`, `updatedAt`.

### 6.2 `courierAssignments`

| İşlem | Fonksiyon |
|-------|-----------|
| Create | `addCourierAssignment()` |
| Read | `getCourierAssignmentsByCompany()`, `getCourierAssignmentsByCourier()` |
| Delete | `deleteCourierAssignmentsByDate()`, `deleteCourierAssignmentsByCourierAndDate()` |

**Alanlar:** `companyId`, `branchId`, `orderId`, `tableId`, `tableNumber`, `courierId`, `courierName`, `packageCount`, `changeAmount`, `paymentMethod`, `totalAmount`, `assignedAt`, `assignedBy`.  
Paket sayısı ve para üstü burada tutulur; siparişte `courierId`, `courierName`, `changeAmount` özet olarak yazılır.

---

## 7. Menü, Kategori, Stok, Reçete

### 7.1 `menus`

| İşlem | Fonksiyon |
|-------|-----------|
| Create | `addMenu()` |
| Read | `getMenusByCompany()` (ve QR tarafı için `getMenusByCompanyFromQrAndMenus()`) |
| Update | `updateMenu()` (menus veya menuItems’ta) |
| Delete | `deleteMenu()` (sadece `menus`) |

**Alanlar:** `companyId`, `branchId`, `name`, `description`, çok dilli isim/açıklama, `image`, `video`, `price`, `cost`, `category`, `isAvailable`, `extras`, `ingredients`, `allergens`, `calories`, `createdAt`, `updatedAt`.

### 7.2 `categories`

| İşlem | Fonksiyon |
|-------|-----------|
| Create | `addCategory()` |
| Read | (menus ile birlikte / liste) |
| Update | `updateCategory()` |
| Delete | `deleteCategory()` |

**Alanlar:** `companyId`, `branchId`, `name`, `description`, `sortOrder`, `isActive`, `createdAt`, `updatedAt`.

### 7.3 `stocks`

| İşlem | Fonksiyon |
|-------|-----------|
| Create | `addStock()` |
| Read | `getStock(id)`, `getAllStocksByCompany()` |
| Update | `updateStock()` |
| Delete | `deleteStock()` |

**Alanlar:** `companyId`, `branchId`, `name`, `description`, `stockUnit`, `baseUnit`, `itemsPerPackage`, `currentQuantity`, `minQuantity`, `createdAt`, `updatedAt`.  
Sipariş kapatıldığında `decreaseStockOnOrderClose()` ile `stockMovements` eklenir ve stok miktarı güncellenir.

### 7.4 `stockMovements`

| İşlem | Fonksiyon |
|-------|-----------|
| Create | `addStockMovement()` |
| Read | `getStockMovements(stockId)`, `getAllStockMovementsByCompany()` |

**Alanlar:** `companyId`, `branchId`, `stockId`, `type` (in/out/adjustment), `quantity`, `unitType`, `reason`, `notes`, `createdBy`, `createdAt`.

### 7.5 `recipes`

| İşlem | Fonksiyon |
|-------|-----------|
| Create | `addRecipe()` |
| Read | `getRecipesByMenuId()`, `getAllRecipesByCompany()` |
| Update | `updateRecipe()` |
| Delete | `deleteRecipe()` |

**Alanlar:** `companyId`, `branchId`, `menuId`, `stockId`, `stockItemName`, `quantity`, `unit`, `createdAt`, `updatedAt`.

---

## 8. Kullanıcılar, Şubeler, Şirketler

### 8.1 `users`

- **Auth:** Firebase Auth + `users` dokümanı (email/şifre veya staff username/şifre).  
- **CRUD:** `createStaffUser()`, `getUsersByBranch()`, `getCurrentUserData()`, `updateStaffUser()`, `deleteStaffUser()` vb.  
- **Alanlar:** `email`, `displayName`, `username`, `passwordHash`, `role`, `companyId`, `assignedBranchId`, `branchName`, `allowedIp`, `isActive`, `lastLoginAt`, `createdAt`, `updatedAt`.

### 8.2 `branches`

- Sadece **okuma** (auth tarafında): `getBranchesByCompany()` – giriş/şube seçimi.

### 8.3 `companies`

- **Okuma:** `getCompany(id)` – önce `companies`, yoksa `users` içinden admin’e göre company bilgisi.

---

## 9. Vardiya ve Çalışma Saatleri

### 9.1 `shiftSchedules`

| İşlem | Fonksiyon |
|-------|-----------|
| Create | `createShiftSchedule()` |
| Read | `getShiftSchedulesByBranch()`, `getShiftSchedulesByEmployee()` |
| Update | `updateShiftSchedule()` |
| Delete | `deleteShiftSchedule()` |

### 9.2 `shiftOptions`

| İşlem | Fonksiyon |
|-------|-----------|
| Create | `createShiftOption()` |
| Read | `getShiftOptionsByBranch()`, `getShiftOptionById()` |
| Update | `updateShiftOption()` |
| Delete | `deleteShiftOption()` |

### 9.3 `shiftEmployees`

| İşlem | Fonksiyon |
|-------|-----------|
| Create | `createShiftEmployee()` |
| Read | `getShiftEmployeesByBranch()` |
| Update | `updateShiftEmployee()` |
| Delete | `deleteShiftEmployee()` |

### 9.4 `storeHours`

- Okuma/yazma: `getStoreHoursByBranch()`, `addOrUpdateStoreHours()`.

---

## 10. Özet Tablo: Hangi Veri Nerede?

| Veri | Koleksiyon(lar) | Not |
|-----|------------------|-----|
| Ödemesi alınan ürünler | `orders.payments[].paidItems`, `orders.items` (kapanış anında kalan), `bills.items` | Kısmi/tam ödeme |
| İptal edilen ürünler | `orders.canceledItems` | Her item’da `canceledAt` |
| Cari masaya gönderilen ürünler | `orders.sentItems`, `orders.items`; masa geçmişi `tableHistory` | Cari = customer + masa |
| En çok satılan ürünler | `sales_stats.topProducts` | Ayrıca bills/orders kaynak |
| İndirim | `orders.discount`, `bills.discount`, `sales_stats.totalDiscount` | |
| İkram | `orders.payments[].isGift` | İstatistikte gelir/satışa dahil değil |
| Paket (kurye) | `courierAssignments.packageCount`, `orders.courierId/courierName/changeAmount` | |
| Ödeme yöntemine göre | `orders.payments[].method`, `bills.payments[].method` | `paymentMethods.code` ile eşleşir |

Bu rapor, POS’taki tüm Firestore CRUD kullanımını ve “hangi bilginin nereye yazıldığını” tek referans dokümanda toplar.
