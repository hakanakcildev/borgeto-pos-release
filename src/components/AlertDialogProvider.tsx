import { useState, useEffect } from "react";
import {
  AlertDialog,
  ConfirmDialog,
  setAlertCallback,
  setConfirmCallback,
  resolveConfirm,
} from "./ui/alert-dialog";

interface AlertState {
  message: string;
  title?: string;
}

interface ConfirmState {
  message: string;
  title?: string;
}

export function AlertDialogProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [alert, setAlert] = useState<AlertState | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  useEffect(() => {
    // Register the global alert callback
    setAlertCallback((props) => {
      setAlert(props);
    });

    // Register the global confirm callback
    setConfirmCallback((props) => {
      setConfirm(props);
    });

    return () => {
      setAlertCallback(null);
      setConfirmCallback(null);
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
      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          title={confirm.title}
          onConfirm={() => {
            setConfirm(null);
            resolveConfirm(true);
          }}
          onCancel={() => {
            setConfirm(null);
            resolveConfirm(false);
          }}
        />
      )}
    </>
  );
}
