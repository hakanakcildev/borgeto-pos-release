import React, { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import "./index.css";

// Import the generated route tree
import { routeTree } from "./routeTree.gen";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { TouchKeyboardProvider } from "./contexts/TouchKeyboardContext";
import { AlertDialogProvider } from "./components/AlertDialogProvider";
import { NetworkStatus } from "./components/NetworkStatus";

// Error Boundary Component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    console.error("ErrorBoundary caught error:", error);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Error caught by boundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "20px", textAlign: "center", color: "red" }}>
          <h1>Bir hata oluştu</h1>
          <p>{this.state.error?.message || "Bilinmeyen hata"}</p>
          <pre style={{ textAlign: "left", overflow: "auto" }}>
            {this.state.error?.stack}
          </pre>
          <button onClick={() => window.location.reload()}>
            Yeniden Yükle
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// CRITICAL FIX: file:// protocol ile çalışırken window.location.pathname file system path döndürüyor
// Bu yüzden router'ın initial location'ını manuel olarak ayarlamalıyız
const getInitialLocation = () => {
  // Electron file:// protocol'ünde window.location.pathname tam dosya yolunu döndürür
  // Bu yüzden hash-based routing kullanmalıyız veya initial location'ı manuel ayarlamalıyız
  if (window.location.protocol === "file:") {
    // file:// protocol'ünde hash'ten route'u al
    const hash = window.location.hash;
    if (hash && hash.startsWith("#")) {
      return hash.substring(1) || "/";
    }
    // Hash yoksa, localStorage'dan son route'u al veya "/" kullan
    const lastRoute = localStorage.getItem("lastRoute");
    return lastRoute || "/";
  }
  // Normal web ortamında window.location.pathname kullan
  return window.location.pathname || "/";
};

// Create a new router instance
const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  notFoundMode: "root",
  // CRITICAL FIX: file:// protocol ile çalışırken base path root olmalı
  basepath: "/",
  // Router'ın her durumda çalışmasını sağla
  defaultErrorComponent: () => (
    <div style={{ padding: "20px", textAlign: "center" }}>
      <h1>Sayfa bulunamadı</h1>
      <button onClick={() => (window.location.href = "/")}>
        Ana Sayfaya Dön
      </button>
    </div>
  ),
});

// Register the router instance for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// Electron'da ilk yükleme sonrası route kontrolü - KALDIRILDI
// Route kontrolü artık __root.tsx'de yapılıyor, burada agresif kontrol gerekmiyor
// Çünkü bu kontrol React render edilmeden önce çalışıyor ve beyaz sayfaya neden olabiliyor
// __root.tsx'deki route kontrolü daha güvenli ve React render edildikten sonra çalışıyor

