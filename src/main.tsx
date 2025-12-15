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

// Create a new router instance
const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  notFoundMode: "root",
});

// Register the router instance for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// Electron'da ilk yükleme sonrası route kontrolü
if (typeof window !== "undefined") {
  window.addEventListener("DOMContentLoaded", () => {
    // Kısa bir gecikme ile router state'ini kontrol et
    setTimeout(() => {
      const posAuthStr = localStorage.getItem("posAuth");
      const isAuthenticated = !!posAuthStr;

      // Eğer authenticated ise ve pathname "/" değilse veya file:// protokolü kullanılıyorsa
      if (
        isAuthenticated &&
        (window.location.pathname !== "/" ||
          window.location.protocol === "file:")
      ) {
        // History API ile "/" path'ine yönlendir
        window.history.replaceState(null, "", "/");
        // Router'ı manuel olarak navigate et
        router.navigate({
          to: "/",
          search: { area: undefined, activeOnly: false },
          replace: true,
        });
      } else if (
        !isAuthenticated &&
        window.location.pathname !== "/auth/login"
      ) {
        window.history.replaceState(null, "", "/auth/login");
        router.navigate({ to: "/auth/login", replace: true });
      }
    }, 100);
  });
}

// Render the app
const rootElement = document.getElementById("root")!;
if (!rootElement.innerHTML) {
  try {
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
  } catch (error) {
    console.error("Render hatası:", error);
    rootElement.innerHTML = `
      <div style="padding: 20px; text-align: center; color: red;">
        <h1>Render Hatası</h1>
        <p>${error instanceof Error ? error.message : "Bilinmeyen hata"}</p>
        <button onclick="window.location.reload()">Yeniden Yükle</button>
      </div>
    `;
  }
}
