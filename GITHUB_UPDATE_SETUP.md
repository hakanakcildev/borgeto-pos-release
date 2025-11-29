# GitHub Releases ile Otomatik Güncelleme Kurulumu

## Adım 1: GitHub Repository Oluşturma

1. GitHub'a giriş yapın: https://github.com
2. Sağ üstteki **"+"** butonuna tıklayın
3. **"New repository"** seçin
4. Repository adını girin (örn: `borgeto-pos-releases`)
5. **Public** veya **Private** seçin (Public önerilir - ücretsiz)
6. **"Create repository"** butonuna tıklayın

## Adım 2: GitHub Personal Access Token Oluşturma

1. GitHub'da sağ üst köşedeki profil resminize tıklayın
2. **Settings** seçin
3. Sol menüden **Developer settings** seçin
4. **Personal access tokens** > **Tokens (classic)** seçin
5. **Generate new token** > **Generate new token (classic)** tıklayın
6. Token için bir isim verin (örn: `borgeto-pos-updater`)
7. **Expiration** seçin (90 days veya No expiration)
8. Aşağıdaki izinleri seçin:
   - ✅ **repo** (tüm alt seçenekler)
9. **Generate token** butonuna tıklayın
10. **Token'ı kopyalayın ve güvenli bir yere kaydedin** (bir daha gösterilmeyecek!)

## Adım 3: Package.json'ı Güncelleme

1. `package.json` dosyasını açın
2. `publish` bölümünü bulun
3. `YOUR_GITHUB_USERNAME` yerine GitHub kullanıcı adınızı yazın
4. `YOUR_REPO_NAME` yerine repository adınızı yazın

Örnek:
```json
"publish": [
  {
    "provider": "github",
    "owner": "hakanakcil",
    "repo": "borgeto-pos-releases"
  }
]
```

## Adım 4: İlk Build ve Release

### 4.1. Token'ı Ortam Değişkeni Olarak Ayarlama

**macOS/Linux için:**
```bash
export GH_TOKEN=your_github_token_here
```

**Windows için (PowerShell):**
```powershell
$env:GH_TOKEN="your_github_token_here"
```

**Windows için (CMD):**
```cmd
set GH_TOKEN=your_github_token_here
```

### 4.2. Build Yapma

```bash
cd electron-pos
npm run build -- --win
```

Bu komut:
- Uygulamayı build eder
- GitHub'a otomatik olarak release oluşturur
- Güncelleme dosyalarını yükler

## Adım 5: Yeni Güncelleme Yayınlama

Her yeni sürüm için:

1. `package.json`'daki `version` numarasını artırın:
   ```json
   "version": "1.0.1"
   ```

2. Token'ı ayarlayın:
   ```bash
   export GH_TOKEN=your_github_token_here
   ```

3. Build yapın:
   ```bash
   npm run build -- --win
   ```

4. Electron-builder otomatik olarak:
   - GitHub'da yeni release oluşturur
   - Dosyaları yükler
   - `latest.yml` dosyasını günceller

## Adım 6: Kullanıcıların Güncelleme Alması

Kullanıcılar uygulamayı açtığında:
- 5 saniye sonra otomatik güncelleme kontrolü yapılır
- Yeni sürüm varsa otomatik indirilir
- Uygulama kapanınca otomatik yüklenir
- Her 4 saatte bir otomatik kontrol yapılır

## Sorun Giderme

### Token hatası alıyorsanız:
- Token'ın `repo` izni olduğundan emin olun
- Token'ın süresi dolmamış olmalı
- `GH_TOKEN` ortam değişkeninin doğru ayarlandığından emin olun

### Release oluşturulmuyorsa:
- GitHub repository adının doğru olduğundan emin olun
- Repository'nin var olduğundan emin olun
- Token'ın repository'ye erişim izni olduğundan emin olun

### Güncelleme çalışmıyorsa:
- İlk kurulumda mutlaka GitHub'dan indirilen sürümü kullanın
- Manuel kurulum yapılan sürümlerde güncelleme çalışmayabilir

## Güvenlik Notu

⚠️ **ÖNEMLİ:** Token'ınızı asla kod içine yazmayın veya GitHub'a yüklemeyin!
- Token'ı sadece ortam değişkeni olarak kullanın
- Token'ı `.gitignore`'a ekleyin
- Token sızdırılırsa hemen GitHub'dan iptal edin

