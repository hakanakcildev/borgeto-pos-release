import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import {
  Settings as SettingsIcon,
  RefreshCw,
  Sun,
  Moon,
  Monitor,
  ArrowLeft,
  X,
  CreditCard,
  Send,
  CheckCircle2,
  Table as TableIcon,
  Utensils,
  Users,
  Printer,
} from "lucide-react";
import { TablesManagementContent } from "@/routes/tables";
import { MenuManagementContent } from "@/routes/menus";
import { PaymentMethodsManagementContent } from "@/routes/payment-methods";
import { UsersManagementContent } from "@/routes/users";
import { PrintersContent } from "@/routes/printers";

export const Route = createFileRoute("/settings")({
  component: Settings,
});

type SettingsTab =
  | "general"
  | "table-management"
  | "tables"
  | "menus"
  | "payment-methods"
  | "users"
  | "printers";

function Settings() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");

  return (
    <ProtectedRoute requireAuth={true} requireCompanyAccess={true}>
      <div className="h-[100dvh] flex w-full bg-gray-50 dark:bg-gray-900 overflow-hidden">
        {/* Sidebar */}
        <div
          className="shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col"
          style={{ width: "280px" }}
        >
          {/* Geri Butonu - Sidebar'ın en üstünde */}
          <div className="shrink-0 p-4 border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() =>
                navigate({
                  to: "/",
                  search: { area: undefined, activeOnly: false },
                })
              }
              className="flex items-center gap-2 w-full px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
              title="Anasayfaya Dön"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="font-medium">Anasayfaya Dön</span>
            </button>
          </div>

          {/* Sekmeler - Sidebar içinde */}
          <div className="shrink-0 p-4 border-b border-gray-200 dark:border-gray-700 space-y-1 overflow-y-auto">
            <button
              onClick={() => setActiveTab("general")}
              className={`w-full px-3 py-2 rounded-lg text-left font-medium transition-colors flex items-center gap-2 ${
                activeTab === "general"
                  ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              <SettingsIcon className="h-4 w-4" />
              Genel
            </button>
            <button
              onClick={() => setActiveTab("table-management")}
              className={`w-full px-3 py-2 rounded-lg text-left font-medium transition-colors flex items-center gap-2 ${
                activeTab === "table-management"
                  ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              <TableIcon className="h-4 w-4" />
              Masa Ayarları
            </button>
            <button
              onClick={() => setActiveTab("tables")}
              className={`w-full px-3 py-2 rounded-lg text-left font-medium transition-colors flex items-center gap-2 ${
                activeTab === "tables"
                  ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              <TableIcon className="h-4 w-4" />
              Masa Yönetimi
            </button>
            <button
              onClick={() => setActiveTab("menus")}
              className={`w-full px-3 py-2 rounded-lg text-left font-medium transition-colors flex items-center gap-2 ${
                activeTab === "menus"
                  ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              <Utensils className="h-4 w-4" />
              Ürün Yönetimi
            </button>
            <button
              onClick={() => setActiveTab("payment-methods")}
              className={`w-full px-3 py-2 rounded-lg text-left font-medium transition-colors flex items-center gap-2 ${
                activeTab === "payment-methods"
                  ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              <CreditCard className="h-4 w-4" />
              Ödeme Yöntemleri
            </button>
            <button
              onClick={() => setActiveTab("users")}
              className={`w-full px-3 py-2 rounded-lg text-left font-medium transition-colors flex items-center gap-2 ${
                activeTab === "users"
                  ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              <Users className="h-4 w-4" />
              Kullanıcılar
            </button>
            <button
              onClick={() => setActiveTab("printers")}
              className={`w-full px-3 py-2 rounded-lg text-left font-medium transition-colors flex items-center gap-2 ${
                activeTab === "printers"
                  ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              <Printer className="h-4 w-4" />
              Yazıcı Ayarları
            </button>
          </div>

          {/* Sidebar içeriği buraya eklenebilir */}
          <div className="flex-1 overflow-y-auto"></div>
        </div>

        {/* Main Content */}
        <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto h-full">
            <SettingsContent
              activeTab={activeTab}
              setActiveTab={setActiveTab}
            />
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}

interface NavigationSettings {
  returnAfterProductAdd: boolean;
  returnAfterProductCancel: boolean;
  returnAfterPayment: boolean;
  returnAfterOrderClose: boolean;
  returnAfterItemMove: boolean;
}

function SettingsContent({
  activeTab,
  setActiveTab,
}: {
  activeTab: SettingsTab;
  setActiveTab: (tab: SettingsTab) => void;
}) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _setActiveTab = setActiveTab;
  const { theme, setTheme } = useTheme();
  const [_pendingUpdate, setPendingUpdate] = useState<{
    version: string;
    timestamp: number;
  } | null>(null);
  const [_isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [_downloadProgress, setDownloadProgress] = useState(0);
  const [_updateDownloaded, setUpdateDownloaded] = useState(false);

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
      } catch (error) {}
    }

    // Bekleyen güncelleme var mı kontrol et
    const storedUpdate = localStorage.getItem("pendingUpdate");
    if (storedUpdate) {
      try {
        setPendingUpdate(JSON.parse(storedUpdate));
      } catch (error) {}
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
      localStorage.setItem(
        "pendingUpdate",
        JSON.stringify({ version, timestamp: Date.now() })
      );
    };

    if (window.electronAPI) {
      window.electronAPI.onDownloadProgress?.(handleDownloadProgress);
      window.electronAPI.onUpdateDownloaded?.(handleUpdateDownloaded);
      window.electronAPI.onUpdateAvailable?.(handleUpdateAvailable);
    }
  }, []);

  const _handleCheckForUpdates = async () => {
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

  const _handleDownloadUpdate = () => {
    if (window.electronAPI?.startDownloadUpdate) {
      window.electronAPI.startDownloadUpdate();
    }
  };

  const _handleInstallUpdate = () => {
    if (window.electronAPI?.quitAndInstall) {
      window.electronAPI.quitAndInstall();
    }
  };

  const handleNavSettingChange = (
    key: keyof NavigationSettings,
    value: boolean
  ) => {
    const newSettings = { ...navSettings, [key]: value };
    setNavSettings(newSettings);
    localStorage.setItem("navigationSettings", JSON.stringify(newSettings));
  };

  const [localIP, setLocalIP] = useState<string | null>(null);

  useEffect(() => {
    const loadIP = async () => {
      const { getLocalIP } = await import("@/lib/utils/ip");
      const ip = await getLocalIP();
      setLocalIP(ip);
    };
    loadIP();
  }, []);

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

      {/* Genel Sekme İçeriği */}
      {activeTab === "general" && (
        <>
      {/* WiFi IP Bilgisi */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Sistem Bilgileri
        </h2>
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                Bağlı WiFi IP Adresi
              </p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {localIP || "Yükleniyor..."}
              </p>
            </div>
            <button
              onClick={async () => {
                const { getLocalIP } = await import("@/lib/utils/ip");
                const ip = await getLocalIP();
                setLocalIP(ip);
              }}
              className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
            >
              <RefreshCw className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </button>
          </div>
          <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
            Garson hesapları bu IP adresi ile eşleşmelidir
          </p>
        </div>
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
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  theme === "light"
                    ? "bg-blue-100 dark:bg-blue-900/30"
                    : "bg-gray-100 dark:bg-gray-700"
                }`}
              >
                <Sun
                  className={`h-6 w-6 ${
                    theme === "light"
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-gray-600 dark:text-gray-400"
                  }`}
                />
              </div>
              <span
                className={`font-medium ${
                  theme === "light"
                    ? "text-blue-900 dark:text-blue-100"
                    : "text-gray-700 dark:text-gray-300"
                }`}
              >
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
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  theme === "dark"
                    ? "bg-blue-100 dark:bg-blue-900/30"
                    : "bg-gray-100 dark:bg-gray-700"
                }`}
              >
                <Moon
                  className={`h-6 w-6 ${
                    theme === "dark"
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-gray-600 dark:text-gray-400"
                  }`}
                />
              </div>
              <span
                className={`font-medium ${
                  theme === "dark"
                    ? "text-blue-900 dark:text-blue-100"
                    : "text-gray-700 dark:text-gray-300"
                }`}
              >
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
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  theme === "system"
                    ? "bg-blue-100 dark:bg-blue-900/30"
                    : "bg-gray-100 dark:bg-gray-700"
                }`}
              >
                <Monitor
                  className={`h-6 w-6 ${
                    theme === "system"
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-gray-600 dark:text-gray-400"
                  }`}
                />
              </div>
              <span
                className={`font-medium ${
                  theme === "system"
                    ? "text-blue-900 dark:text-blue-100"
                    : "text-gray-700 dark:text-gray-300"
                }`}
              >
                Sistem
              </span>
            </div>
          </button>
        </div>
      </div>
        </>
      )}

      {/* Masa Yönetimi Sekme İçeriği */}
      {activeTab === "table-management" && (
        <>
      {/* İşlem Sonrası Hareket Kontrolü */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          İşlem Sonrası Hareket Kontrolü
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              İşlemlerden sonra otomatik olarak masalar sayfasına dönüş yapılsın
              mı?
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
              onClick={() =>
                handleNavSettingChange(
                  "returnAfterProductAdd",
                  !navSettings.returnAfterProductAdd
                )
              }
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                navSettings.returnAfterProductAdd
                  ? "bg-blue-600"
                  : "bg-gray-300 dark:bg-gray-600"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  navSettings.returnAfterProductAdd
                    ? "translate-x-6"
                    : "translate-x-1"
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
              onClick={() =>
                handleNavSettingChange(
                  "returnAfterProductCancel",
                  !navSettings.returnAfterProductCancel
                )
              }
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                navSettings.returnAfterProductCancel
                  ? "bg-blue-600"
                  : "bg-gray-300 dark:bg-gray-600"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  navSettings.returnAfterProductCancel
                    ? "translate-x-6"
                    : "translate-x-1"
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
              onClick={() =>
                handleNavSettingChange(
                  "returnAfterPayment",
                  !navSettings.returnAfterPayment
                )
              }
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                navSettings.returnAfterPayment
                  ? "bg-blue-600"
                  : "bg-gray-300 dark:bg-gray-600"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  navSettings.returnAfterPayment
                    ? "translate-x-6"
                    : "translate-x-1"
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
              onClick={() =>
                handleNavSettingChange(
                  "returnAfterOrderClose",
                  !navSettings.returnAfterOrderClose
                )
              }
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                navSettings.returnAfterOrderClose
                  ? "bg-blue-600"
                  : "bg-gray-300 dark:bg-gray-600"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  navSettings.returnAfterOrderClose
                    ? "translate-x-6"
                    : "translate-x-1"
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
              onClick={() =>
                handleNavSettingChange(
                  "returnAfterItemMove",
                  !navSettings.returnAfterItemMove
                )
              }
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                navSettings.returnAfterItemMove
                  ? "bg-blue-600"
                  : "bg-gray-300 dark:bg-gray-600"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  navSettings.returnAfterItemMove
                    ? "translate-x-6"
                    : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>
      </div>
            </>
          )}

      {/* Masa Yönetimi Sekmesi */}
      {activeTab === "tables" && <TablesManagementContent />}

      {/* Ürün Yönetimi Sekmesi */}
      {activeTab === "menus" && <MenuManagementContent />}

      {/* Ödeme Yöntemleri Sekmesi */}
      {activeTab === "payment-methods" && <PaymentMethodsManagementContent />}

      {/* Kullanıcılar Sekmesi */}
      {activeTab === "users" && <UsersManagementContent />}

      {/* Yazıcı Ayarları Sekmesi */}
      {activeTab === "printers" && <PrintersContent />}
    </div>
  );
}
