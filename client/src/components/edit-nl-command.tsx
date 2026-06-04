import { useState, useRef, useEffect } from "react";

export type EditModel = "qwen36-local" | "gpt-5.5" | "minimax27";

interface ChangeEntry {
  id: string;
  prompt: string;
  result: string;
  time: string;
  ok: boolean;
  mode?: "assistant" | "edit";
}

const FONT_SIZES = [
  { label: 'XS (11px)', value: '11px' },
  { label: 'SM (13px)', value: '13px' },
  { label: 'MD (15px)', value: '15px' },
  { label: 'LG (17px)', value: '17px' },
  { label: 'XL (20px)', value: '20px' },
  { label: '2XL (24px)', value: '24px' },
] as const;

const FONT_FAMILIES = [
  { label: 'System', value: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  { label: 'Inter', value: '"Inter", system-ui, sans-serif' },
  { label: 'Mono', value: '"SF Mono", "Fira Code", "Cascadia Code", monospace' },
  { label: 'Serif', value: 'Georgia, "Noto Serif", serif' },
  { label: 'Rounded', value: '"Nunito", "Quicksand", system-ui, sans-serif' },
  { label: 'Comic', value: '"Comic Sans MS", "Chalkboard SE", cursive' },
] as const;

export function NLCommandPanel() {
  const [prompt, setPrompt] = useState("");
  const [sending, setSending] = useState(false);
  const [changes, setChanges] = useState<ChangeEntry[]>([]);
  const [model, setModel] = useState<EditModel>("qwen36-local");
  const [fontSize, setFontSize] = useState(() => localStorage.getItem('nl-font-size') || '15px');
  const [fontFamily, setFontFamily] = useState(() => localStorage.getItem('nl-font-family') || FONT_FAMILIES[0].value);
  const [showSettings, setShowSettings] = useState(false);
  const [gatewayStatus, setGatewayStatus] = useState<{ connected: boolean; mode: string } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fontSizeNum = parseFloat(fontSize);
  const fontSizeSmall = `${Math.max(fontSizeNum * 0.75, 9)}px`;
  const fontSizeResult = `${fontSizeNum * 0.85}px`;

  useEffect(() => { localStorage.setItem('nl-font-size', fontSize); }, [fontSize]);
  useEffect(() => { localStorage.setItem('nl-font-family', fontFamily); }, [fontFamily]);

  // Check Gateway status on mount
  useEffect(() => {
    fetch('/api/nl-command/status')
      .then(r => r.json())
      .then(d => setGatewayStatus({ connected: d.gatewayConnected, mode: d.mode }))
      .catch(() => setGatewayStatus({ connected: false, mode: 'unknown' }));
  }, []);

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
      const history = changes.flatMap(c => [
        { role: "user", content: c.prompt },
        { role: "assistant", content: c.result },
      ]);
      const res = await fetch("/api/edit/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: userPrompt, history, model }),
      });
      const data = await res.json();

      setChanges(prev =>
        prev.map(c =>
          c.id === entry.id
            ? { ...c, result: data.ok ? data.summary || "Done" : `Error: ${data.error}`, ok: data.ok, mode: data.mode === "assistant" ? "assistant" : (data.mode === "gateway-chat" ? "assistant" : "edit") }
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
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-300">Oscar Command</span>
              {gatewayStatus && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                  gatewayStatus.connected
                    ? 'bg-green-900/40 text-green-400 border border-green-800'
                    : 'bg-yellow-900/40 text-yellow-400 border border-yellow-800'
                }`}>
                  {gatewayStatus.connected ? '● Gateway' : '● Fallback'}
                </span>
              )}
            </div>
            <p className="text-[10px] text-gray-600 mt-0.5">
              {gatewayStatus?.connected
                ? 'Full session: tools, memory, context'
                : 'Chat normally, or ask for app changes'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings(v => !v)}
              className={`text-[10px] px-1.5 py-1 rounded border transition-colors ${showSettings ? 'border-blue-500 text-blue-400 bg-blue-900/30' : 'border-gray-700 text-gray-500 hover:text-gray-300'}`}
              title="Text settings"
            >
              Aa
            </button>
            <select
              value={model}
              onChange={e => setModel(e.target.value as EditModel)}
              className="bg-gray-800 border border-gray-700 rounded text-[10px] text-gray-300 px-1.5 py-1 focus:outline-none focus:border-blue-600"
            >
              <option value="qwen36-local">qwen36-local</option>
              <option value="gpt-5.5">gpt-5.5</option>
              <option value="minimax27">minimax27</option>
            </select>
          </div>
        </div>
        {showSettings && (
          <div className="flex items-center gap-3 mt-2 pt-2 border-t border-gray-800">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-gray-500">Size:</span>
              <select
                value={fontSize}
                onChange={e => setFontSize(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded text-[10px] text-gray-300 px-1 py-0.5 focus:outline-none focus:border-blue-600"
              >
                {FONT_SIZES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-gray-500">Font:</span>
              <select
                value={fontFamily}
                onChange={e => setFontFamily(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded text-[10px] text-gray-300 px-1 py-0.5 focus:outline-none focus:border-blue-600"
              >
                {FONT_FAMILIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Change log */}
      <div className="flex-1 overflow-auto p-2 space-y-2">
        {changes.length === 0 && (
          <div className="text-center text-gray-700 py-8">
            <p className="text-xs">No messages yet</p>
            <p className="text-[10px] mt-1">Try: "Oscar, do you copy?"</p>
          </div>
        )}
        {changes.map(c => (
          <div key={c.id} className={`rounded-lg p-2 border ${c.ok ? "border-gray-800" : "border-red-900"}`}
            style={{ fontFamily }}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-white" style={{ fontSize }}>{c.prompt}</p>
              <span className="text-gray-600 shrink-0" style={{ fontSize: '10px' }}>{c.time}</span>
            </div>
            <p className={`mt-1 whitespace-pre-wrap break-words ${c.ok ? (c.mode === "assistant" ? "text-blue-300" : "text-green-500") : "text-red-500"}`}
              style={{ fontSize: '90%' }}>{c.result}</p>
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
            placeholder="Talk to Oscar or describe a change..."
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
            {sending ? "..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
