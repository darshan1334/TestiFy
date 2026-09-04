import { useState, useMemo } from "react";
import Editor from "@monaco-editor/react";
import { useScan } from "../lib/ScanContext";
import { SeverityBadge } from "../components/Severity";
import type { Finding } from "../lib/api";
import { Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

const LANG_MONACO: Record<string, string> = {
  python: "python", javascript: "javascript", typescript: "typescript",
  java: "java", php: "php", go: "go", ruby: "ruby", csharp: "csharp",
  c: "c", cpp: "cpp",
};

export default function CodeScanner() {
  const { result } = useScan();
  const nav = useNavigate();
  const [selected, setSelected] = useState<Finding | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const findings = result?.code.findings ?? [];
  const filtered = useMemo(
    () => (filter === "all" ? findings : findings.filter((f) => f.severity === filter)),
    [findings, filter]
  );

  if (!result) {
    return <EmptyState onGo={() => nav("/security/upload")} />;
  }

  const active = selected ?? filtered[0] ?? null;

  return (
    <div className="flex h-screen">
      <div className="w-96 shrink-0 border-r border-[var(--color-border)] flex flex-col overflow-hidden">
        <div className="p-4 border-b border-[var(--color-border)]">
          <h2 className="font-display text-lg text-white">Findings ({filtered.length})</h2>
          <div className="flex gap-1.5 mt-3 flex-wrap">
            {["all", "critical", "high", "medium", "low"].map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-2.5 py-1 rounded text-[11px] font-mono uppercase tracking-wide border ${
                  filter === s ? "bg-[var(--color-vibranium)]/30 border-[var(--color-vibranium)] text-white" : "border-[var(--color-border)] text-gray-400"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.map((f) => (
            <button
              key={f.id}
              onClick={() => setSelected(f)}
              className={`w-full text-left px-4 py-3 border-b border-[var(--color-border)]/50 hover:bg-white/5 transition-colors ${
                active?.id === f.id ? "bg-[var(--color-vibranium)]/15" : ""
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <SeverityBadge level={f.severity} />
                <span className="text-[10px] text-gray-500 font-mono">{f.cwe}</span>
              </div>
              <div className="text-sm text-white font-medium leading-tight">{f.title}</div>
              <div className="text-[11px] text-gray-500 font-mono mt-1">{f.file}:{f.line}</div>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="p-6 text-center text-gray-500 text-sm">No findings at this severity. 🎉</div>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-10 flex items-center px-4 border-b border-[var(--color-border)] bg-[var(--color-void-2)] text-xs text-gray-400 font-mono">
          {active ? active.file : "select a finding"}
        </div>
        <div className="flex-1 min-h-0">
          {active && (
            <Editor
              height="100%"
              theme="vs-dark"
              language={LANG_MONACO[active.language] || "plaintext"}
              value={buildSnippetContext(active)}
              options={{ readOnly: true, minimap: { enabled: true }, fontSize: 13, glyphMargin: true }}
              onMount={(editor, monaco) => {
                const contextLines = active.context.split("\n");
                const lineInSnippet = Math.min(active.line - Math.max(0, active.line - 6), contextLines.length - 1) + 1;
                editor.deltaDecorations([], [{
                  range: new monaco.Range(lineInSnippet, 1, lineInSnippet, 1),
                  options: {
                    isWholeLine: true,
                    className: "vuln-line-highlight",
                    glyphMarginClassName: "vuln-glyph",
                  },
                }]);
                editor.revealLineInCenter(lineInSnippet);
              }}
            />
          )}
        </div>
        {active && (
          <div className="border-t border-[var(--color-border)] bg-[var(--color-panel)] p-5 max-h-64 overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-display text-white text-lg">{active.title}</h3>
              <SeverityBadge level={active.severity} />
            </div>
            <p className="text-sm text-gray-300 mb-3">{active.description}</p>
            <div className="flex items-start gap-2 bg-[var(--color-low)]/10 border border-[var(--color-low)]/30 rounded-lg p-3 text-sm text-gray-200">
              <Sparkles size={16} className="text-[var(--color-gold-bright)] mt-0.5 shrink-0" />
              <div>
                <span className="text-[var(--color-gold-bright)] font-semibold">Recommended fix: </span>
                {active.recommendation}
              </div>
            </div>
            <button
              onClick={() => nav("/security/ai", { state: { finding: active } })}
              className="mt-3 text-xs px-3 py-1.5 rounded-md bg-[var(--color-vibranium)]/25 border border-[var(--color-vibranium)] text-[var(--color-vibranium-glow)] hover:bg-[var(--color-vibranium)]/40"
            >
              Generate AI fix →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function buildSnippetContext(f: Finding) {
  // Real surrounding source lines returned by the scan engine (±5 lines).
  return f.context || f.snippet;
}

function EmptyState({ onGo }: { onGo: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-screen text-center px-6">
      <h2 className="font-display text-2xl text-white mb-2">No scan loaded</h2>
      <p className="text-gray-400 mb-6">Upload a project to see live vulnerability findings here.</p>
      <button onClick={onGo} className="px-6 py-2.5 rounded-lg font-display font-bold text-black bg-gradient-to-r from-[var(--color-gold-bright)] to-[var(--color-gold)]">
        Upload Project
      </button>
    </div>
  );
}
