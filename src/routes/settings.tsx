import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { Moon, Sun, Monitor, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { POSLayout } from "@/components/layouts/POSLayout";

export const Route = createFileRoute("/settings")({
  component: Settings,
});

function Settings() {
  return (
    <POSLayout>
      <SettingsContent />
    </POSLayout>
  );
}

function SettingsContent() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [selectedTheme, setSelectedTheme] = useState<"light" | "dark" | "system">(theme);
  const [hasChanges, setHasChanges] = useState(false);

  // Tema değiştiğinde selectedTheme'i güncelle
  useEffect(() => {
    setSelectedTheme(theme);
    setHasChanges(false);
  }, [theme]);

  // Seçim değiştiğinde hasChanges'i güncelle
  useEffect(() => {
    setHasChanges(selectedTheme !== theme);
  }, [selectedTheme, theme]);

  const themes = [
    {
      key: "light" as const,
      label: "Açık Tema",
      description: "Açık renk teması",
      icon: Sun,
    },
    {
      key: "dark" as const,
      label: "Koyu Tema",
      description: "Koyu renk teması",
      icon: Moon,
    },
    {
      key: "system" as const,
      label: "Sistem",
      description: "Sistem ayarlarını kullan",
      icon: Monitor,
    },
  ];

  const handleSave = () => {
    setTheme(selectedTheme);
    setHasChanges(false);
  };

  return (
    <div className="h-full bg-gray-50 dark:bg-gray-900 p-3 lg:p-4 overflow-y-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
          Ayarlar
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
          Sistem ayarlarını yönetin
        </p>
      </div>

      {/* Tema Ayarları */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6 mb-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Tema Ayarları
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Uygulamanın görünüm temasını seçin ve kaydedin
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {themes.map((themeOption) => {
            const Icon = themeOption.icon;
            const isSelected = selectedTheme === themeOption.key;
            
            return (
              <button
                key={themeOption.key}
                onClick={() => setSelectedTheme(themeOption.key)}
                className={`p-4 rounded-lg border-2 transition-all duration-200 text-left ${
                  isSelected
                    ? "border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-200 dark:ring-blue-800"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className={`p-2 rounded-lg ${
                      isSelected
                        ? "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div
                      className={`font-semibold text-sm ${
                        isSelected
                          ? "text-blue-900 dark:text-blue-100"
                          : "text-gray-900 dark:text-white"
                      }`}
                    >
                      {themeOption.label}
                    </div>
                    <div
                      className={`text-xs mt-0.5 ${
                        isSelected
                          ? "text-blue-700 dark:text-blue-300"
                          : "text-gray-500 dark:text-gray-400"
                      }`}
                    >
                      {themeOption.description}
                    </div>
                  </div>
                  {isSelected && (
                    <div className="w-5 h-5 bg-blue-500 dark:bg-blue-400 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs">✓</span>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Kaydet Butonu */}
        <div className="flex items-center justify-between pt-6 border-t border-gray-200 dark:border-gray-700">
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Aktif Tema
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {theme === "system"
                ? `Sistem teması (${resolvedTheme === "dark" ? "Koyu" : "Açık"})`
                : theme === "dark"
                ? "Koyu Tema"
                : "Açık Tema"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {hasChanges && (
              <span className="text-xs text-orange-600 dark:text-orange-400">
                Değişiklikler kaydedilmedi
              </span>
            )}
            <Button
              onClick={handleSave}
              disabled={!hasChanges}
              className="min-w-[120px]"
            >
              <Save className="h-4 w-4 mr-2" />
              Kaydet
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
