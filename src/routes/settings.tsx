import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { POSLayout } from "@/components/layouts/POSLayout";
import { Settings as SettingsIcon, Download, CheckCircle, RefreshCw, Sun, Moon, Monitor, ArrowLeft, X, CreditCard, Send, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/settings")({
  component: Settings,
});

function Settings() {
  return (
    <POSLayout>
      <SettingsContent />
    </POSLayout>
  );
}

interface NavigationSettings {
  returnAfterProductAdd: boolean;
  returnAfterProductCancel: boolean;
  returnAfterPayment: boolean;
  returnAfterOrderClose: boolean;
  returnAfterItemMove: boolean;
}

function SettingsContent() {
  const { theme, setTheme } = useTheme();
  const [pendingUpdate, setPendingUpdate] = useState<{ version: string; timestamp: number } | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [updateDownloaded, setUpdateDownloaded] = useState(false);

  // Navigation settings
  const [navSettings, setNavSettings] = useState<NavigationSettings>({
    returnAfterProductAdd: true,
    returnAfterProductCancel: false,
    returnAfterPayment: false,
    returnAfterOrderClose: true,
    returnAfterItemMove: false,
  });

  useEffect(() => {
    // Navigation ayarlarını yükle
    const storedNavSettings = localStorage.getItem("navigationSettings");
    if (storedNavSettings) {
      try {
        setNavSettings(JSON.parse(storedNavSettings));
      } catch (error) {
      }
    }
    
    // Bekleyen güncelleme var mı kontrol et
    const storedUpdate = localStorage.getItem("pendingUpdate");
    if (storedUpdate) {
      try {
        setPendingUpdate(JSON.parse(storedUpdate));
      } catch (error) {
      }
    }

    // Güncelleme event listener'ları
    const handleDownloadProgress = (progress: { percent: number }) => {
      setDownloadProgress(progress.percent);
    };

    const handleUpdateDownloaded = () => {
      setUpdateDownloaded(true);
      setDownloadProgress(0);
      localStorage.removeItem("pendingUpdate");
      setPendingUpdate(null);
    };

    const handleUpdateAvailable = (version: string) => {
      setPendingUpdate({ version, timestamp: Date.now() });
      localStorage.setItem("pendingUpdate", JSON.stringify({ version, timestamp: Date.now() }));
    };

    if (window.electronAPI) {
      window.electronAPI.onDownloadProgress?.(handleDownloadProgress);
      window.electronAPI.onUpdateDownloaded?.(handleUpdateDownloaded);
      window.electronAPI.onUpdateAvailable?.(handleUpdateAvailable);
    }
  }, []);

  const handleCheckForUpdates = async () => {
    if (!window.electronAPI?.checkForUpdates) {
      return;
    }

    setIsCheckingUpdate(true);
    try {
      const result = await window.electronAPI.checkForUpdates();
      if (result.devMode) {
      }
    } catch (error) {
    } finally {
      setTimeout(() => setIsCheckingUpdate(false), 1000);
    }
  };

  const handleDownloadUpdate = () => {
    if (window.electronAPI?.startDownloadUpdate) {
      window.electronAPI.startDownloadUpdate();
    }
  };

  const handleInstallUpdate = () => {
    if (window.electronAPI?.quitAndInstall) {
      window.electronAPI.quitAndInstall();
    }
  };

  const handleNavSettingChange = (key: keyof NavigationSettings, value: boolean) => {
    const newSettings = { ...navSettings, [key]: value };
    setNavSettings(newSettings);
    localStorage.setItem("navigationSettings", JSON.stringify(newSettings));
  };

  return (
    <div className="h-full bg-gray-50 dark:bg-gray-900 p-3 lg:p-4 overflow-y-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <SettingsIcon className="h-8 w-8" />
          Ayarlar
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
          Sistem ayarlarını yönetin
        </p>
      </div>

      {/* Tema Ayarları */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Tema Ayarları
          </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Açık Tema */}
              <button
            onClick={() => setTheme("light")}
            className={`p-4 rounded-lg border-2 transition-all ${
              theme === "light"
                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
            }`}
          >
            <div className="flex flex-col items-center gap-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                theme === "light" 
                  ? "bg-blue-100 dark:bg-blue-900/30" 
                  : "bg-gray-100 dark:bg-gray-700"
              }`}>
                <Sun className={`h-6 w-6 ${
                  theme === "light" 
                    ? "text-blue-600 dark:text-blue-400" 
                    : "text-gray-600 dark:text-gray-400"
                }`} />
              </div>
              <span className={`font-medium ${
                theme === "light"
                  ? "text-blue-900 dark:text-blue-100"
                  : "text-gray-700 dark:text-gray-300"
              }`}>
                Açık Tema
              </span>
            </div>
          </button>

          {/* Koyu Tema */}
          <button
            onClick={() => setTheme("dark")}
            className={`p-4 rounded-lg border-2 transition-all ${
              theme === "dark"
                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                }`}
              >
            <div className="flex flex-col items-center gap-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                theme === "dark" 
                  ? "bg-blue-100 dark:bg-blue-900/30" 
                  : "bg-gray-100 dark:bg-gray-700"
              }`}>
                <Moon className={`h-6 w-6 ${
                  theme === "dark" 
                    ? "text-blue-600 dark:text-blue-400" 
                    : "text-gray-600 dark:text-gray-400"
                }`} />
                  </div>
              <span className={`font-medium ${
                theme === "dark"
                          ? "text-blue-900 dark:text-blue-100"
                  : "text-gray-700 dark:text-gray-300"
              }`}>
                Koyu Tema
              </span>
                    </div>
          </button>

          {/* Sistem Teması */}
          <button
            onClick={() => setTheme("system")}
            className={`p-4 rounded-lg border-2 transition-all ${
              theme === "system"
                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
            }`}
          >
            <div className="flex flex-col items-center gap-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                theme === "system" 
                  ? "bg-blue-100 dark:bg-blue-900/30" 
                  : "bg-gray-100 dark:bg-gray-700"
              }`}>
                <Monitor className={`h-6 w-6 ${
                  theme === "system" 
                    ? "text-blue-600 dark:text-blue-400" 
                    : "text-gray-600 dark:text-gray-400"
                }`} />
                    </div>
              <span className={`font-medium ${
                theme === "system"
                  ? "text-blue-900 dark:text-blue-100"
                  : "text-gray-700 dark:text-gray-300"
              }`}>
                Sistem
              </span>
                </div>
              </button>
        </div>
      </div>

      {/* İşlem Sonrası Hareket Kontrolü */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          İşlem Sonrası Hareket Kontrolü
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          İşlemlerden sonra otomatik olarak masalar sayfasına dönüş yapılsın mı?
        </p>
        
        <div className="space-y-4">
          {/* Ürün Girişi */}
          <div className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
            <div className="flex items-center gap-3">
              <Send className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  Ürün Girişinden Sonra Masalara Dön
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Ürün eklendikten sonra otomatik yönlendirme
                </p>
              </div>
            </div>
            <button
              onClick={() => handleNavSettingChange("returnAfterProductAdd", !navSettings.returnAfterProductAdd)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                navSettings.returnAfterProductAdd
                  ? "bg-blue-600"
                  : "bg-gray-300 dark:bg-gray-600"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  navSettings.returnAfterProductAdd ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Ürün İptali */}
          <div className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
            <div className="flex items-center gap-3">
              <X className="h-5 w-5 text-red-600 dark:text-red-400" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  Ürün İptalinden Sonra Masalara Dön
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Ürün iptal edildikten sonra otomatik yönlendirme
                </p>
              </div>
            </div>
            <button
              onClick={() => handleNavSettingChange("returnAfterProductCancel", !navSettings.returnAfterProductCancel)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                navSettings.returnAfterProductCancel
                  ? "bg-blue-600"
                  : "bg-gray-300 dark:bg-gray-600"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  navSettings.returnAfterProductCancel ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Ödeme Alma */}
          <div className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
            <div className="flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-green-600 dark:text-green-400" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  Ödeme Alındıktan Sonra Masalara Dön
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Ödeme işleminden sonra otomatik yönlendirme
                </p>
              </div>
            </div>
            <button
              onClick={() => handleNavSettingChange("returnAfterPayment", !navSettings.returnAfterPayment)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                navSettings.returnAfterPayment
                  ? "bg-blue-600"
                  : "bg-gray-300 dark:bg-gray-600"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  navSettings.returnAfterPayment ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Sipariş Kapatma */}
          <div className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  Sipariş Kapatıldıktan Sonra Masalara Dön
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Sipariş kapatıldıktan sonra otomatik yönlendirme
                </p>
              </div>
            </div>
            <button
              onClick={() => handleNavSettingChange("returnAfterOrderClose", !navSettings.returnAfterOrderClose)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                navSettings.returnAfterOrderClose
                  ? "bg-blue-600"
                  : "bg-gray-300 dark:bg-gray-600"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  navSettings.returnAfterOrderClose ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Ürün Taşıma */}
          <div className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
            <div className="flex items-center gap-3">
              <ArrowLeft className="h-5 w-5 text-orange-600 dark:text-orange-400" />
          <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  Ürün Taşındıktan Sonra Masalara Dön
            </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Ürün başka masaya taşındıktan sonra otomatik yönlendirme
                </p>
              </div>
            </div>
            <button
              onClick={() => handleNavSettingChange("returnAfterItemMove", !navSettings.returnAfterItemMove)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                navSettings.returnAfterItemMove
                  ? "bg-blue-600"
                  : "bg-gray-300 dark:bg-gray-600"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  navSettings.returnAfterItemMove ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Güncelleme Bölümü */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Güncelleme Yönetimi
        </h2>

        {updateDownloaded ? (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-green-900 dark:text-green-100 mb-1">
                  Güncelleme İndirildi
                </h3>
                <p className="text-sm text-green-700 dark:text-green-300">
                  Yeni sürüm hazır. Kurmak için aşağıdaki butona tıklayın.
                </p>
              </div>
            </div>
            <div className="mt-4">
              <Button
                onClick={handleInstallUpdate}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
              >
                <Download className="h-4 w-4 mr-2" />
                Kur ve Yeniden Başlat
              </Button>
            </div>
          </div>
        ) : downloadProgress > 0 ? (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                <Download className="h-6 w-6 text-blue-600 dark:text-blue-400 animate-pulse" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                  Güncelleme İndiriliyor
                </h3>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Lütfen bekleyin...
                </p>
              </div>
            </div>
            <div className="w-full bg-blue-200 dark:bg-blue-900/40 rounded-full h-3">
              <div
                className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                style={{ width: `${downloadProgress}%` }}
              />
            </div>
            <p className="text-sm text-blue-700 dark:text-blue-300 mt-2 text-center">
              {Math.round(downloadProgress)}%
            </p>
          </div>
        ) : pendingUpdate ? (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                <Download className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-1">
                  Yeni Güncelleme Mevcut
                </h3>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  Versiyon {pendingUpdate.version} indirilebilir.
                </p>
              </div>
            </div>
            <div className="mt-4">
            <Button
                onClick={handleDownloadUpdate}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
                <Download className="h-4 w-4 mr-2" />
                İndir ve Kur
            </Button>
          </div>
        </div>
        ) : (
          <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center flex-shrink-0">
                <CheckCircle className="h-6 w-6 text-gray-600 dark:text-gray-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                  Güncel Sürüm
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Şu anda en güncel sürümü kullanıyorsunuz.
                </p>
              </div>
            </div>
          </div>
        )}

        <Button
          onClick={handleCheckForUpdates}
          disabled={isCheckingUpdate}
          variant="outline"
          className="w-full"
        >
          {isCheckingUpdate ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Kontrol Ediliyor...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Güncelleme Kontrolü
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
