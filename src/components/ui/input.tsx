import * as React from "react";
import { cn } from "@/lib/utils";
import { useTouchKeyboard } from "@/contexts/TouchKeyboardContext";
import { Keyboard } from "lucide-react";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  showTouchKeyboard?: boolean;
  showKeyboardButton?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, showTouchKeyboard = true, showKeyboardButton = true, onFocus, onBlur, maxLength, ...props }, ref) => {
    const inputRef = React.useRef<HTMLInputElement>(null);
    const { openKeyboard, closeKeyboard, isOpen } = useTouchKeyboard();
    
    // Ref'i birleştir - hem internal ref hem de external ref'i kullan
    React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement, []);
    
    // External ref'i kontrol et ve kullan
    const getInputRef = React.useCallback(() => {
      // Eğer external ref varsa ve object ise onu kullan
      if (ref && typeof ref === 'object' && 'current' in ref) {
        return ref as React.RefObject<HTMLInputElement>;
      }
      // Yoksa internal ref'i kullan
      return inputRef;
    }, [ref]);

    // Dokunmatik ekran kontrolü
    const isTouchDevice = React.useMemo(() => {
      return (
        "ontouchstart" in window ||
        navigator.maxTouchPoints > 0 ||
        // @ts-ignore
        navigator.msMaxTouchPoints > 0
      );
    }, []);

    const handleOpenKeyboard = React.useCallback(() => {
      const currentRef = getInputRef();
      const currentInput = currentRef.current;
      if (currentInput) {
        // Klavye tipini belirle
        let keyboardType: "text" | "number" | "email" | "password" | "tel" = "text";
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
        openKeyboard(currentRef as React.RefObject<HTMLInputElement>, keyboardType, currentValue, maxLength);
      }
    }, [openKeyboard, type, maxLength, getInputRef]);

    const handleFocus = React.useCallback(
      (e: React.FocusEvent<HTMLInputElement>) => {
        if (onFocus) {
          onFocus(e);
        }

        const currentRef = getInputRef();
        const currentInput = currentRef.current;
        if (currentInput) {
          // Input'a focus ver ve cursor'u göster
          currentInput.focus();
          
          // Dokunmatik cihazlarda ve showTouchKeyboard true ise klavyeyi aç
          if (isTouchDevice && showTouchKeyboard) {
            // Kısa bir gecikme ile klavyeyi aç (focus'un tamamlanması için)
            setTimeout(() => {
              handleOpenKeyboard();
            }, 50);
          } else if (isOpen) {
            // Klavye zaten açıksa (örneğin klavye butonu ile açıldıysa), klavyeyi güncelle
            handleOpenKeyboard();
          }
        }
      },
      [onFocus, isTouchDevice, showTouchKeyboard, handleOpenKeyboard, isOpen, getInputRef]
    );

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
            (activeElement.closest('[data-keyboard-container]') ||
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
        }, 200);
      },
      [onBlur, closeKeyboard, showTouchKeyboard, getInputRef]
    );

    return (
      <div className="relative w-full">
        <input
          type={type}
          className={cn(
            "flex h-[2rem] w-full rounded-[0.24rem] border border-input bg-background px-[0.6rem] py-[0.4rem] text-[0.7rem] ring-offset-background file:border-0 file:bg-transparent file:text-[0.7rem] file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 cursor-text",
            showKeyboardButton && isTouchDevice && (type === "password" ? "pr-[5rem]" : "pr-[2.5rem]"),
            className
          )}
          ref={inputRef}
          onFocus={handleFocus}
          onBlur={handleBlur}
          maxLength={maxLength}
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
