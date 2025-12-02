import { createRootRoute, Outlet, useLocation, useRouter, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { NetworkStatus } from "@/components/NetworkStatus";
import TouchKeyboard from "@/components/ui/TouchKeyboard";
import { useTouchKeyboard } from "@/contexts/TouchKeyboardContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

function RootComponent() {
  const location = useLocation();
  const router = useRouter();
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const routerState = useRouterState();
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
    const isRootPath = location.pathname === "/";

    console.log("Route control:", {
      pathname: location.pathname,
      isAuthenticated,
      authLoading,
      matchesLength: router.state.matches.length,
      isRootPath
    });

    // Eğer kullanıcı giriş yapmışsa
    if (isAuthenticated) {
      // Login sayfasındaysa ana sayfaya yönlendir
      if (isLoginPage) {
        console.log("Authenticated user on login page, redirecting to home");
        navigate({ to: "/", search: { area: undefined, activeOnly: false }, replace: true });
        return;
      }
      
      // Root path dışında bir yerdeyse ve route match yoksa ana sayfaya yönlendir
      if (!isRootPath && router.state.matches.length === 0) {
        console.log("No route match found (not root), redirecting to home immediately");
        navigate({ to: "/", search: { area: undefined, activeOnly: false }, replace: true });
        return;
      }
      
      // Root path'teyse ve route match yoksa, route'ların yüklenmesini bekle
      if (isRootPath && router.state.matches.length === 0) {
        console.log("Root path with no match, waiting for routes to load");
        // Kısa bir gecikme sonra hala match yoksa yönlendir
        const timeoutId = setTimeout(() => {
          if (router.state.matches.length === 0) {
            console.log("Still no route match after delay, redirecting to home");
            navigate({ to: "/", search: { area: undefined, activeOnly: false }, replace: true });
          }
        }, 200);
        return () => clearTimeout(timeoutId);
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

  // NotFound durumunu kontrol et
  const isNotFound = routerState.matches.length === 0 && !authLoading;

  // NotFound durumunda kullanıcı dostu sayfa göster
  if (isNotFound && isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4 py-8">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="mb-6">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-12 h-12 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Verileri Eşitle
            </h1>
            <p className="text-gray-600">
              Sayfa bulunamadı. Ana sayfaya dönmek için butona basın.
            </p>
          </div>
          <Button
            onClick={() => {
              navigate({ to: "/", search: { area: undefined, activeOnly: false }, replace: true });
            }}
            className="w-full h-12 text-base font-medium bg-blue-600 hover:bg-blue-700"
          >
            Masalar Sayfasına Git
          </Button>
        </div>
      </div>
    );
  }

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
