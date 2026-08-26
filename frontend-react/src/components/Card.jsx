export default function Card({ className = "", children }) {
  return (
    <div
      className={`rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_4px_10px_rgba(0,0,0,0.04)] ${className}`}
    >
      {children}
    </div>
  );
}
