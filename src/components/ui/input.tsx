import * as React from "react";
import { cn } from "@/lib/utils";
import { useTouchKeyboard } from "@/contexts/TouchKeyboardContext";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  showTouchKeyboard?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, showTouchKeyboard = true, onFocus, onBlur, maxLength, ...props }, ref) => {
    const inputRef = React.useRef<HTMLInputElement>(null);
    const { openKeyboard, closeKeyboard } = useTouchKeyboard();
    
    // Ref'i birleştir
    React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement, []);

    // Dokunmatik ekran kontrolü
    const isTouchDevice = React.useMemo(() => {
      return (
        "ontouchstart" in window ||
        navigator.maxTouchPoints > 0 ||
        // @ts-ignore
        navigator.msMaxTouchPoints > 0
      );
    }, []);

    const handleFocus = React.useCallback(
      (e: React.FocusEvent<HTMLInputElement>) => {
        if (onFocus) {
          onFocus(e);
        }

        // Dokunmatik cihazlarda ve showTouchKeyboard true ise klavyeyi aç
        if (isTouchDevice && showTouchKeyboard && inputRef.current) {
          // Varsayılan klavyeyi engelle
          inputRef.current.setAttribute("readonly", "readonly");
          setTimeout(() => {
            if (inputRef.current) {
              inputRef.current.removeAttribute("readonly");
            }
          }, 100);

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

          const currentValue = inputRef.current.value || "";
          openKeyboard(inputRef as React.RefObject<HTMLInputElement>, keyboardType, currentValue, maxLength);
        }
      },
      [onFocus, isTouchDevice, showTouchKeyboard, openKeyboard, type, maxLength]
    );

    const handleBlur = React.useCallback(
      (e: React.FocusEvent<HTMLInputElement>) => {
        if (onBlur) {
          onBlur(e);
        }
        // Klavyeyi kapat (biraz gecikme ile, çünkü klavye butonuna tıklanabilir)
        setTimeout(() => {
          closeKeyboard();
        }, 200);
      },
      [onBlur, closeKeyboard]
    );

    return (
      <input
        type={type}
        className={cn(
          "flex h-[2rem] w-full rounded-[0.24rem] border border-input bg-background px-[0.6rem] py-[0.4rem] text-[0.7rem] ring-offset-background file:border-0 file:bg-transparent file:text-[0.7rem] file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={inputRef}
        onFocus={handleFocus}
        onBlur={handleBlur}
        maxLength={maxLength}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
