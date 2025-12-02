# Windows Self-Signed Certificate Oluşturma Script'i
# Bu script'i Windows PowerShell'de yönetici olarak çalıştırın

$certName = "Borgeto POS Code Signing Certificate"
$certPath = ".\certificate.pfx"
$certPassword = "BorgetoPOS2024!"

Write-Host "Self-signed certificate oluşturuluyor..." -ForegroundColor Green

# Self-signed certificate oluştur
$cert = New-SelfSignedCertificate `
    -Type CodeSigningCert `
    -Subject "CN=$certName" `
    -KeyUsage DigitalSignature `
    -KeyAlgorithm RSA `
    -KeyLength 2048 `
    -CertStoreLocation "Cert:\CurrentUser\My" `
    -NotAfter (Get-Date).AddYears(5)

Write-Host "Certificate oluşturuldu: $($cert.Thumbprint)" -ForegroundColor Green

# Certificate'i PFX formatına dönüştür
$securePassword = ConvertTo-SecureString -String $certPassword -Force -AsPlainText
Export-PfxCertificate `
    -Cert $cert `
    -FilePath $certPath `
    -Password $securePassword

Write-Host "Certificate PFX dosyası oluşturuldu: $certPath" -ForegroundColor Green
Write-Host "Certificate Password: $certPassword" -ForegroundColor Yellow
Write-Host ""
Write-Host "Sonraki adımlar:" -ForegroundColor Cyan
Write-Host "1. .env dosyasına şu satırları ekleyin:" -ForegroundColor White
Write-Host "   CSC_LINK=./certificate.pfx" -ForegroundColor Gray
Write-Host "   CSC_KEY_PASSWORD=$certPassword" -ForegroundColor Gray
Write-Host "2. npm run build -- --win komutunu çalıştırın" -ForegroundColor White

