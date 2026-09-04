import axios from "axios";

/**
 * The security add-on is served by the same TestiFy backend, mounted under
 * /api/security. Requests go through the existing Vite dev proxy (and the
 * same origin in production), so no VITE_API_URL / CORS setup is needed.
 */
export const API_BASE = "";
const SEC = "/api/security";

export const api = axios.create({ baseURL: API_BASE });

export interface Finding {
  id: string; rule_id: string; title: string; category: string; cwe: string;
  severity: "critical" | "high" | "medium" | "low"; confidence: string;
  file: string; line: number; column: number; snippet: string; context: string;
  description: string; recommendation: string; language: string;
}

export interface SecretFinding {
  id: string; type: string; signature: string; severity: string;
  file: string; line: number; masked_value: string; method: string;
}

export interface DependencyEntry {
  name: string; version: string; ecosystem: string; manifest_file: string;
  direct: boolean;
  vulnerabilities: { id: string; summary: string; severity: string; cvss: number | null; fixed_version: string | null; url: string }[];
}

export interface ScanResult {
  scan_id: string; project_name: string;
  code: {
    files_scanned: number; total_lines: number; languages: Record<string, number>;
    findings: Finding[]; severity_counts: { critical: number; high: number; medium: number; low: number };
    risk_score: number; rules_evaluated: number; scan_duration_seconds: number; coverage_pct: number;
  };
  secrets: { files_scanned: number; total_secrets: number; by_type: Record<string, number>; findings: SecretFinding[] };
  dependencies: { total_dependencies: number; vulnerable_count: number; lookup_available: boolean; dependencies: DependencyEntry[] };
  sbom_cyclonedx: any;
  sbom_spdx: any;
}

/** Headline numbers stored alongside each scan so the history list can show
 *  what a scan found without downloading every finding. */
export interface ScanSummary {
  risk_score: number | null; total_findings: number;
  critical: number; high: number; medium: number; low: number;
  files_scanned: number; total_lines: number; languages: string[];
  total_secrets: number; total_dependencies: number; vulnerable_dependencies: number;
  scan_duration_seconds: number | null;
}

export interface ScanRow {
  id: string; project_name: string; status: string;
  created_at: number; completed_at: number | null;
  /** 'upload' for a .zip, 'git' for a cloned repo. */
  source?: string | null;
  /** Original .zip filename, or the repository URL. */
  origin?: string | null;
  size_bytes?: number | null;
  /** Set when the scan was spawned by a TestiFy test session (New Test page). */
  session_id?: string | null;
  summary?: ScanSummary | null;
  result?: ScanResult;
}

export async function uploadZip(file: File): Promise<{ scan_id: string; project_name: string }> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post(`${SEC}/scan/upload`, form, { headers: { "Content-Type": "multipart/form-data" } });
  return data;
}

export async function scanGitRepo(repoUrl: string): Promise<{ scan_id: string; project_name: string }> {
  const { data } = await api.post(`${SEC}/scan/git`, { repo_url: repoUrl });
  return data;
}

export async function getScan(scanId: string): Promise<ScanRow> {
  const { data } = await api.get(`${SEC}/scan/${scanId}`);
  return data;
}

export async function listScans(limit = 100): Promise<ScanRow[]> {
  const { data } = await api.get(`${SEC}/scans`, { params: { limit } });
  return data;
}

export async function deleteScan(scanId: string): Promise<void> {
  await api.delete(`${SEC}/scan/${scanId}`);
}

/** The security scan spawned by a New Test run, or null if there isn't one. */
export async function scanForSession(sessionId: string): Promise<ScanRow | null> {
  try {
    const { data } = await api.get(`${SEC}/scan-for-session/${sessionId}`);
    return data;
  } catch {
    return null;
  }
}

export function reportUrl(scanId: string, fmt: string) {
  return `${SEC}/scan/${scanId}/report/${fmt}`;
}

export function wsUrl(scanId: string) {
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${window.location.host}${SEC}/ws/scan/${scanId}`;
}

export async function aiFix(finding: Finding) {
  const { data } = await api.post(`${SEC}/ai/fix`, { finding });
  return data as { source: string; explanation: string; fixed_code: string | null; recommendation: string };
}

export async function owaspTop10() {
  const { data } = await api.get(`${SEC}/owasp-top10`);
  return data as { id: string; name: string }[];
}
