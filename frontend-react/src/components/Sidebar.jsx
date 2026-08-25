import { NavLink } from "react-router-dom";
import {
  AudioLines,
  Home,
  Phone,
  Users,
  Sparkles,
  BarChart3,
  Settings,
  ChevronDown,
} from "lucide-react";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: Home },
  { to: "/calls", label: "Calls", icon: Phone },
  { to: "/crm", label: "CRM", icon: Users },
  { to: "/ask-ai", label: "Ask AI", icon: Sparkles },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  return (
    <aside className="flex h-screen w-[310px] shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-6">
      <div className="mb-7 flex items-center gap-3 px-2">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)]">
          <AudioLines className="h-5 w-5 text-[var(--color-primary)]" strokeWidth={2.25} />
        </span>
        <div className="leading-tight">
          <p className="text-[15px] font-bold text-[var(--color-text)]">AI Call Intelligence</p>
          <p className="text-xs text-[var(--color-text-muted)]">CRM</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-3">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3.5 py-4 text-sm font-medium transition-colors duration-150 ${
                isActive
                  ? "bg-[var(--color-accent)] text-[var(--color-accent-strong)]"
                  : "text-[var(--color-text-secondary)] hover:bg-[var(--color-accent)]/50 hover:text-[var(--color-text)]"
              }`
            }
          >
            <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
            {label}
          </NavLink>
        ))}
      </nav>

      <button className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-left transition-colors duration-150 hover:bg-[var(--color-accent)]/40">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)] text-xs font-semibold text-[var(--color-accent-strong)]">
          SJ
        </span>
        <span className="flex-1 leading-tight">
          <p className="text-sm font-semibold text-[var(--color-text)]">Sophia Johnson</p>
          <p className="text-xs text-[var(--color-text-muted)]">Admin</p>
        </span>
        <ChevronDown className="h-4 w-4 text-[var(--color-text-muted)]" />
      </button>
    </aside>
  );
}
