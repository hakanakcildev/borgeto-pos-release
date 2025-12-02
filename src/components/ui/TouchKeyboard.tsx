import React, { useState, useEffect, useRef, useCallback } from "react";
import { X, Delete, Keyboard } from "lucide-react";
import { cn } from "@/lib/utils";

export type KeyboardType = "text" | "number" | "email" | "password" | "tel";

interface TouchKeyboardProps {
  isOpen: boolean;
  onClose: () => void;
  onInput: (value: string) => void;
  onBackspace: () => void;
  onEnter?: () => void;
  type: KeyboardType;
  value: string;
  maxLength?: number;
}

const TouchKeyboard: React.FC<TouchKeyboardProps> = ({
  isOpen,
  onClose,
  onInput,
  onBackspace,
  onEnter,
  type,
  value,
  maxLength,
}) => {
  const [isShift, setIsShift] = useState(false);
  const [isSymbol, setIsSymbol] = useState(false);
  const keyboardRef = useRef<HTMLDivElement>(null);

  // Klavye dışına tıklandığında kapat
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (!keyboardRef.current) return;
      
      const target = event.target as HTMLElement;
      
      // Klavye içindeki herhangi bir elemente tıklandıysa kapatma
      if (keyboardRef.current.contains(target)) {
        return;
      }
      
      // Input veya textarea'ya tıklandıysa kapatma
      if (target.closest("input") || target.closest("textarea")) {
        return;
      }
      
      // Diğer durumlarda kapat
      onClose();
    };

    if (isOpen) {
      // click event'ini kullan (mousedown yerine) - daha güvenilir
      document.addEventListener("click", handleClickOutside, true);
      document.addEventListener("touchend", handleClickOutside, true);
      return () => {
        document.removeEventListener("click", handleClickOutside, true);
        document.removeEventListener("touchend", handleClickOutside, true);
      };
    }
  }, [isOpen, onClose]);

  const handleKeyPress = useCallback(
    (key: string) => {
      if (maxLength && value.length >= maxLength) {
        return;
      }
      onInput(key);
      // Shift modunu otomatik kapat
      if (isShift) {
        setIsShift(false);
      }
    },
    [onInput, value, maxLength, isShift]
  );

  const handleBackspace = useCallback(() => {
    onBackspace();
  }, [onBackspace]);

  const handleEnter = useCallback(() => {
    if (onEnter) {
      onEnter();
    }
  }, [onEnter]);

  // Sayısal klavye
  if (type === "number" || type === "tel") {
    return (
      <div
        ref={keyboardRef}
        className={cn(
          "fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-2xl z-50 transition-transform duration-300",
          isOpen ? "translate-y-0" : "translate-y-full"
        )}
      >
      <div className="max-w-3xl mx-auto p-2">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Keyboard className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Sayısal Klavye
            </span>
          </div>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onTouchStart={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Klavyeyi Kapat"
            >
              <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>

          {/* Number Pad */}
          <div className="grid grid-cols-3 gap-1.5">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleKeyPress(num.toString());
                }}
                onTouchStart={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleKeyPress(num.toString());
                }}
                className="h-12 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 active:bg-gray-200 dark:active:bg-gray-500 rounded-md text-xl font-semibold text-gray-900 dark:text-white transition-colors touch-manipulation"
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleKeyPress(".");
              }}
              onTouchStart={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleKeyPress(".");
              }}
              className="h-12 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 active:bg-gray-200 dark:active:bg-gray-500 rounded-md text-xl font-semibold text-gray-900 dark:text-white transition-colors touch-manipulation"
            >
              .
            </button>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleKeyPress("0");
              }}
              onTouchStart={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleKeyPress("0");
              }}
              className="h-12 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 active:bg-gray-200 dark:active:bg-gray-500 rounded-md text-xl font-semibold text-gray-900 dark:text-white transition-colors touch-manipulation"
            >
              0
            </button>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleBackspace();
              }}
              onTouchStart={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleBackspace();
              }}
              className="h-12 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 active:bg-red-200 dark:active:bg-red-900/40 rounded-md flex items-center justify-center transition-colors touch-manipulation"
            >
              <Delete className="h-4 w-4 text-red-600 dark:text-red-400" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Alfanumerik klavye
  const qwertyLayout = [
    ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
    ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
    ["z", "x", "c", "v", "b", "n", "m"],
  ];

  const turkishLayout = [
    ["q", "w", "e", "r", "t", "y", "u", "ı", "o", "p", "ğ", "ü"],
    ["a", "s", "d", "f", "g", "h", "j", "k", "l", "ş", "i"],
    ["z", "x", "c", "v", "b", "n", "m", "ö", "ç"],
  ];

  const numbers = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
  const symbols = [
    ["!", "@", "#", "$", "%", "^", "&", "*", "(", ")"],
    ["-", "_", "=", "+", "[", "]", "{", "}", "\\", "|"],
    [";", ":", "'", '"', ",", ".", "<", ">", "/", "?"],
  ];

  const currentLayout = isSymbol ? symbols : isShift ? turkishLayout : qwertyLayout;

  return (
    <div
      ref={keyboardRef}
      data-keyboard-container
      className={cn(
        "fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-2xl z-50 transition-transform duration-300",
        isOpen ? "translate-y-0" : "translate-y-full"
      )}
    >
      <div className="max-w-3xl mx-auto p-2">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Keyboard className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              {isSymbol ? "Sembol Klavyesi" : "Klavye"}
            </span>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onTouchStart={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Klavyeyi Kapat"
          >
            <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Number Row */}
        {!isSymbol && (
          <div className="flex gap-1.5 mb-1.5">
            {numbers.map((num) => (
              <button
                key={num}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleKeyPress(num);
                }}
                onTouchStart={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleKeyPress(num);
                }}
                className="flex-1 h-10 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 active:bg-gray-200 dark:active:bg-gray-500 rounded-md text-base font-medium text-gray-900 dark:text-white transition-colors touch-manipulation"
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleBackspace();
              }}
              onTouchStart={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleBackspace();
              }}
              className="w-16 h-10 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 active:bg-red-200 dark:active:bg-red-900/40 rounded-md flex items-center justify-center transition-colors touch-manipulation"
            >
              <Delete className="h-4 w-4 text-red-600 dark:text-red-400" />
            </button>
          </div>
        )}

        {/* Main Keyboard */}
        <div className="space-y-1.5 mb-1.5">
          {currentLayout.map((row, rowIndex) => (
            <div key={rowIndex} className="flex gap-1.5 justify-center">
              {row.map((key) => {
                const displayKey = isShift && !isSymbol ? key.toUpperCase() : key;
                return (
                  <button
                    key={key}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleKeyPress(displayKey);
                    }}
                    onTouchStart={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onTouchEnd={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleKeyPress(displayKey);
                    }}
                    className="h-10 px-3 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 active:bg-gray-200 dark:active:bg-gray-500 rounded-md text-sm font-medium text-gray-900 dark:text-white transition-colors touch-manipulation min-w-[40px] flex-1"
                  >
                    {displayKey}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Bottom Row */}
        <div className="flex gap-1.5">
          {!isSymbol && (
            <>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsShift(!isShift);
                }}
                onTouchStart={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsShift(!isShift);
                }}
                className={cn(
                  "h-10 px-3 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 active:bg-gray-200 dark:active:bg-gray-500 rounded-md text-sm font-medium transition-colors touch-manipulation",
                  isShift
                    ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                    : "text-gray-900 dark:text-white"
                )}
              >
                ⇧
              </button>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleKeyPress(" ");
                }}
                onTouchStart={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleKeyPress(" ");
                }}
                className="flex-1 h-10 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 active:bg-gray-200 dark:active:bg-gray-500 rounded-md text-sm font-medium text-gray-900 dark:text-white transition-colors touch-manipulation"
              >
                Boşluk
              </button>
            </>
          )}
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsSymbol(!isSymbol);
            }}
            onTouchStart={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsSymbol(!isSymbol);
            }}
            className={cn(
              "h-10 px-3 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 active:bg-gray-200 dark:active:bg-gray-500 rounded-md text-sm font-medium transition-colors touch-manipulation",
              isSymbol
                ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                : "text-gray-900 dark:text-white"
            )}
          >
            {isSymbol ? "ABC" : "123"}
          </button>
          {onEnter && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleEnter();
              }}
              onTouchStart={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleEnter();
              }}
              className="h-10 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-md text-sm font-medium text-white transition-colors touch-manipulation"
            >
              Enter
            </button>
          )}
          {!isSymbol && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleBackspace();
              }}
              onTouchStart={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleBackspace();
              }}
              className="h-10 px-3 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 active:bg-red-200 dark:active:bg-red-900/40 rounded-md flex items-center justify-center transition-colors touch-manipulation"
            >
              <Delete className="h-4 w-4 text-red-600 dark:text-red-400" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TouchKeyboard;

