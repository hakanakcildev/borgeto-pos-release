import { useState, useEffect, useRef } from "react";

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);
  const wasOfflineRef = useRef(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Eğer önceden offline idiyse, reconnected durumunu tetikle
      if (wasOfflineRef.current) {
        setWasOffline(true);
        // 5 saniye sonra sıfırla (bildirim gösterildikten sonra)
        setTimeout(() => {
          setWasOffline(false);
          wasOfflineRef.current = false;
        }, 5000);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      wasOfflineRef.current = true;
      setWasOffline(false); // Reconnected bildirimi için hazırla
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return { isOnline, wasOffline };
}

