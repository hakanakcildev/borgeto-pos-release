import { Outlet, Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";
import { signOutUser } from "@/lib/firebase/auth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Button } from "@/components/ui/button";
import {
  Home,
  LogOut,
  Menu,
  X,
  Settings,
  BarChart3,
  Utensils,
  CreditCard,
  Phone,
  History,
  Table as TableIcon,
  Printer,
  Bike,
  RefreshCw,
  Download,
  CheckCircle,
  Package,
  User,
} from "lucide-react";
import { useState, useCallback, useEffect } from "react";
import { getCompany } from "@/lib/firebase/companies";
import type { Company } from "@/lib/firebase/types";

// Mobile Menu Component
function MobileMenu({
  isOpen,
  onClose,
  menuItems,
  getIsActive,
  onLogout,
  company,
}: {
  isOpen: boolean;
  onClose: () => void;
  menuItems: Array<{
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    href: string;
  }>;
  getIsActive: (href: string) => boolean;
  onLogout: () => void;
  company: Company | null;
}) {
  const { userData } = useAuth();

  return (
    <>
      {/* Overlay */}
      <div
        className={`lg:hidden fixed inset-0 bg-black/20 backdrop-blur-sm transition-opacity duration-300 ease-in-out z-40 ${
          isOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Mobile Menu */}
      <div
        className={`lg:hidden fixed top-0 left-0 h-full w-72 bg-white dark:bg-gray-800 shadow-2xl z-50 transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-800">
          <div className="flex items-center space-x-3 min-w-0 flex-1">
            {company?.logo ? (
              <img
                src={company.logo}
                alt={company.name}
                className="w-10 h-10 rounded-xl object-cover shadow-sm flex-shrink-0"
              />
            ) : (
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                <span className="text-white font-bold text-sm">
                  {company?.name?.charAt(0).toUpperCase() || "P"}
                </span>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white truncate">
                {company?.name || "Firma"}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {userData?.displayName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200 cursor-pointer flex-shrink-0"
          >
            <X className="h-5 w-5 text-gray-600 dark:text-gray-300" />
          </button>
        </div>

        {/* Menu Items */}
        <div className="p-4">
          <div className="space-y-2">
            {menuItems.map((item, index) => {
              const isActive = getIsActive(item.href);
              return (
                <Link
                  key={index}
                  to={item.href}
                  onClick={onClose}
                  className={`flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${
                    isActive
                      ? "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 border-r-4 border-blue-600 dark:border-blue-400 shadow-sm"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white"
                  }`}
                >
                  <item.icon
                    className={`h-5 w-5 ${isActive ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400"}`}
                  />
                  <span
                    className={`ml-3 text-base ${isActive ? "font-semibold" : "font-medium"}`}
                  >
                    {item.title}
                  </span>
                </Link>
              );
            })}

          </div>

          {/* User Info & Logout */}
          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-3 mb-4 px-4 py-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/40 rounded-lg flex items-center justify-center flex-shrink-0">
                <Home className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                  {userData?.displayName || "Kullanıcı"}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {userData?.email}
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onLogout();
                onClose();
              }}
              className="w-full text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 text-sm py-3 rounded-xl"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Çıkış Yap
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

interface POSLayoutProps {
  children?: React.ReactNode;
}

export function POSLayout({ children }: POSLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [company, setCompany] = useState<Company | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const [currentPath, setCurrentPath] = useState(location.pathname);
  const { userData } = useAuth();
  
  // Güncelleme state'leri
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateVersion, setUpdateVersion] = useState<string>("");
  const [downloadingUpdate, setDownloadingUpdate] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [updateDownloaded, setUpdateDownloaded] = useState(false);
  const [showUpdateNotification, setShowUpdateNotification] = useState(false);

  useEffect(() => {
    setCurrentPath(location.pathname);
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    const loadCompany = async () => {
      if (userData?.companyId) {
        try {
          const companyData = await getCompany(userData.companyId);
          setCompany(companyData);
        } catch (error) {
        }
      }
    };
    loadCompany();
  }, [userData?.companyId]);


  // Kullanıcı giriş yaptığında otomatik güncelleme kontrolünü etkinleştir
  useEffect(() => {
    if (userData && window.electronAPI?.enableAutoDownload) {
      window.electronAPI.enableAutoDownload().catch(() => {});
    }
  }, [userData]);

  // Electron güncelleme event listener'ları
  useEffect(() => {
    if (!window.electronAPI) return;

    const handleUpdateAvailable = (version: string, releaseNotes?: string) => {
      setUpdateAvailable(true);
      setUpdateVersion(version);
      
      // Release notes'u localStorage'a kaydet
      if (releaseNotes) {
        localStorage.setItem("updateReleaseNotes", releaseNotes);
      }
      
      // Eğer autoDownload true ise indirme başlamış demektir
      // Eğer false ise kullanıcıdan onay bekleniyor demektir
      // Login sayfasında değilsek ve kullanıcı giriş yapmışsa bildirim göster
      if (userData) {
        setShowUpdateNotification(true);
        // Eğer autoDownload true ise indirme başlamış demektir
        // Aksi halde sadece bildirim göster
        setDownloadingUpdate(false);
        setDownloadProgress(0);
      } else {
        // Login sayfasındayız, indirme başlamamalı
        setDownloadingUpdate(false);
        setDownloadProgress(0);
      }
    };

    const handleUpdateNotAvailable = () => {
      setUpdateAvailable(false);
    };

    const handleDownloadProgress = (progress: { percent: number }) => {
      setDownloadProgress(progress.percent);
      setDownloadingUpdate(true);
      // İndirme başladığında bildirimi göster (indirme durumunu göster)
      setShowUpdateNotification(true);
    };

    const handleUpdateDownloaded = () => {
      setDownloadingUpdate(false);
      setDownloadProgress(100);
      setUpdateDownloaded(true);
      setUpdateAvailable(false);
      // Login yapılmışsa bildirim göster
      if (userData) {
        setShowUpdateNotification(true);
      }
      // İndirme tamamlandığında localStorage'dan sil
      localStorage.removeItem("pendingUpdate");
    };

    const handleUpdateError = () => {
      setDownloadingUpdate(false);
      setUpdateAvailable(false);
    };

    const handleUpdateChecking = () => {
    };

    if (window.electronAPI.onUpdateAvailable) {
      window.electronAPI.onUpdateAvailable(handleUpdateAvailable);
      window.electronAPI.onUpdateNotAvailable(handleUpdateNotAvailable);
      window.electronAPI.onUpdateDownloaded(handleUpdateDownloaded);
      window.electronAPI.onDownloadProgress(handleDownloadProgress);
      window.electronAPI.onUpdateError(handleUpdateError);
      window.electronAPI.onUpdateChecking(handleUpdateChecking);
    }

    // NOT: Otomatik indirme artık devre dışı
    // Kullanıcı manuel olarak "İndir ve Kur" butonuna basmalı
    // Güncelleme bilgisi localStorage'a kaydedilecek

    return () => {
      // Cleanup if needed
    };
  }, [userData]);

  // Güncellemeyi kur ve yeniden başlat
  const handleInstallUpdate = useCallback(async () => {
    if (window.electronAPI?.quitAndInstall) {
      try {
        await window.electronAPI.quitAndInstall();
      } catch (error) {
      }
    }
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      // Local storage'ı temizle
      localStorage.removeItem("posAuth");
      
      // Storage event tetikle
      window.dispatchEvent(new StorageEvent("storage", {
        key: "posAuth",
        newValue: null,
      }));
      
      // Firebase'den çıkış yap
      await signOutUser();
      
      // Login sayfasına yönlendir
      navigate({ to: "/auth/login", replace: true });
    } catch (error) {
      // Hata olsa bile temizle ve yönlendir
      localStorage.removeItem("posAuth");
      window.dispatchEvent(new StorageEvent("storage", {
        key: "posAuth",
        newValue: null,
      }));
      navigate({ to: "/auth/login", replace: true });
    }
  }, [navigate]);

  const menuItems = [
    { title: "Masalar", icon: Home, href: "/" },
    { title: "Masa Yönetimi", icon: TableIcon, href: "/tables" },
    { title: "Cari Masaları", icon: User, href: "/customer-tables" },
    { title: "Ürün Yönetimi", icon: Utensils, href: "/menus" },
    { title: "Stok Yönetimi", icon: Package, href: "/stocks" },
    {
      title: "Ödeme Yöntemleri",
      icon: CreditCard,
      href: "/payment-methods",
    },
    { title: "İstatistikler", icon: BarChart3, href: "/statistics" },
    { title: "Masa Geçmişi", icon: History, href: "/table-history" },
    { title: "Kurye Yönetimi", icon: Bike, href: "/couriers" },
    { title: "Yazıcı Ayarları", icon: Printer, href: "/printers" },
    { title: "Destek", icon: Phone, href: "/support" },
    { title: "Ayarlar", icon: Settings, href: "/settings" },
  ];

  const getIsActive = useCallback(
    (href: string) => {
      if (href === "/") {
        return currentPath === "/";
      }
      if (href === "/settings") {
        return (
          currentPath === "/settings" ||
          currentPath.startsWith("/settings/")
        );
      }
      if (href === "/tables") {
        return (
          currentPath === "/tables" ||
          currentPath.startsWith("/tables/")
        );
      }
      if (href === "/payment-methods") {
        return (
          currentPath === "/payment-methods" ||
          currentPath.startsWith("/payment-methods/")
        );
      }
      if (href === "/support") {
        return (
          currentPath === "/support" ||
          currentPath.startsWith("/support/")
        );
      }
      if (href === "/menus") {
        return (
          currentPath === "/menus" || currentPath.startsWith("/menus/")
        );
      }
      if (href === "/stocks") {
        return (
          currentPath === "/stocks" || currentPath.startsWith("/stocks/")
        );
      }
      if (href === "/customer-tables") {
        return (
          currentPath === "/customer-tables" || currentPath.startsWith("/customer-tables/")
        );
      }
      if (href === "/statistics") {
        return (
          currentPath === "/statistics" || currentPath.startsWith("/statistics/")
        );
      }
      return currentPath === href || currentPath === href + "/";
    },
    [currentPath]
  );

  return (
    <ProtectedRoute requireAuth={true} requireCompanyAccess={true}>
      <div className="h-[100dvh] flex w-full bg-gray-50 dark:bg-gray-900 overflow-hidden">
        {/* Sidebar - Collapsed/Expanded */}
        <div
          className={`fixed lg:relative top-0 left-0 h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex-col z-50 transition-all duration-300 ease-in-out flex-shrink-0 ${
            isSidebarExpanded 
              ? "w-64 xl:w-72" 
              : "w-16 xl:w-24"
          } ${isSidebarExpanded ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
        >
          <div className="h-full flex flex-col overflow-y-auto shadow-lg">
            {/* Header */}
            <div
              className={`border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-800 transition-all duration-300 ${
                isSidebarExpanded ? "px-3 xl:px-4 py-4 xl:py-6" : "px-2 xl:px-3 py-3 xl:py-4"
              }`}
            >
              {/* Borgeto POS ve Logo */}
              <div className="flex flex-col items-center">
                <p
                  className={`font-semibold text-gray-900 dark:text-white text-center mb-2 whitespace-nowrap ${
                    isSidebarExpanded ? "text-xs xl:text-sm" : "text-[10px] xl:text-xs"
                  }`}
                >
                  Borgeto POS
                </p>
                {company?.logo ? (
                  <img
                    src={company.logo}
                    alt={company.name}
                    className={`rounded-xl object-cover shadow-sm ${
                      isSidebarExpanded ? "w-10 h-10 xl:w-12 xl:h-12" : "w-8 h-8 xl:w-10 xl:h-10"
                    }`}
                  />
                ) : (
                  <div
                    className={`bg-blue-600 rounded-xl flex items-center justify-center shadow-sm ${
                      isSidebarExpanded ? "w-10 h-10 xl:w-12 xl:h-12" : "w-8 h-8 xl:w-10 xl:h-10"
                    }`}
                  >
                    <span
                      className={`text-white font-bold ${
                        isSidebarExpanded ? "text-sm xl:text-lg" : "text-xs xl:text-sm"
                      }`}
                    >
                      {company?.name?.charAt(0).toUpperCase() || "P"}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div
              className={`flex-1 transition-all duration-300 ${
                isSidebarExpanded ? "px-3 xl:px-6 py-4 xl:py-6" : "px-2 xl:px-3 py-3 xl:py-4"
              }`}
            >
              {/* Menü Aç/Kapa Butonu - Menü Öğelerinin Üstünde */}
              <div className="mb-2">
                <button
                  onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
                  className={`w-full flex items-center transition-all duration-200 h-10 xl:h-[44px] ${
                    isSidebarExpanded
                      ? "gap-2 xl:gap-4 px-3 xl:px-4 text-xs xl:text-sm rounded-xl"
                      : "justify-center px-2 rounded-lg"
                  } text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white`}
                  title={!isSidebarExpanded ? "Menü" : undefined}
                >
                  {isSidebarExpanded ? (
                    <X className="h-4 w-4 xl:h-5 xl:w-5 flex-shrink-0 text-gray-500 dark:text-gray-400" />
                  ) : (
                    <Menu className="h-4 w-4 xl:h-5 xl:w-5 flex-shrink-0 text-gray-500 dark:text-gray-400" />
                  )}
                  {isSidebarExpanded && (
                    <span className="font-medium text-xs xl:text-sm">Menüyü Kapat</span>
                  )}
                </button>
              </div>
              <div className="space-y-1.5 xl:space-y-2">
                {menuItems.map((item, index) => {
                  const isActive = getIsActive(item.href);
                  return (
                    <Link
                      key={index}
                      to={item.href as any}
                      onClick={() => {
                        setIsSidebarExpanded(false);
                      }}
                      className={`flex items-center transition-all duration-200 h-10 xl:h-[44px] ${
                        isSidebarExpanded
                          ? "gap-2 xl:gap-4 px-3 xl:px-4 text-xs xl:text-sm rounded-xl"
                          : "justify-center px-2 rounded-lg"
                      } ${
                        isActive
                          ? isSidebarExpanded
                            ? "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 border-r-4 border-blue-600 dark:border-blue-400 shadow-sm"
                            : "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                          : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white"
                      }`}
                      title={!isSidebarExpanded ? item.title : undefined}
                    >
                      <item.icon
                        className={`h-4 w-4 xl:h-5 xl:w-5 flex-shrink-0 ${
                          isActive
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-gray-500 dark:text-gray-400"
                        }`}
                      />
                      {isSidebarExpanded && (
                        <span
                          className={`${isActive ? "font-semibold" : "font-medium"} text-xs xl:text-sm`}
                        >
                          {item.title}
                        </span>
                      )}
                    </Link>
                  );
                })}

              </div>
            </div>

            <div
              className={`border-t border-gray-200 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-800 mt-auto transition-all duration-300 ${
                isSidebarExpanded ? "px-3 xl:px-6 py-4 xl:py-6" : "px-2 xl:px-3 py-3 xl:py-4"
              }`}
            >
              {isSidebarExpanded ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsSidebarExpanded(false);
                    handleLogout();
                  }}
                  className="w-full py-2 xl:py-3 rounded-xl text-xs xl:text-sm"
                >
                  <LogOut className="h-3 w-3 xl:h-4 xl:w-4 mr-1.5 xl:mr-2" />
                  Çıkış Yap
                </Button>
              ) : (
                <button
                  onClick={() => {
                    setIsSidebarExpanded(false);
                    handleLogout();
                  }}
                  className="w-full p-2 xl:p-3 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200 flex items-center justify-center"
                  title="Çıkış Yap"
                >
                  <LogOut className="h-4 w-4 xl:h-5 xl:w-5 text-gray-600 dark:text-gray-300" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto h-full">
            {children || <Outlet />}
          </div>
        </main>

        <MobileMenu
          isOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
          menuItems={menuItems}
          getIsActive={getIsActive}
          onLogout={handleLogout}
          company={company}
        />

        {/* Güncelleme İndiriliyor Modal */}
        {downloadingUpdate && (
          <div className="fixed inset-0 z-[9999] bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
              <div className="text-center">
                <RefreshCw className="h-16 w-16 animate-spin text-blue-600 dark:text-blue-400 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Güncelleme İndiriliyor
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Yeni versiyon indiriliyor, lütfen bekleyin...
                </p>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mb-2">
                  <div
                    className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${downloadProgress}%` }}
                  />
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {Math.round(downloadProgress)}%
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Güncelleme İndirildi Modal - Uygulama Başlatıldığında */}
        {updateDownloaded && !userData && (
          <div className="fixed inset-0 z-[9999] bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Güncelleme Hazır
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Versiyon {updateVersion} indirildi. Güncellemeyi kurmak ve uygulamayı yeniden başlatmak ister misiniz?
                </p>
                <div className="flex gap-3">
                  <Button
                    onClick={handleInstallUpdate}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Şimdi Kur ve Yeniden Başlat
                  </Button>
                  <Button
                    onClick={() => setUpdateDownloaded(false)}
                    variant="outline"
                    className="flex-1"
                  >
                    Daha Sonra
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Güncelleme Bildirimi - Login Yapılmışsa */}
        {showUpdateNotification && userData && (
          <div className="fixed top-4 right-4 z-[9999] animate-fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 p-4 max-w-sm">
              {updateDownloaded ? (
                <>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                        Güncelleme Hazır
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        Versiyon {updateVersion} indirildi. Kurmak için tıklayın.
                      </p>
                      <div className="flex gap-2">
                        <Button
                          onClick={handleInstallUpdate}
                          size="sm"
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs"
                        >
                          <Download className="h-3 w-3 mr-1" />
                          Kur ve Yeniden Başlat
                        </Button>
                        <Button
                          onClick={() => setShowUpdateNotification(false)}
                          size="sm"
                          variant="outline"
                          className="text-xs"
                        >
                          Daha Sonra
                        </Button>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowUpdateNotification(false)}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </>
              ) : updateAvailable && !downloadingUpdate ? (
                <>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                      <RefreshCw className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                        Yeni Güncelleme Mevcut
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        Versiyon {updateVersion} mevcut. İndirmek için tıklayın.
                      </p>
                      <div className="flex gap-2">
                        <Button
                          onClick={async () => {
                            setDownloadingUpdate(true);
                            setDownloadProgress(0);
                            if (window.electronAPI?.startDownloadUpdate) {
                              try {
                                await window.electronAPI.startDownloadUpdate();
                              } catch (error) {
                                setDownloadingUpdate(false);
                              }
                            }
                          }}
                          size="sm"
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs"
                        >
                          <Download className="h-3 w-3 mr-1" />
                          İndir ve Kur
                        </Button>
                        <Button
                          onClick={() => setShowUpdateNotification(false)}
                          size="sm"
                          variant="outline"
                          className="text-xs"
                        >
                          Daha Sonra
                        </Button>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowUpdateNotification(false)}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </>
              ) : updateAvailable && downloadingUpdate ? (
                <>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                      <RefreshCw className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-spin" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                        Güncelleme İndiriliyor
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        Versiyon {updateVersion} indiriliyor...
                      </p>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${downloadProgress}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {Math.round(downloadProgress)}%
                      </p>
                    </div>
                    <button
                      onClick={() => setShowUpdateNotification(false)}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}

