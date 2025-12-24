import { Outlet, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  Download,
  CheckCircle,
  ArrowLeft,
  X,
  Wifi,
  Server,
} from "lucide-react";
import { useState, useCallback, useEffect } from "react";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";

interface POSLayoutProps {
  children?: React.ReactNode;
  backTo?: {
    path: string;
    search?: Record<string, unknown>;
  };
  headerTitle?: string;
}

export function POSLayout({ children, backTo, headerTitle }: POSLayoutProps) {
  const navigate = useNavigate();
  const { userData, companyData, branchData } = useAuth();
  const { isOnline } = useNetworkStatus();
  const [serverStatus, setServerStatus] = useState<
    "connected" | "disconnected"
  >("connected");

  // Güncelleme state'leri
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateVersion, setUpdateVersion] = useState<string>("");
  const [downloadingUpdate, setDownloadingUpdate] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [updateDownloaded, setUpdateDownloaded] = useState(false);
  const [showUpdateNotification, setShowUpdateNotification] = useState(false);

  // Kullanıcı giriş yaptığında otomatik indirme etkinleştirilmeyecek
  // Sadece kullanıcı "İndir ve Kur" butonuna bastığında indirme başlayacak
  // useEffect(() => {
  //   if (userData && window.electronAPI?.enableAutoDownload) {
  //     window.electronAPI.enableAutoDownload().catch(() => {});
  //   }
  // }, [userData]);

  // Sunucu durumunu kontrol et
  useEffect(() => {
    setServerStatus("connected");
  }, []);

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

    const handleUpdateChecking = () => {};

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
      } catch (error) {}
    }
  }, []);

  return (
    <ProtectedRoute requireAuth={true} requireCompanyAccess={true}>
      <div className="h-[100dvh] flex w-full bg-gray-50 dark:bg-gray-900 overflow-hidden">
        {/* Main Content */}
        <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {/* Header - Anasayfadaki gibi 80px yükseklik */}
          <header className="h-[80px] shrink-0 px-6 flex items-center justify-between bg-black/20 backdrop-blur-sm">
            <div className="flex items-center gap-4">
              {/* Geri Butonu */}
              <button
                onClick={() => {
                  if (backTo) {
                    navigate({
                      to: backTo.path,
                      search: backTo.search,
                    });
                  } else {
                    navigate({
                      to: "/",
                      search: { area: undefined, activeOnly: false },
                    });
                  }
                }}
                className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-white/10 transition-colors"
                title={backTo ? "Masalara Dön" : "Anasayfaya Dön"}
              >
                <ArrowLeft className="h-5 w-5 text-white" />
              </button>

              <div className="flex items-center gap-3">
                <img
                  src="/images/borgeto-logo.png"
                  alt="Logo"
                  className="h-10 w-10 object-contain"
                />
                <div className="flex items-center gap-4">
                  <h1 className="text-2xl font-bold text-white">Borgeto Pos</h1>
                  {headerTitle ? (
                    <span className="text-white/80 font-normal text-sm">
                      {headerTitle}
                    </span>
                  ) : (
                    companyData?.name && (
                      <span className="text-white/80 font-normal text-sm">
                        {companyData.name}
                      </span>
                    )
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
          <div className="flex-1 overflow-hidden h-full">
            {children || <Outlet />}
          </div>
        </main>

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
                  Versiyon {updateVersion} indirildi. Güncellemeyi kurmak ve
                  uygulamayı yeniden başlatmak ister misiniz?
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
                        Versiyon {updateVersion} indirildi. Kurmak için
                        tıklayın.
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
