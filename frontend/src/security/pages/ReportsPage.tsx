import { useScan } from "../lib/ScanContext";
import { useNavigate } from "react-router-dom";
import { reportUrl } from "../lib/api";
import { FileOutput, FileJson, FileCode2, FileText, File } from "lucide-react";

const FORMATS = [
  { key: "pdf", label: "PDF Report", desc: "Executive-ready PDF summary + findings table", icon: File },
  { key: "html", label: "HTML Report", desc: "Standalone themed HTML report", icon: FileCode2 },
  { key: "json", label: "JSON Report", desc: "Full machine-readable results", icon: FileJson },
  { key: "sarif", label: "SARIF 2.1.0", desc: "Import directly into GitHub Code Scanning", icon: FileText },
];

export default function ReportsPage() {
  const { result, scanId } = useScan();
  const nav = useNavigate();

  if (!result || !scanId) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-center px-6">
        <h2 className="font-display text-2xl text-white mb-2">No scan loaded</h2>
        <button onClick={() => nav("/security/upload")} className="mt-4 px-6 py-2.5 rounded-lg font-display font-bold text-black bg-gradient-to-r from-[var(--color-gold-bright)] to-[var(--color-gold)]">
          Upload Project
        </button>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-3">
        <FileOutput className="text-[var(--color-vibranium-glow)]" size={26} />
        <div>
          <h1 className="font-display text-3xl font-bold text-white">Reports</h1>
          <p className="text-gray-400 text-sm">Export real scan results for {result.project_name}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {FORMATS.map(({ key, label, desc, icon: Icon }) => (
          <a key={key} href={reportUrl(scanId, key)} target="_blank" rel="noreferrer"
             className="glass-panel rounded-xl p-6 flex items-start gap-4 hover:border-[var(--color-vibranium)] transition-colors group">
            <div className="w-11 h-11 rounded-lg bg-[var(--color-vibranium)]/20 flex items-center justify-center shrink-0">
              <Icon size={20} className="text-[var(--color-vibranium-glow)]" />
            </div>
            <div>
              <div className="text-white font-display font-bold text-lg group-hover:text-[var(--color-gold-bright)] transition-colors">{label}</div>
              <div className="text-gray-400 text-sm mt-1">{desc}</div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
