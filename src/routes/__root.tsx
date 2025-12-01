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

  // Başlangıçta route kontrolü yap - 404 sayfası gösteriliyorsa doğru route'a yönlendir
  useEffect(() => {
    // Router'ın route'u bulup bulmadığını kontrol et
    if (!authLoading && router.state.matches.length === 0) {
      // Eğer route bulunamadıysa ve kullanıcı giriş yapmamışsa login'e yönlendir
      if (!isAuthenticated) {
        navigate({ to: "/auth/login", replace: true });
      } else {
        // Kullanıcı giriş yapmışsa ana sayfaya yönlendir
        navigate({ to: "/", search: { area: undefined, activeOnly: false }, replace: true });
      }
    }
  }, [router.state.matches.length, authLoading, isAuthenticated, navigate]);

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
