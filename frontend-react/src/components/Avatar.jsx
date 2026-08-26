export default function Avatar({ initials, size = "md" }) {
  const sizes = {
    sm: "h-8 w-8 text-xs",
    md: "h-9 w-9 text-xs",
    lg: "h-16 w-16 text-lg",
  };
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)] font-semibold text-[var(--color-accent-strong)] ${sizes[size]}`}
    >
      {initials}
    </span>
  );
}
