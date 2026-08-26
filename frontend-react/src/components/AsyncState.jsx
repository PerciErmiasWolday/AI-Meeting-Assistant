import { Loader2, AlertTriangle } from "lucide-react";

export function LoadingState({ label = "Loading..." }) {
  return (
    <div className="flex h-[50vh] flex-col items-center justify-center gap-3 text-[var(--color-text-muted)]">
      <Loader2 className="h-6 w-6 animate-spin text-[var(--color-primary)]" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function ErrorState({ message = "Something went wrong." }) {
  return (
    <div className="flex h-[50vh] flex-col items-center justify-center gap-3 text-center text-[var(--color-text-muted)]">
      <AlertTriangle className="h-6 w-6 text-[var(--color-status-red-text)]" />
      <p className="max-w-sm text-sm">{message}</p>
    </div>
  );
}
