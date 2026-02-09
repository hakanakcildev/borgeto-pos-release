# Sürüm Notları

## v2.0.99 - Performans ve Hız İyileştirmeleri

### ⚡ Performans
- Masa sayfası açılışı hızlandırıldı (paralel veri yükleme, gereksiz istekler kaldırıldı)
- Ödeme alındıktan sonra optimistic güncelleme ile anında yanıt
- Ana sayfa ve masa detayında bloklayan işlemler arka plana alındı
- Sipariş gönder sonrası 500ms bekleme kaldırıldı

### 🖨️ Yazdırma
- Termal yazıcılar için Windows RAW (ESC/POS) yazdırma iyileştirmeleri
- Ödeme/masa kapanma tolerans düzeltmeleri

---

## v1.1.5 - Güncelleme İşlem Sırası Düzeltmesi

### 🔧 İyileştirmeler
- Versiyon artırma ve güncelleme notları işlem sırası düzeltildi
- Mevcut versiyon bilgisi artık doğru şekilde gösteriliyor
- Build öncesi tüm güncellemeler tamamlanıyor

---

## v1.1.4 - Güncelleme Kontrolü ve Bildirim Düzeltmeleri

### 🐛 Hata Düzeltmeleri
- Login sayfasında güncelleme kontrolü butonuna basıldığında sürekli dönme sorunu düzeltildi
- Güncelleme kontrolü artık her durumda düzgün çalışıyor
- `update-available` event'i artık her zaman gönderiliyor (autoDownload false olsa bile)

### 🔄 Güncelleme Sistemi
- Uygulama açıldığında bekleyen güncelleme varsa hemen bildirim gösteriliyor
- Window yüklendiğinde bekleyen güncelleme kontrolü eklendi
- Login sayfasında da güncelleme bildirimleri düzgün gösteriliyor
- Her durumda (login sayfasında da, oturum açıkta da) güncelleme bildirimleri çalışıyor

### 🎯 Kullanıcı Deneyimi
- Güncelleme kontrolü butonu artık düzgün çalışıyor
- Bekleyen güncellemeler uygulama açıldığında hemen gösteriliyor
- Daha tutarlı ve güvenilir güncelleme bildirimleri

---

## v1.1.2 - Otomatik Güncelleme Sistemi İyileştirmeleri

### 🔄 Güncelleme Sistemi
- Oturum açıkken güncelleme bildirimleri artık düzgün çalışıyor
- Kullanıcı giriş yaptığında otomatik güncelleme kontrolü etkinleştiriliyor
- Periyodik güncelleme kontrolü eklendi (her 30 dakikada bir)
- CHANGELOG.md'den sürüm notları otomatik olarak çekiliyor
- Güncelleme bildirimlerinde release notes gösteriliyor

### 🎯 Kullanıcı Deneyimi
- Versiyon bilgisi otomatik olarak güncelleniyor
- Güncelleme notları CHANGELOG.md'den otomatik parse ediliyor
- Daha profesyonel ve tutarlı güncelleme bildirimleri

### 🔧 Teknik İyileştirmeler
- `get-app-version` IPC handler eklendi
- `get-changelog` IPC handler eklendi
- `enable-auto-download` handler'ı iyileştirildi
- Periyodik güncelleme kontrolü için interval yönetimi

---

## v1.1.1 - Input/Textarea Arka Plan Düzeltmesi

### 🐛 Hata Düzeltmeleri
- Input ve Textarea alanlarının arka plan renkleri düzeltildi
- Açık temada beyaz arka plan, koyu temada koyu gri arka plan
- Yazı renkleri tema uyumlu hale getirildi (açık temada koyu, koyu temada beyaz)
- Seçim renkleri tema uyumlu hale getirildi

### 🎯 Kullanıcı Deneyimi
- Yazı alanlarında daha iyi okunabilirlik
- Tema değişikliklerinde tutarlı görünüm

---

## v1.1.0 - Major Update: UI/UX İyileştirmeleri ve Klavye Sistemi

### 🎨 Yeni Özellikler
- **Gelişmiş Klavye Sistemi**
  - 3 durumlu shift tuşu: Normal → Shift → Caps Lock → Normal
  - Login sayfası hariç tüm input alanlarında otomatik shift açılışı
  - Standart klavyelerdeki gibi shift tuşu davranışı
  - Türkçe karakter desteği ile büyük harf dönüşümü

