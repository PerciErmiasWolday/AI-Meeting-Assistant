const VARIANT_BY_STATUS = {
  completed: "green",
  "new lead": "green",
  qualified: "green",
  resolved: "green",
  "follow-up": "amber",
  proposal: "amber",
  "in review": "blue",
  "in progress": "blue",
  closed: "gray",
  missed: "red",
  "ready to review": "amber",
  "extraction failed": "red",
};

const VARIANT_CLASSES = {
  green: "bg-[var(--color-status-green-bg)] text-[var(--color-status-green-text)]",
  amber: "bg-[var(--color-status-amber-bg)] text-[var(--color-status-amber-text)]",
  blue: "bg-[var(--color-status-blue-bg)] text-[var(--color-status-blue-text)]",
  gray: "bg-[var(--color-status-gray-bg)] text-[var(--color-status-gray-text)]",
  red: "bg-[var(--color-status-red-bg)] text-[var(--color-status-red-text)]",
};

export default function StatusBadge({ status, dot = false }) {
  const variant = VARIANT_BY_STATUS[status?.toLowerCase()] || "gray";
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${VARIANT_CLASSES[variant]}`}
    >
      {dot && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />}
      {status}
    </span>
  );
}
