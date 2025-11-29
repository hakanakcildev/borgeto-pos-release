import { createRootRoute, Outlet, useLocation, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { NetworkStatus } from "@/components/NetworkStatus";
import TouchKeyboard from "@/components/ui/TouchKeyboard";
import { useTouchKeyboard } from "@/contexts/TouchKeyboardContext";

function RootComponent() {
  const location = useLocation();
  const router = useRouter();
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

  // Başlangıçta "/" route'una yönlendir
  useEffect(() => {
    if (location.pathname === "" || location.pathname === "/") {
      // Router'ın route'u bulup bulmadığını kontrol et
      if (router.state.matches.length === 0) {
        router.navigate({ to: "/", search: { area: undefined, activeOnly: false }, replace: true });
      }
    }
  }, []);

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
