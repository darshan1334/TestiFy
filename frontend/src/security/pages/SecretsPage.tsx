import { useScan } from "../lib/ScanContext";
import { SeverityBadge } from "../components/Severity";
import { useNavigate } from "react-router-dom";
import { KeyRound } from "lucide-react";

export default function SecretsPage() {
  const { result } = useScan();
  const nav = useNavigate();

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

  const { secrets } = result;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-3">
        <KeyRound className="text-[var(--color-vibranium-glow)]" size={26} />
        <div>
          <h1 className="font-display text-3xl font-bold text-white">Secrets Detection</h1>
          <p className="text-gray-400 text-sm">{secrets.total_secrets} secret(s) found across {secrets.files_scanned} files scanned</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {Object.entries(secrets.by_type).map(([type, count]) => (
          <div key={type} className="glass-panel px-4 py-2 rounded-lg text-sm text-gray-300">
            {type} <span className="text-[var(--color-gold-bright)] font-mono ml-2">{count}</span>
          </div>
        ))}
        {secrets.total_secrets === 0 && (
          <div className="text-gray-500 text-sm">No hardcoded credentials detected. Clean pass. ✅</div>
        )}
      </div>

      <div className="glass-panel rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-void-2)] text-gray-400 uppercase text-[11px] tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">Severity</th>
              <th className="text-left px-4 py-3">Type</th>
              <th className="text-left px-4 py-3">Location</th>
              <th className="text-left px-4 py-3">Masked Value</th>
              <th className="text-left px-4 py-3">Method</th>
            </tr>
          </thead>
          <tbody>
            {secrets.findings.map((s) => (
              <tr key={s.id} className="border-t border-[var(--color-border)]/50 hover:bg-white/5">
                <td className="px-4 py-3"><SeverityBadge level={s.severity} /></td>
                <td className="px-4 py-3 text-white">{s.type}</td>
                <td className="px-4 py-3 font-mono text-gray-400">{s.file}:{s.line}</td>
                <td className="px-4 py-3 font-mono text-[var(--color-gold-bright)]">{s.masked_value}</td>
                <td className="px-4 py-3 text-gray-500 text-xs uppercase">{s.method}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
