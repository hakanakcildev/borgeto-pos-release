import { createRootRoute, Outlet, useLocation, useRouter, useNavigate } from "@tanstack/react-router";
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

  // AGRES İF ROUTE KONTROLÜ - Her durumda doğru sayfaya yönlendir
  useEffect(() => {
    // Auth yüklenene kadar bekle
    if (authLoading) {
      return;
    }

    const isLoginPage = location.pathname === "/auth/login" || location.pathname === "/auth";
    const hasRouteMatch = router.state.matches.length > 0;


    // Eğer kullanıcı giriş yapmışsa
    if (isAuthenticated) {
      // Login sayfasındaysa ANINDA ana sayfaya yönlendir
      if (isLoginPage) {
        navigate({ to: "/", search: { area: undefined, activeOnly: false }, replace: true });
        return;
      }
      
      // Route match YOKSA ANINDA ana sayfaya yönlendir
      if (!hasRouteMatch) {
        navigate({ to: "/", search: { area: undefined, activeOnly: false }, replace: true });
        return;
      }
      
    } else {
      // Eğer kullanıcı giriş yapmamışsa
      // Login sayfasında değilse ANINDA login'e yönlendir
      if (!isLoginPage) {
        navigate({ to: "/auth/login", replace: true });
        return;
      }
      
    }
  }, [authLoading, isAuthenticated, location.pathname, router.state.matches.length, navigate]);

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
