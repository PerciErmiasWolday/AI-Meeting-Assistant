export default function PagePlaceholder({ title }) {
  return (
    <div className="flex h-[70vh] items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] text-[var(--color-text-muted)]">
      {title} page — content coming soon
    </div>
  );
}
