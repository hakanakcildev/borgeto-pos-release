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

  // AGRES İF ROUTE KONTROLÜ - Her durumda doğru sayfaya yönlendir
  useEffect(() => {
    // Auth yüklenene kadar bekle
    if (authLoading) {
      console.log("Auth loading, waiting...");
      return;
    }

    const isLoginPage = location.pathname === "/auth/login" || location.pathname === "/auth";
    const hasRouteMatch = router.state.matches.length > 0;

    console.log("🔍 Route control:", {
      pathname: location.pathname,
      isAuthenticated,
      authLoading,
      hasRouteMatch,
      matchesLength: router.state.matches.length,
    });

    // Eğer kullanıcı giriş yapmışsa
    if (isAuthenticated) {
      // Login sayfasındaysa ANINDA ana sayfaya yönlendir
      if (isLoginPage) {
        console.log("✅ Authenticated on login page → Redirecting to home");
        navigate({ to: "/", search: { area: undefined, activeOnly: false }, replace: true });
        return;
      }
      
      // Route match YOKSA ANINDA ana sayfaya yönlendir
      if (!hasRouteMatch) {
        console.log("⚠️ No route match for authenticated user → Redirecting to home");
        navigate({ to: "/", search: { area: undefined, activeOnly: false }, replace: true });
        return;
      }
      
      console.log("✅ Authenticated with valid route, all good!");
    } else {
      // Eğer kullanıcı giriş yapmamışsa
      // Login sayfasında değilse ANINDA login'e yönlendir
      if (!isLoginPage) {
        console.log("❌ Not authenticated, not on login page → Redirecting to login");
        navigate({ to: "/auth/login", replace: true });
        return;
      }
      
      console.log("✅ Not authenticated on login page, all good!");
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
