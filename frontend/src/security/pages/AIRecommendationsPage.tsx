import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useScan } from "../lib/ScanContext";
import type { Finding } from "../lib/api";
import { aiFix } from "../lib/api";
import { SeverityBadge } from "../components/Severity";
import { Sparkles, Loader2, ArrowRight } from "lucide-react";

export default function AIRecommendationsPage() {
  const { result } = useScan();
  const nav = useNavigate();
  const location = useLocation() as { state?: { finding?: Finding } };
  const [selected, setSelected] = useState<Finding | null>(location.state?.finding ?? null);
  const [loading, setLoading] = useState(false);
  const [fix, setFix] = useState<{ source: string; explanation: string; fixed_code: string | null; recommendation: string } | null>(null);

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-center px-6">
        <h2 className="font-display text-2xl text-white mb-2">No scan loaded</h2>
        <button onClick={() => nav("/security/upload")} className="mt-4 px-6 py-2.5 rounded-lg font-display font-bold text-black bg-gradient-to-r from-[var(--color-gold-bright)] to-[var(--color-gold)]">
          Upload Project
        </button>
      </div>
    );
  }

  const runFix = async (f: Finding) => {
    setSelected(f);
    setLoading(true);
    setFix(null);
    try {
      const res = await aiFix(f);
      setFix(res);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-3">
        <Sparkles className="text-[var(--color-gold-bright)]" size={26} />
        <div>
          <h1 className="font-display text-3xl font-bold text-white">AI Recommendations</h1>
          <p className="text-gray-400 text-sm">Claude-generated fix suggestions for each finding, grounded in your actual code.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-panel rounded-xl divide-y divide-[var(--color-border)]/50 max-h-[70vh] overflow-y-auto">
          {result.code.findings.map((f) => (
            <button key={f.id} onClick={() => runFix(f)}
              className={`w-full text-left px-4 py-3 hover:bg-white/5 flex items-center justify-between ${selected?.id === f.id ? "bg-[var(--color-vibranium)]/15" : ""}`}>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <SeverityBadge level={f.severity} />
                  <span className="text-white text-sm font-medium">{f.title}</span>
                </div>
                <div className="text-[11px] text-gray-500 font-mono">{f.file}:{f.line}</div>
              </div>
              <ArrowRight size={14} className="text-gray-600" />
            </button>
          ))}
        </div>

        <div className="glass-panel rounded-xl p-6">
          {!selected && <p className="text-gray-500 text-sm">Select a finding to generate a fix.</p>}
          {selected && (
            <>
              <div className="flex items-center gap-2 mb-3">
                <SeverityBadge level={selected.severity} />
                <h3 className="font-display text-white text-lg">{selected.title}</h3>
              </div>
              <div className="text-xs text-gray-500 font-mono mb-4">{selected.file}:{selected.line}</div>

              {loading && (
                <div className="flex items-center gap-2 text-[var(--color-vibranium-glow)] text-sm">
                  <Loader2 size={16} className="animate-spin" /> Generating fix...
                </div>
              )}

              {fix && (
                <div className="space-y-4">
                  <div className="text-[10px] uppercase tracking-widest text-gray-500">
                    Source: {fix.source === "rule-engine" ? "Rule engine (static, no ANTHROPIC_API_KEY set)" : fix.source}
                  </div>
                  <p className="text-sm text-gray-200">{fix.explanation}</p>
                  {fix.fixed_code && (
                    <pre className="bg-[var(--color-void-2)] border border-[var(--color-border)] rounded-lg p-4 text-xs text-[var(--color-low)] font-mono overflow-x-auto">
                      {fix.fixed_code}
                    </pre>
                  )}
                  <div className="bg-[var(--color-gold)]/10 border border-[var(--color-gold)]/30 rounded-lg p-3 text-sm text-gray-200">
                    <span className="text-[var(--color-gold-bright)] font-semibold">Steps: </span>{fix.recommendation}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
