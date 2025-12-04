import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import type { KeyboardType } from "@/components/ui/TouchKeyboard";

interface TouchKeyboardContextType {
  isOpen: boolean;
  openKeyboard: (
    inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement>,
    type: KeyboardType,
    currentValue: string,
    maxLength?: number
  ) => void;
  closeKeyboard: () => void;
  handleInput: (value: string) => void;
  handleBackspace: () => void;
  keyboardType: KeyboardType;
  currentValue: string;
  maxLength?: number;
}

const TouchKeyboardContext = createContext<TouchKeyboardContextType | undefined>(undefined);

export const useTouchKeyboard = () => {
  const context = useContext(TouchKeyboardContext);
  if (context === undefined) {
    // Provider yoksa fallback değer döndür (hata fırlatmak yerine)
    return {
      isOpen: false,
      openKeyboard: () => {},
      closeKeyboard: () => {},
      handleInput: () => {},
      handleBackspace: () => {},
      keyboardType: "text" as KeyboardType,
      currentValue: "",
      maxLength: undefined,
    };
  }
  return context;
};

interface TouchKeyboardProviderProps {
  children: React.ReactNode;
}

export const TouchKeyboardProvider: React.FC<TouchKeyboardProviderProps> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [keyboardType, setKeyboardType] = useState<KeyboardType>("text");
  const [currentValue, setCurrentValue] = useState("");
  const [maxLength, setMaxLength] = useState<number | undefined>(undefined);
  const inputRef = useRef<React.RefObject<HTMLInputElement | HTMLTextAreaElement> | null>(null);

  const openKeyboard = useCallback(
    (
      ref: React.RefObject<HTMLInputElement | HTMLTextAreaElement>,
      type: KeyboardType,
      value: string,
      maxLen?: number
    ) => {
      inputRef.current = ref;
      setKeyboardType(type);
      // Input'un gerçek değerini kullan (eğer ref mevcut ise)
      const actualValue = ref.current?.value || value || "";
      setCurrentValue(actualValue);
      setMaxLength(maxLen);
      setIsOpen(true);
    },
    []
  );

  // Input değeri değiştiğinde currentValue'yu güncelle (sadece touch keyboard açıkken)
  useEffect(() => {
    if (inputRef.current?.current && isOpen) {
      const input = inputRef.current.current;
      const handleInputChange = () => {
        if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
          setCurrentValue(input.value || "");
        }
      };

      input.addEventListener("input", handleInputChange);
      input.addEventListener("change", handleInputChange);

      return () => {
        input.removeEventListener("input", handleInputChange);
        input.removeEventListener("change", handleInputChange);
      };
    }
  }, [isOpen]);

  const closeKeyboard = useCallback(() => {
    // Input'u blur et (focus'u kaldır)
    if (inputRef.current?.current) {
      const input = inputRef.current.current;
      if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
        input.blur();
      }
    }
    setIsOpen(false);
    inputRef.current = null;
  }, []);

  const handleInput = useCallback(
    (value: string) => {
      // Sadece touch keyboard açıkken çalış
      if (!isOpen) {
        return;
      }

      if (inputRef.current?.current) {
        const input = inputRef.current.current;
        
        // Input'un gerçek değerini al (state yerine)
        const inputValue = input.value || "";
        
        // Number input'larda cursor pozisyonu yok, sadece sonuna ekle
        let newValue: string;
        if (input instanceof HTMLInputElement && input.type === "number") {
          newValue = inputValue + value;
        } else {
          // Cursor pozisyonunu al (text input'larda)
        const cursorStart = input.selectionStart ?? inputValue.length;
        const cursorEnd = input.selectionEnd ?? inputValue.length;
        
        // Cursor pozisyonuna göre yeni değeri oluştur
          newValue = 
          inputValue.slice(0, cursorStart) + 
          value + 
          inputValue.slice(cursorEnd);
        }
        
        if (maxLength && newValue.length > maxLength) {
          return;
        }

        // Input değerini güncelle
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value"
        )?.set;
        const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype,
          "value"
        )?.set;

        if (input instanceof HTMLInputElement && nativeInputValueSetter) {
          nativeInputValueSetter.call(input, newValue);
        } else if (input instanceof HTMLTextAreaElement && nativeTextAreaValueSetter) {
          nativeTextAreaValueSetter.call(input, newValue);
        }

        // Focus'u koru
        if (document.activeElement !== input) {
          input.focus();
        }
        // Number tipindeki input'larda setSelectionRange çalışmaz
        if (input instanceof HTMLInputElement && input.type !== "number") {
          // Cursor pozisyonunu yeni eklenen karakterin sonuna ayarla
          const cursorStart = input.selectionStart ?? inputValue.length;
          const newCursorPosition = cursorStart + value.length;
        requestAnimationFrame(() => {
            try {
          input.setSelectionRange(newCursorPosition, newCursorPosition);
            } catch (error) {
              // setSelectionRange hatası görmezden gelinir
            }
        });
        }

        // Event tetikle
        const inputEvent = new Event("input", { bubbles: true });
        input.dispatchEvent(inputEvent);

        // Change event de tetikle
        const changeEvent = new Event("change", { bubbles: true });
        input.dispatchEvent(changeEvent);

        setCurrentValue(newValue);
      }
    },
    [maxLength, isOpen]
  );

  const handleBackspace = useCallback(() => {
    if (inputRef.current?.current) {
      const input = inputRef.current.current;
      
      // Input'un gerçek değerini al (state yerine)
      const inputValue = input.value || "";
      
      if (inputValue.length === 0) {
        return;
      }
      
      // Number input'larda sadece son karakteri sil
      let newValue: string;
      let newCursorPosition: number;
      
      if (input instanceof HTMLInputElement && input.type === "number") {
        newValue = inputValue.slice(0, -1);
        newCursorPosition = newValue.length;
      } else {
        // Text input'larda cursor pozisyonunu al
      const cursorStart = input.selectionStart ?? inputValue.length;
      const cursorEnd = input.selectionEnd ?? inputValue.length;
      
      // Eğer seçili metin varsa, seçili metni sil
      // Yoksa cursor'un solundaki karakteri sil
      if (cursorStart !== cursorEnd) {
        // Seçili metin varsa, seçili metni sil
        newValue = inputValue.slice(0, cursorStart) + inputValue.slice(cursorEnd);
        newCursorPosition = cursorStart;
      } else if (cursorStart > 0) {
        // Cursor'un solundaki karakteri sil
        newValue = inputValue.slice(0, cursorStart - 1) + inputValue.slice(cursorStart);
        newCursorPosition = cursorStart - 1;
      } else {
        // Cursor başta, silinecek bir şey yok
        return;
        }
      }

      // Input değerini güncelle
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      )?.set;
      const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        "value"
      )?.set;

      if (input instanceof HTMLInputElement && nativeInputValueSetter) {
        nativeInputValueSetter.call(input, newValue);
      } else if (input instanceof HTMLTextAreaElement && nativeTextAreaValueSetter) {
        nativeTextAreaValueSetter.call(input, newValue);
      }

      // Focus'u koru ve cursor pozisyonunu ayarla
      if (document.activeElement !== input) {
        input.focus();
      }
      // Number tipindeki input'larda setSelectionRange çalışmaz
      if (input instanceof HTMLInputElement && input.type !== "number") {
      requestAnimationFrame(() => {
          try {
        input.setSelectionRange(newCursorPosition, newCursorPosition);
          } catch (error) {
            // setSelectionRange hatası görmezden gelinir
          }
      });
      }

      // Event tetikle
      const event = new Event("input", { bubbles: true });
      input.dispatchEvent(event);

      // Change event de tetikle
      const changeEvent = new Event("change", { bubbles: true });
      input.dispatchEvent(changeEvent);

      setCurrentValue(newValue);
    }
  }, []);

  const value: TouchKeyboardContextType = {
    isOpen,
    openKeyboard,
    closeKeyboard,
    handleInput,
    handleBackspace,
    keyboardType,
    currentValue,
    maxLength,
  };

  return (
    <TouchKeyboardContext.Provider value={value}>
      {children}
    </TouchKeyboardContext.Provider>
  );
};

