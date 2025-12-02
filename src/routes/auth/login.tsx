import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useCallback, useRef, useEffect } from "react";
import { signInWithCredentials } from "@/lib/firebase/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Eye,
  EyeOff,
  Lock,
  RefreshCw,
  FileText,
  X,
  Keyboard,
} from "lucide-react";
import { useTouchKeyboard } from "@/contexts/TouchKeyboardContext";

export const Route = createFileRoute("/auth/login")({
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [showUpdateNotes, setShowUpdateNotes] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateVersion, setUpdateVersion] = useState("");
  const [downloadingUpdate, setDownloadingUpdate] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const { openKeyboard, isOpen } = useTouchKeyboard();

  // Klavye butonu tıklandığında aktif input'a focus ver ve klavyeyi aç
  const handleKeyboardButtonClick = useCallback(() => {
    const activeElement = document.activeElement;
    let targetInput: HTMLInputElement | null = null;
    let keyboardType: "text" | "email" | "password" = "text";
    let currentValue = "";

    // Aktif input'u kontrol et
    if (activeElement === emailInputRef.current) {
      targetInput = emailInputRef.current;
      keyboardType = "email";
      currentValue = email;
    } else if (activeElement === passwordInputRef.current) {
      targetInput = passwordInputRef.current;
      keyboardType = "password";
      currentValue = password;
    } else if (emailInputRef.current) {
      // Aktif input yoksa email input'una focus ver
      targetInput = emailInputRef.current;
      keyboardType = "email";
      currentValue = email;
    } else if (passwordInputRef.current) {
      targetInput = passwordInputRef.current;
      keyboardType = "password";
      currentValue = password;
    }

    if (targetInput) {
      // Input'a focus ver
      targetInput.focus();

      // Kısa bir gecikme ile klavyeyi aç (focus'un tamamlanması için)
      setTimeout(() => {
        if (targetInput && targetInput === document.activeElement) {
          openKeyboard(
            { current: targetInput } as React.RefObject<HTMLInputElement>,
            keyboardType,
            currentValue
          );
        }
      }, 50);
    }
  }, [openKeyboard, email, password]);

  // Giriş işlemi
  const handleLogin = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError("");

      try {
        const result = await signInWithCredentials(email, password);

        // Local storage'a kaydet (uygulama kapatılsa bile oturum açık kalır)
        localStorage.setItem(
          "posAuth",
          JSON.stringify({
            type: result.type,
            companyId: result.companyId,
            branchId: result.branchId,
            user: result.user,
            branch: result.branch,
            company: result.company,
            timestamp: Date.now(),
          })
        );

        // Storage event tetikle
        window.dispatchEvent(
          new StorageEvent("storage", {
            key: "posAuth",
            newValue: localStorage.getItem("posAuth"),
          })
        );

        // Kısa bir gecikme ile navigate et
        await new Promise((resolve) => setTimeout(resolve, 100));
        navigate({ to: "/", search: { area: undefined, activeOnly: false } });
      } catch (error: unknown) {
        if (error && typeof error === "object" && "message" in error) {
          setError((error as { message: string }).message);
        } else if (error && typeof error === "object" && "code" in error) {
          const errorCode = (error as { code: string }).code;
          if (errorCode === "auth/user-not-found") {
            setError("Kullanıcı bulunamadı");
          } else if (errorCode === "auth/wrong-password") {
            setError("Hatalı şifre");
          } else if (errorCode === "auth/invalid-email") {
            setError("Geçersiz e-posta adresi veya kullanıcı adı");
          } else {
            setError("Giriş sırasında bir hata oluştu");
          }
        } else {
          setError("Giriş sırasında bir hata oluştu");
        }
      } finally {
        setLoading(false);
      }
    },
    [email, password, navigate]
  );

  // Güncelleme kontrolü
  const handleCheckUpdates = useCallback(async () => {
    setCheckingUpdate(true);
    setError("");
    try {
      if (window.electronAPI?.checkForUpdates) {
        // checkForUpdates çağrısı yap - event'ler ile sonuç bildirimi yapılacak
        const result = await window.electronAPI.checkForUpdates();
        console.log("Update check result:", result);
        // Eğer hata varsa göster
        if (result && !result.success && result.error) {
          setError(result.error);
          setCheckingUpdate(false);
        }
        // Başarılıysa event'lerden gelecek sonucu bekle
        // setCheckingUpdate event handler'larda false yapılacak
      } else {
        setCheckingUpdate(false);
        alert("Güncelleme kontrolü şu anda kullanılamıyor.");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Güncelleme kontrolü sırasında bir hata oluştu";
      setError(errorMessage);
      setCheckingUpdate(false);
    }
  }, []);

  // Electron güncelleme event listener'ları
  useEffect(() => {
    if (!window.electronAPI) return;

    const handleUpdateAvailable = (version: string) => {
      setError("");
      setUpdateAvailable(true);
      setUpdateVersion(version);
      setCheckingUpdate(false);
    };

    const handleUpdateNotAvailable = () => {
      setError("");
      setUpdateAvailable(false);
      setCheckingUpdate(false);
      // Güncel versiyonsa hiçbir mesaj gösterme
    };

    const handleDownloadProgress = (progress: { percent: number }) => {
      setDownloadProgress(progress.percent);
    };

    const handleUpdateDownloaded = () => {
      setError("");
      setDownloadingUpdate(false);
      setDownloadProgress(100);
      // Güncelleme indirildi, uygulamayı yeniden başlat
      setTimeout(() => {
        if (window.electronAPI?.quitApp) {
          window.electronAPI.quitApp();
        }
      }, 1000);
    };

    const handleUpdateError = (error: string) => {
      setError(`Güncelleme hatası: ${error}`);
      setCheckingUpdate(false);
      setDownloadingUpdate(false);
    };

    if (window.electronAPI.onUpdateAvailable) {
      window.electronAPI.onUpdateAvailable(handleUpdateAvailable);
      window.electronAPI.onUpdateNotAvailable(handleUpdateNotAvailable);
      window.electronAPI.onUpdateDownloaded(handleUpdateDownloaded);
      window.electronAPI.onDownloadProgress(handleDownloadProgress);
      window.electronAPI.onUpdateError(handleUpdateError);
    }
  }, []);

  // Güncellemeyi indir
  const handleDownloadUpdate = useCallback(() => {
    setDownloadingUpdate(true);
    setDownloadProgress(0);
    setUpdateAvailable(false);
    // Güncelleme zaten otomatik indiriliyor, sadece UI'ı güncelliyoruz
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4 py-8">
      {/* Güncelleme indiriliyor ekranı */}
      {downloadingUpdate && (
        <div className="fixed inset-0 z-[9999] bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
            <div className="text-center">
              <RefreshCw className="h-16 w-16 animate-spin text-blue-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Güncelleme İndiriliyor
              </h2>
              <p className="text-gray-600 mb-4">
                Yeni versiyon indiriliyor, lütfen bekleyin...
              </p>
              <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
              <p className="text-sm text-gray-500">
                {Math.round(downloadProgress)}%
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Yeni versiyon mevcut modal */}
      {updateAvailable && (
        <div className="fixed inset-0 z-[9999] bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <RefreshCw className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Yeni Sürüm Mevcut
              </h2>
              <p className="text-gray-600 mb-6">
                Versiyon {updateVersion} mevcut. Güncellemek ister misiniz?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setUpdateAvailable(false)}
                  className="flex-1 px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-colors"
                >
                  Daha Sonra
                </button>
                <button
                  onClick={handleDownloadUpdate}
                  className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                >
                  İndir ve Kur
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-md">
        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
                <Lock className="h-10 w-10 text-white" />
              </div>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
              POS Sistemi
            </h1>
            <p className="text-sm text-gray-600">
              Sipariş yönetim sistemine giriş yapın
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-6">
            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* Email/Username Input */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                E-posta Adresi veya Kullanıcı Adı
              </label>
              <Input
                id="email"
                ref={emailInputRef}
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="E-posta adresinizi veya kullanıcı adınızı girin"
                required
                autoComplete="username"
                className="h-12 text-base bg-gray-50 text-gray-900 border-2 border-gray-300 focus:border-blue-500 focus:outline-none"
              />
            </div>

            {/* Password Input */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Şifre
              </label>
              <div className="relative">
                <Input
                  id="password"
                  ref={passwordInputRef}
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Şifrenizi girin"
                  required
                  autoComplete="current-password"
                  className="h-12 text-base bg-gray-50 text-gray-900 border-2 border-gray-300 focus:border-blue-500 focus:outline-none pr-24"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-gray-100 transition-colors z-10"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setShowPassword(!showPassword);
                  }}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    setShowPassword(!showPassword);
                  }}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button and Keyboard Button */}
            <div className="flex gap-3">
              <Button
                type="submit"
                className="flex-1 h-12 text-base font-medium bg-blue-600 hover:bg-blue-700 text-white"
                disabled={loading}
              >
                {loading ? "Giriş Yapılıyor..." : "Giriş Yap"}
              </Button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleKeyboardButtonClick();
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleKeyboardButtonClick();
                }}
                className={`h-12 w-12 rounded-lg transition-colors touch-manipulation flex items-center justify-center ${
                  isOpen
                    ? "bg-blue-100 text-blue-600"
                    : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                }`}
                aria-label="Klavyeyi Aç"
                title="Klavyeyi Aç"
              >
                <Keyboard className="h-6 w-6" />
              </button>
            </div>
          </form>

          {/* Info Text */}
          <p className="mt-6 text-center text-sm text-gray-600">
            QR Menü sistemi ile aynı bilgileri kullanabilirsiniz
          </p>

          {/* Update Buttons */}
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={handleCheckUpdates}
              disabled={checkingUpdate}
              className="flex-1 h-12 text-sm font-medium border-2 border-gray-400 rounded-lg bg-gray-200 text-gray-900 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
            >
              {checkingUpdate ? (
                <>
                  <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                  Kontrol Ediliyor...
                </>
              ) : (
                <>
                  <RefreshCw className="h-5 w-5 mr-2" />
                  Güncellemeleri Kontrol Et
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => setShowUpdateNotes(true)}
              className="flex-1 h-12 text-sm font-medium border-2 border-gray-400 rounded-lg bg-gray-200 text-gray-900 hover:bg-gray-300 flex items-center justify-center transition-colors"
            >
              <FileText className="h-5 w-5 mr-2" />
              Güncelleme Notları
            </button>
          </div>
        </div>
      </div>

      {/* Update Notes Modal */}
      {showUpdateNotes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                Güncelleme Notları
              </h2>
              <button
                onClick={() => setShowUpdateNotes(false)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="h-6 w-6 text-gray-600" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Version Info */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Versiyon Bilgisi
                </h3>
                <div className="bg-blue-50 rounded-xl p-4">
                  <p className="text-base text-gray-700">
                    <span className="font-medium">Mevcut Versiyon:</span> 1.0.50
                  </p>
                  <p className="text-sm text-gray-600 mt-2">
                    Son Güncelleme:{" "}
                    {new Date().toLocaleDateString("tr-TR", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
              </div>

              {/* Update History */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Yapılan Geliştirmeler
                </h3>
                <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h4 className="text-base font-medium text-gray-900 mb-2">
                      v1.0.50 - 404 Sorunu KESİN ÇÖZÜM! (Son Güncelleme)
                    </h4>
                    <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                      <li>
                        ✅ Electron before-quit event'i devre dışı - oturum artık kalıcı
                      </li>
                      <li>
                        ✅ localStorage artık uygulama kapanınca temizlenmiyor
                      </li>
                      <li>
                        ✅ 404 sayfası tamamen kaldırıldı - direkt yönlendirme yapılıyor
                      </li>
                      <li>
                        ✅ Agresif route kontrolü - authenticated kullanıcılar her zaman masalar sayfasında
                      </li>
                      <li>
                        ✅ Detaylı console log'lar - sorunları kolayca takip edebilirsiniz
                      </li>
                      <li>
                        ✅ AuthContext geliştirildi - daha güvenilir auth yükleme
                      </li>
                      <li>
                        🎯 SORUN: Program açıldığında 404 sayfası gösteriyordu
                      </li>
                      <li>
                        🎯 ÇÖZÜM: Oturum artık kalıcı ve her durumda doğru sayfaya yönlendiriliyor
                      </li>
                    </ul>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h4 className="text-base font-medium text-gray-900 mb-2">
                      v1.0.49 - Güncelleme Hatası ve 404 Sayfası Düzeltmesi
                    </h4>
                    <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                      <li>
                        "Object could not be cloned" hatası düzeltildi - güncelleme kontrolü sorunsuz çalışıyor
                      </li>
                      <li>
                        IPC serialization problemi çözüldü - sadece basit objeler gönderiliyor
                      </li>
                      <li>
                        404 sayfası kullanıcı dostu hale getirildi - "Verileri Eşitle" mesajı gösteriliyor
                      </li>
                      <li>
                        "Masalar Sayfasına Git" butonu eklendi - tek tıkla masalar sayfasına dönüş
                      </li>
                      <li>
                        Güncelleme akışı iyileştirildi - yeni sürüm varsa direkt "İndir ve Kur" modalı gösteriliyor
                      </li>
                    </ul>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h4 className="text-base font-medium text-gray-900 mb-2">
                      v1.0.48 - NotFound Sayfası Sorunu Kesin Çözüm
                    </h4>
                    <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                      <li>
                        notFoundMode: "root" eklendi - router notFound durumunda root component gösteriyor
                      </li>
                      <li>
                        Root path kontrolü eklendi - root path'te ise route'lar yüklenene kadar bekliyor
                      </li>
                      <li>
                        200ms timeout ile kontrol - route match hala yoksa masalar sayfasına yönlendirme
                      </li>
                      <li>
                        Root path dışında route match yoksa anında yönlendirme - hızlı çözüm
                      </li>
                    </ul>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h4 className="text-base font-medium text-gray-900 mb-2">
                      v1.0.47 - Kritik: Oturum Temizleme ve Route Yönlendirme Düzeltildi
                    </h4>
                    <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                      <li>
                        deleteAppDataOnUninstall: true yapıldı - program kaldırılınca localStorage temizleniyor
                      </li>
                      <li>
                        Route yönlendirmesi setTimeout kaldırıldı - direkt yönlendirme yapılıyor
                      </li>
                      <li>
                        Storage change event'inde console.log eklendi - oturum temizleme izlenebiliyor
                      </li>
                      <li>
                        Authenticated kullanıcılar için route match yoksa anında masalar sayfasına yönlendirme
                      </li>
                    </ul>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h4 className="text-base font-medium text-gray-900 mb-2">
                      v1.0.46 - Program Kapanınca Oturum Temizleme ve Route Düzeltmesi
                    </h4>
                    <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                      <li>
                        Program kapandığında localStorage otomatik temizleniyor - oturum kapatılıyor
                      </li>
                      <li>
                        before-quit event'inde posAuth localStorage'dan siliniyor
                      </li>
                      <li>
                        Route kontrolüne detaylı console log eklendi - sorunları izlemek kolay
                      </li>
                      <li>
                        Route match yoksa 100ms gecikme ile yönlendirme - route'ların yüklenmesini bekliyor
                      </li>
                    </ul>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h4 className="text-base font-medium text-gray-900 mb-2">
                      v1.0.45 - İlk Açılışta Route Eşleşmesi Sorunu Düzeltildi
                    </h4>
                    <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                      <li>
                        İlk açılışta route match olmasa bile authenticated kullanıcılar masalar sayfasına yönlendiriliyor
                      </li>
                      <li>
                        router.state.matches.length === 0 kontrolü her durumda çalışıyor
                      </li>
                      <li>
                        Console log eklendi - route eşleşme sorunlarını izlemek için
                      </li>
                      <li>
                        Oturum açıkken program açıldığında kesinlikle masalar sayfası açılıyor
                      </li>
                    </ul>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h4 className="text-base font-medium text-gray-900 mb-2">
                      v1.0.44 - 404 Sayfası Kaldırıldı, Route Kontrolü Tamamen Düzeltildi
                    </h4>
                    <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                      <li>
                        404 sayfası tamamen kaldırıldı - artık hiç 404 sayfası gösterilmiyor
                      </li>
                      <li>
                        Oturum açıkken program açıldığında direkt masalar sayfası açılıyor
                      </li>
                      <li>
                        Route kontrolü basitleştirildi - authenticated ise ana sayfa, değilse login
                      </li>
                      <li>
                        Geçersiz route'larda authenticated kullanıcılar masalar sayfasına yönlendiriliyor
                      </li>
                    </ul>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h4 className="text-base font-medium text-gray-900 mb-2">
                      v1.0.43 - 404 Sorunu, Klavye ve Logout Düzeltmeleri
                    </h4>
                    <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                      <li>
                        404 sayfa sorunu düzeltildi - oturum açıksa direkt masalar sayfasına yönlendiriliyor
                      </li>
                      <li>
                        Klavye silme tuşu ç harfinin yanına taşındı - daha kolay erişim
                      </li>
                      <li>
                        Logout çıkış butonu düzeltildi - storage event tetikleniyor, sorunsuz çıkış yapılıyor
                      </li>
                      <li>
                        Route kontrolü iyileştirildi - authenticated kullanıcılar için 404 yerine ana sayfa
                      </li>
                    </ul>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h4 className="text-base font-medium text-gray-900 mb-2">
                      v1.0.42 - Kritik Düzeltmeler: Input Focus ve Güncelleme Sistemi
                    </h4>
                    <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                      <li>
                        İlk açılışta input focus sorunu tamamen düzeltildi - 3 kez focus veriliyor (100ms, 300ms, 500ms)
                      </li>
                      <li>
                        Otomatik güncelleme kontrolü kaldırıldı - artık güncel versiyonsa hiçbir mesaj gösterilmiyor
                      </li>
                      <li>
                        Yeni güncelleme sistemi: Yeni versiyon varsa modal gösteriliyor, "İndir ve Kur" butonu ile manuel güncelleme
                      </li>
                      <li>
                        Güncelleme indirme progress bar'ı eklendi - indirme durumu görünüyor
                      </li>
                      <li>
                        Güncelleme indirildikten sonra otomatik yeniden başlatma - sorunsuz güncelleme
                      </li>
                    </ul>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h4 className="text-base font-medium text-gray-900 mb-2">
                      v1.0.41 - İlk Açılışta Input Focus Sorunu Düzeltildi
                    </h4>
                    <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                      <li>
                        İlk açılışta input'lara tıklanamama sorunu düzeltildi -
                        window focus otomatik veriliyor
                      </li>
                      <li>
                        Alt+Tab sonrası input çalışma sorunu düzeltildi - focus
                        event'leri eklendi
                      </li>
                      <li>
                        ready-to-show event'inde window.focus() ve
                        webContents.focus() çağrılıyor
                      </li>
                      <li>
                        Window restore, focus, blur event'leri dinleniyor -
                        her durumda çalışıyor
                      </li>
                    </ul>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h4 className="text-base font-medium text-gray-900 mb-2">
                      v1.0.40 - Input Cursor ve Şifre Input Sorunları Düzeltildi
                    </h4>
                    <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                      <li>
                        Cursor pozisyonu otomatik değişme sorunu düzeltildi -
                        artık tıkladığınız yerde kalıyor
                      </li>
                      <li>
                        Şifre inputuna tıklama sorunu düzeltildi - göz ikonu
                        z-index düşürüldü
                      </li>
                      <li>
                        Cursor görünürlüğü artırıldı - caretColor inline style
                        olarak eklendi
                      </li>
                      <li>
                        onMouseDown ve onTouchStart event'leri kaldırıldı -
                        native davranış kullanılıyor
                      </li>
                    </ul>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h4 className="text-base font-medium text-gray-900 mb-2">
                      v1.0.39 - NSIS Installer x64 Mimari Düzeltmesi
                    </h4>
                    <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                      <li>
                        Windows build x64 mimarisine çevrildi - ARM64 yerine x64
                        kullanılıyor
                      </li>
                      <li>
                        NSIS installer artık tüm dosyaları kuruyor - mimari
                        uyumsuzluğu düzeltildi
                      </li>
                      <li>
                        packElevateHelper: true eklendi - installer
                        yetkilendirme düzgün çalışıyor
                      </li>
                      <li>
                        Target arch explicit olarak x64 yapıldı - Windows
                        bilgisayarlarda çalışıyor
                      </li>
                    </ul>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h4 className="text-base font-medium text-gray-900 mb-2">
                      v1.0.38 - NSIS Installer Kritik Düzeltme - files Listesi
                      Kaldırıldı
                    </h4>
                    <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                      <li>
                        files listesi tamamen kaldırıldı - electron-builder
                        otomatik dosya algılama kullanıyor
                      </li>
                      <li>
                        runAfterFinish: false yapıldı - installer dosyaları
                        kurmadan uygulamayı çalıştırmıyor
                      </li>
                      <li>
                        NSIS installer artık tüm dosyaları kuruyor - otomatik
                        algılama daha güvenilir
                      </li>
                    </ul>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h4 className="text-base font-medium text-gray-900 mb-2">
                      v1.0.37 - NSIS Installer ve Login Input Sorunları
                      Düzeltildi
                    </h4>
                    <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                      <li>
                        NSIS installer dosya kurulum sorunu düzeltildi - files
                        listesi düzgün yapılandırıldı
                      </li>
                      <li>
                        Login sayfasındaki label onClick event'leri kaldırıldı -
                        inputlara direkt tıklanabilir
                      </li>
                      <li>
                        readOnly ve disabled prop'ları kaldırıldı - inputlar tam
                        çalışır durumda
                      </li>
                      <li>
                        include: null kaldırıldı - NSIS installer varsayılan
                        davranışı kullanıyor
                      </li>
                    </ul>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h4 className="text-base font-medium text-gray-900 mb-2">
                      v1.0.36 - Input Tıklama ve Güncelleme Sorunları Düzeltildi
                    </h4>
                    <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                      <li>
                        İkinci input'a tıklama sorunu düzeltildi - artık tüm
                        inputlara tıklanabilir
                      </li>
                      <li>
                        e.stopPropagation() kaldırıldı - inputlar arası geçiş
                        sorunsuz çalışıyor
                      </li>
                      <li>Güncelleme mekanizmasına hata yakalama eklendi</li>
                      <li>
                        Blur timeout'u 200ms'den 100ms'ye düşürüldü - daha hızlı
                        yanıt
                      </li>
                    </ul>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h4 className="text-base font-medium text-gray-900 mb-2">
                      v1.0.35 - NSIS Installer Kritik Düzeltme
                    </h4>
                    <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                      <li>
                        NSIS installer artık tüm dosyaları kuruyor - files
                        listesi tamamen yeniden yapılandırıldı
                      </li>
                      <li>
                        Kısayol sorunu düzeltildi - artık dosyalar kuruluyor
                      </li>
                      <li>
                        include: null eklendi - NSIS installer'ın tüm dosyaları
                        kurması garanti edildi
                      </li>
                    </ul>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h4 className="text-base font-medium text-gray-900 mb-2">
                      v1.0.34 - NSIS Installer Dosya Kurulum Sorunu Düzeltildi
                    </h4>
                    <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                      <li>NSIS installer artık tüm dosyaları kuruyor</li>
                      <li>
                        files listesi düzeltildi - tüm gerekli dosyalar dahil
                        edildi
                      </li>
                      <li>directories.app ayarı eklendi</li>
                      <li>Gereksiz dosyalar exclude edildi</li>
                    </ul>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h4 className="text-base font-medium text-gray-900 mb-2">
                      v1.0.33 - NSIS Installer Düzeltmesi
                    </h4>
                    <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                      <li>NSIS installer ayarları kontrol edildi</li>
                      <li>
                        Dosyaların kurulması için ayarlar gözden geçirildi
                      </li>
                    </ul>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h4 className="text-base font-medium text-gray-900 mb-2">
                      v1.0.32 - Güncelleme Mekanizması Geri Alındı
                    </h4>
                    <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                      <li>
                        Güncelleme mekanizması çalışan eski haline döndürüldü
                      </li>
                      <li>autoInstallOnAppQuit tekrar aktif edildi</li>
                    </ul>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h4 className="text-base font-medium text-gray-900 mb-2">
                      v1.0.31 - Güncelleme Mekanizması Düzeltmesi
                    </h4>
                    <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                      <li>
                        Güncelleme sırasında dosyaların silinmesi sorunu
                        düzeltildi
                      </li>
                      <li>
                        Güvenli güncelleme kurulumu eklendi - quitAndInstall()
                        kullanılıyor
                      </li>
                      <li>
                        autoInstallOnAppQuit kapatıldı - manuel kurulum ile daha
                        güvenli
                      </li>
                      <li>
                        NSIS ayarları iyileştirildi - güncelleme sırasında uyarı
                        gösteriliyor
                      </li>
                    </ul>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h4 className="text-base font-medium text-gray-900 mb-2">
                      v1.0.30 - Login Yönlendirme ve Input Tıklama Sorunları
                      Düzeltmesi
                    </h4>
                    <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                      <li>
                        İlk açılışta authenticated değilse direkt login
                        sayfasına yönlendirme eklendi
                      </li>
                      <li>
                        Daha önce giriş yapıldıysa direkt masalar sayfası
                        görünecek
                      </li>
                      <li>
                        Input component'inde pointer-events sorunu tamamen
                        düzeltildi - artık inputlara tıklanabilir
                      </li>
                      <li>
                        Wrapper div'den gereksiz pointer-events-none kaldırıldı
                      </li>
                    </ul>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h4 className="text-base font-medium text-gray-900 mb-2">
                      v1.0.29 - Input Seçim Sorunu Düzeltmesi
                    </h4>
                    <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                      <li>
                        Input seçim sorunu düzeltildi - artık input'lara
                        tıklayınca focus alıyor
                      </li>
                      <li>Pointer-events ve user-select ayarları eklendi</li>
                      <li>Touch event'leri iyileştirildi</li>
                      <li>Label tıklamaları düzeltildi</li>
                    </ul>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h4 className="text-base font-medium text-gray-900 mb-2">
                      v1.0.28 - Otomatik Versiyon Kontrolü ve Oturum Kalıcılığı
                    </h4>
                    <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                      <li>
                        Uygulama açıldığında otomatik versiyon kontrolü eklendi
                      </li>
                      <li>Güncel versiyonsa hiçbir uyarı gösterilmiyor</li>
                      <li>
                        Yeni versiyon varsa loading ekranı ile indirme
                        gösteriliyor
                      </li>
                      <li>
                        Oturum bilgileri localStorage'a taşındı - uygulama
                        kapatılsa bile oturum açık kalıyor
                      </li>
                      <li>
                        404 hatası düzeltildi - uygulama ilk açıldığında login
                        sayfasına yönlendiriliyor
                      </li>
                    </ul>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h4 className="text-base font-medium text-gray-900 mb-2">
                      v1.0.27 - TouchKeyboardProvider Hata Düzeltmesi
                    </h4>
                    <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                      <li>
                        useTouchKeyboard hook'u provider yoksa fallback değer
                        döndürüyor
                      </li>
                      <li>Provider hatası çözüldü - artık hata fırlatmıyor</li>
                      <li>
                        Input component'i provider olmadan da çalışabiliyor
                      </li>
                    </ul>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h4 className="text-base font-medium text-gray-900 mb-2">
                      v1.0.26 - Login Sayfası ve Klavye İyileştirmeleri
                    </h4>
                    <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                      <li>Klavye boyutu küçültüldü (daha kompakt tasarım)</li>
                      <li>Input ref yönetimi sorunu tamamen çözüldü</li>
                      <li>Her input kendi klavye butonunu gösteriyor</li>
                      <li>Cursor görünürlüğü ve pozisyonu düzeltildi</li>
                      <li>Şifre inputuna tıklayınca doğru input'a yazıyor</li>
                      <li>Focus yönetimi iyileştirildi</li>
                    </ul>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h4 className="text-base font-medium text-gray-900 mb-2">
                      v1.0.0 - İlk Sürüm
                    </h4>
                    <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                      <li>Tam ekran ödeme alma ekranı eklendi</li>
                      <li>Ürün seçimi ve miktar belirleme özelliği</li>
                      <li>Numerik tuş takımı ile miktar girişi</li>
                      <li>İskonto uygulama sistemi (oran ve fiyat bazlı)</li>
                      <li>Kısmi ödeme alma özelliği</li>
                      <li>
                        Paket masaları için kurye atama ve para üstü işlemleri
                      </li>
                      <li>Kurye yönetimi ve istatistikleri</li>
                      <li>
                        Gelişmiş masa yönetimi (aktif masalar, tüm masalar)
                      </li>
                      <li>Otomatik zaman güncellemeleri</li>
                      <li>Yazıcı yönetimi (USB, Seri Port, Ağ yazıcıları)</li>
                      <li>Koyu tema desteği</li>
                      <li>Responsive tasarım (mobil ve masaüstü uyumlu)</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
            <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6">
              <Button
                onClick={() => setShowUpdateNotes(false)}
                className="w-full h-12 text-base font-medium"
              >
                Kapat
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
