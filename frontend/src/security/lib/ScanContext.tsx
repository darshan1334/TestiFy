import { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { ReactNode } from "react";
import type { ScanResult } from "./api";
import { getScan, wsUrl } from "./api";

interface ScanState {
  scanId: string | null;
  status: "idle" | "running" | "completed" | "failed";
  progress: { stage: string; pct: number; message: string } | null;
  result: ScanResult | null;
  /** Start tracking a brand-new scan (upload / clone just kicked off). */
  setScanId: (id: string | null) => void;
  /** Re-open a past scan from history: fetches it and swaps it in as the
   *  active scan, so every security page renders that scan's data. */
  openScan: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const ScanCtx = createContext<ScanState | null>(null);

const LAST_SCAN_KEY = "sc_last_scan";

export function ScanProvider({ children }: { children: ReactNode }) {
  const [scanId, setScanIdState] = useState<string | null>(() => localStorage.getItem(LAST_SCAN_KEY));
  const [status, setStatus] = useState<ScanState["status"]>("idle");
  const [progress, setProgress] = useState<ScanState["progress"]>(null);
  const [result, setResult] = useState<ScanResult | null>(null);

  const setScanId = useCallback((id: string | null) => {
    setScanIdState(id);
    if (id) localStorage.setItem(LAST_SCAN_KEY, id);
    else localStorage.removeItem(LAST_SCAN_KEY);
    setResult(null);
    setProgress(null);
    setStatus(id ? "running" : "idle");
  }, []);

  const refresh = useCallback(async () => {
    if (!scanId) return;
    try {
      const row = await getScan(scanId);
      if (row.status === "completed" && row.result) {
        setResult(row.result);
        setStatus("completed");
      } else if (row.status === "failed") {
        setStatus("failed");
      } else {
        setStatus("running");
      }
    } catch {
      // scan not found (fresh backend / deleted from history) - ignore
    }
  }, [scanId]);

  /**
   * Opening a scan from history fetches its stored result *before* swapping
   * the active scan over, so revisiting a finished scan lands straight on its
   * results instead of flashing the "scanning..." state first.
   */
  const openScan = useCallback(async (id: string) => {
    const row = await getScan(id);
    setScanIdState(id);
    localStorage.setItem(LAST_SCAN_KEY, id);
    setProgress(null);
    if (row.status === "completed" && row.result) {
      setResult(row.result);
      setStatus("completed");
    } else {
      setResult(null);
      setStatus(row.status === "failed" ? "failed" : "running");
    }
  }, []);

  useEffect(() => {
    if (!scanId) return;
    // A finished scan never changes again - don't hold a socket or a 2.5s
    // poll open for it (previously these kept running for the whole session
    // once a scan completed, including for scans reopened from history).
    if (status === "completed" || status === "failed") return;

    refresh();
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(wsUrl(scanId));
      ws.onmessage = (ev) => {
        const data = JSON.parse(ev.data);
        setProgress(data);
        if (data.stage === "done") refresh();
        if (data.stage === "error") setStatus("failed");
      };
    } catch {
      /* ws unavailable, fall back to polling below */
    }
    const poll = setInterval(refresh, 2500);
    return () => {
      ws?.close();
      clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanId, status]);

  return (
    <ScanCtx.Provider value={{ scanId, status, progress, result, setScanId, openScan, refresh }}>
      {children}
    </ScanCtx.Provider>
  );
}

export function useScan() {
  const ctx = useContext(ScanCtx);
  if (!ctx) throw new Error("useScan must be used within ScanProvider");
  return ctx;
}
