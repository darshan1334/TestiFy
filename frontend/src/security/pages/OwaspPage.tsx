import { useEffect, useState } from "react";
import { useScan } from "../lib/ScanContext";
import { owaspTop10 } from "../lib/api";
import { ShieldAlert } from "lucide-react";

export default function OwaspPage() {
  const { result } = useScan();
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    owaspTop10().then(setCategories).catch(() => setCategories([]));
  }, []);

  const countByCategory = (id: string) =>
    result?.code.findings.filter((f) => f.category.startsWith(id)).length ?? 0;

  const maxCount = Math.max(1, ...categories.map((c) => countByCategory(c.id)));

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-3">
        <ShieldAlert className="text-[var(--color-vibranium-glow)]" size={26} />
        <div>
          <h1 className="font-display text-3xl font-bold text-white">OWASP Top 10 (2021)</h1>
          <p className="text-gray-400 text-sm">
            {result ? "Your findings mapped against each category" : "Load a scan to see your project's real distribution"}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {categories.map((c) => {
          const count = countByCategory(c.id);
          return (
            <div key={c.id} className="glass-panel rounded-xl p-4 flex items-center gap-4">
              <div className="w-20 shrink-0 font-mono text-[var(--color-gold-bright)] text-sm">{c.id}</div>
              <div className="flex-1">
                <div className="text-white text-sm font-medium mb-1.5">{c.name}</div>
                <div className="h-2 rounded-full bg-[var(--color-panel-2)] overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[var(--color-vibranium)] to-[var(--color-crit)]"
                    style={{ width: `${result ? (count / maxCount) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <div className="w-10 text-right font-mono text-white">{count}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
