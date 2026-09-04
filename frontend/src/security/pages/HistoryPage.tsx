import { useEffect, useState, useCallback } from "react";
import type { ScanRow } from "../lib/api";
import { listScans, deleteScan, reportUrl } from "../lib/api";
import { useScan } from "../lib/ScanContext";
import { useNavigate } from "react-router-dom";
import {
  History, ArrowRight, RefreshCw, Trash2, FileJson, File as FileIcon,
  UploadCloud, GitBranch, Loader2, Search, FlaskConical,
} from "lucide-react";
import { SEV_COLOR } from "../components/Severity";

function relativeTime(seconds: number) {
  const diff = Date.now() / 1000 - seconds;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(seconds * 1000).toLocaleDateString();
}

function formatSize(bytes?: number | null) {
  if (!bytes) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function riskColor(score?: number | null) {
  if (score == null) return "#888";
  if (score >= 75) return SEV_COLOR.critical;
  if (score >= 50) return SEV_COLOR.high;
  if (score >= 25) return SEV_COLOR.medium;
  return SEV_COLOR.low;
}

export default function HistoryPage() {
  const [scans, setScans] = useState<ScanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { scanId, openScan } = useScan();
  const nav = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setScans(await listScans());
      setError(null);
    } catch {
      setScans([]);
      setError("Could not load scan history. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // A scan that is still running will finish while this page is open, so keep
  // the list fresh until nothing is in flight.
  useEffect(() => {
    if (!scans.some((s) => s.status === "running")) return;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [scans, load]);

  /** Load a past scan back into the app, then jump to its dashboard - every
   *  other security page reads the active scan from ScanContext. */
  const revisit = useCallback(async (id: string) => {
    setOpeningId(id);
    try {
      await openScan(id);
      nav("/security");
    } catch {
      setError("That scan could not be opened - it may have been deleted.");
      load();
    } finally {
      setOpeningId(null);
    }
  }, [openScan, nav, load]);

  const remove = useCallback(async (row: ScanRow) => {
    if (!window.confirm(`Delete the scan history entry for "${row.project_name}"? Its stored results cannot be recovered.`)) return;
    try {
      await deleteScan(row.id);
      setScans((prev) => prev.filter((s) => s.id !== row.id));
    } catch {
      setError("Delete failed.");
    }
  }, []);

  const q = query.trim().toLowerCase();
  const visible = q
    ? scans.filter((s) => s.project_name?.toLowerCase().includes(q) || s.origin?.toLowerCase().includes(q))
    : scans;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <History className="text-[var(--color-vibranium-glow)]" size={26} />
        <div className="mr-auto">
          <h1 className="font-display text-3xl font-bold text-white">Scan History</h1>
          <p className="text-gray-400 text-sm">
            Every project you have uploaded or cloned. Results are stored on the server &mdash; reopen any scan to browse its findings again.
          </p>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by project or file"
            className="bg-[var(--color-void-2)] border border-[var(--color-border)] rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--color-vibranium)]"
          />
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm text-gray-300 hover:border-[var(--color-vibranium)] hover:text-white transition-colors"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-[var(--color-crit)]/40 bg-[var(--color-crit)]/10 text-[var(--color-crit)] px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="glass-panel rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-[var(--color-void-2)] text-gray-400 uppercase text-[11px] tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Project</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Risk</th>
                <th className="text-left px-4 py-3">Findings</th>
                <th className="text-left px-4 py-3">Secrets</th>
                <th className="text-left px-4 py-3">Vuln. deps</th>
                <th className="text-left px-4 py-3">Scanned</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((s) => {
                const sum = s.summary;
                const active = s.id === scanId;
                const size = formatSize(s.size_bytes);
                return (
                  <tr
                    key={s.id}
                    className={`border-t border-[var(--color-border)]/50 hover:bg-white/5 transition-colors ${active ? "bg-[var(--color-vibranium)]/10" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {s.source === "git" || s.source === "github"
                          ? <GitBranch size={13} className="text-[var(--color-gold-bright)] shrink-0" />
                          : <UploadCloud size={13} className="text-[var(--color-vibranium-glow)] shrink-0" />}
                        <span className="text-white font-medium">{s.project_name}</span>
                        {active && (
                          <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-[var(--color-vibranium)]/25 text-[var(--color-vibranium-glow)]">
                            viewing
                          </span>
                        )}
                        {s.session_id && (
                          <button
                            onClick={() => nav(`/results/${s.session_id}`)}
                            title="Scanned automatically from a New Test run - open the test results"
                            className="flex items-center gap-1 text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-[var(--color-gold)]/15 text-[var(--color-gold-bright)] hover:bg-[var(--color-gold)]/25"
                          >
                            <FlaskConical size={10} /> new test
                          </button>
                        )}
                      </div>
                      {s.origin && (
                        <div className="text-[11px] text-gray-500 font-mono mt-0.5 truncate max-w-[280px]" title={s.origin}>
                          {s.origin}{size ? ` · ${size}` : ""}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-mono uppercase px-2 py-0.5 rounded ${
                        s.status === "completed" ? "text-[var(--color-low)] bg-[var(--color-low)]/10" :
                        s.status === "failed" ? "text-[var(--color-crit)] bg-[var(--color-crit)]/10" :
                        "text-[var(--color-med)] bg-[var(--color-med)]/10"
                      }`}>{s.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      {sum?.risk_score != null ? (
                        <span className="font-display font-bold" style={{ color: riskColor(sum.risk_score) }}>
                          {sum.risk_score}
                        </span>
                      ) : <span className="text-gray-600">&mdash;</span>}
                    </td>
                    <td className="px-4 py-3">
                      {sum ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-white font-medium">{sum.total_findings}</span>
                          {(["critical", "high", "medium", "low"] as const).map((lvl) =>
                            sum[lvl] > 0 ? (
                              <span key={lvl} title={`${sum[lvl]} ${lvl}`}
                                className="text-[10px] font-mono px-1.5 rounded"
                                style={{ color: SEV_COLOR[lvl], background: `${SEV_COLOR[lvl]}1a` }}>
                                {sum[lvl]}
                              </span>
                            ) : null
                          )}
                        </div>
                      ) : <span className="text-gray-600">&mdash;</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-300">{sum ? sum.total_secrets : "—"}</td>
                    <td className="px-4 py-3 text-gray-300">
                      {sum ? `${sum.vulnerable_dependencies} / ${sum.total_dependencies}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs whitespace-nowrap"
                        title={new Date(s.created_at * 1000).toLocaleString()}>
                      {relativeTime(s.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {s.status === "completed" && (
                          <>
                            <a href={reportUrl(s.id, "pdf")} target="_blank" rel="noreferrer" title="Download PDF report"
                               className="p-1.5 rounded text-gray-400 hover:text-[var(--color-gold-bright)] hover:bg-white/5">
                              <FileIcon size={14} />
                            </a>
                            <a href={reportUrl(s.id, "json")} target="_blank" rel="noreferrer" title="Download JSON report"
                               className="p-1.5 rounded text-gray-400 hover:text-[var(--color-gold-bright)] hover:bg-white/5">
                              <FileJson size={14} />
                            </a>
                            <button onClick={() => revisit(s.id)} disabled={openingId === s.id}
                              className="ml-1 flex items-center gap-1 text-xs px-2.5 py-1.5 rounded text-[var(--color-vibranium-glow)] hover:bg-[var(--color-vibranium)]/15 disabled:opacity-50">
                              {openingId === s.id
                                ? <Loader2 size={12} className="animate-spin" />
                                : <>Reopen <ArrowRight size={12} /></>}
                            </button>
                          </>
                        )}
                        {s.status === "running" && (
                          <button onClick={() => revisit(s.id)}
                            className="ml-1 flex items-center gap-1 text-xs px-2.5 py-1.5 rounded text-[var(--color-med)] hover:bg-[var(--color-med)]/15">
                            <Loader2 size={12} className="animate-spin" /> Follow
                          </button>
                        )}
                        <button onClick={() => remove(s)} title="Delete from history"
                          className="p-1.5 rounded text-gray-500 hover:text-[var(--color-crit)] hover:bg-[var(--color-crit)]/10">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!loading && visible.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                    {scans.length === 0 ? (
                      <>
                        <p>No scans yet.</p>
                        <button onClick={() => nav("/security/upload")}
                          className="mt-4 px-5 py-2 rounded-lg font-display font-bold text-black bg-gradient-to-r from-[var(--color-gold-bright)] to-[var(--color-gold)]">
                          Upload a project
                        </button>
                      </>
                    ) : `No scans match "${query}".`}
                  </td>
                </tr>
              )}
              {loading && scans.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                  <Loader2 size={18} className="animate-spin inline" />
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
