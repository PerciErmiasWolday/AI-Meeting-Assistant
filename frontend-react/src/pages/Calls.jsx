import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Search,
  Filter,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  MoreVertical,
  FileText,
  MessageSquare,
  ListChecks,
  CheckSquare,
  Database,
  Copy,
  Sparkles,
  Trash2,
  UploadCloud,
} from "lucide-react";
import Card from "../components/Card";
import Avatar from "../components/Avatar";
import StatusBadge from "../components/StatusBadge";
import Popover from "../components/Popover";
import UploadModal from "../components/UploadModal";
import { LoadingState, ErrorState } from "../components/AsyncState";
import { getMeetings, getMeeting, getCrmRecords, extractCrm, saveCrm, deleteMeeting } from "../lib/api";
import { toast } from "../lib/toast";

const PAGE_SIZE = 6;

const TABS = [
  { key: "transcript", label: "Transcript", icon: FileText },
  { key: "summary", label: "Summary", icon: MessageSquare },
  { key: "key-points", label: "Key Points", icon: ListChecks },
  { key: "action-items", label: "Action Items", icon: CheckSquare },
  { key: "crm-extraction", label: "CRM Extraction", icon: Database },
];

const CRM_FORM_FIELDS = [
  ["first_name", "First name"],
  ["last_name", "Last name"],
  ["phone_number", "Phone"],
  ["company", "Company"],
  ["reason_for_call", "Reason for call"],
  ["next_action", "Next action"],
  ["call_outcome", "Outcome / status"],
  ["sentiment", "Sentiment"],
];

