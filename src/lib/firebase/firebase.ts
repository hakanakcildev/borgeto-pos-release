import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

// Firebase configuration - QR Menü sistemi ile aynı
const firebaseConfig = {
  apiKey:
    import.meta.env.VITE_apiKey ||
    import.meta.env.VITE_APP_API_KEY ||
    "demo-api-key",
  authDomain:
    import.meta.env.VITE_authDomain ||
    import.meta.env.VITE_APP_AUTH_DOMAIN ||
    "demo-project.firebaseapp.com",
  projectId:
    import.meta.env.VITE_projectID ||
    import.meta.env.VITE_APP_PROJECT_ID ||
    "demo-project",
  storageBucket:
    import.meta.env.VITE_storageBucket ||
    import.meta.env.VITE_APP_STORAGE_BUCKET ||
    "demo-project.appspot.com",
  messagingSenderId:
    import.meta.env.VITE_messagingSenderID ||
    import.meta.env.VITE_APP_MESSAGING_SENDER_ID ||
    "123456789",
  appId:
    import.meta.env.VITE_appID ||
    import.meta.env.VITE_APP_APP_ID ||
    "1:123456789:web:demo",
  measurementId:
    import.meta.env.VITE_measurementId ||
    import.meta.env.VITE_APP_MEASUREMENT_ID ||
    "G-DEMO",
};

// Yeni veya eski değişken isimlerinden en az birinin olması gerekiyor
const hasApiKey =
  import.meta.env.VITE_apiKey || import.meta.env.VITE_APP_API_KEY;
const hasAuthDomain =
  import.meta.env.VITE_authDomain || import.meta.env.VITE_APP_AUTH_DOMAIN;
const hasProjectId =
  import.meta.env.VITE_projectID || import.meta.env.VITE_APP_PROJECT_ID;
const hasStorageBucket =
  import.meta.env.VITE_storageBucket || import.meta.env.VITE_APP_STORAGE_BUCKET;

if (!hasApiKey || !hasAuthDomain || !hasProjectId || !hasStorageBucket) {
  // Firebase konfigürasyon hatası - eksik environment variables
  console.warn(
    "Firebase yapılandırması eksik. Lütfen .env dosyasını kontrol edin."
  );
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);

// Development mode için emulator bağlantıları
if (import.meta.env.DEV) {
  if (import.meta.env.VITE_USE_FIREBASE_EMULATOR === "true") {
    // Connect to Firestore emulator
    import("firebase/firestore").then(({ connectFirestoreEmulator }) => {
      try {
        connectFirestoreEmulator(db, "localhost", 8080);
      } catch (error) {
        // Firestore emulator already connected
      }
    });

    // Connect to Auth emulator
    import("firebase/auth").then(({ connectAuthEmulator }) => {
      try {
        connectAuthEmulator(auth, "http://localhost:9099");
      } catch (error) {
        // Auth emulator already connected
      }
    });

    // Connect to Storage emulator
    import("firebase/storage").then(({ connectStorageEmulator }) => {
      try {
        connectStorageEmulator(storage, "localhost", 9199);
      } catch (error) {
        // Storage emulator already connected
      }
    });
  }
}

export default app;
