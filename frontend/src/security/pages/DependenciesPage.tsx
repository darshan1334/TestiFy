import { useScan } from "../lib/ScanContext";
import { SeverityBadge } from "../components/Severity";
import { useNavigate } from "react-router-dom";
import { PackageSearch, ExternalLink, AlertTriangle } from "lucide-react";

export default function DependenciesPage() {
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

  const { dependencies } = result;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-3">
        <PackageSearch className="text-[var(--color-vibranium-glow)]" size={26} />
        <div>
          <h1 className="font-display text-3xl font-bold text-white">Dependency Scanner</h1>
          <p className="text-gray-400 text-sm">
            {dependencies.total_dependencies} dependencies · {dependencies.vulnerable_count} with known CVEs (OSV.dev)
          </p>
        </div>
      </div>

      {!dependencies.lookup_available && dependencies.total_dependencies > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-[var(--color-med)]/40 bg-[var(--color-med)]/10 text-[var(--color-med)] px-4 py-3 text-sm">
          <AlertTriangle size={16} />
          Live CVE lookup against OSV.dev was unavailable from this environment (no network egress). Dependencies
          were parsed correctly; deploy with outbound internet access to see real CVE matches.
        </div>
      )}

      <div className="glass-panel rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-void-2)] text-gray-400 uppercase text-[11px] tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">Package</th>
              <th className="text-left px-4 py-3">Version</th>
              <th className="text-left px-4 py-3">Ecosystem</th>
              <th className="text-left px-4 py-3">Manifest</th>
              <th className="text-left px-4 py-3">Known CVEs</th>
            </tr>
          </thead>
          <tbody>
            {dependencies.dependencies.map((d) => (
              <tr key={`${d.ecosystem}-${d.name}`} className="border-t border-[var(--color-border)]/50 hover:bg-white/5 align-top">
                <td className="px-4 py-3 text-white font-medium">{d.name}</td>
                <td className="px-4 py-3 font-mono text-gray-400">{d.version}</td>
                <td className="px-4 py-3 text-gray-400">{d.ecosystem}</td>
                <td className="px-4 py-3 font-mono text-gray-500 text-xs">{d.manifest_file}</td>
                <td className="px-4 py-3">
                  {d.vulnerabilities.length === 0 ? (
                    <span className="text-gray-600 text-xs">none found</span>
                  ) : (
                    <div className="space-y-1.5">
                      {d.vulnerabilities.map((v) => (
                        <div key={v.id} className="flex items-center gap-2">
                          <SeverityBadge level={v.severity} />
                          <span className="text-gray-300">{v.id}</span>
                          {v.fixed_version && <span className="text-gray-500">→ fix: {v.fixed_version}</span>}
                          <a href={v.url} target="_blank" rel="noreferrer" className="text-[var(--color-vibranium-glow)]">
                            <ExternalLink size={12} />
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
