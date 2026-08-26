import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Sparkles,
  Play,
  Calendar,
  SlidersHorizontal,
  ArrowUpRight,
  Download,
  ThumbsUp,
  ThumbsDown,
  PieChart,
  Users,
  Clock,
  TrendingUp,
  MessageSquare,
  Check,
  Phone,
  ClipboardList,
  Loader2,
} from "lucide-react";
import Card from "../components/Card";
import Avatar from "../components/Avatar";
import StatusBadge from "../components/StatusBadge";
import Modal from "../components/Modal";
import { askCrm, getCrmRecord, getCrmRecords } from "../lib/api";
import { downloadCsv } from "../lib/csv";
import { toast } from "../lib/toast";

// No backend endpoint computes aggregate weekly insights - kept as static content.
const INSIGHTS = [
  { icon: PieChart, value: "3", label: "pricing-related calls this week" },
  { icon: Users, value: "2", label: "need follow-up (67%)" },
  { icon: Clock, value: "1.8 days", label: "avg. time since last call" },
  { icon: TrendingUp, value: "High", label: "interest level (based on sentiment)" },
];

const SUGGESTED_QUESTIONS = [
  "Which customers are waiting for us to follow-up?",
  "What did John from Acme say about pricing?",
  "Find everyone who mentioned needing more than 50 licenses.",
  "What are the most common reasons people have called this month?",
  "Who sounded interested but hasn't been contacted again?",
];

const MORE_SUGGESTED_QUESTIONS = [
  "Which calls had a negative sentiment?",
  "What companies have we spoken with this month?",
  "Summarize every call about support issues.",
];

const DATA_COVERAGE = [
  { icon: Users, label: "Contacts & CRM data" },
  { icon: Phone, label: "Call summaries" },
  { icon: ClipboardList, label: "Full transcripts" },
  { icon: Check, label: "Notes & tasks" },
];

const TIME_RANGES = ["All Time", "This Week", "This Month"];

function nameFor(record) {
  return [record.first_name, record.last_name].filter(Boolean).join(" ") || "Unknown";
}

