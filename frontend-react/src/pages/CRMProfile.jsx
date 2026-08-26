import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Users,
  Plus,
  MoreVertical,
  Sparkles,
  Phone,
  FileText,
  MoreHorizontal,
  ClipboardList,
  Trash2,
} from "lucide-react";
import Card from "../components/Card";
import Avatar from "../components/Avatar";
import StatusBadge from "../components/StatusBadge";
import Popover from "../components/Popover";
import { LoadingState, ErrorState } from "../components/AsyncState";
import { getCrmRecord, deleteCrmRecord } from "../lib/api";
import { toast } from "../lib/toast";

const EMPTY_TAB_MESSAGE = {
  Notes: "No notes yet.",
  Files: "No files attached yet.",
  Tasks: "No tasks yet.",
  Activity: "No activity recorded yet.",
};

const TABS = ["Overview", "Call History", "Notes", "Files", "Tasks", "Activity"];

function nameFor(record) {
  return [record.first_name, record.last_name].filter(Boolean).join(" ") || "Unknown";
}

function initialsFor(name) {
  return name.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

function formatDuration(seconds) {
  if (seconds == null) return "—";
  const m = Math.round(seconds / 60);
  return `${m}m`;
}

export default function CRMProfile() {
  const navigate = useNavigate();
  const { contactId } = useParams();
  const [activeTab, setActiveTab] = useState("Overview");
  const [record, setRecord] = useState(null);
  const [error, setError] = useState(null);
  const [kebabOpen, setKebabOpen] = useState(false);

  useEffect(() => {
    getCrmRecord(contactId).then(setRecord).catch((err) => setError(err.message));
  }, [contactId]);

  if (error) return <ErrorState message={error} />;
  if (!record) return <LoadingState label="Loading contact..." />;

  const name = nameFor(record);
  const callDate = record.meeting_created_at || record.created_at;

  function handleDelete() {
    if (!window.confirm(`Delete ${name}? This can't be undone.`)) return;
    setKebabOpen(false);
    deleteCrmRecord(record.id)
      .then(() => {
        toast("Contact deleted.");
        navigate("/crm");
      })
      .catch((err) => toast(err.message, "info"));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate("/crm")}
          className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to contacts
        </button>
        <button
          onClick={() => navigate("/calls", { state: { openUpload: true } })}
          className="flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-primary-hover)]"
        >
          <Plus className="h-4 w-4" />
          Log New Call
        </button>
      </div>

      <div className="grid grid-cols-[1fr_360px] gap-4">
        <div className="flex flex-col gap-4">
          <Card>
            <div className="mb-3 flex items-start justify-between">
              <div className="flex items-center gap-4">
                <Avatar initials={initialsFor(name)} size="lg" />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-xl font-bold text-[var(--color-text)]">{name}</p>
                    {record.call_outcome && <StatusBadge status={record.call_outcome} dot />}
                  </div>
                  <p className="text-sm text-[var(--color-text-secondary)]">{record.company || "—"}</p>
                  <p className="mt-1 text-sm text-[var(--color-text-muted)]">{record.phone_number || "No phone on record"}</p>
                </div>
              </div>
              <div className="relative">
                <button
                  onClick={() => setKebabOpen((v) => !v)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-accent)]/40"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
                <Popover open={kebabOpen} onClose={() => setKebabOpen(false)} anchorClassName="right-0">
                  <button
                    onClick={handleDelete}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm text-[var(--color-status-red-text)] hover:bg-[var(--color-status-red-bg)]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete contact
                  </button>
                </Popover>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4 border-t border-[var(--color-border)] pt-3">
              <div>
                <p className="mb-1.5 text-xs text-[var(--color-text-muted)]">Current Status</p>
                {record.call_outcome ? <StatusBadge status={record.call_outcome} /> : <span className="text-sm text-[var(--color-text-muted)]">—</span>}
              </div>
              <div>
                <p className="mb-1.5 text-xs text-[var(--color-text-muted)]">Latest Need</p>
                <p className="text-sm font-medium text-[var(--color-text)]">{record.reason_for_call || "—"}</p>
              </div>
              <div>
                <p className="mb-1.5 text-xs text-[var(--color-text-muted)]">Next Step</p>
                <p className="text-sm font-medium text-[var(--color-text)]">{record.next_action || "—"}</p>
              </div>
              <div>
                <p className="mb-1.5 text-xs text-[var(--color-text-muted)]">Owner</p>
                <div className="flex items-center gap-2">
                  <Avatar initials="S" size="sm" />
                  <span className="text-sm font-medium text-[var(--color-text)]">Sophia</span>
                </div>
              </div>
            </div>
          </Card>

          <div className="flex gap-5 border-b border-[var(--color-border)]">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`border-b-2 pb-2.5 text-sm font-medium transition-colors ${
                  activeTab === t
                    ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                    : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {(activeTab === "Overview" || activeTab === "Call History") && (
            <Card>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-lg font-semibold text-[var(--color-text)]">Call History</p>
              </div>
              <div className="flex gap-4 py-2.5">
                <span className="h-2.5 w-2.5 shrink-0 translate-y-1 rounded-full border-2 border-[var(--color-accent-strong)]" />
                <div className="flex flex-1 items-start justify-between gap-4">
                  <div className="flex gap-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)] text-[var(--color-primary)]">
                      <Phone className="h-3.5 w-3.5" />
                    </span>
                    <div>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {new Date(callDate).toLocaleString()} · {formatDuration(record.meeting_duration)}
                      </p>
                      <p className="mt-0.5 font-semibold text-[var(--color-text)]">{record.reason_for_call || "Call"}</p>
                      <p className="mt-0.5 max-w-lg text-sm text-[var(--color-text-secondary)]">
                        {record.call_summary || "No summary available."}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
                    <FileText className="h-4 w-4" />
                    <MoreHorizontal className="h-4 w-4" />
                  </div>
                </div>
              </div>
              <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                This contact has one logged call. Additional calls linked to the same person will appear here once saved.
              </p>
            </Card>
          )}

          {EMPTY_TAB_MESSAGE[activeTab] && (
            <Card>
              <p className="py-6 text-center text-sm text-[var(--color-text-muted)]">{EMPTY_TAB_MESSAGE[activeTab]}</p>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-[var(--color-text)]">
              <Sparkles className="h-4 w-4 text-[var(--color-primary)]" />
              AI Summary
            </p>
            <p className="rounded-xl bg-[var(--color-accent)]/50 p-3 text-sm leading-relaxed text-[var(--color-text-secondary)]">
              {record.call_summary || "No summary extracted for this contact."}
            </p>
          </Card>

          <Card>
            <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-[var(--color-text)]">
              <Users className="h-4 w-4 text-[var(--color-primary)]" />
              Key Information Extracted
            </p>
            {record.important_details.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)]">Nothing extracted.</p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {record.important_details.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-[var(--color-text-secondary)]">
                    <ClipboardList className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)]" />
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <p className="mb-3 text-sm font-semibold text-[var(--color-text)]">Contact Insights</p>
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--color-text-muted)]">First Contacted</span>
                <span className="font-medium text-[var(--color-text)]">{new Date(callDate).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--color-text-muted)]">Total Calls</span>
                <span className="font-medium text-[var(--color-text)]">1</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--color-text-muted)]">Call Duration</span>
                <span className="font-medium text-[var(--color-text)]">{formatDuration(record.meeting_duration)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--color-text-muted)]">Sentiment</span>
                <span className="font-medium text-[var(--color-text)]">{record.sentiment || "—"}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
