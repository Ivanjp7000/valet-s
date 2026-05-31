import { useState, useEffect } from "react";

interface GitBarProps {
  onReload?: () => void;
}

export function GitStatusBar({ onReload }: GitBarProps) {
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  // Poll git status every 10s
  const refreshStatus = () => {
    fetch("/api/edit/git/status")
      .then(r => r.json())
      .then(d => { if (d.ok) setFiles(d.changedFiles || []); });
  };

  useEffect(() => {
    refreshStatus();
    const interval = setInterval(refreshStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const runAction = async (action: string) => {
    setLoading(action);
    try {
      const url = `/api/edit/git/${action}`;
      const body = action === "commit" ? { message: message || "Edit: " + new Date().toLocaleTimeString() } : {};
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!data.ok) alert(data.error);
      refreshStatus();
      if (action === "push") onReload?.();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(null);
    }
  };

  if (files.length === 0 && !loading) {
    return (
      <div className="flex items-center justify-between px-3 py-1 bg-gray-900 border-t border-gray-800">
        <span className="text-[10px] text-green-500">✓ No changes</span>
        <span className="text-[10px] text-gray-600">git</span>
      </div>
    );
  }

  return (
    <div className="px-3 py-1.5 bg-gray-900 border-t border-gray-800 space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-yellow-500">{files.length} changed</span>
        <span className="text-[10px] text-gray-500 truncate">{files.map(f => f.file).join(", ")}</span>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Commit message..."
          className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-[10px] text-white placeholder-gray-600 focus:outline-none focus:border-blue-600"
        />
        <button
          onClick={() => runAction("stage")}
          disabled={loading !== null}
          className="px-2 py-0.5 rounded text-[10px] bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-50"
        >
          📎 Stage
        </button>
        <button
          onClick={() => runAction("commit")}
          disabled={loading !== null}
          className="px-2 py-0.5 rounded text-[10px] bg-blue-800 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          💾 Commit
        </button>
        <button
          onClick={() => runAction("push")}
          disabled={loading !== null}
          className="px-2 py-0.5 rounded text-[10px] bg-green-800 text-white hover:bg-green-700 disabled:opacity-50"
        >
          🚀 Push + Deploy
        </button>
      </div>
    </div>
  );
}
