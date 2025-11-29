# Otomatik Güncelleme Sunucusu Kurulumu

## Seçenek 1: GitHub Releases (Önerilen - Ücretsiz)

1. GitHub'da bir repository oluşturun
2. `package.json`'daki publish yapılandırmasını güncelleyin:

```json
"publish": [
  {
    "provider": "github",
    "owner": "your-username",
    "repo": "your-repo-name"
  }
]
```

3. GitHub Personal Access Token oluşturun (Settings > Developer settings > Personal access tokens)
4. Build yaparken token'ı kullanın:
```bash
export GH_TOKEN=your_token_here
npm run build -- --win
```

## Seçenek 2: Özel Sunucu (S3, FTP, HTTP)

1. Güncelleme dosyalarını bir web sunucusuna yükleyin
2. `package.json`'daki URL'yi güncelleyin:

```json
"publish": [
  {
    "provider": "generic",
    "url": "https://your-server.com/updates/"
  }
]
```

3. Sunucuda şu dosyalar olmalı:
   - `latest.yml` (Windows için)
   - `Borgeto POS Setup X.X.X.exe`
   - `Borgeto POS Setup X.X.X.exe.blockmap`

## Seçenek 3: S3 Bucket

```json
"publish": [
  {
    "provider": "s3",
    "bucket": "your-bucket-name",
    "region": "us-east-1"
  }
]
```

## Güncelleme Dosyalarını Yükleme

Build yaptıktan sonra `release` klasöründeki dosyaları güncelleme sunucunuza yükleyin:
- `Borgeto POS Setup X.X.X.exe`
- `Borgeto POS Setup X.X.X.exe.blockmap`
- `latest.yml` (electron-builder otomatik oluşturur)

## Not

- Güncellemeler uygulama başladıktan 5 saniye sonra kontrol edilir
- Her 4 saatte bir otomatik kontrol yapılır
- Güncelleme bulunduğunda otomatik indirilir ve uygulama kapanınca yüklenir

