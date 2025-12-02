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

  // Başlangıçta route kontrolü yap - 404 sayfası gösteriliyorsa veya kullanıcı giriş yapmamışsa login'e yönlendir
  useEffect(() => {
    // Auth yüklenene kadar bekle
    if (authLoading) return;

    // Eğer route bulunamadıysa (404) veya kullanıcı giriş yapmamışsa ve korumalı bir route'daysa login'e yönlendir
    const isProtectedRoute = location.pathname !== "/auth/login" && location.pathname !== "/auth";
    const isNotFound = router.state.matches.length === 0;
    
    if (isNotFound || (isProtectedRoute && !isAuthenticated)) {
      navigate({ to: "/auth/login", replace: true });
      return;
    }

    // Eğer kullanıcı giriş yapmışsa ve login sayfasındaysa ana sayfaya yönlendir
    if (isAuthenticated && location.pathname === "/auth/login") {
      navigate({ to: "/", search: { area: undefined, activeOnly: false }, replace: true });
    }
  }, [router.state.matches.length, authLoading, isAuthenticated, navigate, location.pathname]);

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
