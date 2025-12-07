// IP adresi alma fonksiyonu
export const getLocalIP = async (): Promise<string | null> => {
  try {
    // Electron ortamında
    if (window.electronAPI?.getLocalIP) {
      const result = await window.electronAPI.getLocalIP();
      return result?.ip || null;
    }

    // Web ortamında (RTCPeerConnection kullanarak)
    return new Promise((resolve) => {
      const RTCPeerConnection =
        (window as any).RTCPeerConnection ||
        (window as any).webkitRTCPeerConnection ||
        (window as any).mozRTCPeerConnection;

      if (!RTCPeerConnection) {
        resolve(null);
        return;
      }

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      pc.createDataChannel("");

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const candidate = event.candidate.candidate;
          const match = candidate.match(
            /([0-9]{1,3}(\.[0-9]{1,3}){3}|[a-f0-9]{1,4}(:[a-f0-9]{1,4}){7})/
          );
          if (match) {
            const ip = match[1];
            // Local IP'leri filtrele (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
            if (
              ip.startsWith("192.168.") ||
              ip.startsWith("10.") ||
              /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)
            ) {
              pc.close();
              resolve(ip);
            }
          }
        }
      };

      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .catch(() => {
          pc.close();
          resolve(null);
        });

      // Timeout after 3 seconds
      setTimeout(() => {
        pc.close();
        resolve(null);
      }, 3000);
    });
  } catch (error) {
    return null;
  }
};
