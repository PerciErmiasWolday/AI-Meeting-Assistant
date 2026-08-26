import { useEffect, useRef } from "react";

export default function Popover({ open, onClose, anchorClassName = "", children }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className={`absolute z-30 mt-2 min-w-[200px] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2 shadow-[0_4px_16px_rgba(0,0,0,0.12)] ${anchorClassName}`}
    >
      {children}
    </div>
  );
}
