import * as React from "react";
import { cn } from "@/lib/utils";
import { useTouchKeyboard } from "@/contexts/TouchKeyboardContext";
import { Keyboard } from "lucide-react";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  showTouchKeyboard?: boolean;
  showKeyboardButton?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, showTouchKeyboard = true, showKeyboardButton = true, onFocus, onBlur, maxLength, ...props }, ref) => {
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);
    const { openKeyboard, closeKeyboard, isOpen } = useTouchKeyboard();
    
    // Ref'i birleştir
    React.useImperativeHandle(ref, () => textareaRef.current as HTMLTextAreaElement, []);

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
      if (textareaRef.current) {
        const currentValue = textareaRef.current.value || "";
        openKeyboard(textareaRef as React.RefObject<HTMLTextAreaElement>, "text", currentValue, maxLength);
      }
    }, [openKeyboard, maxLength]);

    const handleFocus = React.useCallback(
      (e: React.FocusEvent<HTMLTextAreaElement>) => {
        if (onFocus) {
          onFocus(e);
        }

        if (textareaRef.current) {
          // Dokunmatik cihazlarda ve showTouchKeyboard true ise klavyeyi aç
          if (isTouchDevice && showTouchKeyboard) {
            // Varsayılan klavyeyi engelle
            textareaRef.current.setAttribute("readonly", "readonly");
            setTimeout(() => {
              if (textareaRef.current) {
                textareaRef.current.removeAttribute("readonly");
              }
            }, 100);

            handleOpenKeyboard();
          } else if (isOpen) {
            // Klavye zaten açıksa (örneğin klavye butonu ile açıldıysa), klavyeyi güncelle
            handleOpenKeyboard();
          }
        }
      },
      [onFocus, isTouchDevice, showTouchKeyboard, handleOpenKeyboard, isOpen]
    );

    const handleBlur = React.useCallback(
      (e: React.FocusEvent<HTMLTextAreaElement>) => {
        if (onBlur) {
          onBlur(e);
        }
        // Klavyeyi kapat (biraz gecikme ile, çünkü klavye butonuna tıklanabilir)
        setTimeout(() => {
          const activeElement = document.activeElement;
          
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
            // handleFocus zaten yeni textarea için klavyeyi güncelleyecek
            return;
          }
          
          // Eğer aktif element klavye içindeyse veya klavye açma butonundaysa kapatma
          if (
            activeElement &&
            (activeElement.closest('[data-keyboard-container]') ||
             activeElement.closest('button[aria-label="Klavyeyi Aç"]'))
          ) {
            // Textarea'ya focus'u geri ver
            if (textareaRef.current) {
              textareaRef.current.focus();
            }
            return;
          }
          
          // Sadece gerçekten textarea dışına çıkıldıysa kapat
          if (!textareaRef.current?.contains(activeElement)) {
            closeKeyboard();
          }
        }, 200);
      },
      [onBlur, closeKeyboard]
    );

    return (
      <div className="relative w-full">
        <textarea
          className={cn(
            "flex min-h-[5rem] w-full rounded-[0.24rem] border border-input bg-background px-[0.6rem] py-[0.4rem] text-[0.7rem] ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none",
            showKeyboardButton && isTouchDevice && "pr-[2.5rem]",
            className
          )}
          ref={textareaRef}
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
              "absolute right-[0.4rem] top-[0.4rem] p-[0.3rem] rounded-[0.24rem] transition-colors touch-manipulation z-10",
              isOpen
                ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
            )}
            aria-label="Klavyeyi Aç"
          >
            <Keyboard className="h-[1rem] w-[1rem]" />
          </button>
        )}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };

