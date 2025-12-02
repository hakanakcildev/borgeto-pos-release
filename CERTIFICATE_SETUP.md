# Windows Kod İmzalama Sertifikası Kurulumu

Windows'ta güncelleme sisteminin çalışması için uygulamanın dijital olarak imzalanması gerekmektedir. Bu dokümantasyon, self-signed certificate ile imzalama işlemini açıklar.

## Self-Signed Certificate Oluşturma

### Windows'ta Sertifika Oluşturma

1. **PowerShell'i Yönetici Olarak Açın**
   - Windows tuşuna basın
   - "PowerShell" yazın
   - Sağ tıklayın ve "Yönetici olarak çalıştır" seçin

2. **Sertifika Oluşturma Script'ini Çalıştırın**
   ```powershell
   cd C:\path\to\borgeto-pos-win
   .\scripts\create-certificate.ps1
   ```

   Veya manuel olarak:
   ```powershell
   $certName = "Borgeto POS Code Signing Certificate"
   $certPath = ".\certificate.pfx"
   $certPassword = "BorgetoPOS2024!"
   
   $cert = New-SelfSignedCertificate `
       -Type CodeSigningCert `
       -Subject "CN=$certName" `
       -KeyUsage DigitalSignature `
       -KeyAlgorithm RSA `
       -KeyLength 2048 `
       -CertStoreLocation "Cert:\CurrentUser\My" `
       -NotAfter (Get-Date).AddYears(5)
   
   $securePassword = ConvertTo-SecureString -String $certPassword -Force -AsPlainText
   Export-PfxCertificate `
       -Cert $cert `
       -FilePath $certPath `
       -Password $securePassword
   ```

3. **.env Dosyasına Sertifika Bilgilerini Ekleyin**
   
   Proje kök dizininde `.env` dosyası oluşturun veya mevcut dosyaya şu satırları ekleyin:
   ```
   CSC_LINK=./certificate.pfx
   CSC_KEY_PASSWORD=BorgetoPOS2024!
   ```

4. **Build Alın**
   ```bash
   npm run build -- --win
   ```

## Notlar

- Self-signed certificate sadece test amaçlıdır
- Production için güvenilir bir CA'dan (Certificate Authority) sertifika satın almanız önerilir
- Self-signed certificate ile imzalanan uygulamalar Windows tarafından "Bilinmeyen yayımcı" olarak gösterilir
- Güncelleme sistemi self-signed certificate ile çalışacaktır

## Production İçin Gerçek Sertifika

Production ortamı için şu sertifika sağlayıcılarından sertifika satın alabilirsiniz:
- DigiCert
- Sectigo (eski adıyla Comodo)
- GlobalSign
- SSL.com

Sertifikayı aldıktan sonra `.env` dosyasına ekleyin ve build alın.

