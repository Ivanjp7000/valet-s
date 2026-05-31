import { useState, useRef, useEffect } from "react";

interface ChangeEntry {
  id: string;
  prompt: string;
  result: string;
  time: string;
  ok: boolean;
}

export function NLCommandPanel() {
  const [prompt, setPrompt] = useState("");
  const [sending, setSending] = useState(false);
  const [changes, setChanges] = useState<ChangeEntry[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [changes]);

  const handleSend = async () => {
    if (!prompt.trim() || sending) return;
    const userPrompt = prompt.trim();
    setPrompt("");
    setSending(true);

    const entry: ChangeEntry = {
      id: Date.now().toString(),
      prompt: userPrompt,
      result: "Processing...",
      time: new Date().toLocaleTimeString(),
      ok: true,
    };
    setChanges(prev => [...prev, entry]);

    try {
      // Send to Oscar via the edit API
      const res = await fetch("/api/edit/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: userPrompt }),
      });
      const data = await res.json();

      setChanges(prev =>
        prev.map(c =>
          c.id === entry.id
            ? { ...c, result: data.ok ? data.summary || "Changes applied" : `Error: ${data.error}`, ok: data.ok }
            : c
        )
      );
    } catch (e: any) {
      setChanges(prev =>
        prev.map(c =>
          c.id === entry.id ? { ...c, result: `Error: ${e.message}`, ok: false } : c
        )
      );
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-950">
      {/* Header */}
      <div className="px-3 py-2 bg-gray-900 border-b border-gray-800">
        <span className="text-xs font-semibold text-gray-300">🤖 Natural Language Editor</span>
        <p className="text-[10px] text-gray-600 mt-0.5">Describe changes in plain English</p>
      </div>

      {/* Change log */}
      <div className="flex-1 overflow-auto p-2 space-y-2">
        {changes.length === 0 && (
          <div className="text-center text-gray-700 py-8">
            <p className="text-xs">No changes yet</p>
            <p className="text-[10px] mt-1">Try: "Make the hero section darker"</p>
          </div>
        )}
        {changes.map(c => (
          <div key={c.id} className={`rounded-lg p-2 border ${c.ok ? "border-gray-800" : "border-red-900"}`}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs text-white">{c.prompt}</p>
              <span className="text-[9px] text-gray-600 shrink-0">{c.time}</span>
            </div>
            <p className={`text-[10px] mt-1 ${c.ok ? "text-green-500" : "text-red-500"}`}>{c.result}</p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-2 border-t border-gray-800">
        <div className="flex gap-2">
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe the change..."
            rows={3}
            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-600 resize-none"
          />
          <button
            onClick={handleSend}
            disabled={sending || !prompt.trim()}
            className={`px-3 rounded-lg text-xs font-medium transition-colors shrink-0 ${
              sending || !prompt.trim()
                ? "bg-gray-800 text-gray-600 cursor-wait"
                : "bg-blue-700 text-white hover:bg-blue-600"
            }`}
          >
            {sending ? "..." : "🚀"}
          </button>
        </div>
      </div>
    </div>
  );
}
