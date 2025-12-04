import { useState, useEffect } from "react";
import { AlertDialog } from "./ui/alert-dialog";
import { setAlertCallback } from "./ui/alert-dialog";

interface AlertState {
  message: string;
  title?: string;
}

export function AlertDialogProvider({ children }: { children: React.ReactNode }) {
  const [alert, setAlert] = useState<AlertState | null>(null);

  useEffect(() => {
    // Register the global alert callback
    setAlertCallback((props) => {
      setAlert(props);
    });

    return () => {
      setAlertCallback(null);
    };
  }, []);

  return (
    <>
      {children}
      {alert && (
        <AlertDialog
          message={alert.message}
          title={alert.title}
          onClose={() => setAlert(null)}
        />
      )}
    </>
  );
}

