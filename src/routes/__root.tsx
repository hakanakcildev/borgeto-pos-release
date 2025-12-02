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

  // Sayfa değiştiğinde en üste kaydır
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // Uygulama açıldığında otomatik versiyon kontrolü - KALDIRILDI
  // Artık otomatik güncelleme kontrolü yapılmıyor
  // Kullanıcı login sayfasından manuel olarak kontrol edebilir

  // Başlangıçta route kontrolü yap - ilk açılışta authenticated değilse login'e yönlendir
  useEffect(() => {
    // Auth yüklenene kadar bekle
    if (authLoading) return;

    const isLoginPage = location.pathname === "/auth/login" || location.pathname === "/auth";

    console.log("Route control:", {
      pathname: location.pathname,
      isAuthenticated,
      authLoading,
      matchesLength: router.state.matches.length
    });

    // Eğer kullanıcı giriş yapmışsa
    if (isAuthenticated) {
      // Login sayfasındaysa ana sayfaya yönlendir
      if (isLoginPage) {
        console.log("Authenticated user on login page, redirecting to home");
        navigate({ to: "/", search: { area: undefined, activeOnly: false }, replace: true });
        return;
      }
      
      // Route match yoksa direkt ana sayfaya yönlendir (gecikme yok)
      if (router.state.matches.length === 0) {
        console.log("No route match found, redirecting to home immediately");
        navigate({ to: "/", search: { area: undefined, activeOnly: false }, replace: true });
        return;
      }
    } else {
      // Eğer kullanıcı giriş yapmamışsa
      // Login sayfasında değilse login'e yönlendir
      if (!isLoginPage) {
        console.log("Not authenticated, redirecting to login");
        navigate({ to: "/auth/login", replace: true });
        return;
      }
    }
  }, [router.state.matches.length, authLoading, isAuthenticated, navigate, location.pathname]);


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
