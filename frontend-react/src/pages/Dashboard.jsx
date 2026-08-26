import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Phone,
  Clock,
  UserPlus,
  DollarSign,
  Sparkles,
  ChevronRight,
  MessageSquare,
  Calendar,
  ArrowUpRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
} from "recharts";
import Card from "../components/Card";
import Avatar from "../components/Avatar";
import { LoadingState, ErrorState } from "../components/AsyncState";
import { getMeetings, getCrmRecords } from "../lib/api";

const SUGGESTED_QUESTIONS = [
  "Which calls today have the highest opportunity potential?",
  "What objections are we hearing most often?",
];

// Today's Priorities has no backend equivalent (no tasks/calendar entity) - kept as static content.
const PRIORITIES = [
  { icon: Phone, title: "Follow up with 12 calls", subtitle: "High priority follow-ups", time: "10:00 AM" },
  { icon: Calendar, title: "Demo with Globex Corp", subtitle: "Product walkthrough", time: "2:00 PM" },
  { icon: UserPlus, title: "Send proposal to Acme Corp", subtitle: "Pricing proposal", time: "4:30 PM" },
];

function isSameDay(isoString, date) {
  const d = new Date(isoString);
  return (
    d.getFullYear() === date.getFullYear() &&
    d.getMonth() === date.getMonth() &&
    d.getDate() === date.getDate()
  );
}

function countsByDay(items, dateField, days) {
  const now = new Date();
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(now);
    day.setDate(now.getDate() - i);
    const count = items.filter((item) => isSameDay(item[dateField], day)).length;
    result.push({
      day: day.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      calls: count,
    });
  }
  return result;
}

function trendLabel(today, yesterday) {
  if (yesterday === 0) return today > 0 ? "new today" : "no change";
  const pct = Math.round(((today - yesterday) / yesterday) * 100);
  return `${pct >= 0 ? "+" : ""}${pct}% vs yesterday`;
}

