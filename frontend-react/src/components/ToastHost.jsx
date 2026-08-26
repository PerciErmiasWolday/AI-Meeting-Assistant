import { useEffect, useState } from "react";
import { CheckCircle2, Info } from "lucide-react";
import { subscribeToast } from "../lib/toast";

export default function ToastHost() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    return subscribeToast((t) => {
      setToasts((prev) => [...prev, t]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== t.id));
      }, 3200);
    });
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text)] shadow-[0_4px_16px_rgba(0,0,0,0.12)]"
        >
          {t.variant === "info" ? (
            <Info className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
          ) : (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--color-status-green-text)]" />
          )}
          {t.message}
        </div>
      ))}
    </div>
  );
}
