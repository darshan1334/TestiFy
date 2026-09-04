import { useState } from "react";
import { useScan } from "../lib/ScanContext";
import { useNavigate } from "react-router-dom";
import { reportUrl } from "../lib/api";
import { FileStack, Download, Network } from "lucide-react";

export default function SBOMPage() {
  const { result, scanId } = useScan();
  const nav = useNavigate();
  const [format, setFormat] = useState<"cyclonedx" | "spdx">("cyclonedx");

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

  const sbom = format === "cyclonedx" ? result.sbom_cyclonedx : result.sbom_spdx;
  const components = format === "cyclonedx" ? sbom.components : sbom.packages;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileStack className="text-[var(--color-vibranium-glow)]" size={26} />
          <div>
            <h1 className="font-display text-3xl font-bold text-white">Software Bill of Materials</h1>
            <p className="text-gray-400 text-sm">{components.length} components · Generated in real CycloneDX 1.5 / SPDX 2.3 spec format</p>
          </div>
        </div>
        <a href={reportUrl(scanId, format)} target="_blank" rel="noreferrer"
           className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-display font-bold text-black bg-gradient-to-r from-[var(--color-gold-bright)] to-[var(--color-gold)]">
          <Download size={16} /> Download {format === "cyclonedx" ? "CycloneDX" : "SPDX"}
        </a>
      </div>

      <div className="flex gap-2">
        {(["cyclonedx", "spdx"] as const).map((f) => (
          <button key={f} onClick={() => setFormat(f)}
            className={`px-4 py-1.5 rounded-lg text-sm font-mono uppercase border ${
              format === f ? "bg-[var(--color-vibranium)]/30 border-[var(--color-vibranium)] text-white" : "border-[var(--color-border)] text-gray-400"
            }`}>
            {f === "cyclonedx" ? "CycloneDX" : "SPDX"}
          </button>
        ))}
      </div>

      <div className="glass-panel rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4 text-gray-400 text-sm">
          <Network size={16} className="text-[var(--color-vibranium-glow)]" /> Component Graph (dependency list)
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {components.map((c: any, i: number) => (
            <div key={i} className="flex items-center justify-between bg-[var(--color-void-2)] rounded-lg px-3 py-2 text-sm border border-[var(--color-border)]/60">
              <span className="text-white font-mono">{c.name}</span>
              <span className="text-gray-500 font-mono text-xs">{c.version || c.versionInfo}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
