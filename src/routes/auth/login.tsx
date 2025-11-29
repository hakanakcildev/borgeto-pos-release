import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useCallback } from "react";
import { signInWithCredentials } from "@/lib/firebase/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, Lock } from "lucide-react";

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-[0.8rem] py-[1.6rem]">
      <div className="w-full max-w-[38.4rem]">
        <div className="bg-white rounded-[1.6rem] shadow-xl p-[1.2rem] sm:p-[1.6rem]">
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
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="E-posta adresinizi veya kullanıcı adınızı girin"
                required
                className="h-[2.4rem] text-[0.8rem]"
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
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Şifrenizi girin"
                  required
                  className="h-[2.4rem] text-[0.8rem] pr-[2.4rem]"
                />
                <button
                  type="button"
                  className="absolute right-[0.6rem] top-1/2 transform -translate-y-1/2 cursor-pointer"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-[1rem] w-[1rem] text-gray-400" />
                  ) : (
                    <Eye className="h-[1rem] w-[1rem] text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-[2.4rem] text-[0.8rem] font-medium"
              disabled={loading}
            >
              {loading ? "Giriş Yapılıyor..." : "Giriş Yap"}
            </Button>
          </form>

          <p className="mt-[1.2rem] text-center text-[0.7rem] text-gray-600">
            QR Menü sistemi ile aynı bilgileri kullanabilirsiniz
          </p>
        </div>
      </div>
    </div>
  );
}

