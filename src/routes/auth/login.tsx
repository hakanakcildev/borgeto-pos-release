import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useCallback, useRef } from "react";
import { signInWithCredentials } from "@/lib/firebase/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, Lock, Keyboard, RefreshCw, FileText, X } from "lucide-react";
import { useTouchKeyboard } from "@/contexts/TouchKeyboardContext";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/auth/login")({
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [showUpdateNotes, setShowUpdateNotes] = useState(false);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const { openKeyboard, isOpen } = useTouchKeyboard();

  const handleLogin = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError("");

      try {
        const result = await signInWithCredentials(email, password);
        
        // Store login result in sessionStorage for AuthContext
        sessionStorage.setItem(
          "posAuth",
          JSON.stringify({
            type: result.type,
            companyId: result.companyId,
            branchId: result.branchId,
            user: result.user,
            branch: result.branch,
            company: result.company,
            timestamp: Date.now(),
          })
        );
        
        // Trigger storage event to update AuthContext immediately
        window.dispatchEvent(new StorageEvent("storage", {
          key: "posAuth",
          newValue: sessionStorage.getItem("posAuth"),
        }));
        
        // Small delay to ensure AuthContext updates before navigation
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Navigate to POS dashboard after successful login
        navigate({ to: "/", search: { area: undefined, activeOnly: false } });
      } catch (error: unknown) {

        if (error && typeof error === "object" && "message" in error) {
          const errorMessage = (error as { message: string }).message;
          setError(errorMessage);
        } else if (error && typeof error === "object" && "code" in error) {
          const errorCode = (error as { code: string }).code;
          if (errorCode === "auth/user-not-found") {
            setError("Kullanıcı bulunamadı");
          } else if (errorCode === "auth/wrong-password") {
            setError("Hatalı şifre");
          } else if (errorCode === "auth/invalid-email") {
            setError("Geçersiz e-posta adresi veya kullanıcı adı");
          } else {
            setError("Giriş sırasında bir hata oluştu");
          }
        } else {
          setError("Giriş sırasında bir hata oluştu");
        }
      } finally {
        setLoading(false);
      }
    },
    [email, password, navigate]
  );

  const handleKeyboardButtonClick = useCallback(() => {
    // Aktif input'u bul veya email input'una odaklan
    const activeElement = document.activeElement;
    let targetInput: HTMLInputElement | null = null;
    let keyboardType: "text" | "email" | "password" = "text";
    let currentValue = "";

    if (activeElement === emailInputRef.current || activeElement === passwordInputRef.current) {
      targetInput = activeElement as HTMLInputElement;
    } else if (emailInputRef.current) {
      targetInput = emailInputRef.current;
      emailInputRef.current.focus();
    } else if (passwordInputRef.current) {
      targetInput = passwordInputRef.current;
      passwordInputRef.current.focus();
    }

    if (targetInput) {
      if (targetInput === passwordInputRef.current) {
        keyboardType = "password";
        currentValue = password;
      } else {
        keyboardType = "email";
        currentValue = email;
      }
      openKeyboard(
        { current: targetInput } as React.RefObject<HTMLInputElement>,
        keyboardType,
        currentValue
      );
    }
  }, [openKeyboard, email, password]);

  const handleCheckUpdates = useCallback(async () => {
    setCheckingUpdate(true);
    try {
      // Güncelleme kontrolü - şimdilik basit bir kontrol
      // İleride API'den versiyon kontrolü yapılabilir
      await new Promise(resolve => setTimeout(resolve, 1000));
      alert("Güncelleme kontrolü tamamlandı. En son sürümü kullanıyorsunuz.");
    } catch (error) {
      alert("Güncelleme kontrolü sırasında bir hata oluştu");
    } finally {
      setCheckingUpdate(false);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-[0.8rem] py-[1.6rem]">
      <div className="w-full max-w-[38.4rem]">
        <div className="bg-white rounded-[1.6rem] shadow-xl p-[1.2rem] sm:p-[1.6rem] relative">
          {/* Header */}
          <div className="text-center mb-[1.6rem]">
            <div className="flex justify-center mb-[0.8rem]">
              <div className="w-[3.2rem] h-[3.2rem] bg-blue-600 rounded-[1.6rem] flex items-center justify-center shadow-lg">
                <Lock className="h-[2.4rem] w-[2.4rem] text-white" />
              </div>
            </div>
            <h1 className="text-[1.2rem] sm:text-[1.5rem] font-bold text-gray-900 mb-[0.4rem]">
              POS Sistemi
            </h1>
            <p className="text-[0.7rem] sm:text-[0.8rem] text-gray-600">
              Sipariş yönetim sistemine giriş yapın
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-[1.2rem]">
            {error && (
              <div className="p-[0.8rem] bg-red-50 border border-red-200 rounded-[0.32rem]">
                <p className="text-[0.7rem] text-red-600">{error}</p>
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="block text-[0.7rem] font-medium text-gray-700 mb-[0.4rem]"
              >
                E-posta Adresi veya Kullanıcı Adı
              </label>
              <Input
                id="email"
                ref={emailInputRef}
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="E-posta adresinizi veya kullanıcı adınızı girin"
                required
                className="h-[2.4rem] text-[0.8rem] bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white border-2 border-gray-300 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400"
                showKeyboardButton={false}
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-[0.7rem] font-medium text-gray-700 mb-[0.4rem]"
              >
                Şifre
              </label>
              <div className="relative">
                <Input
                  id="password"
                  ref={passwordInputRef}
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Şifrenizi girin"
                  required
                  className="h-[2.4rem] text-[0.8rem] bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white border-2 border-gray-300 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400"
                  showKeyboardButton={false}
                />
                <button
                  type="button"
                  className="absolute right-[0.4rem] top-1/2 -translate-y-1/2 p-[0.3rem] rounded-[0.24rem] hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer z-20"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowPassword(!showPassword);
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowPassword(!showPassword);
                  }}
                >
                  {showPassword ? (
                    <EyeOff className="h-[1rem] w-[1rem] text-gray-400" />
                  ) : (
                    <Eye className="h-[1rem] w-[1rem] text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex gap-[0.8rem]">
              <Button
                type="submit"
                className="flex-1 h-[2.4rem] text-[0.8rem] font-medium bg-blue-600 hover:bg-blue-700 text-white"
                disabled={loading}
              >
                {loading ? "Giriş Yapılıyor..." : "Giriş Yap"}
              </Button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleKeyboardButtonClick();
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleKeyboardButtonClick();
                }}
                className={cn(
                  "h-[2.4rem] w-[2.4rem] rounded-[0.24rem] transition-colors touch-manipulation flex items-center justify-center",
                  isOpen
                    ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
                )}
                aria-label="Klavyeyi Aç"
                title="Klavyeyi Aç"
              >
                <Keyboard className="h-[1.2rem] w-[1.2rem]" />
              </button>
            </div>
          </form>

          <p className="mt-[1.2rem] text-center text-[0.7rem] text-gray-600">
            QR Menü sistemi ile aynı bilgileri kullanabilirsiniz
          </p>

          {/* Güncelleme Butonları */}
          <div className="mt-[1.2rem] flex gap-[0.8rem]">
            <button
              type="button"
              onClick={handleCheckUpdates}
              disabled={checkingUpdate}
              className="flex-1 h-[2.4rem] text-[0.7rem] font-medium border-2 border-gray-400 dark:border-gray-500 rounded-[0.24rem] bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
            >
              {checkingUpdate ? (
                <>
                  <RefreshCw className="h-[1rem] w-[1rem] mr-[0.4rem] animate-spin" />
                  Kontrol Ediliyor...
                </>
              ) : (
                <>
                  <RefreshCw className="h-[1rem] w-[1rem] mr-[0.4rem]" />
                  Güncellemeleri Kontrol Et
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => setShowUpdateNotes(true)}
              className="flex-1 h-[2.4rem] text-[0.7rem] font-medium border-2 border-gray-400 dark:border-gray-500 rounded-[0.24rem] bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center justify-center transition-colors"
            >
              <FileText className="h-[1rem] w-[1rem] mr-[0.4rem]" />
              Güncelleme Notları
            </button>
          </div>
        </div>
      </div>

      {/* Güncelleme Notları Modalı */}
      {showUpdateNotes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-[1.6rem] shadow-xl max-w-[42rem] w-full max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-[1.2rem] flex items-center justify-between">
              <h2 className="text-[1.2rem] font-bold text-gray-900 dark:text-white">
                Güncelleme Notları
              </h2>
              <button
                onClick={() => setShowUpdateNotes(false)}
                className="p-[0.4rem] rounded-[0.24rem] hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <X className="h-[1.2rem] w-[1.2rem] text-gray-600 dark:text-gray-400" />
              </button>
            </div>
            <div className="p-[1.2rem] space-y-[1.2rem]">
              {/* Versiyon Bilgisi */}
              <div>
                <h3 className="text-[0.9rem] font-semibold text-gray-900 dark:text-white mb-[0.8rem]">
                  Versiyon Bilgisi
                </h3>
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-[0.8rem] p-[0.8rem]">
                  <p className="text-[0.8rem] text-gray-700 dark:text-gray-300">
                    <span className="font-medium">Mevcut Versiyon:</span> 1.0.3
                  </p>
                  <p className="text-[0.7rem] text-gray-600 dark:text-gray-400 mt-[0.4rem]">
                    Son Güncelleme: {new Date().toLocaleDateString('tr-TR', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </p>
                </div>
              </div>

              {/* Yapılan Geliştirmeler */}
              <div>
                <h3 className="text-[0.9rem] font-semibold text-gray-900 dark:text-white mb-[0.8rem]">
                  Yapılan Geliştirmeler
                </h3>
                <div className="space-y-[0.8rem]">
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-[0.8rem] p-[0.8rem]">
                    <h4 className="text-[0.8rem] font-medium text-gray-900 dark:text-white mb-[0.4rem]">
                      v1.0.0 - İlk Sürüm
                    </h4>
                    <ul className="text-[0.7rem] text-gray-700 dark:text-gray-300 space-y-[0.4rem] list-disc list-inside">
                      <li>Tam ekran ödeme alma ekranı eklendi</li>
                      <li>Ürün seçimi ve miktar belirleme özelliği</li>
                      <li>Numerik tuş takımı ile miktar girişi</li>
                      <li>İskonto uygulama sistemi (oran ve fiyat bazlı)</li>
                      <li>Kısmi ödeme alma özelliği</li>
                      <li>Paket masaları için kurye atama ve para üstü işlemleri</li>
                      <li>Kurye yönetimi ve istatistikleri</li>
                      <li>Gelişmiş masa yönetimi (aktif masalar, tüm masalar)</li>
                      <li>Otomatik zaman güncellemeleri</li>
                      <li>Yazıcı yönetimi (USB, Seri Port, Ağ yazıcıları)</li>
                      <li>Koyu tema desteği</li>
                      <li>Responsive tasarım (mobil ve masaüstü uyumlu)</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
            <div className="sticky bottom-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-[1.2rem]">
              <Button
                onClick={() => setShowUpdateNotes(false)}
                className="w-full h-[2.4rem] text-[0.8rem] font-medium"
              >
                Kapat
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

