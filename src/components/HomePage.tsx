import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";
import {
  Home,
  Bike,
  Package,
  User,
  BarChart3,
  Settings,
  Phone,
  Calendar,
  History,
  LogOut,
  X,
  Minimize2,
} from "lucide-react";
import { signOutUser } from "@/lib/firebase/auth";

interface ExchangeRates {
  USD: number;
  EUR: number;
  lastUpdated: Date | null;
}

export function HomePage() {
  const { userData, companyData, branchData } = useAuth();
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates>({
    USD: 0,
    EUR: 0,
    lastUpdated: null,
  });
  const [exchangeRatesLoading, setExchangeRatesLoading] = useState(false);

  // Saati güncelle
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);


  // Döviz kurlarını yükle
  useEffect(() => {
    const fetchExchangeRates = async () => {
      try {
        setExchangeRatesLoading(true);

        // exchangerate-api.com kullanıyoruz (daha güvenilir)
        const [usdResponse, eurResponse] = await Promise.all([
          fetch("https://api.exchangerate-api.com/v4/latest/USD"),
          fetch("https://api.exchangerate-api.com/v4/latest/EUR"),
        ]);

        const usdData = await usdResponse.json();
        const eurData = await eurResponse.json();

        if (usdData?.rates?.TRY && eurData?.rates?.TRY) {
          setExchangeRates({
            USD: Number(usdData.rates.TRY),
            EUR: Number(eurData.rates.TRY),
            lastUpdated: new Date(),
          });
        } else {
          // Fallback: exchangerate.host
          const fallbackResponse = await fetch(
            "https://api.exchangerate.host/latest?base=USD&symbols=TRY"
          );
          const fallbackData = await fallbackResponse.json();

          const eurFallbackResponse = await fetch(
            "https://api.exchangerate.host/latest?base=EUR&symbols=TRY"
          );
          const eurFallbackData = await eurFallbackResponse.json();

          if (
            fallbackData?.success &&
            fallbackData?.rates?.TRY &&
            eurFallbackData?.success &&
            eurFallbackData?.rates?.TRY
          ) {
            setExchangeRates({
              USD: Number(fallbackData.rates.TRY),
              EUR: Number(eurFallbackData.rates.TRY),
              lastUpdated: new Date(),
            });
          }
        }
      } catch (error) {
        console.error("Döviz kurları yüklenirken hata:", error);
      } finally {
        setExchangeRatesLoading(false);
      }
    };

    // İlk yükleme
    fetchExchangeRates();

    // Her 5 dakikada bir güncelle
    const interval = setInterval(fetchExchangeRates, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const formatDate = (date: Date) => {
    const days = [
      "Pazar",
      "Pazartesi",
      "Salı",
      "Çarşamba",
      "Perşembe",
      "Cuma",
      "Cumartesi",
    ];
    const months = [
      "Ocak",
      "Şubat",
      "Mart",
      "Nisan",
      "Mayıs",
      "Haziran",
      "Temmuz",
      "Ağustos",
      "Eylül",
      "Ekim",
      "Kasım",
      "Aralık",
    ];
    return `${date.getDate()} ${months[date.getMonth()]} ${days[date.getDay()]}`;
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleLogout = async () => {
    try {
      // Firebase Auth'dan çıkış yap
      await signOutUser();

      // localStorage'dan posAuth'u temizle
      localStorage.removeItem("posAuth");

      // Storage event'i tetikle (diğer tab'lar için)
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "posAuth",
          newValue: null,
        })
      );

      // Login sayfasına yönlendir
      navigate({ to: "/auth/login" });
    } catch (error) {
      console.error("Logout error:", error);
      // Hata olsa bile localStorage'ı temizle ve login'e yönlendir
      localStorage.removeItem("posAuth");
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "posAuth",
          newValue: null,
        })
      );
      navigate({ to: "/auth/login" });
    }
  };

  const handleQuit = async () => {
    if (window.electronAPI?.quitApp) {
      try {
        await window.electronAPI.quitApp();
      } catch (error) {
        console.error("Quit error:", error);
      }
    }
  };

  // Sidebar'daki tüm menü öğeleri (Ayarlar sidebar'ına taşınanlar hariç)
  const menuItems = [
    {
      title: "Masalar",
      icon: Home,
      onClick: () => {
        navigate({ to: "/", search: { area: "all", activeOnly: false } });
      },
    },
    {
      title: "Cari Masaları",
      icon: User,
      onClick: () => {
        navigate({ to: "/customer-tables" });
      },
    },
    {
      title: "Stok Yönetimi",
      icon: Package,
      onClick: () => {
        navigate({ to: "/stocks" });
      },
    },
    {
      title: "Vardiya Kontrol",
      icon: Calendar,
      onClick: () => {
        navigate({ to: "/shifts" });
      },
    },
    {
      title: "İstatistikler",
      icon: BarChart3,
      onClick: () => {
        navigate({ to: "/statistics" });
      },
    },
    {
      title: "Masa Geçmişi",
      icon: History,
      onClick: () => {
        navigate({ to: "/table-history" });
      },
    },
    {
      title: "Kurye Yönetimi",
      icon: Bike,
      onClick: () => {
        navigate({ to: "/couriers" });
      },
    },
    {
      title: "Ayarlar",
      icon: Settings,
      onClick: () => {
        navigate({ to: "/settings" });
      },
    },
  ];

  return (
    <div className="h-[100dvh] w-full overflow-hidden relative">
      {/* Gradient Background - Projenin arka plan rengi */}
      <div
        className="absolute inset-0"
        style={{
          background: "#101828",
        }}
      />

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col">
        {/* Header - CRITICAL FIX: Sabit yükseklik ve responsive padding */}
        <header className="h-[80px] shrink-0 px-4 sm:px-6 flex items-center justify-between bg-black/20 backdrop-blur-sm">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <img
                src="/logo.png"
                alt="Logo"
                className="h-8 w-8 sm:h-10 sm:w-10 object-contain shrink-0"
              />
              <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white truncate">
                  Borgeto POS
                </h1>
                {companyData?.name && (
                  <span className="text-white/80 font-normal text-xs sm:text-sm truncate hidden sm:inline">
                    {companyData.name}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            {/* Branch Info - CRITICAL FIX: Daha kompakt */}
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-white/10 backdrop-blur-sm">
                <p className="text-xs sm:text-sm text-white font-medium truncate max-w-[100px] sm:max-w-none">
                  {userData?.branchName || branchData?.name || ""}
                </p>
              </div>
              {/* Masaüstüne Dön Butonu */}
              <button
                onClick={async () => {
                  if (window.electronAPI?.minimizeWindow) {
                    try {
                      await window.electronAPI.minimizeWindow();
                    } catch (error) {
                      console.error("Minimize error:", error);
                    }
                  }
                }}
                className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-lg hover:bg-white/10 transition-colors"
                title="Masaüstüne Dön"
              >
                <Minimize2 className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
              </button>
            </div>
          </div>
        </header>

        {/* Main Content - Ortada - Sabit boyut, scroll yok, tam ekranın ortasında */}
        <div className="flex-1 flex items-center justify-center min-h-0 overflow-hidden">
          <div className="flex flex-col items-center justify-center w-full h-full max-w-6xl px-2 sm:px-4 md:px-6">
            {/* Tüm içerik tek bir container içinde - ortalanmış */}
            <div className="flex flex-col items-center justify-center w-full gap-3 sm:gap-4 md:gap-6">
              {/* Üst kısım: Tarih/Saat ve Döviz Kurları - Responsive boyutlar */}
              <div className="flex items-center justify-between w-full gap-2 sm:gap-4 md:gap-6">
                {/* Date & Time - Sol taraf - Responsive font boyutları */}
                <div className="flex flex-col items-center justify-center flex-1 min-w-0">
                  <p className="text-white/90 text-xs sm:text-sm md:text-base lg:text-lg mb-0.5 sm:mb-1 md:mb-2">
                    {formatDate(currentTime)}
                  </p>
                  <p className="text-white text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold leading-tight">
                    {formatTime(currentTime)}
                  </p>
                </div>

                {/* Exchange Rates - Sağ taraf - Responsive boyutlar */}
                <div className="flex flex-col gap-0.5 sm:gap-1 md:gap-2 flex-1 items-center min-w-0 shrink-0">
                  <h3 className="text-white/80 text-[10px] sm:text-xs md:text-sm font-medium">
                    Döviz Kurları
                  </h3>
                  {exchangeRatesLoading ? (
                    <div className="flex items-center gap-1 sm:gap-2 text-white/60 text-[10px] sm:text-xs md:text-sm">
                      <div className="animate-spin rounded-full h-2 w-2 sm:h-3 sm:w-3 md:h-4 md:w-4 border-b-2 border-white"></div>
                      <span>Yükleniyor...</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-1 sm:gap-2 md:gap-3">
                        <div className="px-1.5 sm:px-2 md:px-3 py-1 sm:py-1.5 md:py-2 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20">
                          <div className="flex items-center gap-0.5 sm:gap-1 md:gap-2">
                            <span className="text-white/70 text-[9px] sm:text-[10px] md:text-xs font-medium">
                              USD
                            </span>
                            <span className="text-white text-xs sm:text-sm md:text-base lg:text-lg font-bold">
                              ₺{exchangeRates.USD.toFixed(2)}
                            </span>
                          </div>
                        </div>
                        <div className="px-1.5 sm:px-2 md:px-3 py-1 sm:py-1.5 md:py-2 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20">
                          <div className="flex items-center gap-0.5 sm:gap-1 md:gap-2">
                            <span className="text-white/70 text-[9px] sm:text-[10px] md:text-xs font-medium">
                              EUR
                            </span>
                            <span className="text-white text-xs sm:text-sm md:text-base lg:text-lg font-bold">
                              ₺{exchangeRates.EUR.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                      {exchangeRates.lastUpdated && (
                        <p className="text-white/50 text-[9px] sm:text-[10px] md:text-xs text-center">
                          Son güncelleme:{" "}
                          {exchangeRates.lastUpdated.toLocaleTimeString(
                            "tr-TR",
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Menu Grid - Responsive grid, butonlar arası boşluk */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 md:gap-4 w-full">
                {menuItems.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={index}
                      onClick={item.onClick}
                      className="group relative bg-white/10 backdrop-blur-sm rounded-lg sm:rounded-xl hover:bg-white/20 transition-all duration-200 border border-white/20 hover:border-white/40 hover:scale-105 flex flex-col items-center justify-center w-full aspect-square"
                    >
                      <div className="mb-1 sm:mb-1.5 md:mb-2 p-1.5 sm:p-2 md:p-2.5 lg:p-3 rounded-lg transition-all flex-shrink-0">
                        <Icon className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 lg:h-7 lg:w-7 xl:h-8 xl:w-8 text-white" />
                      </div>
                      <span className="text-white text-[9px] sm:text-[10px] md:text-xs lg:text-sm font-semibold text-center leading-tight px-0.5 sm:px-1 flex-shrink-0">
                        {item.title}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer - Sabit yükseklik, Oturumu Kapat ve Kapat butonları sağda */}
        <footer className="h-[60px] shrink-0 px-4 sm:px-6 py-2 sm:py-3 flex items-center justify-between bg-black/20 backdrop-blur-sm">
          <button
            onClick={() => navigate({ to: "/support" })}
            className="flex items-center gap-2 text-white/80 hover:text-white transition-colors"
          >
            <Phone className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="text-xs sm:text-sm">Müşteri Hizmetleri</span>
          </button>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 md:px-6 py-1.5 sm:py-2 md:py-3 rounded-lg bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-colors text-white text-[10px] sm:text-xs md:text-sm font-medium"
            >
              <LogOut className="h-3 w-3 sm:h-4 sm:w-4" />
              Oturumu Kapat
            </button>
            <button
              onClick={handleQuit}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 md:px-6 py-1.5 sm:py-2 md:py-3 rounded-lg bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-colors text-white text-[10px] sm:text-xs md:text-sm font-medium"
            >
              <X className="h-3 w-3 sm:h-4 sm:w-4" />
              Kapat
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