function initialsFor(name) {
  return name.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

export default function AskAI() {
  const location = useLocation();
  const navigate = useNavigate();

  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [answer, setAnswer] = useState(null);
  const [results, setResults] = useState([]);
  const [recentQueries, setRecentQueries] = useState([]);
  const [showAllQueries, setShowAllQueries] = useState(false);
  const [showMoreSuggestions, setShowMoreSuggestions] = useState(false);
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [context, setContext] = useState("");
  const [feedback, setFeedback] = useState(null);

  const [allRecords, setAllRecords] = useState([]);
  const [timeRange, setTimeRange] = useState("All Time");
  const [ownerFilter, setOwnerFilter] = useState("All");
  const [reasonFilter, setReasonFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  useEffect(() => {
    getCrmRecords().then(setAllRecords).catch(() => {});
  }, []);

  const askedFromNav = useRef(false);
  useEffect(() => {
    if (location.state?.question && !askedFromNav.current) {
      askedFromNav.current = true;
      handleAsk(location.state.question);
      navigate(".", { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleAsk(q) {
    const base = (q ?? question).trim();
    if (!base) return;
    const text = context.trim() ? `${base} (context: ${context.trim()})` : base;
    setQuestion(base);
    setLoading(true);
    setError(null);
    setFeedback(null);

    askCrm(text)
      .then(async (res) => {
        setAnswer(res.answer);
        const records = await Promise.all(res.matched_call_ids.map((id) => getCrmRecord(id)));
        setResults(records);
        setRecentQueries((prev) => [{ text: base, time: "Just now" }, ...prev]);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  const reasonOptions = ["All", ...new Set(allRecords.map((r) => r.reason_for_call).filter(Boolean))];
  const statusOptions = ["All", ...new Set(allRecords.map((r) => r.call_outcome).filter(Boolean))];

  const displayedResults = results.filter((r) => {
    if (reasonFilter !== "All" && r.reason_for_call !== reasonFilter) return false;
    if (statusFilter !== "All" && r.call_outcome !== statusFilter) return false;
    if (timeRange !== "All Time") {
      const days = timeRange === "This Week" ? 7 : 31;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      if (new Date(r.created_at) < cutoff) return false;
    }
    return true;
  });

  const visibleQueries = showAllQueries ? recentQueries : recentQueries.slice(0, 5);
  const visibleSuggestions = showMoreSuggestions
    ? [...SUGGESTED_QUESTIONS, ...MORE_SUGGESTED_QUESTIONS]
    : SUGGESTED_QUESTIONS;

  return (
    <div className="grid grid-cols-[1fr_340px] gap-4">
      <div className="flex flex-col gap-3.5">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-[28px] font-bold text-[var(--color-text)]">Ask AI</h1>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Search across your calls, contacts, summaries, and transcripts.
            </p>
          </div>
          <button
            onClick={() => setHowItWorksOpen(true)}
            className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-accent)]/40"
          >
            <Play className="h-4 w-4 fill-current" />
            How Ask AI works
          </button>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border-2 border-[var(--color-accent)] bg-[var(--color-surface)] px-5 py-3">
          <Sparkles className="h-5 w-5 shrink-0 text-[var(--color-primary)]" />
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAsk()}
            placeholder="Ask anything about your calls, contacts, or performance..."
            className="flex-1 bg-transparent text-base text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none"
          />
          <button
            onClick={() => handleAsk()}
            disabled={loading}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary)] text-white transition-colors hover:bg-[var(--color-primary-hover)] active:scale-95 disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)]">
              <Calendar className="h-3.5 w-3.5" />
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="bg-transparent focus:outline-none"
              >
                {TIME_RANGES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)]">
              Owner:
              <select
                value={ownerFilter}
                onChange={(e) => setOwnerFilter(e.target.value)}
                className="bg-transparent focus:outline-none"
              >
                <option value="All">All</option>
                <option value="Sophia">Sophia</option>
              </select>
            </label>
            <label className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)]">
              Reason:
              <select
                value={reasonFilter}
                onChange={(e) => setReasonFilter(e.target.value)}
                className="bg-transparent focus:outline-none"
              >
                {reasonOptions.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)]">
              Status:
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-transparent focus:outline-none"
              >
                {statusOptions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>
          <button
            onClick={() => setAdvancedOpen((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Advanced Filters
          </button>
        </div>

        {advancedOpen && (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
            <label className="text-xs text-[var(--color-text-muted)]">
              Extra context to include with your question
              <input
                type="text"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="e.g. only calls with new leads"
                className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text)] focus:outline-none"
              />
            </label>
          </div>
        )}

        {error && <p className="text-sm text-[var(--color-status-red-text)]">{error}</p>}

        {answer && (
          <Card>
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-[var(--color-text)]">
              <Sparkles className="h-4 w-4 text-[var(--color-primary)]" />
              Answer
            </p>
            <p className="mb-3 whitespace-pre-wrap text-sm text-[var(--color-text-secondary)]">{answer}</p>

            {displayedResults.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-sm">
                  <thead>
                    <tr className="text-left text-xs text-[var(--color-text-muted)]">
                      <th className="pb-3 pr-4 font-normal">Name</th>
                      <th className="pb-3 pr-4 font-normal">Company</th>
                      <th className="pb-3 pr-4 font-normal">Last Called</th>
                      <th className="pb-3 pr-4 font-normal">Reason</th>
                      <th className="pb-3 pr-4 font-normal">AI Summary</th>
                      <th className="pb-3 pr-4 font-normal">Next Step</th>
                      <th className="pb-3 font-normal">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedResults.map((r) => {
                      const name = nameFor(r);
                      return (
                        <tr key={r.id} className="border-t border-[var(--color-border)]">
                          <td className="py-2 pr-4">
                            <div className="flex items-center gap-3">
                              <Avatar initials={initialsFor(name)} size="sm" />
                              <span className="font-medium text-[var(--color-text)]">{name}</span>
                            </div>
                          </td>
                          <td className="py-2 pr-4 text-[var(--color-text-secondary)]">{r.company || "—"}</td>
                          <td className="whitespace-nowrap py-2 pr-4 text-[var(--color-text-secondary)]">
                            {new Date(r.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-2 pr-4 text-[var(--color-text-secondary)]">{r.reason_for_call || "—"}</td>
                          <td className="py-2 pr-4 text-[var(--color-text-secondary)]">{r.call_summary || "—"}</td>
                          <td className="py-2 pr-4 text-[var(--color-text-secondary)]">{r.next_action || "—"}</td>
                          <td className="py-2">
                            {r.call_outcome ? <StatusBadge status={r.call_outcome} /> : <span className="text-xs text-[var(--color-text-muted)]">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {results.length > 0 && displayedResults.length === 0 && (
              <p className="text-sm text-[var(--color-text-muted)]">No matches with the current filters.</p>
            )}

            <div className="mt-3 flex items-center justify-between border-t border-[var(--color-border)] pt-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigate("/crm")}
                  className="rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-accent)]/40"
                >
                  View Full List
                </button>
                <button
                  onClick={() => {
                    if (displayedResults.length === 0) {
                      toast("Nothing to export.", "info");
                      return;
                    }
                    downloadCsv(
                      "ask-ai-results.csv",
                      displayedResults.map((r) => ({
                        name: nameFor(r),
                        company: r.company || "",
                        last_called: r.created_at,
                        reason: r.reason_for_call || "",
                        summary: r.call_summary || "",
                        next_step: r.next_action || "",
                        status: r.call_outcome || "",
                      }))
                    );
                    toast("Results exported.");
                  }}
                  className="flex items-center gap-1.5 rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-accent)]/40"
                >
                  <Download className="h-3.5 w-3.5" />
                  Export Results
                </button>
              </div>
              <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
                Was this helpful?
                <button
                  onClick={() => {
                    setFeedback("up");
                    toast("Thanks for the feedback!");
                  }}
                  className={`flex h-7 w-7 items-center justify-center rounded-lg hover:bg-[var(--color-accent)]/40 ${feedback === "up" ? "bg-[var(--color-accent)] text-[var(--color-primary)]" : ""}`}
                >
                  <ThumbsUp className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => {
                    setFeedback("down");
                    toast("Thanks for the feedback!");
                  }}
                  className={`flex h-7 w-7 items-center justify-center rounded-lg hover:bg-[var(--color-accent)]/40 ${feedback === "down" ? "bg-[var(--color-accent)] text-[var(--color-primary)]" : ""}`}
                >
                  <ThumbsDown className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </Card>
        )}

        <Card>
          <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-[var(--color-text)]">
            <Sparkles className="h-4 w-4 text-[var(--color-primary)]" />
            Insights
          </p>
          <div className="grid grid-cols-4 gap-3">
            {INSIGHTS.map((ins) => (
              <div key={ins.label} className="flex items-start gap-3 rounded-xl bg-[var(--color-accent)]/40 p-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)]">
                  <ins.icon className="h-4 w-4 text-[var(--color-primary)]" />
                </span>
                <div>
                  <p className="font-bold text-[var(--color-text)]">{ins.value}</p>
                  <p className="text-xs leading-tight text-[var(--color-text-muted)]">{ins.label}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <p className="text-center text-xs text-[var(--color-text-muted)]">
          AI responses may be inaccurate. Please review important information.
        </p>
      </div>

      <div className="flex flex-col gap-3.5">
        <Card>
          <p className="mb-3 text-sm font-semibold text-[var(--color-text)]">Suggested Questions</p>
          <div className="flex flex-col gap-1.5">
            {visibleSuggestions.map((q) => (
              <button
                key={q}
                onClick={() => handleAsk(q)}
                className="flex items-start justify-between gap-2 rounded-xl bg-[var(--color-accent)]/40 px-3 py-2 text-left text-xs leading-snug text-[var(--color-text)] hover:bg-[var(--color-accent)]"
              >
                <span className="flex items-start gap-2">
                  <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-text-secondary)]" />
                  {q}
                </span>
              </button>
            ))}
          </div>
          {!showMoreSuggestions && (
            <button
              onClick={() => setShowMoreSuggestions(true)}
              className="mt-2 flex w-full items-center justify-center rounded-xl border border-[var(--color-border)] py-1.5 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-accent)]/40"
            >
              View all suggestions
            </button>
          )}
        </Card>

        <Card>
          <p className="mb-3 text-sm font-semibold text-[var(--color-text)]">Recent Queries</p>
          {recentQueries.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">Nothing asked yet this session.</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {visibleQueries.map((q, i) => (
                <button
                  key={i}
                  onClick={() => handleAsk(q.text)}
                  className="flex items-center justify-between gap-2 text-left text-sm hover:text-[var(--color-accent-medium)]"
                >
                  <span className="text-[var(--color-text)]">{q.text}</span>
                  <span className="shrink-0 text-xs text-[var(--color-text-muted)]">{q.time}</span>
                </button>
              ))}
            </div>
          )}
          {recentQueries.length > 5 && !showAllQueries && (
            <button
              onClick={() => setShowAllQueries(true)}
              className="mt-2 flex w-full items-center justify-center rounded-xl border border-[var(--color-border)] py-1.5 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-accent)]/40"
            >
              View all queries
            </button>
          )}
        </Card>

        <Card>
          <p className="mb-3 text-sm font-semibold text-[var(--color-text)]">Data Coverage</p>
          <p className="mb-3 text-xs text-[var(--color-text-muted)]">AI searches across the following:</p>
          <div className="flex flex-col gap-2.5">
            {DATA_COVERAGE.map((d) => (
              <div key={d.label} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-[var(--color-text-secondary)]">
                  <d.icon className="h-4 w-4 text-[var(--color-text-muted)]" />
                  {d.label}
                </span>
                <Check className="h-4 w-4 text-[var(--color-status-green-text)]" />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Modal open={howItWorksOpen} onClose={() => setHowItWorksOpen(false)} title="How Ask AI works">
        <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
          Ask AI keyword-searches your saved CRM records (reason, summary, and extracted details) for the
          most relevant matches to your question, then sends only those matches to the AI model to generate
          an answer — not your entire call history. That keeps answers grounded in real data and avoids
          sending unrelated transcripts. Results below the answer are the actual matched records.
        </p>
      </Modal>
    </div>
  );
}