function StatCard({ icon: Icon, label, value, trend, spark }) {
  const data = spark.map((v, i) => ({ i, v }));
  return (
    <Card className="flex items-start justify-between">
      <div>
        <span className="mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-accent)]">
          <Icon className="h-[18px] w-[18px] text-[var(--color-primary)]" strokeWidth={2} />
        </span>
        <p className="text-sm font-medium text-[var(--color-text)]">{label}</p>
        <p className="mt-1 text-[28px] font-bold leading-none text-[var(--color-text)]">{value}</p>
        <p className="mt-2 text-xs text-[var(--color-text-muted)]">{trend}</p>
      </div>
      <div className="h-10 w-20 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <YAxis hide domain={["dataMin - 1", "dataMax + 1"]} />
            <Line type="monotone" dataKey="v" stroke="var(--color-primary)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState(null);
  const [crmRecords, setCrmRecords] = useState(null);
  const [error, setError] = useState(null);
  const [quickQuestion, setQuickQuestion] = useState("");

  function askFromDashboard(q) {
    const text = q.trim();
    if (!text) return;
    navigate("/ask-ai", { state: { question: text } });
  }

  useEffect(() => {
    Promise.all([getMeetings(), getCrmRecords()])
      .then(([meetingsData, crmData]) => {
        setMeetings(meetingsData);
        setCrmRecords(crmData);
      })
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <ErrorState message={error} />;
  if (!meetings || !crmRecords) return <LoadingState label="Loading dashboard..." />;

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const meetingsToday = meetings.filter((m) => isSameDay(m.created_at, today));
  const meetingsYesterday = meetings.filter((m) => isSameDay(m.created_at, yesterday));

  const followUpRecords = crmRecords.filter((r) => (r.call_outcome || "").toLowerCase().includes("follow"));
  const followUpToday = followUpRecords.filter((r) => isSameDay(r.created_at, today));
  const followUpYesterday = followUpRecords.filter((r) => isSameDay(r.created_at, yesterday));

  const crmToday = crmRecords.filter((r) => isSameDay(r.created_at, today));
  const crmYesterday = crmRecords.filter((r) => isSameDay(r.created_at, yesterday));

  const openRecords = crmRecords.filter((r) => {
    const outcome = (r.call_outcome || "").toLowerCase();
    return outcome && !outcome.includes("closed") && !outcome.includes("resolved");
  });
  const openToday = openRecords.filter((r) => isSameDay(r.created_at, today));
  const openYesterday = openRecords.filter((r) => isSameDay(r.created_at, yesterday));

  const stats = [
    {
      icon: Phone,
      label: "Today's Calls",
      value: meetingsToday.length,
      trend: trendLabel(meetingsToday.length, meetingsYesterday.length),
      spark: countsByDay(meetings, "created_at", 7).map((d) => d.calls),
    },
    {
      icon: Clock,
      label: "Calls Needing Follow-Up",
      value: followUpRecords.length,
      trend: trendLabel(followUpToday.length, followUpYesterday.length),
      spark: countsByDay(followUpRecords, "created_at", 7).map((d) => d.calls),
    },
    {
      icon: UserPlus,
      label: "New Contacts",
      value: crmRecords.length,
      trend: trendLabel(crmToday.length, crmYesterday.length),
      spark: countsByDay(crmRecords, "created_at", 7).map((d) => d.calls),
    },
    {
      icon: DollarSign,
      label: "Open Opportunities",
      value: openRecords.length,
      trend: trendLabel(openToday.length, openYesterday.length),
      spark: countsByDay(openRecords, "created_at", 7).map((d) => d.calls),
    },
  ];

  const crmByMeetingId = new Map(crmRecords.map((r) => [r.meeting_id, r]));
  const recentCalls = [...meetings]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 4)
    .map((m) => {
      const record = crmByMeetingId.get(m.id);
      const name = record && (record.first_name || record.last_name)
        ? [record.first_name, record.last_name].filter(Boolean).join(" ")
        : m.title;
      const initials = name
        .split(" ")
        .map((w) => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();
      return {
        id: m.id,
        initials,
        name,
        company: record?.company || "—",
        purpose: record?.reason_for_call || "—",
        time: new Date(m.created_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
      };
    });

  const callVolume = countsByDay(meetings, "created_at", 7);
  const totalCallVolume = callVolume.reduce((sum, d) => sum + d.calls, 0);

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-end gap-6">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            type="text"
            placeholder="Search calls, contacts, companies..."
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-2.5 pl-10 pr-4 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[var(--color-text)]">Recent Calls</h2>
            <button
              onClick={() => navigate("/calls")}
              className="flex items-center gap-1 text-sm font-medium text-[var(--color-primary)] transition-colors hover:text-[var(--color-accent-medium)]"
            >
              View all calls
            </button>
          </div>
          {recentCalls.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--color-text-muted)]">No meetings yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-[var(--color-text-muted)]">
                  <th className="pb-3 pr-4 font-normal">Caller</th>
                  <th className="pb-3 pr-4 font-normal">Company</th>
                  <th className="pb-3 pr-4 font-normal">Purpose</th>
                  <th className="pb-3 pr-4 font-normal">Time</th>
                  <th className="pb-3"></th>
                </tr>
              </thead>
              <tbody>
                {recentCalls.map((c) => (
                  <tr key={c.id} className="border-t border-[var(--color-border)]">
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-3">
                        <Avatar initials={c.initials} />
                        <span className="font-medium text-[var(--color-text)]">{c.name}</span>
                      </div>
                    </td>
                    <td className="py-2.5 pr-4 text-[var(--color-text-secondary)]">{c.company}</td>
                    <td className="py-2.5 pr-4 text-[var(--color-text-secondary)]">{c.purpose}</td>
                    <td className="whitespace-nowrap py-2.5 pr-4 text-[var(--color-text-secondary)]">{c.time}</td>
                    <td className="py-2.5 text-right">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-accent)] text-[var(--color-primary)]">
                        <Phone className="h-3.5 w-3.5" strokeWidth={2} />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card>
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="h-[18px] w-[18px] text-[var(--color-primary)]" strokeWidth={2} />
            <h2 className="text-lg font-semibold text-[var(--color-text)]">Quick Ask AI</h2>
          </div>
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
            <input
              type="text"
              value={quickQuestion}
              onChange={(e) => setQuickQuestion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && askFromDashboard(quickQuestion)}
              placeholder="Ask anything about your calls, contacts, or performance..."
              className="flex-1 bg-transparent text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none"
            />
            <button
              onClick={() => askFromDashboard(quickQuestion)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary)] text-white transition-colors hover:bg-[var(--color-primary-hover)] active:scale-95"
            >
              <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} />
            </button>
          </div>
          <div className="flex flex-col gap-2.5">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => askFromDashboard(q)}
                className="flex items-center justify-between gap-3 rounded-xl bg-[var(--color-accent)]/60 px-4 py-3 text-left text-sm text-[var(--color-text)] transition-colors hover:bg-[var(--color-accent)]"
              >
                <span className="flex items-center gap-2.5">
                  <MessageSquare className="h-4 w-4 shrink-0 text-[var(--color-text-secondary)]" strokeWidth={2} />
                  {q}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
              </button>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-[var(--color-text)]">Analytics Overview</h2>
          <p className="text-sm font-medium text-[var(--color-text)]">Call Volume</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-[28px] font-bold leading-none text-[var(--color-text)]">{totalCallVolume}</span>
          </div>
          <p className="mb-4 mt-1 text-xs text-[var(--color-text-muted)]">last 7 days</p>
          <div className="h-36 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={callVolume} margin={{ left: 16, right: 24, top: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="callVolumeFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                  tick={{ fill: "var(--color-text-muted)", fontSize: 12 }}
                  dy={8}
                />
                <Area
                  type="monotone"
                  dataKey="calls"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  fill="url(#callVolumeFill)"
                  dot={{ r: 3, fill: "var(--color-primary)", strokeWidth: 0 }}
                  activeDot={{ r: 4 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-semibold text-[var(--color-text)]">Today's Priorities</h2>
          <div className="flex flex-col">
            {PRIORITIES.map((p, i) => (
              <div
                key={p.title}
                className={`flex items-center gap-3 py-2.5 ${i > 0 ? "border-t border-[var(--color-border)]" : ""}`}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent)]">
                  <p.icon className="h-[18px] w-[18px] text-[var(--color-primary)]" strokeWidth={2} />
                </span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[var(--color-text)]">{p.title}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{p.subtitle}</p>
                </div>
                <span className="text-sm text-[var(--color-text-secondary)]">{p.time}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
