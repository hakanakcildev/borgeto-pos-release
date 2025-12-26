import { useEffect, useState, useRef } from "react";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { WifiOff, CheckCircle2 } from "lucide-react";

export function NetworkStatus() {
  const { isOnline, wasOffline } = useNetworkStatus();
  const [showReconnected, setShowReconnected] = useState(false);
  const [showDisconnected, setShowDisconnected] = useState(false);
  const previousOnlineStatusRef = useRef<boolean | null>(null);

  // Internet geri geldiğinde bildirim göster
  useEffect(() => {
    if (isOnline && wasOffline) {
      setShowReconnected(true);
      const timer = setTimeout(() => {
        setShowReconnected(false);
      }, 3000); // 3 saniye sonra otomatik kapanır

      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  // Internet kesildiğinde bildirim göster
  useEffect(() => {
    // İlk render'da previousOnlineStatusRef null olabilir, bu durumda bildirim gösterme
    if (previousOnlineStatusRef.current === null) {
      previousOnlineStatusRef.current = isOnline;
      return;
    }

    // Online'dan offline'a geçiş
    if (previousOnlineStatusRef.current === true && !isOnline) {
      setShowDisconnected(true);
      const timer = setTimeout(() => {
        setShowDisconnected(false);
      }, 3000); // 3 saniye sonra otomatik kapanır

      previousOnlineStatusRef.current = isOnline;
      return () => clearTimeout(timer);
    }

    // Durumu güncelle
    previousOnlineStatusRef.current = isOnline;
  }, [isOnline]);

  if (showDisconnected) {
    return (
      <div className="fixed top-4 right-4 z-50 bg-red-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in">
        <WifiOff className="h-5 w-5" />
        <span className="font-medium">İnternet bağlantısı kesildi</span>
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

