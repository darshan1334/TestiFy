import { Settings, Server, KeyRound } from "lucide-react";
import { API_BASE } from "../lib/api";

const ENDPOINT = `${API_BASE || window.location.origin}/api/security`;

export default function SettingsPage() {
  return (
    <div className="p-8 space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Settings className="text-[var(--color-vibranium-glow)]" size={26} />
        <h1 className="font-display text-3xl font-bold text-white">Settings</h1>
      </div>

      <div className="glass-panel rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Server size={18} className="text-[var(--color-gold-bright)]" />
          <div>
            <div className="text-white font-medium">API Endpoint</div>
            <div className="text-gray-500 text-sm font-mono">{ENDPOINT}</div>
          </div>
        </div>
        <p className="text-xs text-gray-500">Served by the TestiFy backend under the <code className="text-[var(--color-vibranium-glow)]">/api/security</code> prefix.</p>
      </div>

      <div className="glass-panel rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <KeyRound size={18} className="text-[var(--color-gold-bright)]" />
          <div>
            <div className="text-white font-medium">AI Recommendations</div>
            <div className="text-gray-500 text-sm">Powered by the Anthropic API on the backend</div>
          </div>
        </div>
        <p className="text-xs text-gray-500">
          Set <code className="text-[var(--color-vibranium-glow)]">ANTHROPIC_API_KEY</code> as an environment
          variable on the backend server to enable model-generated fixes. Without it, AI Recommendations falls
          back to the static, rule-authored remediation text (still real — just not model-generated).
        </p>
      </div>
    </div>
  );
}