function initialsFor(name) {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatDuration(seconds) {
  if (seconds == null) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function Calls() {
  const navigate = useNavigate();
  const location = useLocation();

  const [meetings, setMeetings] = useState(null);
  const [crmRecords, setCrmRecords] = useState([]);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("transcript");

  const [crmData, setCrmData] = useState(null); // extracted or saved CRM fields for the selected meeting
  const [crmLoading, setCrmLoading] = useState(false);
  const [crmError, setCrmError] = useState(null);
  const [crmSaved, setCrmSaved] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [kebabOpen, setKebabOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [uploadOpen, setUploadOpen] = useState(Boolean(location.state?.openUpload));

  function loadData(selectNewestId) {
    return Promise.all([getMeetings(), getCrmRecords()])
      .then(([meetingsData, crmData]) => {
        setMeetings(meetingsData);
        setCrmRecords(crmData);
        if (selectNewestId != null) {
          setSelectedId(selectNewestId);
        } else if (meetingsData.length > 0 && selectedId == null) {
          setSelectedId(meetingsData[0].id);
        }
      })
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    loadData();
    if (location.state?.openUpload) navigate(".", { replace: true, state: {} });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedId == null) return;
    setDetailLoading(true);
    setDetail(null);
    setCrmData(null);
    setCrmError(null);
    setCrmSaved(false);
    setActiveTab("transcript");
    getMeeting(selectedId)
      .then((data) => {
        setDetail(data);
        // CRM data now auto-saves on upload, so most calls will already have a
        // CallRecord by the time they're opened here - show that saved data
        // (and lock the Save button, since there's no update endpoint yet).
        // Only fall back to the unsaved draft/error state for calls where the
        // auto-save didn't happen (extraction failed, or the CRM write itself
        // failed after a successful extraction).
        const savedRecord = crmRecords.find((r) => r.meeting_id === selectedId);
        if (savedRecord) {
          setCrmData(savedRecord);
          setCrmSaved(true);
        } else if (data.crm_extraction_status === "ready" && data.crm_extraction) {
          setCrmData(data.crm_extraction);
        } else if (data.crm_extraction_status === "failed") {
          setCrmError("Automatic extraction failed for this call. Click below to retry.");
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setDetailLoading(false));
  }, [selectedId, crmRecords]);

  if (error) return <ErrorState message={error} />;
  if (!meetings) return <LoadingState label="Loading calls..." />;

  const selectedMeeting = meetings.find((m) => m.id === selectedId);

  const crmByMeetingId = new Map(crmRecords.map((r) => [r.meeting_id, r]));
  const statusOptions = ["All", ...new Set(crmRecords.map((r) => r.call_outcome).filter(Boolean))];

  const filteredMeetings = meetings.filter((m) => {
    const record = crmByMeetingId.get(m.id);
    const name = record && (record.first_name || record.last_name)
      ? [record.first_name, record.last_name].filter(Boolean).join(" ")
      : m.title;

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const haystack = [name, record?.company, record?.reason_for_call].filter(Boolean).join(" ").toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (statusFilter !== "All" && record?.call_outcome !== statusFilter) return false;
    if (dateFrom && new Date(m.created_at) < new Date(dateFrom)) return false;
    if (dateTo && new Date(m.created_at) > new Date(`${dateTo}T23:59:59`)) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredMeetings.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedMeetings = filteredMeetings.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function clearFilters() {
    setSearchQuery("");
    setStatusFilter("All");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  }

  function handleDeleteMeeting() {
    if (!selectedMeeting) return;
    if (!window.confirm(`Delete "${selectedMeeting.title}"? This can't be undone.`)) return;
    setKebabOpen(false);
    deleteMeeting(selectedMeeting.id)
      .then(() => {
        const remaining = meetings.filter((m) => m.id !== selectedMeeting.id);
        setMeetings(remaining);
        setSelectedId(remaining.length > 0 ? remaining[0].id : null);
        toast("Meeting deleted.");
      })
      .catch((err) => toast(err.message, "info"));
  }

  function handleExtract() {
    setCrmLoading(true);
    setCrmError(null);
    extractCrm(selectedId)
      .then((data) => {
        setCrmData(data);
        setMeetings((prev) =>
          prev.map((m) => (m.id === selectedId ? { ...m, crm_extraction_status: "ready" } : m))
        );
      })
      .catch((err) => {
        setCrmError(err.message);
        setMeetings((prev) =>
          prev.map((m) => (m.id === selectedId ? { ...m, crm_extraction_status: "failed" } : m))
        );
      })
      .finally(() => setCrmLoading(false));
  }

  function handleSave() {
    setCrmLoading(true);
    setCrmError(null);
    saveCrm(selectedId, crmData)
      .then(() => setCrmSaved(true))
      .catch((err) => setCrmError(err.message))
      .finally(() => setCrmLoading(false));
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-[28px] font-bold text-[var(--color-text)]">Calls</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Review call history, recordings, and AI-generated insights.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setUploadOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-hover)]"
          >
            <UploadCloud className="h-4 w-4" />
            Upload Recording
          </button>
          <div className="relative w-72">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search calls, contacts, companies..."
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-2.5 pl-10 pr-4 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
            />
          </div>
          <div className="relative">
            <button
              onClick={() => setFiltersOpen((v) => !v)}
              className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 text-sm font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-accent)]/40"
            >
              <Filter className="h-4 w-4" />
              Filters{statusFilter !== "All" ? ` (1)` : ""}
            </button>
            <Popover open={filtersOpen} onClose={() => setFiltersOpen(false)}>
              <p className="mb-1.5 px-1 text-xs font-medium text-[var(--color-text-muted)]">Status</p>
              {statusOptions.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setStatusFilter(s);
                    setPage(1);
                    setFiltersOpen(false);
                  }}
                  className={`block w-full rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-[var(--color-accent)]/40 ${
                    statusFilter === s ? "font-semibold text-[var(--color-primary)]" : "text-[var(--color-text)]"
                  }`}
                >
                  {s}
                </button>
              ))}
            </Popover>
          </div>
          <div className="relative">
            <button
              onClick={() => setDateOpen((v) => !v)}
              className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 text-sm font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-accent)]/40"
            >
              <Calendar className="h-4 w-4" />
              Date range{dateFrom || dateTo ? " (1)" : ""}
            </button>
            <Popover open={dateOpen} onClose={() => setDateOpen(false)} anchorClassName="right-0">
              <div className="flex flex-col gap-2 p-1">
                <label className="text-xs text-[var(--color-text-muted)]">
                  From
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                    className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-2 py-1 text-sm text-[var(--color-text)]"
                  />
                </label>
                <label className="text-xs text-[var(--color-text-muted)]">
                  To
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                    className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-2 py-1 text-sm text-[var(--color-text)]"
                  />
                </label>
              </div>
            </Popover>
          </div>
          {(searchQuery || statusFilter !== "All" || dateFrom || dateTo) && (
            <button
              onClick={clearFilters}
              className="text-xs font-medium text-[var(--color-primary)] hover:text-[var(--color-accent-medium)]"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-[1.15fr_1fr] gap-5">
        <Card className="flex flex-col">
          {meetings.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--color-text-muted)]">No meetings yet.</p>
          ) : filteredMeetings.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--color-text-muted)]">No calls match your filters.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-[var(--color-text-muted)]">
                  <th className="pb-3 pr-4 font-normal">Caller</th>
                  <th className="pb-3 pr-4 font-normal">Company</th>
                  <th className="pb-3 pr-4 font-normal">Date</th>
                  <th className="pb-3 pr-4 font-normal">Time</th>
                  <th className="pb-3 pr-4 font-normal">Reason</th>
                  <th className="pb-3 font-normal">Status</th>
                </tr>
              </thead>
              <tbody>
                {pagedMeetings.map((m) => {
                  const record = crmByMeetingId.get(m.id);
                  const draft = !record && m.crm_extraction_status === "ready" ? m.crm_extraction : null;
                  const name = record && (record.first_name || record.last_name)
                    ? [record.first_name, record.last_name].filter(Boolean).join(" ")
                    : m.title;
                  const company = record?.company || draft?.company;
                  const reason = record?.reason_for_call || draft?.reason_for_call;
                  return (
                    <tr
                      key={m.id}
                      onClick={() => setSelectedId(m.id)}
                      className={`cursor-pointer border-t border-[var(--color-border)] transition-colors ${
                        selectedId === m.id ? "bg-[var(--color-accent)]/50" : "hover:bg-[var(--color-accent)]/20"
                      }`}
                    >
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-3">
                          <Avatar initials={initialsFor(name)} size="sm" />
                          <span className="font-medium text-[var(--color-text)]">{name}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-[var(--color-text-secondary)]">
                        {company ? (
                          draft ? (
                            <span className="italic text-[var(--color-text-muted)]" title="Draft - not yet saved to CRM">
                              {company}
                            </span>
                          ) : (
                            company
                          )
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="whitespace-nowrap py-3 pr-4 text-[var(--color-text-secondary)]">
                        {new Date(m.created_at).toLocaleDateString()}
                      </td>
                      <td className="whitespace-nowrap py-3 pr-4 text-[var(--color-text-secondary)]">
                        {new Date(m.created_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                      </td>
                      <td className="py-3 pr-4 text-[var(--color-text-secondary)]">
                        {reason ? (
                          draft ? (
                            <span className="italic text-[var(--color-text-muted)]" title="Draft - not yet saved to CRM">
                              {reason}
                            </span>
                          ) : (
                            reason
                          )
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-3">
                        {record?.call_outcome ? (
                          <StatusBadge status={record.call_outcome} />
                        ) : record ? (
                          <span className="text-xs text-[var(--color-text-muted)]">Not extracted</span>
                        ) : m.crm_extraction_status === "ready" ? (
                          <StatusBadge status="Ready to review" />
                        ) : m.crm_extraction_status === "failed" ? (
                          <StatusBadge status="Extraction failed" />
                        ) : (
                          <span className="text-xs text-[var(--color-text-muted)]">Not extracted</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          <div className="mt-4 flex items-center justify-between border-t border-[var(--color-border)] pt-4 text-sm">
            <span className="text-[var(--color-text-muted)]">
              Showing {filteredMeetings.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1}
              {"–"}
              {Math.min(currentPage * PAGE_SIZE, filteredMeetings.length)} of {filteredMeetings.length} calls
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-accent)]/40 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg font-medium ${
                    n === currentPage
                      ? "bg-[var(--color-accent)] text-[var(--color-accent-strong)]"
                      : "text-[var(--color-text-secondary)] hover:bg-[var(--color-accent)]/40"
                  }`}
                >
                  {n}
                </button>
              ))}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-accent)]/40 disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={currentPage === totalPages}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-accent)]/40 disabled:opacity-40"
              >
                <ChevronsRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </Card>

        <Card>
          {detailLoading || !detail ? (
            <LoadingState label="Loading meeting..." />
          ) : (
            <>
              <div className="mb-4 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Avatar initials={initialsFor(selectedMeeting.title)} />
                  <div>
                    <p className="font-semibold text-[var(--color-text)]">{selectedMeeting.title}</p>
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      Duration: {formatDuration(detail.duration)}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {new Date(detail.created_at).toLocaleString()}
                  </span>
                  <div className="relative">
                    <button
                      onClick={() => setKebabOpen((v) => !v)}
                      className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                    >
                      <MoreVertical className="h-4 w-4 shrink-0" />
                    </button>
                    <Popover open={kebabOpen} onClose={() => setKebabOpen(false)} anchorClassName="right-0">
                      <button
                        onClick={handleDeleteMeeting}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm text-[var(--color-status-red-text)] hover:bg-[var(--color-status-red-bg)]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete meeting
                      </button>
                    </Popover>
                  </div>
                </div>
              </div>

              <div className="mb-5 flex gap-4 border-b border-[var(--color-border)]">
                {TABS.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setActiveTab(t.key)}
                    className={`flex items-center gap-1.5 border-b-2 pb-2.5 text-sm font-medium transition-colors ${
                      activeTab === t.key
                        ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                        : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                    }`}
                  >
                    <t.icon className="h-4 w-4" />
                    {t.label}
                  </button>
                ))}
              </div>

              {activeTab === "transcript" && (
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-text-muted)]" />
                      <input
                        type="text"
                        placeholder="Search transcript..."
                        className="w-full rounded-lg border border-[var(--color-border)] py-1.5 pl-8 pr-3 text-xs text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none"
                      />
                    </div>
                    <button
                      onClick={() => navigator.clipboard?.writeText(detail.transcript || "")}
                      className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-text)] hover:bg-[var(--color-accent)]/40"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copy
                    </button>
                  </div>
                  <p className="max-h-80 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-text-secondary)]">
                    {detail.transcript || "No transcript available."}
                  </p>
                </div>
              )}

              {activeTab === "summary" && (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-text-secondary)]">
                  {detail.summary || "No summary available for this meeting."}
                </p>
              )}

              {activeTab === "key-points" && (
                <p className="text-sm text-[var(--color-text-muted)]">Key points aren't extracted separately yet.</p>
              )}

              {activeTab === "action-items" && (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-text-secondary)]">
                  {detail.action_items || "No action items identified for this meeting."}
                </p>
              )}

              {activeTab === "crm-extraction" && (
                <div>
                  {!crmData && (
                    <button
                      onClick={handleExtract}
                      disabled={crmLoading}
                      className="flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
                    >
                      <Sparkles className="h-4 w-4" />
                      {crmLoading ? "Extracting..." : "Extract CRM Data"}
                    </button>
                  )}

                  {crmError && <p className="mt-3 text-sm text-[var(--color-status-red-text)]">{crmError}</p>}

                  {crmData && (
                    <div className="mt-1 flex flex-col gap-3">
                      <div className="grid grid-cols-2 gap-3">
                        {CRM_FORM_FIELDS.map(([key, label]) => (
                          <label key={key} className="text-xs text-[var(--color-text-muted)]">
                            {label}
                            <input
                              type="text"
                              value={crmData[key] || ""}
                              onChange={(e) => setCrmData({ ...crmData, [key]: e.target.value })}
                              readOnly={crmSaved}
                              className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 text-sm text-[var(--color-text)] focus:outline-none read-only:bg-[var(--color-bg)] read-only:text-[var(--color-text-secondary)]"
                            />
                          </label>
                        ))}
                      </div>
                      <button
                        onClick={handleSave}
                        disabled={crmLoading || crmSaved}
                        className="self-start rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
                      >
                        {crmLoading ? "Saving..." : crmSaved ? "Saved ✓" : "Save to CRM"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </Card>
      </div>

      <UploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={(meeting) => loadData(meeting.id)}
      />
    </div>
  );
}
