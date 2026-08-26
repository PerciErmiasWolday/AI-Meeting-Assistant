import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Users,
  Search,
  Filter,
  ArrowUpDown,
  Columns3,
  Bell,
  Upload,
  RefreshCw,
  Plus,
  ChevronDown,
  X,
  Phone,
  MoreVertical,
  Sparkles,
  CheckSquare,
  Play,
  ExternalLink,
  Trash2,
} from "lucide-react";
import Card from "../components/Card";
import Avatar from "../components/Avatar";
import StatusBadge from "../components/StatusBadge";
import Popover from "../components/Popover";
import Modal from "../components/Modal";
import { LoadingState, ErrorState } from "../components/AsyncState";
import { getCrmRecords, getCrmRecord, deleteCrmRecord } from "../lib/api";
import { downloadCsv } from "../lib/csv";
import { toast } from "../lib/toast";

const DATE_PRESETS = ["All", "Today", "This Week", "This Month"];

function nameFor(record) {
  return [record.first_name, record.last_name].filter(Boolean).join(" ") || "Unknown";
}

function initialsFor(name) {
  return name.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function withinPreset(iso, preset) {
  if (preset === "All") return true;
  const days = { Today: 1, "This Week": 7, "This Month": 31 }[preset];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return new Date(iso) >= cutoff;
}

export default function CRM() {
  const [records, setRecords] = useState(null);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [reasonFilter, setReasonFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState("All");
  const [needsFollowUpOnly, setNeedsFollowUpOnly] = useState(Boolean(location.state?.followUpOnly));
  const [sortDir, setSortDir] = useState("desc");
  const [showSummaryColumn, setShowSummaryColumn] = useState(true);
  const [openMenu, setOpenMenu] = useState(null); // 'headerFilter' | 'date' | 'owner' | 'reason' | 'status' | 'columns' | null
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [kebabOpen, setKebabOpen] = useState(false);

  useEffect(() => {
    getCrmRecords()
      .then((data) => {
        setRecords(data);
        if (data.length > 0) setSelectedId(data[0].id);
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (selectedId == null) return;
    setSelectedDetail(null);
    getCrmRecord(selectedId).catch((err) => setError(err.message)).then(setSelectedDetail);
  }, [selectedId]);

  if (error) return <ErrorState message={error} />;
  if (!records) return <LoadingState label="Loading contacts..." />;

  const selected = records.find((r) => r.id === selectedId);
  const statusOptions = ["All", ...new Set(records.map((r) => r.call_outcome).filter(Boolean))];
  const reasonOptions = ["All", ...new Set(records.map((r) => r.reason_for_call).filter(Boolean))];

  const filteredRecords = records
    .filter((r) => {
      const name = nameFor(r);
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const haystack = [name, r.company, r.phone_number, r.reason_for_call].filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (statusFilter !== "All" && r.call_outcome !== statusFilter) return false;
      if (reasonFilter !== "All" && r.reason_for_call !== reasonFilter) return false;
      if (!withinPreset(r.created_at, dateFilter)) return false;
      if (needsFollowUpOnly && !(r.call_outcome || "").toLowerCase().includes("follow")) return false;
      return true;
    })
    .sort((a, b) => (sortDir === "desc" ? 1 : -1) * (new Date(b.created_at) - new Date(a.created_at)));

  const activeFilterCount = [
    searchQuery.trim() !== "",
    statusFilter !== "All",
    reasonFilter !== "All",
    dateFilter !== "All",
    needsFollowUpOnly,
  ].filter(Boolean).length;

  function clearAllFilters() {
    setSearchQuery("");
    setStatusFilter("All");
    setReasonFilter("All");
    setDateFilter("All");
    setNeedsFollowUpOnly(false);
  }

  function exportRecords() {
    if (filteredRecords.length === 0) {
      toast("Nothing to export.", "info");
      return;
    }
    downloadCsv(
      "contacts.csv",
      filteredRecords.map((r) => ({
        name: nameFor(r),
        company: r.company || "",
        phone: r.phone_number || "",
        last_called: r.created_at,
        reason: r.reason_for_call || "",
        summary: r.call_summary || "",
        next_step: r.next_action || "",
        status: r.call_outcome || "",
        owner: "Sophia",
      }))
    );
    toast("Contacts exported.");
  }

  function handleDeleteContact() {
    if (!selected) return;
    if (!window.confirm(`Delete ${nameFor(selected)}? This can't be undone.`)) return;
    setKebabOpen(false);
    deleteCrmRecord(selected.id)
      .then(() => {
        const remaining = records.filter((r) => r.id !== selected.id);
        setRecords(remaining);
        setSelectedId(remaining.length > 0 ? remaining[0].id : null);
        toast("Contact deleted.");
      })
      .catch((err) => toast(err.message, "info"));
  }

  return (
    <div className="flex gap-5">
      <div className="flex flex-1 flex-col gap-4">
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <h1 className="text-[28px] font-bold text-[var(--color-text)]">Contacts</h1>
            <span className="flex items-center gap-1 text-sm text-[var(--color-text-muted)]">
              <Users className="h-4 w-4" />
              {records.length} total
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative w-72">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search contacts..."
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-2.5 pl-10 pr-4 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
              />
            </div>
            <div className="relative">
              <button
                onClick={() => setOpenMenu(openMenu === "headerFilter" ? null : "headerFilter")}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-[var(--color-accent)]/40"
              >
                <Filter className="h-4 w-4" />
              </button>
              <Popover open={openMenu === "headerFilter"} onClose={() => setOpenMenu(null)} anchorClassName="right-0">
                <p className="mb-1.5 px-1 text-xs font-medium text-[var(--color-text-muted)]">Status</p>
                {statusOptions.map((s) => (
                  <button
                    key={s}
                    onClick={() => { setStatusFilter(s); setOpenMenu(null); }}
                    className={`block w-full rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-[var(--color-accent)]/40 ${statusFilter === s ? "font-semibold text-[var(--color-primary)]" : "text-[var(--color-text)]"}`}
                  >
                    {s}
                  </button>
                ))}
              </Popover>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setOpenMenu(openMenu === "status" ? null : "status")}
                className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2 text-sm font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-accent)]/40"
              >
                <Filter className="h-4 w-4" />
                Filter{statusFilter !== "All" || reasonFilter !== "All" ? ` (${[statusFilter !== "All", reasonFilter !== "All"].filter(Boolean).length})` : ""}
              </button>
              <Popover open={openMenu === "status"} onClose={() => setOpenMenu(null)}>
                <p className="mb-1.5 px-1 text-xs font-medium text-[var(--color-text-muted)]">Status</p>
                {statusOptions.map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`block w-full rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-[var(--color-accent)]/40 ${statusFilter === s ? "font-semibold text-[var(--color-primary)]" : "text-[var(--color-text)]"}`}
                  >
                    {s}
                  </button>
                ))}
                <p className="mb-1.5 mt-2 px-1 text-xs font-medium text-[var(--color-text-muted)]">Reason</p>
                {reasonOptions.map((r) => (
                  <button
                    key={r}
                    onClick={() => setReasonFilter(r)}
                    className={`block w-full truncate rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-[var(--color-accent)]/40 ${reasonFilter === r ? "font-semibold text-[var(--color-primary)]" : "text-[var(--color-text)]"}`}
                  >
                    {r}
                  </button>
                ))}
              </Popover>
            </div>

            <button
              onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
              className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2 text-sm font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-accent)]/40"
            >
              <ArrowUpDown className="h-4 w-4" />
              Sort: {sortDir === "desc" ? "Newest" : "Oldest"}
            </button>

            <div className="relative">
              <button
                onClick={() => setOpenMenu(openMenu === "columns" ? null : "columns")}
                className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2 text-sm font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-accent)]/40"
              >
                <Columns3 className="h-4 w-4" />
                Columns
              </button>
              <Popover open={openMenu === "columns"} onClose={() => setOpenMenu(null)}>
                <label className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-[var(--color-text)] hover:bg-[var(--color-accent)]/40">
                  <input type="checkbox" checked={showSummaryColumn} onChange={(e) => setShowSummaryColumn(e.target.checked)} />
                  AI Summary
                </label>
              </Popover>
            </div>

            <button
              onClick={() => setNeedsFollowUpOnly((v) => !v)}
              className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors ${
                needsFollowUpOnly
                  ? "border-[var(--color-primary)] bg-[var(--color-accent)] text-[var(--color-accent-strong)]"
                  : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-[var(--color-accent)]/40"
              }`}
            >
              <Bell className="h-4 w-4" />
              Needs Follow-Up
            </button>

            <button
              onClick={exportRecords}
              className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2 text-sm font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-accent)]/40"
            >
              <Upload className="h-4 w-4" />
              Export
            </button>

            <button
              onClick={() => toast("Google Sheets sync isn't available in this app yet.", "info")}
              className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2 text-sm font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-accent)]/40"
            >
              <RefreshCw className="h-4 w-4" />
              Sync with Google Sheets
            </button>
          </div>
          <button
            onClick={() => setAddContactOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-hover)]"
          >
            <Plus className="h-4 w-4" />
            Add Contact
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setOpenMenu(openMenu === "date" ? null : "date")}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-accent)]/40"
            >
              Date: {dateFilter}
              <ChevronDown className="h-3 w-3" />
            </button>
            <Popover open={openMenu === "date"} onClose={() => setOpenMenu(null)}>
              {DATE_PRESETS.map((d) => (
                <button
                  key={d}
                  onClick={() => { setDateFilter(d); setOpenMenu(null); }}
                  className={`block w-full rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-[var(--color-accent)]/40 ${dateFilter === d ? "font-semibold text-[var(--color-primary)]" : "text-[var(--color-text)]"}`}
                >
                  {d}
                </button>
              ))}
            </Popover>
          </div>

          <button className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)]">
            Owner: Sophia
          </button>

          <div className="relative">
            <button
              onClick={() => setOpenMenu(openMenu === "reasonChip" ? null : "reasonChip")}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-accent)]/40"
            >
              Reason: {reasonFilter}
              <ChevronDown className="h-3 w-3" />
            </button>
            <Popover open={openMenu === "reasonChip"} onClose={() => setOpenMenu(null)}>
              {reasonOptions.map((r) => (
                <button
                  key={r}
                  onClick={() => { setReasonFilter(r); setOpenMenu(null); }}
                  className={`block w-full truncate rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-[var(--color-accent)]/40 ${reasonFilter === r ? "font-semibold text-[var(--color-primary)]" : "text-[var(--color-text)]"}`}
                >
                  {r}
                </button>
              ))}
            </Popover>
          </div>

          <div className="relative">
            <button
              onClick={() => setOpenMenu(openMenu === "statusChip" ? null : "statusChip")}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-accent)]/40"
            >
              Status: {statusFilter}
              <ChevronDown className="h-3 w-3" />
            </button>
            <Popover open={openMenu === "statusChip"} onClose={() => setOpenMenu(null)}>
              {statusOptions.map((s) => (
                <button
                  key={s}
                  onClick={() => { setStatusFilter(s); setOpenMenu(null); }}
                  className={`block w-full rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-[var(--color-accent)]/40 ${statusFilter === s ? "font-semibold text-[var(--color-primary)]" : "text-[var(--color-text)]"}`}
                >
                  {s}
                </button>
              ))}
            </Popover>
          </div>

          {activeFilterCount > 0 && (
            <button onClick={clearAllFilters} className="text-xs font-medium text-[var(--color-primary)] hover:text-[var(--color-accent-medium)]">
              Clear all
            </button>
          )}
        </div>

        <Card>
          {records.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--color-text-muted)]">
              No CRM records yet. Extract and save one from the Calls page.
            </p>
          ) : filteredRecords.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--color-text-muted)]">No contacts match your filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-[var(--color-text-muted)]">
                    <th className="pb-3 pr-4 font-normal">Name</th>
                    <th className="pb-3 pr-4 font-normal">Company</th>
                    <th className="pb-3 pr-4 font-normal">Phone</th>
                    <th className="pb-3 pr-4 font-normal">Last Called</th>
                    <th className="pb-3 pr-4 font-normal">Reason</th>
                    {showSummaryColumn && <th className="pb-3 pr-4 font-normal">AI Summary</th>}
                    <th className="pb-3 pr-4 font-normal">Next Step</th>
                    <th className="pb-3 pr-4 font-normal">Status</th>
                    <th className="pb-3 font-normal">Owner</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((r) => {
                    const name = nameFor(r);
                    return (
                      <tr
                        key={r.id}
                        onClick={() => setSelectedId(r.id)}
                        className={`cursor-pointer border-t border-[var(--color-border)] transition-colors ${
                          selectedId === r.id ? "bg-[var(--color-accent)]/50" : "hover:bg-[var(--color-accent)]/20"
                        }`}
                      >
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-3">
                            <Avatar initials={initialsFor(name)} size="sm" />
                            <span className="font-medium text-[var(--color-text)]">{name}</span>
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-[var(--color-text-secondary)]">{r.company || "—"}</td>
                        <td className="whitespace-nowrap py-3 pr-4 text-[var(--color-text-secondary)]">{r.phone_number || "—"}</td>
                        <td className="whitespace-nowrap py-3 pr-4 text-[var(--color-text-secondary)]">
                          {formatDate(r.created_at)}
                        </td>
                        <td className="py-3 pr-4 text-[var(--color-text-secondary)]">{r.reason_for_call || "—"}</td>
                        {showSummaryColumn && (
                          <td className="py-3 pr-4 text-[var(--color-text-secondary)]">{r.call_summary || "—"}</td>
                        )}
                        <td className="py-3 pr-4 text-[var(--color-text-secondary)]">{r.next_action || "—"}</td>
                        <td className="py-3 pr-4">
                          {r.call_outcome ? (
                            <StatusBadge status={r.call_outcome} dot />
                          ) : (
                            <span className="text-xs text-[var(--color-text-muted)]">Not set</span>
                          )}
                        </td>
                        <td className="py-3 text-[var(--color-text-secondary)]">Sophia</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {selected && (
        <Card className="w-[340px] shrink-0 self-start">
          <div className="mb-3 flex items-start justify-between">
            <div>
              <p className="text-lg font-semibold text-[var(--color-text)]">{nameFor(selected)}</p>
              <p className="text-sm text-[var(--color-text-secondary)]">{selected.company || "—"}</p>
            </div>
            <button onClick={() => setSelectedId(null)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-3 flex gap-2">
            {selected.phone_number ? (
              <a
                href={`tel:${selected.phone_number}`}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-accent)]/40"
              >
                <Phone className="h-4 w-4" />
              </a>
            ) : (
              <button
                disabled
                title="No phone number on record"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] opacity-50"
              >
                <Phone className="h-4 w-4" />
              </button>
            )}
            <div className="relative">
              <button
                onClick={() => setKebabOpen((v) => !v)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-accent)]/40"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
              <Popover open={kebabOpen} onClose={() => setKebabOpen(false)}>
                <button
                  onClick={handleDeleteContact}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm text-[var(--color-status-red-text)] hover:bg-[var(--color-status-red-bg)]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete contact
                </button>
              </Popover>
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-[var(--color-border)] pt-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-[var(--color-text-muted)]">Last contacted</span>
              <span className="font-medium text-[var(--color-text)]">{formatDate(selected.created_at)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--color-text-muted)]">Status</span>
              {selected.call_outcome ? (
                <StatusBadge status={selected.call_outcome} dot />
              ) : (
                <span className="text-xs text-[var(--color-text-muted)]">Not set</span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--color-text-muted)]">Owner</span>
              <span className="font-medium text-[var(--color-text)]">Sophia</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--color-text-muted)]">Phone</span>
              <span className="font-medium text-[var(--color-text)]">{selected.phone_number || "—"}</span>
            </div>
          </div>

          <div className="mt-3 border-t border-[var(--color-border)] pt-3">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-[var(--color-text)]">
              <Sparkles className="h-4 w-4 text-[var(--color-primary)]" />
              AI Summary
            </p>
            <p className="rounded-xl bg-[var(--color-accent)]/50 p-3 text-sm leading-relaxed text-[var(--color-text-secondary)]">
              {selected.call_summary || "No summary extracted for this call."}
            </p>
          </div>

          <div className="mt-3">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-[var(--color-text)]">
              <CheckSquare className="h-4 w-4 text-[var(--color-primary)]" />
              Next Step
            </p>
            <p className="rounded-xl bg-[var(--color-accent)]/50 p-3 text-sm leading-relaxed text-[var(--color-text-secondary)]">
              {selected.next_action || "No next step recorded."}
            </p>
          </div>

          <div className="mt-3 border-t border-[var(--color-border)] pt-3">
            <p className="mb-2 text-sm font-semibold text-[var(--color-text)]">Call History</p>
            <div className="flex items-center gap-3 rounded-xl bg-[var(--color-accent)]/30 p-2">
              <div className="flex w-9 shrink-0 flex-col items-center text-[10px] font-semibold uppercase text-[var(--color-text-muted)]">
                <span>{new Date(selected.created_at).toLocaleDateString(undefined, { month: "short" })}</span>
                <span className="text-sm text-[var(--color-text)]">{new Date(selected.created_at).getDate()}</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-[var(--color-text)]">{selected.reason_for_call || "Call"}</p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {new Date(selected.created_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                  {selectedDetail?.meeting_duration != null && ` · ${Math.round(selectedDetail.meeting_duration / 60)}m`}
                </p>
              </div>
              <Play className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)]" />
            </div>
          </div>

          <button
            onClick={() => navigate(`/crm/${selected.id}`)}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-[var(--color-border)] py-2.5 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-accent)]/40"
          >
            View Full History
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
        </Card>
      )}

      <Modal open={addContactOpen} onClose={() => setAddContactOpen(false)} title="Add Contact">
        <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
          Contacts are created from processed calls — upload a recording, then save its extracted CRM data,
          and it'll show up here automatically.
        </p>
        <button
          onClick={() => { setAddContactOpen(false); navigate("/calls", { state: { openUpload: true } }); }}
          className="mt-4 flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary-hover)]"
        >
          Upload a Recording
        </button>
      </Modal>
    </div>
  );
}
