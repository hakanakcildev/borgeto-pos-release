import { useEffect, useState } from "react";

interface AlertDialogProps {
  title?: string;
  message: string;
  onClose: () => void;
}

export function AlertDialog({ title, message, onClose }: AlertDialogProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(true);
  }, []);

  const handleClose = () => {
    setShow(false);
    setTimeout(onClose, 200);
  };


  return (
    <div
      className={`fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4 transition-opacity duration-200 ${
        show ? "opacity-100" : "opacity-0"
      }`}
      onClick={handleClose}
    >
      <div
        className={`bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 transition-all duration-200 ${
          show ? "scale-100" : "scale-95"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title */}
        {title && (
          <h3 className="text-xl font-bold text-gray-900 dark:text-white text-center mb-4">
            {title}
          </h3>
        )}

        {/* Message */}
        <p className="text-gray-700 dark:text-gray-300 text-center mb-6 whitespace-pre-line">
          {message}
        </p>

        {/* OK Button */}
        <button
          onClick={handleClose}
          className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          Tamam
        </button>
      </div>
    </div>
  );
}

// Global alert function replacement
let alertCallback: ((props: Omit<AlertDialogProps, "onClose">) => void) | null = null;

export function setAlertCallback(callback: typeof alertCallback) {
  alertCallback = callback;
}

export function customAlert(message: string, title?: string, _type?: "info" | "success" | "error" | "warning") {
  if (alertCallback) {
    alertCallback({ message, title });
  } else {
    // Fallback to native alert
    window.alert(message);
  }
}

