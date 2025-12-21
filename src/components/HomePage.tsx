import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import {
  Home,
  Bike,
  Package,
  User,
  BarChart3,
  Settings,
  Wifi,
  Server,
  Phone,
  Calendar,
  History,
  LogOut,
} from "lucide-react";
import { signOutUser } from "@/lib/firebase/auth";

interface ExchangeRates {
  USD: number;
  EUR: number;
  lastUpdated: Date | null;
}

export function HomePage() {
  const { userData, companyData, branchData } = useAuth();
  const { isOnline } = useNetworkStatus();
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [serverStatus, setServerStatus] = useState<
    "connected" | "disconnected"
  >("connected");
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

  // Sunucu durumunu kontrol et (basit bir kontrol)
  useEffect(() => {
    // Firebase bağlantısı varsa sunucu bağlı sayılır
    setServerStatus("connected");
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
        {/* Header */}
        <header className="h-[80px] shrink-0 px-6 flex items-center justify-between bg-black/20 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <img
                src="/images/borgeto-logo.png"
                alt="Logo"
                className="h-10 w-10 object-contain"
              />
              <div className="flex items-center gap-4">
                <h1 className="text-2xl font-bold text-white">Borgeto Pos</h1>
                {companyData?.name && (
                  <span className="text-white/80 font-normal text-sm">
                    {companyData.name}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Internet Status */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 backdrop-blur-sm">
              <Wifi
                className={`h-4 w-4 ${isOnline ? "text-green-400" : "text-red-400"}`}
              />
              <span className="text-sm text-white font-medium">
                {isOnline ? "Internet BAĞLI" : "Internet BAĞLI DEĞİL"}
              </span>
            </div>

            {/* Server Status */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 backdrop-blur-sm">
              <Server
                className={`h-4 w-4 ${serverStatus === "connected" ? "text-green-400" : "text-red-400"}`}
              />
              <span className="text-sm text-white font-medium">
                {serverStatus === "connected"
                  ? "Server BAĞLI"
                  : "Server BAĞLI DEĞİL"}
              </span>
            </div>

            {/* Branch Info */}
            <div className="flex items-center gap-3">
              <div className="px-3 py-1.5 rounded-lg bg-white/10 backdrop-blur-sm">
                <p className="text-sm text-white font-medium">
                  {userData?.branchName || branchData?.name || ""}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content - Ortada */}
        <div className="flex-1 flex items-center justify-center min-h-0">
          <div className="flex flex-col items-center justify-center w-full max-w-6xl px-6">
            {/* Tüm içerik tek bir container içinde */}
            <div className="flex flex-col items-center gap-8 w-full">
              {/* Üst kısım: Tarih/Saat ve Döviz Kurları */}
              <div className="flex items-center justify-between w-full gap-8">
                {/* Date & Time - Sol taraf */}
                <div className="flex flex-col items-center justify-center flex-1">
                  <p className="text-white/90 text-xl mb-3">
                    {formatDate(currentTime)}
                  </p>
                  <p className="text-white text-7xl font-bold">
                    {formatTime(currentTime)}
                  </p>
                </div>

                {/* Exchange Rates - Sağ taraf */}
                <div className="flex flex-col gap-3 flex-1 items-center">
                  <h3 className="text-white/80 text-sm font-medium mb-2">
                    Döviz Kurları
                  </h3>
                  {exchangeRatesLoading ? (
                    <div className="flex items-center gap-2 text-white/60 text-sm">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Yükleniyor...</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-4">
                        <div className="px-4 py-2 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20">
                          <div className="flex items-center gap-2">
                            <span className="text-white/70 text-xs font-medium">
                              USD
                            </span>
                            <span className="text-white text-lg font-bold">
                              ₺{exchangeRates.USD.toFixed(2)}
                            </span>
                          </div>
                        </div>
                        <div className="px-4 py-2 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20">
                          <div className="flex items-center gap-2">
                            <span className="text-white/70 text-xs font-medium">
                              EUR
                            </span>
                            <span className="text-white text-lg font-bold">
                              ₺{exchangeRates.EUR.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                      {exchangeRates.lastUpdated && (
                        <p className="text-white/50 text-xs text-center">
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

              {/* Menu Grid */}
              <div className="grid grid-cols-4 gap-6 w-full px-6 py-10">
                {menuItems.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={index}
                      onClick={item.onClick}
                      className="group relative bg-white/10 backdrop-blur-sm rounded-xl hover:bg-white/20 transition-all duration-200 border border-white/20 hover:border-white/40 hover:scale-105 flex flex-col items-center justify-center aspect-square"
                      style={{ minWidth: "160px", minHeight: "160px" }}
                    >
                      <div className="mb-3 p-5 rounded-lg transition-all">
                        <Icon className="h-10 w-10 text-white" />
                      </div>
                      <span className="text-white text-base font-semibold text-center leading-tight px-2">
                        {item.title}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Oturumu Kapat Butonu */}
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-6 py-3 rounded-lg bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-colors text-white text-sm font-medium"
              >
                <LogOut className="h-4 w-4" />
                Oturumu Kapat
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="flex-shrink-0 px-6 py-3 flex items-center justify-between bg-black/20 backdrop-blur-sm">
          <button
            onClick={() => navigate({ to: "/support" })}
            className="flex items-center gap-2 text-white/80 hover:text-white transition-colors"
          >
            <Phone className="h-4 w-4" />
            <span className="text-sm">Müşteri Hizmetleri</span>
          </button>
          <div className="flex items-center gap-4">
            <span className="text-white/70 text-sm">Borgeto Pos 1.1.102</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
