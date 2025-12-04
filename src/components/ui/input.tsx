import * as React from "react";
import { cn } from "@/lib/utils";
import { useTouchKeyboard } from "@/contexts/TouchKeyboardContext";
import { Keyboard } from "lucide-react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  showTouchKeyboard?: boolean;
  showKeyboardButton?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type,
      showTouchKeyboard = true,
      showKeyboardButton = true,
      onFocus,
      onBlur,
      maxLength,
      ...props
    },
    ref
  ) => {
    const inputRef = React.useRef<HTMLInputElement>(null);
    const { openKeyboard, closeKeyboard, isOpen } = useTouchKeyboard();

    // Ref callback ile hem internal hem external ref'i senkronize et
    const setRefs = React.useCallback(
      (node: HTMLInputElement | null) => {
        inputRef.current = node;

        // External ref'i güncelle
        if (typeof ref === "function") {
          ref(node);
        } else if (ref) {
          (ref as React.MutableRefObject<HTMLInputElement | null>).current =
            node;
        }
      },
      [ref]
    );

    // Her zaman inputRef'i kullan (hem internal hem external ref senkronize)
    const getInputRef = React.useCallback(() => {
      return inputRef;
    }, []);

    // Dokunmatik ekran kontrolü - gerçek touch event'leri kontrol et
    const isTouchDevice = React.useMemo(() => {
      // PC klavyesi kullanıldığında touch keyboard'u otomatik açma
      // Sadece gerçek touch event'lerinde veya manuel açıldığında çalış
      return "ontouchstart" in window || navigator.maxTouchPoints > 0;
    }, []);

    const handleOpenKeyboard = React.useCallback(() => {
      const currentRef = getInputRef();
      const currentInput = currentRef.current;
      if (currentInput) {
        // Klavye tipini belirle
        let keyboardType: "text" | "number" | "email" | "password" | "tel" =
          "text";
        if (type === "number" || type === "tel") {
          keyboardType = type === "tel" ? "tel" : "number";
        } else if (type === "email") {
          keyboardType = "email";
        } else if (type === "password") {
          keyboardType = "password";
        } else {
          keyboardType = "text";
        }

        const currentValue = currentInput.value || "";
        // Doğru ref'i geçir
        openKeyboard(
          currentRef as React.RefObject<HTMLInputElement>,
          keyboardType,
          currentValue,
          maxLength
        );
      }
    }, [openKeyboard, type, maxLength, getInputRef]);

    const handleFocus = React.useCallback(
      (e: React.FocusEvent<HTMLInputElement>) => {
        const currentRef = getInputRef();
        const currentInput = currentRef.current;

        if (onFocus) {
          onFocus(e);
        }

        if (currentInput) {
          // Sadece touch device'larda ve showTouchKeyboard true ise otomatik klavyeyi aç
          // PC klavyesi kullanıldığında otomatik açma (sadece manuel buton ile açılabilir)
          if (isTouchDevice && showTouchKeyboard) {
            // Touch event kontrolü - eğer son event touch ise klavyeyi aç
            const lastEventWasTouch = (window as any).__lastTouchEvent;
            if (lastEventWasTouch) {
            // Kısa bir gecikme ile klavyeyi aç (focus'un tamamlanması için)
            setTimeout(() => {
              if (currentInput === document.activeElement) {
                handleOpenKeyboard();
              }
            }, 50);
            }
          } else if (isOpen) {
            // Klavye zaten açıksa (örneğin klavye butonu ile açıldıysa), klavyeyi güncelle
            handleOpenKeyboard();
          }
        }
      },
      [
        onFocus,
        isTouchDevice,
        showTouchKeyboard,
        handleOpenKeyboard,
        isOpen,
        getInputRef,
      ]
    );

    const handleClick = React.useCallback(() => {
      const currentRef = getInputRef();
      const currentInput = currentRef.current;
      if (currentInput) {
        // Input'a focus ver
        currentInput.focus();
      }
    }, [getInputRef]);

    const handleBlur = React.useCallback(
      (e: React.FocusEvent<HTMLInputElement>) => {
        if (onBlur) {
          onBlur(e);
        }

        // showTouchKeyboard false ise klavye işlemlerini yapma
        if (!showTouchKeyboard) {
          return;
        }

        // Klavyeyi kapat (biraz gecikme ile, çünkü klavye butonuna tıklanabilir)
        setTimeout(() => {
          const activeElement = document.activeElement;
          const currentRef = getInputRef();
          const currentInput = currentRef.current;

          // Kapatma butonuna basıldıysa kapat
          if (
            activeElement &&
            activeElement.closest('button[aria-label="Klavyeyi Kapat"]')
          ) {
            closeKeyboard();
            return;
          }

          // Eğer yeni focus bir input veya textarea'ya gidiyorsa, klavyeyi kapatma
          if (
            activeElement &&
            (activeElement instanceof HTMLInputElement ||
              activeElement instanceof HTMLTextAreaElement)
          ) {
            // Klavye açıksa ve başka bir input/textarea'ya geçildiyse, klavyeyi açık tut
            // handleFocus zaten yeni input için klavyeyi güncelleyecek
            return;
          }

          // Eğer aktif element klavye içindeyse veya klavye açma butonundaysa kapatma
          if (
            activeElement &&
            (activeElement.closest("[data-keyboard-container]") ||
              activeElement.closest('button[aria-label="Klavyeyi Aç"]'))
          ) {
            // Input'a focus'u geri ver
            if (currentInput) {
              currentInput.focus();
            }
            return;
          }

          // Sadece gerçekten input dışına çıkıldıysa kapat
          if (currentInput && !currentInput.contains(activeElement)) {
            closeKeyboard();
          }
        }, 100);
      },
      [onBlur, closeKeyboard, showTouchKeyboard, getInputRef]
    );

    // autoCapitalize: Login sayfası hariç tüm input'larda "sentences" (ilk harf büyük)
    // Eğer props'ta autoCapitalize belirtilmişse onu kullan, yoksa varsayılan olarak "sentences"
    const autoCapitalizeValue = props.autoCapitalize !== undefined 
      ? props.autoCapitalize 
      : (type === "password" || type === "email" ? "none" : "sentences");

    return (
      <div className="relative w-full">
        <input
          type={type}
          className={cn(
            "flex h-[2rem] w-full rounded-[0.24rem] border border-input bg-white dark:bg-gray-800 px-[0.6rem] py-[0.4rem] text-[0.7rem] ring-offset-background file:border-0 file:bg-transparent file:text-[0.7rem] file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            "cursor-text selection:bg-blue-200 dark:selection:bg-blue-800 selection:text-blue-900 dark:selection:text-blue-100",
            "text-gray-900 dark:text-white",
            "select-text touch-manipulation",
            showKeyboardButton &&
              isTouchDevice &&
              (type === "password" ? "pr-[5rem]" : "pr-[2.5rem]"),
            className
          )}
          style={{
            caretColor: "#2563eb",
            WebkitUserSelect: "text",
            userSelect: "text",
          }}
          ref={setRefs}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onClick={handleClick}
          maxLength={maxLength}
          tabIndex={0}
          autoCapitalize={autoCapitalizeValue}
          {...props}
        />
        {showKeyboardButton && isTouchDevice && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleOpenKeyboard();
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleOpenKeyboard();
            }}
            className={cn(
              "absolute top-1/2 -translate-y-1/2 p-[0.4rem] rounded-[0.24rem] transition-colors touch-manipulation z-10",
              type === "password" ? "right-[2.8rem]" : "right-[0.4rem]",
              isOpen
                ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
            )}
            aria-label="Klavyeyi Aç"
            title="Klavyeyi Aç"
          >
            <Keyboard className="h-[1.1rem] w-[1.1rem]" />
          </button>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

export { Input };