// Render the app
const rootElement = document.getElementById("root");
if (!rootElement) {
  console.error("❌ Root element bulunamadı!");
  document.body.innerHTML = `
    <div style="padding: 20px; text-align: center; color: red; background: white; min-height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center;">
      <h1 style="font-size: 24px; margin-bottom: 16px;">Kritik Hata</h1>
      <p style="margin-bottom: 16px;">Root element (#root) bulunamadı!</p>
      <button onclick="window.location.reload()" style="padding: 10px 20px; font-size: 16px; cursor: pointer; background: #2563eb; color: white; border: none; border-radius: 4px;">
        Yeniden Yükle
      </button>
    </div>
  `;
} else {
  // Root element boşsa veya sadece whitespace içeriyorsa render et
  const shouldRender =
    !rootElement.innerHTML || rootElement.innerHTML.trim() === "";

  if (shouldRender) {
    try {
      console.log("🚀 React uygulaması render ediliyor...");
      console.log("🔍 Environment:", {
        NODE_ENV: import.meta.env.MODE,
        PROD: import.meta.env.PROD,
        DEV: import.meta.env.DEV,
        BASE_URL: import.meta.env.BASE_URL,
        location: window.location.href,
        protocol: window.location.protocol,
      });
      console.log("🔍 Router state:", {
        hasRouter: !!router,
        hasState: !!router?.state,
        status: router?.state?.status,
      });

      // CRITICAL: Script'lerin yüklenip yüklenmediğini kontrol et
      console.log("🔍 Scripts check:", {
        scriptsCount: document.scripts.length,
        scripts: Array.from(document.scripts).map((s) => ({
          src: s.src || "inline",
          type: s.type,
          async: s.async,
          defer: s.defer,
        })),
      });

      const root = ReactDOM.createRoot(rootElement);
      root.render(
        <StrictMode>
          <ErrorBoundary>
            <ThemeProvider>
              <AuthProvider>
                <AlertDialogProvider>
                  <TouchKeyboardProvider>
                    <NetworkStatus />
                    <RouterProvider router={router} />
                  </TouchKeyboardProvider>
                </AlertDialogProvider>
              </AuthProvider>
            </ThemeProvider>
          </ErrorBoundary>
        </StrictMode>
      );
      console.log("✅ React uygulaması render edildi");

      // CRITICAL FIX: Router'ın initial location'ını manuel olarak ayarla
      // file:// protocol'ünde window.location.pathname file system path döndürüyor
      const initialPath = getInitialLocation();
      console.log("🔍 Initial path:", initialPath);
      console.log("🔍 Window location:", {
        href: window.location.href,
        pathname: window.location.pathname,
        protocol: window.location.protocol,
        hash: window.location.hash,
      });

      // Router'ın initialize olduğunu kontrol et ve initial route'u ayarla
      setTimeout(() => {
        if (router && router.state) {
          const currentPathname = router.state.location.pathname;
          console.log("✅ Router initialized:", {
            status: router.state.status,
            location: router.state.location,
            matches: router.state.matches.length,
            pathname: currentPathname,
          });

          // CRITICAL FIX: Eğer pathname file system path gibi görünüyorsa veya route bulunamadıysa
          const isFileSystemPath =
            currentPathname.includes(":\\") ||
            currentPathname.includes("/Users/") ||
            currentPathname.includes("index.html");

          if (isFileSystemPath || router.state.matches.length === 0) {
            console.warn(
              "⚠️ Router pathname file system path veya route bulunamadı, initial navigation yapılıyor...",
              {
                currentPathname,
                isFileSystemPath,
                matchesCount: router.state.matches.length,
              }
            );

            // Auth durumuna göre route belirle
            const targetRoute = "/";

            // Router'ın navigate metodunu kullan - search parametreleri gerekli
            router
              .navigate({
                to: targetRoute,
                search: { area: undefined, activeOnly: false },
                replace: true,
              })
              .then(() => {
                console.log("✅ Initial navigation başarılı:", targetRoute);
                // Son route'u kaydet
                localStorage.setItem("lastRoute", targetRoute);
              })
              .catch((err) => {
                console.error("❌ Initial navigation hatası:", err);
              });
          } else {
            // Route bulundu, son route'u kaydet
            localStorage.setItem("lastRoute", currentPathname);
          }
        } else {
          console.error("❌ Router initialize olmadı!");
        }
      }, 100);

      // Ekstra güvenlik: DOMContentLoaded'da da kontrol et
      const checkAndFixRoute = () => {
        if (router && router.state) {
          const currentPath = router.state.location.pathname;
          const isFileSystemPath =
            currentPath.includes(":\\") ||
            currentPath.includes("/Users/") ||
            currentPath.includes("index.html");

          console.log("🔍 Route check:", {
            currentPath,
            isFileSystemPath,
            matchesCount: router.state.matches.length,
          });

          // Eğer pathname file system path gibi görünüyorsa veya route bulunamadıysa
          if (isFileSystemPath || router.state.matches.length === 0) {
            console.log("🔄 Initial route'a yönlendiriliyor...");
            router
              .navigate({
                to: "/",
                replace: true,
                search: { area: undefined, activeOnly: false },
              })
              .then(() => {
                console.log("✅ Route düzeltildi");
                localStorage.setItem("lastRoute", "/");
              })
              .catch((err) => {
                console.error("❌ Navigation hatası:", err);
              });
          }
        }
      };

      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
          setTimeout(checkAndFixRoute, 200);
        });
      } else {
        // DOM zaten yüklü
        setTimeout(checkAndFixRoute, 200);
      }

      // Production'da render kontrolü - 3 saniye sonra içerik yoksa hata göster
      // Electron'da process.env.NODE_ENV her zaman "production" olabilir, bu yüzden import.meta.env kullan
      const isProduction = import.meta.env.PROD || !import.meta.env.DEV;
      if (isProduction) {
        setTimeout(() => {
          const checkElement = document.getElementById("root");
          // Root element var ama içerik yoksa veya sadece React root container varsa
          if (checkElement) {
            const hasContent =
              checkElement.children.length > 0 ||
              (checkElement.innerHTML &&
                checkElement.innerHTML.trim() !== "" &&
                !checkElement.innerHTML.includes("data-reactroot"));
            if (!hasContent) {
              console.error("❌ React render edildi ama içerik görünmüyor!");
              // Sadece log'la, kullanıcıya hata gösterme (çünkü bu false positive olabilir)
              // Ama eğer gerçekten içerik yoksa, 5 saniye sonra tekrar kontrol et
              setTimeout(() => {
                const recheckElement = document.getElementById("root");
                if (recheckElement) {
                  const stillNoContent =
                    recheckElement.children.length === 0 ||
                    !recheckElement.innerHTML ||
                    recheckElement.innerHTML.trim() === "";
                  if (stillNoContent) {
                    recheckElement.innerHTML = `
                      <div style="padding: 20px; text-align: center; color: #dc2626; background: white; min-height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center;">
                        <h1 style="font-size: 24px; margin-bottom: 16px;">Render Sorunu</h1>
                        <p style="margin-bottom: 16px;">React render edildi ama içerik görünmüyor.</p>
                        <p style="margin-bottom: 16px; font-size: 14px; color: #666;">Lütfen Ctrl+Shift+I ile DevTools'u açıp console'u kontrol edin.</p>
                        <button onclick="window.location.reload()" style="padding: 10px 20px; font-size: 16px; cursor: pointer; background: #2563eb; color: white; border: none; border-radius: 4px; margin-top: 8px;">
                          Yeniden Yükle
                        </button>
                      </div>
                    `;
                  }
                }
              }, 5000);
            }
          }
        }, 3000);
      }
    } catch (error) {
      console.error("❌ Render hatası:", error);
      rootElement.innerHTML = `
        <div style="padding: 20px; text-align: center; color: red; background: white; min-height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center;">
          <h1 style="font-size: 24px; margin-bottom: 16px;">Render Hatası</h1>
          <p style="margin-bottom: 16px;">${error instanceof Error ? error.message : "Bilinmeyen hata"}</p>
          <pre style="text-align: left; overflow: auto; max-height: 400px; background: #f5f5f5; padding: 10px; border-radius: 4px; max-width: 90%;">
${error instanceof Error ? error.stack : String(error)}
          </pre>
          <button onclick="window.location.reload()" style="margin-top: 20px; padding: 10px 20px; font-size: 16px; cursor: pointer; background: #2563eb; color: white; border: none; border-radius: 4px;">
            Yeniden Yükle
          </button>
        </div>
      `;
    }
  } else {
    console.warn("⚠️ Root element zaten içerik içeriyor, render atlandı");
  }
}