### 🎯 UI/UX İyileştirmeleri
- **Masa Kartları**
  - Dolu masalar yeşil arka plan, boş masalar kırmızı arka plan
  - Dolu masaların yazıları beyaz renkte
  - Tüm masa kartlarına 1px beyaz border eklendi
  - Border'lar kaldırıldı, sadece arka plan renkleri ile görsel ayrım

- **Sidebar İyileştirmeleri**
  - Logo ve yazı boyutları açık/kapalı durumda sabit kalıyor
  - Daha tutarlı görünüm

### 🖨️ Yazdırma İyileştirmeleri
- Yazıcı çıktısındaki çizgiler tek satırda ve yazı ile aynı genişlikte
- Dinamik çizgi genişliği: En uzun satırın genişliğine göre otomatik ayarlanıyor
- Daha profesyonel ve düzenli çıktı formatı

### 🔧 Teknik İyileştirmeler
- Input ve Textarea component'lerine autoCapitalize desteği eklendi
- Login sayfasındaki input'larda autoCapitalize="none" (şifre ve email için)
- Diğer tüm input'larda autoCapitalize="sentences" (ilk harf büyük)

---

## v1.0.96 - Güncelleme Sistemi ve Ayarlar

### 🎨 Yeni Özellikler
- Yeni Ayarlar sayfası eklendi
- Tema yönetimi Ayarlar sayfasına taşındı (Açık/Koyu/Sistem)
- Güncelleme yönetimi Ayarlar sayfasında görüntüleniyor

### 🔄 Güncelleme Sistemi İyileştirmeleri
- Otomatik güncelleme indirme devre dışı bırakıldı
- Kullanıcı kontrollü güncelleme sistemi
- "İndir ve Kur" butonu ile manuel indirme
- "Daha Sonra" seçeneği ile Ayarlar sayfasından erişim
- Güncelleme durumu localStorage'da saklanıyor

### 🖨️ Yazdırma İyileştirmeleri
- Yazdırma genişliği 58 karaktere çıkarıldı (80mm kağıt için optimize)
- Kağıdı tam kaplayacak şekilde ayarlandı

### 🎯 Kullanıcı Deneyimi
- Tüm alert mesajlarında Borgeto logosu eklendi
- Custom alert dialog komponenti oluşturuldu
- Daha modern ve profesyonel bildirimler

---

## [1.0.80] - 2025-01-XX

### ✨ Yeni Özellikler
- **Kağıt Boyutu Otomatik Tespiti**
  - Yazıcıların kağıt boyutu otomatik olarak tespit ediliyor (Windows WMI ile)
  - 80mm, 58mm, 110mm ve diğer boyutlar otomatik algılanıyor
  - Kağıt genişliği karakter sayısına çevriliyor (80mm=48, 58mm=32, 110mm=72 karakter)

### 🐛 Hata Düzeltmeleri
- Yazdırma formatı tam sayfa genişliğinde çalışıyor
- Yazıcıların kağıt genişliğine göre otomatik formatlama

### 🔧 İyileştirmeler
- Yazıcı sayfasında kağıt boyutu bilgisi gösteriliyor
- Örnek çıktı önizlemesi yazıcının kağıt genişliğine göre gösteriliyor
- Tüm yazdırma işlemleri yazıcının kağıt genişliğini kullanıyor
- Tam sayfa genişliğinde yazdırma

---

## [1.0.77] - 2025-01-XX

### ✨ Yeni Özellikler
- **Yazdırma Formatı İyileştirmeleri**
  - Yazdırma formatı tam sayfa genişliğinde ve düzgün formatlanmış
  - ESC/POS komutları ile font, hizalama ve kalın yazı desteği
  - Başlık ortalanmış ve büyük font, toplam tutar sağa hizalı ve kalın

### 🐛 Hata Düzeltmeleri
- Yazdırma çıktısında kare karakterler sorunu düzeltildi (ASCII encoding)
- Yazdırma formatı ortada sıkışık görünme sorunu düzeltildi
- Türkçe karakterler düzgün görüntüleniyor (ASCII karşılıklarına çevriliyor)

### 🔧 İyileştirmeler
- Yazıcı sayfasına örnek çıktı önizlemesi eklendi
- Test yazdırma butonu gerçek yazıcıya yazdırma yapıyor
- Yazdırma formatı tam sayfa genişliğinde (48 karakter)

