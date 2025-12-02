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
    // Development'ta hata göster ama production'da çalışmasını sağla
    if (process.env.NODE_ENV === 'development') {
      console.error("useTouchKeyboard must be used within a TouchKeyboardProvider");
    }
    throw new Error("useTouchKeyboard must be used within a TouchKeyboardProvider");
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

  // Input değeri değiştiğinde currentValue'yu güncelle
  useEffect(() => {
    if (inputRef.current?.current) {
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
      if (inputRef.current?.current) {
        const input = inputRef.current.current;
        
        // Input'un gerçek değerini al (state yerine)
        const inputValue = input.value || "";
        
        // Cursor pozisyonunu al
        const cursorStart = input.selectionStart ?? inputValue.length;
        const cursorEnd = input.selectionEnd ?? inputValue.length;
        
        // Cursor pozisyonuna göre yeni değeri oluştur
        const newValue = 
          inputValue.slice(0, cursorStart) + 
          value + 
          inputValue.slice(cursorEnd);
        
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

        // Cursor pozisyonunu yeni eklenen karakterin sonuna ayarla
        const newCursorPosition = cursorStart + value.length;
        input.setSelectionRange(newCursorPosition, newCursorPosition);

        // Event tetikle
        const inputEvent = new Event("input", { bubbles: true });
        input.dispatchEvent(inputEvent);

        // Change event de tetikle
        const changeEvent = new Event("change", { bubbles: true });
        input.dispatchEvent(changeEvent);

        setCurrentValue(newValue);
      }
    },
    [maxLength]
  );

  const handleBackspace = useCallback(() => {
    if (inputRef.current?.current) {
      const input = inputRef.current.current;
      
      // Input'un gerçek değerini al (state yerine)
      const inputValue = input.value || "";
      
      if (inputValue.length === 0) {
        return;
      }
      
      // Cursor pozisyonunu al
      const cursorStart = input.selectionStart ?? inputValue.length;
      const cursorEnd = input.selectionEnd ?? inputValue.length;
      
      // Eğer seçili metin varsa, seçili metni sil
      // Yoksa cursor'un solundaki karakteri sil
      let newValue: string;
      let newCursorPosition: number;
      
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

      // Cursor pozisyonunu ayarla
      input.setSelectionRange(newCursorPosition, newCursorPosition);

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

