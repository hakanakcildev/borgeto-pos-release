import {
  createRootRoute,
  Outlet,
  useLocation,
  useRouter,
  useNavigate,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { NetworkStatus } from "@/components/NetworkStatus";
import TouchKeyboard from "@/components/ui/TouchKeyboard";
import { useTouchKeyboard } from "@/contexts/TouchKeyboardContext";
import { useAuth } from "@/contexts/AuthContext";

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

  // Touch event'lerini global olarak dinle (PC klavyesi vs touch ayırımı için)
  useEffect(() => {
    const handleTouchStart = () => {
      (window as any).__lastTouchEvent = true;
      // Touch event'ten sonra kısa bir süre sonra flag'i temizle
      setTimeout(() => {
        (window as any).__lastTouchEvent = false;
      }, 1000);
    };

    const handleMouseDown = () => {
      // Mouse event'i touch event değil
      (window as any).__lastTouchEvent = false;
    };

    const handleKeyDown = () => {
      // Keyboard event'i touch event değil
      (window as any).__lastTouchEvent = false;
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Sayfa değiştiğinde en üste kaydır
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // Route kontrolü - GEÇİCİ OLARAK DEVRE DIŞI (beyaz ekran sorununu çözmek için)
  // Router'ın kendi mekanizmasına tamamen güveniyoruz
  // useEffect(() => {
  //   // Auth yüklenene kadar bekle
  //   if (authLoading) {
  //     return;
  //   }

  //   // Router'ın hazır olmasını bekle - ama render'ı engelleme
  //   if (!router || !router.state) {
  //     return;
  //   }

  //   const isLoginPage =
  //     location.pathname === "/auth/login" || location.pathname === "/auth";

  //   // Sadece çok spesifik durumlarda yönlendirme yap:
  //   // 1. Authenticated kullanıcı login sayfasındaysa -> ana sayfaya
  //   // 2. Unauthenticated kullanıcı login sayfasında değilse -> login'e
  //   // Diğer tüm durumlarda router'ın kendi mekanizmasına güven

  //   if (isAuthenticated && isLoginPage) {
  //     // Authenticated kullanıcı login sayfasında - ana sayfaya yönlendir
  //     // Ama içeriğin render olması için biraz bekle
  //     const timer = setTimeout(() => {
  //       navigate({
  //         to: "/",
  //         search: { area: undefined, activeOnly: false },
  //         replace: true,
  //       });
  //     }, 300);
  //     return () => clearTimeout(timer);
  //   } else if (!isAuthenticated && !isLoginPage) {
  //     // Unauthenticated kullanıcı login sayfasında değil - login'e yönlendir
  //     // Ama içeriğin render olması için biraz bekle
  //     const timer = setTimeout(() => {
  //       navigate({ to: "/auth/login", replace: true });
  //     }, 300);
  //     return () => clearTimeout(timer);
  //   }
  //   // Diğer tüm durumlarda hiçbir şey yapma - router kendi işini yapsın
  // }, [authLoading, isAuthenticated, location.pathname, navigate, router]);

  // Debug log'ları ekle
  useEffect(() => {
    console.log("🔍 RootComponent render:", {
      pathname: location.pathname,
      authLoading,
      isAuthenticated,
      routerReady: !!router?.state,
      matchesCount: router?.state?.matches?.length || 0,
    });
  }, [location.pathname, authLoading, isAuthenticated, router]);

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
