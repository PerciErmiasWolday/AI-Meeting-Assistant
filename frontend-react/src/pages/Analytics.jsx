import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  ChevronDown,
  Upload,
  Phone,
  CheckCircle2,
  Users,
  Clock,
  Bell,
  Tag,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis } from "recharts";
import Card from "../components/Card";
import Popover from "../components/Popover";
import { LoadingState, ErrorState } from "../components/AsyncState";
import { getMeetings, getCrmRecords } from "../lib/api";
import { downloadCsv } from "../lib/csv";
import { toast } from "../lib/toast";

// No backend endpoint generates on-demand aggregate insight text (would need an
// LLM summarization pass over the whole dataset) - kept as static content.
const AI_INSIGHTS = [
  { icon: Tag, lead: "Pricing", text: "is a common reason for calls, based on the reasons logged so far." },
  { icon: Users, lead: "Customers mentioning teams larger than 50 employees", text: "are taking longer to receive follow-ups." },
  { icon: Clock, lead: "Some customers", text: "showed strong interest during their latest call but have not been contacted again." },
];

const RANGES = ["This Month", "Last Month", "All Time"];

function isWithinRange(iso, range) {
  const d = new Date(iso);
  const now = new Date();
  if (range === "All Time") return true;
  if (range === "This Month") {
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return d.getFullYear() === lastMonth.getFullYear() && d.getMonth() === lastMonth.getMonth();
}

function daysAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

export default function Analytics() {
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState(null);
  const [crmRecords, setCrmRecords] = useState(null);
  const [error, setError] = useState(null);
  const [range, setRange] = useState("All Time");
  const [rangeOpen, setRangeOpen] = useState(false);

  useEffect(() => {
    Promise.all([getMeetings(), getCrmRecords()])
      .then(([m, c]) => {
        setMeetings(m);
        setCrmRecords(c);
      })
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <ErrorState message={error} />;
  if (!meetings || !crmRecords) return <LoadingState label="Loading analytics..." />;

  const meetingsInRange = meetings.filter((m) => isWithinRange(m.created_at, range));
  const recordsInRange = crmRecords.filter((r) => isWithinRange(r.created_at, range));

  const followUpRecords = recordsInRange.filter((r) => (r.call_outcome || "").toLowerCase().includes("follow"));
  const followUpRate = recordsInRange.length > 0 ? Math.round((followUpRecords.length / recordsInRange.length) * 100) : 0;

  const durations = meetingsInRange.map((m) => m.duration).filter((d) => d != null);
  const avgDurationSec = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : null;
  const avgDurationLabel = avgDurationSec == null
    ? "—"
    : `${Math.floor(avgDurationSec / 60)}m ${Math.round(avgDurationSec % 60)}s`;

  const stats = [
    { icon: Phone, label: "Total Calls", value: String(meetingsInRange.length) },
    { icon: CheckCircle2, label: "Follow-Up Rate", value: `${followUpRate}%`, trendLabel: `${followUpRecords.length} calls` },
    { icon: Users, label: "New Contacts", value: String(recordsInRange.length) },
    { icon: Clock, label: "Avg. Call Duration", value: avgDurationLabel },
  ];

  const callsOverTime = (() => {
    const days = 7;
    const now = new Date();
    const out = [];
    for (let i = days - 1; i >= 0; i--) {
      const day = new Date(now);
      day.setDate(now.getDate() - i);
      const count = meetings.filter((m) => {
        const d = new Date(m.created_at);
        return d.toDateString() === day.toDateString();
      }).length;
      out.push({ day: day.toLocaleDateString(undefined, { month: "short", day: "numeric" }), calls: count });
    }
    return out;
  })();

  const reasonCounts = {};
  recordsInRange.forEach((r) => {
    const reason = r.reason_for_call || "Unspecified";
    reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
  });
  const topReasons = Object.entries(reasonCounts)
    .map(([label, count]) => ({ label, pct: recordsInRange.length > 0 ? Math.round((count / recordsInRange.length) * 100) : 0 }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 6);

  const overdueFollowUps = followUpRecords.filter((r) => daysAgo(r.created_at) >= 3);
  const avgResponseDays = followUpRecords.length > 0
    ? (followUpRecords.reduce((sum, r) => sum + daysAgo(r.created_at), 0) / followUpRecords.length).toFixed(1)
    : "0";

  const followUpStats = [
    { icon: Bell, value: String(followUpRecords.length), label: "Need Follow-Up" },
    { icon: Clock, value: String(overdueFollowUps.length), label: "Overdue Follow-Ups" },
    { icon: Clock, value: `${avgResponseDays} days`, label: "Avg. Days Waiting" },
  ];

  function exportAnalytics() {
    if (recordsInRange.length === 0) {
      toast("Nothing to export for this range.", "info");
      return;
    }
    downloadCsv(
      "analytics.csv",
      recordsInRange.map((r) => ({
        name: [r.first_name, r.last_name].filter(Boolean).join(" ") || "Unknown",
        company: r.company || "",
        reason: r.reason_for_call || "",
        status: r.call_outcome || "",
        created_at: r.created_at,
      }))
    );
    toast("Analytics exported.");
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-[28px] font-bold text-[var(--color-text)]">Analytics</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Understand your calls and customer conversations.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              onClick={() => setRangeOpen((v) => !v)}
              className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-accent)]/40"
            >
              <Calendar className="h-4 w-4" />
              {range}
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            <Popover open={rangeOpen} onClose={() => setRangeOpen(false)} anchorClassName="right-0">
              {RANGES.map((r) => (
                <button
                  key={r}
                  onClick={() => { setRange(r); setRangeOpen(false); }}
                  className={`block w-full rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-[var(--color-accent)]/40 ${range === r ? "font-semibold text-[var(--color-primary)]" : "text-[var(--color-text)]"}`}
                >
                  {r}
                </button>
              ))}
            </Popover>
          </div>
          <button className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-accent)]/40">
            All Employees: Sophia
          </button>
          <button
            onClick={exportAnalytics}
            className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-accent)]/40"
          >
            <Upload className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3.5">
        {stats.map((s) => (
          <Card key={s.label}>
            <span className="mb-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-accent)]">
              <s.icon className="h-[18px] w-[18px] text-[var(--color-primary)]" strokeWidth={2} />
            </span>
            <p className="text-sm font-medium text-[var(--color-text)]">{s.label}</p>
            <p className="mt-1 text-[28px] font-bold leading-none text-[var(--color-text)]">{s.value}</p>
            {s.trendLabel && <p className="mt-2 text-xs text-[var(--color-text-muted)]">{s.trendLabel}</p>}
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3.5">
        <Card>
          <h2 className="mb-3 text-lg font-semibold text-[var(--color-text)]">Calls Over Time</h2>
          <div className="h-36 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={callsOverTime} margin={{ left: -20, right: 16, top: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="callsOverTimeFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStart"
                  tick={{ fill: "var(--color-text-muted)", fontSize: 12 }}
                  dy={8}
                />
                <YAxis tickLine={false} axisLine={false} allowDecimals={false} tick={{ fill: "var(--color-text-muted)", fontSize: 12 }} />
                <Area
                  type="monotone"
                  dataKey="calls"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  fill="url(#callsOverTimeFill)"
                  dot={{ r: 3, fill: "var(--color-primary)", strokeWidth: 0 }}
                  activeDot={{ r: 4 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-semibold text-[var(--color-text)]">Top Reasons for Calls</h2>
          {topReasons.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">No CRM data in this range yet.</p>
          ) : (
            <div className="flex flex-col gap-3.5">
              {topReasons.map((r) => (
                <div key={r.label} className="flex items-center gap-3">
                  <span className="w-44 shrink-0 truncate text-sm text-[var(--color-text)]" title={r.label}>{r.label}</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--color-accent)]/50">
                    <div className="h-full rounded-full bg-[var(--color-primary)]" style={{ width: `${r.pct * 2.6}%` }} />
                  </div>
                  <span className="w-9 shrink-0 text-right text-sm text-[var(--color-text-secondary)]">{r.pct}%</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3.5">
        <Card>
          <h2 className="mb-2.5 text-lg font-semibold text-[var(--color-text)]">Follow-Ups</h2>
          <div className="mb-2.5 grid grid-cols-3 gap-2">
            {followUpStats.map((f) => (
              <div key={f.label} className="flex items-start gap-2.5 rounded-xl bg-[var(--color-accent)]/40 p-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)]">
                  <f.icon className="h-4 w-4 text-[var(--color-primary)]" />
                </span>
                <div>
                  <p className="font-bold text-[var(--color-text)]">{f.value}</p>
                  <p className="text-xs leading-tight text-[var(--color-text-muted)]">{f.label}</p>
                </div>
              </div>
            ))}
          </div>

          {followUpRecords.length === 0 ? (
            <p className="py-4 text-center text-sm text-[var(--color-text-muted)]">No follow-ups needed right now.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-[var(--color-text-muted)]">
                  <th className="pb-1.5 font-normal">Customer</th>
                  <th className="pb-1.5 font-normal">Reason</th>
                  <th className="pb-1.5 font-normal">Last Contact</th>
                  <th className="pb-1.5 font-normal">Next Step</th>
                  <th className="pb-1.5 text-right font-normal">Waiting</th>
                </tr>
              </thead>
              <tbody>
                {followUpRecords.slice(0, 5).map((r) => (
                  <tr key={r.id} className="border-t border-[var(--color-border)]">
                    <td className="py-1.5 font-medium text-[var(--color-text)]">
                      {[r.first_name, r.last_name].filter(Boolean).join(" ") || "Unknown"}
                    </td>
                    <td className="py-1.5 text-[var(--color-text-secondary)]">{r.reason_for_call || "—"}</td>
                    <td className="py-1.5 text-[var(--color-text-secondary)]">
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-1.5 text-[var(--color-text-secondary)]">{r.next_action || "—"}</td>
                    <td className="py-1.5 text-right font-medium text-[var(--color-primary)]">{daysAgo(r.created_at)}d</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <button
            onClick={() => navigate("/crm", { state: { followUpOnly: true } })}
            className="mt-2.5 flex items-center gap-1.5 rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-accent)]/40"
          >
            View All Follow-Ups
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </Card>

        <Card>
          <p className="mb-2.5 flex items-center gap-1.5 text-lg font-semibold text-[var(--color-text)]">
            <Sparkles className="h-4 w-4 text-[var(--color-primary)]" />
            AI Insight
          </p>
          <div className="flex flex-col gap-3 rounded-xl bg-[var(--color-accent)]/40 p-3.5">
            {AI_INSIGHTS.map((ins, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)]">
                  <ins.icon className="h-3.5 w-3.5 text-[var(--color-primary)]" />
                </span>
                <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
                  <span className="font-semibold text-[var(--color-text)]">{ins.lead}</span> {ins.text}
                </p>
              </div>
            ))}
          </div>
          <button
            onClick={() => navigate("/ask-ai", { state: { question: "What's driving the most common reasons customers are calling?" } })}
            className="mt-3 flex items-center gap-1.5 rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-accent)]/40"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Ask AI About This
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </Card>
      </div>
    </div>
  );
}
