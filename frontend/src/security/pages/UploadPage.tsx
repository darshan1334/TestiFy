import { useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { UploadCloud, Code2, GitBranch, FolderArchive, Loader2 } from "lucide-react";
import { uploadZip, scanGitRepo } from "../lib/api";
import { useScan } from "../lib/ScanContext";

export default function UploadPage() {
  const [dragOver, setDragOver] = useState(false);
  const [repoUrl, setRepoUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nav = useNavigate();
  const { setScanId } = useScan();

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith(".zip")) {
      setError("Only .zip archives are supported. Compress your project folder first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { scan_id } = await uploadZip(file);
      setScanId(scan_id);
      nav("/security");
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Upload failed. Is the backend running?");
    } finally {
      setBusy(false);
    }
  }, [nav, setScanId]);

  const handleGit = useCallback(async () => {
    if (!repoUrl) return;
    setBusy(true);
    setError(null);
    try {
      const { scan_id } = await scanGitRepo(repoUrl);
      setScanId(scan_id);
      nav("/security");
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Repository clone failed.");
    } finally {
      setBusy(false);
    }
  }, [repoUrl, nav, setScanId]);

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold text-white">Upload Project</h1>
        <p className="text-gray-400 text-sm mt-1">Your code is scanned on this server and never leaves your infrastructure.</p>
      </div>

      <motion.div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault(); setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) handleFile(f);
        }}
        onClick={() => inputRef.current?.click()}
        animate={{ borderColor: dragOver ? "#9a6bff" : "#2c1c48", scale: dragOver ? 1.01 : 1 }}
        className="glass-panel rounded-2xl border-2 border-dashed p-16 flex flex-col items-center justify-center text-center cursor-pointer relative overflow-hidden scanline"
      >
        <input ref={inputRef} type="file" accept=".zip" className="hidden"
               onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
        {busy ? (
          <Loader2 size={48} className="text-[var(--color-vibranium-bright)] animate-spin mb-4" />
        ) : (
          <UploadCloud size={48} className="text-[var(--color-vibranium-bright)] mb-4" />
        )}
        <p className="text-white font-display text-xl">{busy ? "Uploading & scanning..." : "Drag & Drop your project"}</p>
        <p className="text-gray-500 text-sm mt-2">or click to browse — .zip archives only</p>
        <div className="flex gap-3 mt-6 text-xs text-gray-500">
          <span className="px-3 py-1 rounded-full border border-[var(--color-border)]">ZIP</span>
          <span className="px-3 py-1 rounded-full border border-[var(--color-border)]">Folder → ZIP</span>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { icon: Code2, label: "GitHub", placeholder: "https://github.com/org/repo" },
          { icon: GitBranch, label: "GitLab", placeholder: "https://gitlab.com/org/repo" },
          { icon: FolderArchive, label: "Bitbucket", placeholder: "https://bitbucket.org/org/repo" },
        ].map(({ icon: Icon, label }) => (
          <div key={label} className="glass-panel rounded-xl p-4 flex items-center gap-3 text-gray-300">
            <Icon size={20} className="text-[var(--color-gold-bright)]" />
            <span className="font-medium">{label}</span>
          </div>
        ))}
      </div>

      <div className="glass-panel rounded-xl p-6">
        <h3 className="font-display text-lg text-white mb-3">Scan a public Git repository</h3>
        <div className="flex gap-3">
          <input
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="https://github.com/org/repo.git"
            className="flex-1 bg-[var(--color-void-2)] border border-[var(--color-border)] rounded-lg px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-[var(--color-vibranium)]"
          />
          <button
            onClick={handleGit}
            disabled={busy || !repoUrl}
            className="px-6 py-2.5 rounded-lg font-display font-bold text-black bg-gradient-to-r from-[var(--color-gold-bright)] to-[var(--color-gold)] disabled:opacity-40"
          >
            Clone & Scan
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">Performs a real shallow `git clone` on the server, then runs the full analysis pipeline.</p>
      </div>

      {error && (
        <div className="rounded-lg border border-[var(--color-crit)]/40 bg-[var(--color-crit)]/10 text-[var(--color-crit)] px-4 py-3 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
