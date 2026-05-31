import { useState, useRef, useEffect, useCallback } from "react";

interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
  ext?: string;
}

interface FileTreeProps {
  onSelectFile: (path: string) => void;
  selectedPath: string | null;
}

export function FileTree({ onSelectFile, selectedPath }: FileTreeProps) {
  const [tree, setTree] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["pages", "components", "hooks", "lib", "styles", "content"]));
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    fetch("/api/edit/tree")
      .then(r => r.json())
      .then(d => { if (d.ok) setTree(d.tree); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const toggleDir = (path: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const matchesSearch = (node: FileNode): boolean => {
    if (search && node.name.toLowerCase().includes(search.toLowerCase())) return true;
    if (node.children) return node.children.some(matchesSearch);
    return false;
  };

  const renderNode = (node: FileNode, depth = 0) => {
    if (search && !matchesSearch(node)) return null;

    const isSelected = node.type === "file" && selectedPath === node.path;

    if (node.type === "directory") {
      const isExpanded = expanded.has(node.path);
      return (
        <div key={node.path}>
          <button
            onClick={() => toggleDir(node.path)}
            className="w-full flex items-center gap-1 py-0.5 px-1 hover:bg-blue-900/30 rounded text-left"
            style={{ paddingLeft: `${depth * 12 + 4}px` }}
          >
            <span className="text-[10px] text-gray-500 w-3">{isExpanded ? "▼" : "▶"}</span>
            <span className="text-gray-400">📁</span>
            <span className="text-xs text-gray-300 truncate">{node.name}</span>
          </button>
          {isExpanded && node.children?.map(c => renderNode(c, depth + 1))}
        </div>
      );
    }

    const extIcons: Record<string, string> = {
      ".tsx": "⚛️", ".ts": "🔷", ".jsx": "⚛️", ".js": "📜",
      ".css": "🎨", ".json": "📋", ".md": "📝", ".html": "🌐",
    };
    const icon = extIcons[node.ext || ""] || "📄";

    return (
      <button
        key={node.path}
        onClick={() => onSelectFile(node.path)}
        className={`w-full flex items-center gap-1 py-0.5 px-1 rounded text-left transition-colors ${
          isSelected ? "bg-blue-800/50 text-white" : "hover:bg-blue-900/30 text-gray-400"
        }`}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        <span className="text-[10px] w-3">{""}</span>
        <span className="text-[10px]">{icon}</span>
        <span className="text-xs truncate">{node.name}</span>
      </button>
    );
  };

  return (
    <div className="flex flex-col h-full bg-gray-950">
      {/* Search */}
      <div className="p-2 border-b border-gray-800">
        <input
          type="text"
          value={search}
          onChange={e => {
            setSearch(e.target.value);
            if (e.target.value) setExpanded(new Set(tree.flatMap(n => n.type === 'directory' ? [n.path, ...(n.children || [])] : [])));
          }}
          placeholder="Filter files..."
          className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-600"
        />
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-auto p-1 scrollbar-thin">
        {loading && <div className="text-xs text-gray-500 p-2">Loading...</div>}
        {error && <div className="text-xs text-red-500 p-2">Error: {error}</div>}
        {!loading && !error && tree.map(n => renderNode(n))}
      </div>

      <div className="text-[10px] text-gray-600 px-2 py-1 border-t border-gray-800">
        client/src/ — {tree.reduce((acc, n) => acc + (n.type === 'file' ? 1 : (n.children?.length || 0) + 1), 0)} items
      </div>
    </div>
  );
}
