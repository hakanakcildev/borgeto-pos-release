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
  Table,
  Printer,
  Bike,
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
      console.error("Logout error:", error);
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
    { title: "Masa Yönetimi", icon: Table, href: "/tables" },
    { title: "Ürün Yönetimi", icon: Utensils, href: "/menus" },
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
            isSidebarExpanded ? "w-72" : "w-24"
          } ${isSidebarExpanded ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
        >
          <div className="h-full flex flex-col overflow-y-auto shadow-lg">
            {/* Header */}
            <div
              className={`border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-800 transition-all duration-300 ${
                isSidebarExpanded ? "px-4 py-6" : "px-3 py-4"
              }`}
            >
              {/* Borgeto POS ve Logo */}
              <div className="flex flex-col items-center">
                <p
                  className={`font-semibold text-gray-900 dark:text-white text-center mb-2 whitespace-nowrap ${
                    isSidebarExpanded ? "text-sm" : "text-xs"
                  }`}
                >
                  Borgeto POS
                </p>
                {company?.logo ? (
                  <img
                    src={company.logo}
                    alt={company.name}
                    className={`rounded-xl object-cover shadow-sm ${
                      isSidebarExpanded ? "w-12 h-12" : "w-10 h-10"
                    }`}
                  />
                ) : (
                  <div
                    className={`bg-blue-600 rounded-xl flex items-center justify-center shadow-sm ${
                      isSidebarExpanded ? "w-12 h-12" : "w-10 h-10"
                    }`}
                  >
                    <span
                      className={`text-white font-bold ${
                        isSidebarExpanded ? "text-lg" : "text-sm"
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
                isSidebarExpanded ? "px-6 py-6" : "px-3 py-4"
              }`}
            >
              {/* Menü Aç/Kapa Butonu - Menü Öğelerinin Üstünde */}
              <div className="mb-2">
                <button
                  onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
                  className={`w-full flex items-center transition-all duration-200 h-[44px] ${
                    isSidebarExpanded
                      ? "gap-4 px-4 text-sm rounded-xl"
                      : "justify-center px-2 rounded-lg"
                  } text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white`}
                  title={!isSidebarExpanded ? "Menü" : undefined}
                >
                  {isSidebarExpanded ? (
                    <X className="h-5 w-5 flex-shrink-0 text-gray-500 dark:text-gray-400" />
                  ) : (
                    <Menu className="h-5 w-5 flex-shrink-0 text-gray-500 dark:text-gray-400" />
                  )}
                  {isSidebarExpanded && (
                    <span className="font-medium">Menüyü Kapat</span>
                  )}
                </button>
              </div>
              <div className="space-y-2">
                {menuItems.map((item, index) => {
                  const isActive = getIsActive(item.href);
                  return (
                    <Link
                      key={index}
                      to={item.href as any}
                      onClick={() => {
                        setIsSidebarExpanded(false);
                      }}
                      className={`flex items-center transition-all duration-200 h-[44px] ${
                        isSidebarExpanded
                          ? "gap-4 px-4 text-sm rounded-xl"
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
                        className={`h-5 w-5 flex-shrink-0 ${
                          isActive
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-gray-500 dark:text-gray-400"
                        }`}
                      />
                      {isSidebarExpanded && (
                        <span
                          className={isActive ? "font-semibold" : "font-medium"}
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
                isSidebarExpanded ? "px-6 py-6" : "px-3 py-4"
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
                  className="w-full py-3 rounded-xl"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Çıkış Yap
                </Button>
              ) : (
                <button
                  onClick={() => {
                    setIsSidebarExpanded(false);
                    handleLogout();
                  }}
                  className="w-full p-3 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200 flex items-center justify-center"
                  title="Çıkış Yap"
                >
                  <LogOut className="h-5 w-5 text-gray-600 dark:text-gray-300" />
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
      </div>
    </ProtectedRoute>
  );
}

