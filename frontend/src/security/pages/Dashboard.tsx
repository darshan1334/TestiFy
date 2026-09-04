import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { useScan } from "../lib/ScanContext";
import { StatCard } from "../components/Severity";
import SecurityHero from "../components/SecurityHero";
import { ShieldAlert, KeyRound, PackageSearch, Gauge, ScanSearch } from "lucide-react";

ChartJS.register(ArcElement, Tooltip, Legend);

export default function Dashboard() {
  const { result, status, progress } = useScan();
  const nav = useNavigate();

  if (!result) {
    return (
      <div className="relative min-h-[calc(100vh-0px)] overflow-hidden bg-grid">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0b0616]/40 to-[#07040d]" />
        <SecurityHero />
        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 text-center">
          <motion.span
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="text-xs tracking-[0.35em] uppercase text-[var(--color-gold-bright)] mb-4 gold-glow-text"
          >
            AI-Powered Application Security
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="font-display text-5xl md:text-7xl font-bold text-white glow-text tracking-tight"
          >
            TestiFy <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--color-vibranium-bright)] to-[var(--color-gold-bright)]">Security</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="mt-5 max-w-xl text-gray-300 text-lg"
          >
            AI-powered Static Application Security Testing. Upload your source
            code and instantly detect real vulnerabilities — no mock data, no
            guesswork.
          </motion.p>
          <motion.button
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            onClick={() => nav("/security/upload")}
            className="mt-9 px-8 py-3.5 rounded-lg font-display font-bold text-black bg-gradient-to-r from-[var(--color-gold-bright)] to-[var(--color-gold)] shadow-[0_0_40px_rgba(230,193,112,0.35)] hover:scale-105 transition-transform"
          >
            Scan Project →
          </motion.button>
          {status === "running" && (
            <div className="mt-8 text-sm text-[var(--color-vibranium-glow)] font-mono">
              {progress?.message || "Scan in progress..."}
            </div>
          )}
        </div>
      </div>
    );
  }

  const sev = result.code.severity_counts;
  const doughnutData = {
    labels: ["Critical", "High", "Medium", "Low"],
    datasets: [{
      data: [sev.critical, sev.high, sev.medium, sev.low],
      backgroundColor: ["#e63946", "#f4a261", "#e9c46a", "#2a9d8f"],
      borderColor: "#0b0616",
      borderWidth: 3,
    }],
  };

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">
            Project: <span className="text-[var(--color-gold-bright)] font-mono">{result.project_name}</span>
          </p>
        </div>
        <button onClick={() => nav("/security/upload")} className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm text-gray-300 hover:border-[var(--color-vibranium)] hover:text-white transition-colors">
          New Scan
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="Risk Score" value={result.code.risk_score} color="var(--color-gold-bright)" icon={Gauge} />
        <StatCard label="Critical" value={sev.critical} color="var(--color-crit)" icon={ShieldAlert} />
        <StatCard label="High" value={sev.high} color="var(--color-high)" icon={ShieldAlert} />
        <StatCard label="Secrets" value={result.secrets.total_secrets} color="var(--color-vibranium-bright)" icon={KeyRound} />
        <StatCard label="Vuln. Deps" value={result.dependencies.vulnerable_count} color="var(--color-med)" icon={PackageSearch} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass-panel rounded-xl p-6 lg:col-span-1">
          <h3 className="font-display text-lg text-white mb-4 flex items-center gap-2"><ShieldAlert size={18} className="text-[var(--color-vibranium-glow)]" /> Severity Breakdown</h3>
          <Doughnut data={doughnutData} options={{ plugins: { legend: { labels: { color: "#cbd5e1" } } } }} />
        </div>

        <div className="glass-panel rounded-xl p-6 lg:col-span-2">
          <h3 className="font-display text-lg text-white mb-4 flex items-center gap-2"><ScanSearch size={18} className="text-[var(--color-vibranium-glow)]" /> Scan Coverage</h3>
          <div className="grid grid-cols-2 gap-4 text-sm mb-4">
            <div className="text-gray-400">Files scanned <span className="float-right text-white font-mono">{result.code.files_scanned}</span></div>
            <div className="text-gray-400">Lines analyzed <span className="float-right text-white font-mono">{result.code.total_lines.toLocaleString()}</span></div>
            <div className="text-gray-400">Rules evaluated <span className="float-right text-white font-mono">{result.code.rules_evaluated}</span></div>
            <div className="text-gray-400">Scan duration <span className="float-right text-white font-mono">{result.code.scan_duration_seconds}s</span></div>
          </div>
          <div className="space-y-2">
            {Object.entries(result.code.languages).map(([lang, count]) => (
              <div key={lang} className="flex items-center gap-3 text-xs">
                <span className="w-24 text-gray-400 capitalize">{lang}</span>
                <div className="flex-1 h-2 rounded-full bg-[var(--color-panel-2)] overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[var(--color-vibranium)] to-[var(--color-vibranium-bright)]"
                       style={{ width: `${Math.min(100, (count / result.code.files_scanned) * 100)}%` }} />
                </div>
                <span className="w-8 text-right text-gray-500 font-mono">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
