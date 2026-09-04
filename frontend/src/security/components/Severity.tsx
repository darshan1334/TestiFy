export const SEV_COLOR: Record<string, string> = {
  critical: "var(--color-crit)",
  high: "var(--color-high)",
  medium: "var(--color-med)",
  low: "var(--color-low)",
};

export function SeverityBadge({ level }: { level: string }) {
  const color = SEV_COLOR[level] || "#888";
  return (
    <span
      className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase font-mono"
      style={{ color, background: `${color}1a`, border: `1px solid ${color}55` }}
    >
      {level}
    </span>
  );
}

export function StatCard({ label, value, color, icon: Icon }: { label: string; value: string | number; color?: string; icon?: any }) {
  return (
    <div className="glass-panel rounded-xl p-5 relative overflow-hidden">
      <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full blur-2xl opacity-20" style={{ background: color || "#9a6bff" }} />
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] uppercase tracking-[0.15em] text-gray-400">{label}</span>
        {Icon && <Icon size={16} style={{ color: color || "#9a6bff" }} />}
      </div>
      <div className="text-3xl font-display font-bold" style={{ color: color || "#fff" }}>{value}</div>
    </div>
  );
}
