import { useState, useEffect, useCallback } from "react";
import Editor from "@monaco-editor/react";

interface CodeEditorProps {
  filePath: string | null;
  onSave: (path: string, content: string) => void;
}

export function CodeEditor({ filePath, onSave }: CodeEditorProps) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [lang, setLang] = useState<"typescript" | "css" | "json" | "plaintext">("typescript");

  // Load file when path changes
  useEffect(() => {
    if (!filePath) return;
    setLoading(true);
    setError(null);
    fetch(`/api/edit/file/${encodeURIComponent(filePath)}`)
      .then(r => r.json())
      .then(d => {
        if (d.ok) {
          setContent(d.content);
          setSaved(true);
          // Detect language
          const ext = filePath.split(".").pop();
          if (ext === "css") setLang("css");
          else if (ext === "json") setLang("json");
          else if (ext === "tsx" || ext === "ts") setLang("typescript");
          else setLang("plaintext");
        } else {
          setError(d.error || "Failed to load");
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [filePath]);

  const handleSave = useCallback(async () => {
    if (!filePath) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/edit/file/${encodeURIComponent(filePath)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (data.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } else {
        setError(data.error || "Save failed");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filePath, content]);

  // Keyboard shortcut: Ctrl/Cmd+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSave]);

  const handleEditorChange = (val: string | undefined) => {
    if (val !== undefined) {
      setContent(val);
      setSaved(false);
    }
  };

  if (!filePath) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-600">
        <span className="text-4xl mb-2">📝</span>
        <span className="text-sm">Select a file to edit</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 font-mono truncate max-w-[200px]">{filePath}</span>
          {saved && <span className="text-[10px] text-green-500">✓ saved</span>}
          {!saved && <span className="text-[10px] text-yellow-500">● modified</span>}
        </div>
        <div className="flex items-center gap-2">
          {error && <span className="text-xs text-red-500">{error}</span>}
          <button
            onClick={handleSave}
            disabled={loading || saved}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              loading
                ? "bg-gray-700 text-gray-500 cursor-wait"
                : saved
                ? "bg-gray-700 text-gray-500"
                : "bg-blue-700 text-white hover:bg-blue-600"
            }`}
          >
            {loading ? "..." : "💾 Save"}
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        <Editor
          height="100%"
          language={lang}
          value={content}
          onChange={handleEditorChange}
          theme="vs-dark"
          options={{
            fontSize: 13,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
            minimap: { enabled: false },
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: "off",
            bracketPairColorization: { enabled: true },
            guides: { bracketPairs: true, indentation: true },
            padding: { top: 8, bottom: 8 },
          }}
        />
      </div>
    </div>
  );
}