---

## [1.0.74] - 2025-01-XX

### ✨ Yeni Özellikler
- **Güncelleme Kontrolü İyileştirmeleri**
  - Güncelleme kontrolü butonuna basıldığında son sürüm ise "Son sürümü kullanıyorsunuz" mesajı gösteriliyor
  - Yeni sürüm varsa "İndir ve Kur" modalı açılıyor
  - Güncelleme kontrolü hata mesajları iyileştirildi

### 🐛 Hata Düzeltmeleri
- "Güncelleme kontrolü şu anda kullanılamıyor" hatası düzeltildi
- Güncelleme kontrolü artık düzgün çalışıyor

### 🔧 İyileştirmeler
- Güncelleme kontrolü kullanıcı deneyimi iyileştirildi
- Son sürüm mesajı için yeni modal eklendi

---

## [1.0.73] - 2025-01-XX

### ✨ Yeni Özellikler
- **Yazdır Butonu İyileştirmeleri**
  - Yazdır butonu artık ödeme al butonunun yanında, daha kompakt bir tasarımla yer alıyor
  - Ödeme ekranında iskonto butonunun altına yazdır butonu eklendi
  - Yazdır butonu genişliği artırıldı, daha kullanışlı hale getirildi

### 🐛 Hata Düzeltmeleri
- Yazdırma çıktısında Türkçe karakterlerin düzgün görüntülenmesi sağlandı
- Yazdırma formatı basitleştirildi ve okunabilirliği artırıldı

### 🔧 İyileştirmeler
- Masa yazdırma işlemi optimize edildi
- Tüm ürünler (mevcut, iptal, ödemesi alınan) tek bir çıktıda birleştirilerek yazdırılıyor

---

## [1.0.72] - Önceki Sürüm

### ✨ Yeni Özellikler
- Yazdırma sistemi tamamen yenilendi
- ESC/POS formatında yazdırma desteği eklendi
- Otomatik yazıcı algılama (USB, Network, Bluetooth, System)
- Kategori bazlı yazıcı atama sistemi
- Ürün eklendiğinde ve iptal edildiğinde otomatik yazdırma
- Ödeme alındığında otomatik yazdırma
- Yazıcı isimlerini düzenleme özelliği

### 🔧 İyileştirmeler
- Yazdırma çıktı formatı basitleştirildi
- Türkçe karakter desteği iyileştirildi

---

## [1.0.71] - Önceki Sürüm

### ✨ Yeni Özellikler
- Otomatik güncelleme sistemi
- Güncelleme bildirimleri
- Güncelleme sonrası otomatik oturum açma

### 🔧 İyileştirmeler
- Güncelleme indirme kontrolü iyileştirildi
- Kullanıcı deneyimi iyileştirildi

---

## [1.0.70] - Önceki Sürüm

### ✨ Yeni Özellikler
- Ekstra malzeme seçeneği ürünlere eklendi
- Ekstra malzemeler fiyata otomatik ekleniyor
- Ekstra malzeme kartları tamamen tıklanabilir hale getirildi

### 🔧 İyileştirmeler
- Ürün yönetimi sayfası iyileştirildi
- Sipariş ekranı kullanıcı deneyimi geliştirildi

---

## [1.0.69] - Önceki Sürüm

### ✨ Yeni Özellikler
- Dolu masalar için görsel iyileştirmeler
- Daha belirgin masa kartları

### 🔧 İyileştirmeler
- Responsive tasarım iyileştirmeleri
- Ekran boyutuna göre otomatik ölçeklendirme

---

## [1.0.68] - Önceki Sürüm

### ✨ Yeni Özellikler
- İstatistikler sayfasında sayıların yuvarlanması
- Daha doğru raporlama

### 🔧 İyileştirmeler
- Veri görselleştirme iyileştirmeleri

---

## [1.0.67] - Önceki Sürüm

### ✨ Yeni Özellikler
- GitHub otomatik release sistemi
- Versiyon numarası olmadan setup dosyası adlandırması

### 🔧 İyileştirmeler
- Build süreci otomatikleştirildi
- Versiyon yönetimi iyileştirildi

---

*Not: Bu dosya otomatik olarak güncellenmektedir. Her yeni sürüm için buraya eklemeler yapılmaktadır.*

