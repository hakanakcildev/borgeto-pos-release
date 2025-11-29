import { useEffect, useState } from "react";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { WifiOff, CheckCircle2 } from "lucide-react";

export function NetworkStatus() {
  const { isOnline, wasOffline } = useNetworkStatus();
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    if (isOnline && wasOffline) {
      setShowReconnected(true);
      const timer = setTimeout(() => {
        setShowReconnected(false);
      }, 5000); // 5 saniye sonra otomatik kapanır

      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  if (!isOnline) {
    return (
      <div className="fixed top-4 right-4 z-50 bg-red-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in">
        <WifiOff className="h-5 w-5" />
        <span className="font-medium">İnternet bağlantısı yok</span>
      </div>
    );
  }

  if (showReconnected) {
    return (
      <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in">
        <CheckCircle2 className="h-5 w-5" />
        <span className="font-medium">İnternet bağlantısı geri geldi</span>
      </div>
    );
  }

  return null;
}

