import { createRootRoute, Outlet, useLocation, useRouter, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { NetworkStatus } from "@/components/NetworkStatus";
import TouchKeyboard from "@/components/ui/TouchKeyboard";
import { useTouchKeyboard } from "@/contexts/TouchKeyboardContext";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

function RootComponent() {
  const location = useLocation();
  const router = useRouter();
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const {
    isOpen,
    closeKeyboard,
    handleInput,
    handleBackspace,
    keyboardType,
    currentValue,
    maxLength,
  } = useTouchKeyboard();
  const [isDownloadingUpdate, setIsDownloadingUpdate] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  // Sayfa değiştiğinde en üste kaydır
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // Uygulama açıldığında otomatik versiyon kontrolü
  useEffect(() => {
    if (!window.electronAPI) return;

    // Update event listener'ları
    const handleUpdateAvailable = (version: string) => {
      setIsDownloadingUpdate(true);
      setDownloadProgress(0);
      console.log("Yeni güncelleme mevcut:", version);
    };

    const handleUpdateNotAvailable = () => {
      // Güncel versiyonsa hiçbir uyarı gösterme
      setIsDownloadingUpdate(false);
      console.log("Güncel versiyon kullanılıyor");
    };

    const handleUpdateDownloaded = (version: string) => {
      setIsDownloadingUpdate(false);
      setDownloadProgress(100);
      console.log("Güncelleme indirildi:", version);
      // Kısa bir süre sonra güncellemeyi kur ve uygulamayı yeniden başlat
      // quitAndInstall kullanarak güvenli bir şekilde güncelleme yapılır
      setTimeout(() => {
        if (window.electronAPI?.quitAndInstall) {
          window.electronAPI.quitAndInstall();
        } else if (window.electronAPI?.quitApp) {
          // Fallback: Eğer quitAndInstall yoksa normal çıkış yap
          window.electronAPI.quitApp();
        }
      }, 2000);
    };

    const handleDownloadProgress = (progress: { percent: number }) => {
      setDownloadProgress(progress.percent);
    };

    const handleUpdateError = (error: string) => {
      setIsDownloadingUpdate(false);
      console.error("Güncelleme hatası:", error);
    };

    // Event listener'ları kaydet
    if (window.electronAPI.onUpdateAvailable) {
      window.electronAPI.onUpdateAvailable(handleUpdateAvailable);
    }
    if (window.electronAPI.onUpdateNotAvailable) {
      window.electronAPI.onUpdateNotAvailable(handleUpdateNotAvailable);
    }
    if (window.electronAPI.onUpdateDownloaded) {
      window.electronAPI.onUpdateDownloaded(handleUpdateDownloaded);
    }
    if (window.electronAPI.onDownloadProgress) {
      window.electronAPI.onDownloadProgress(handleDownloadProgress);
    }
    if (window.electronAPI.onUpdateError) {
      window.electronAPI.onUpdateError(handleUpdateError);
    }

    // Uygulama açıldığında otomatik versiyon kontrolü yap
    const checkUpdates = async () => {
      try {
        if (window.electronAPI?.checkForUpdates) {
          await window.electronAPI.checkForUpdates();
        }
      } catch (error) {
        console.error("Versiyon kontrolü hatası:", error);
      }
    };

    // Auth yüklendikten sonra versiyon kontrolü yap
    if (!authLoading) {
      // Kısa bir gecikme ile versiyon kontrolü yap (uygulamanın tamamen yüklenmesi için)
      const timeoutId = setTimeout(() => {
        checkUpdates();
      }, 1000);

      return () => {
        clearTimeout(timeoutId);
      };
    }
  }, [authLoading]);

  // Başlangıçta route kontrolü yap - ilk açılışta authenticated değilse login'e yönlendir
  useEffect(() => {
    // Auth yüklenene kadar bekle
    if (authLoading) return;

    const isLoginPage = location.pathname === "/auth/login" || location.pathname === "/auth";
    const isNotFound = router.state.matches.length === 0;

    // Eğer kullanıcı giriş yapmamışsa
    if (!isAuthenticated) {
      // Login sayfasında değilse login'e yönlendir
      if (!isLoginPage) {
        navigate({ to: "/auth/login", replace: true });
        return;
      }
    } else {
      // Eğer kullanıcı giriş yapmışsa ve login sayfasındaysa ana sayfaya yönlendir
      if (isLoginPage) {
        navigate({ to: "/", search: { area: undefined, activeOnly: false }, replace: true });
        return;
      }
    }

    // 404 durumunda authenticated değilse login'e yönlendir
    if (isNotFound && !isAuthenticated) {
      navigate({ to: "/auth/login", replace: true });
    }
  }, [router.state.matches.length, authLoading, isAuthenticated, navigate, location.pathname]);

  // Güncelleme indiriliyorsa loading ekranı göster
  if (isDownloadingUpdate) {
    return (
      <div className="fixed inset-0 z-[9999] bg-white dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-16 w-16 text-blue-600 dark:text-blue-400 animate-spin mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Güncelleme İndiriliyor
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Yeni versiyon indiriliyor, lütfen bekleyin...
          </p>
          <div className="w-64 bg-gray-200 dark:bg-gray-700 rounded-full h-2 mx-auto">
            <div
              className="bg-blue-600 dark:bg-blue-400 h-2 rounded-full transition-all duration-300"
              style={{ width: `${downloadProgress}%` }}
            />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
            {Math.round(downloadProgress)}%
          </p>
        </div>
      </div>
    );
  }

  // Versiyon kontrolü arka planda yapılır, loading ekranı göstermiyoruz
  // Sadece güncelleme indirilirken loading ekranı gösterilir

  return (
    <>
      <NetworkStatus />
      <Outlet />
      <TouchKeyboard
        isOpen={isOpen}
        onClose={closeKeyboard}
        onInput={handleInput}
        onBackspace={handleBackspace}
        type={keyboardType}
        value={currentValue}
        maxLength={maxLength}
      />
    </>
  );
}

export const Route = createRootRoute({
  component: RootComponent,
});
