// View — responsive testing harness + live editor
// Two modes: Preview (device frames only) and Editor (file tree + Monaco / NL commands + preview)

import { useState, useRef, useEffect, useCallback } from "react";
import { FileTree } from "@/components/edit-file-tree";
import { CodeEditor } from "@/components/edit-code-editor";
import { NLCommandPanel } from "@/components/edit-nl-command";
import { GitStatusBar } from "@/components/edit-git-bar";

// ── Types ──────────────────────────────────────────────────────
interface DevicePreset {
  id: string;
  label: string;
  icon: string;
  width: number;
  height: number;
  borderRounded: boolean;
  notch: boolean;
  chrome: boolean;
}

const DEVICES: DevicePreset[] = [
  { id: "desktop", label: "Desktop", icon: "🖥️", width: 1280, height: 800, borderRounded: false, notch: false, chrome: true },
  { id: "ipad", label: "iPad", icon: "⬛", width: 810, height: 1080, borderRounded: true, notch: false, chrome: false },
  { id: "iphone", label: "iPhone", icon: "📲", width: 393, height: 852, borderRounded: true, notch: true, chrome: false },
  { id: "android", label: "Android", icon: "🤖", width: 412, height: 915, borderRounded: true, notch: false, chrome: false },
];

const QUICK_PAGES = [
  { label: "Landing", icon: "🏠", path: "/" },
  { label: "Login", icon: "🔐", path: "/sro" },
  { label: "Dashboard", icon: "📊", path: "/home" },
  { label: "Staff", icon: "👨‍💼", path: "/staff" },
  { label: "Admin", icon: "⚙️", path: "/admin" },
  { label: "Docs", icon: "📖", path: "/docs" },
];

// ── Storage ────────────────────────────────────────────────────
const STORAGE_KEY = "valet-view-settings";

interface ViewSettings {
  targetPath: string;
  showDevices: string[];
  editorMode?: boolean;
  rightPanel?: "editor" | "nl";
}

function loadSettings(): ViewSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.showDevices) && parsed.showDevices.length > 0) {
        return {
          targetPath: parsed.targetPath || "/",
          showDevices: parsed.showDevices.filter((id: string) => DEVICES.some((d) => d.id === id)),
          editorMode: parsed.editorMode || false,
          rightPanel: parsed.rightPanel || "editor",
        };
      }
    }
  } catch {}
  return { targetPath: "/", showDevices: DEVICES.map((d) => d.id), editorMode: false, rightPanel: "editor" };
}

function saveSettings(s: ViewSettings) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {}
}

// ── Device Frame ───────────────────────────────────────────────
function DeviceFrame({
  device,
  pageUrl,
  refreshKey,
  syncScrollRef,
}: {
  device: DevicePreset;
  pageUrl: string;
  refreshKey: number;
  syncScrollRef: React.MutableRefObject<Map<string, number> | null>;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [scale, setScale] = useState(0.5);
  const [loaded, setLoaded] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);

  // Auto-scale
  useEffect(() => {
    const updateScale = () => {
      const wrapper = wrapperRef.current;
      if (!wrapper) return;
      const availH = window.innerHeight - 180;
      const parent = wrapper.parentElement;
      const availW = parent ? parent.clientWidth : 500;
      const chromeOffset = device.chrome ? 40 : 0;
      const sH = availH / (device.height + chromeOffset);
      const sW = (availW - 20) / device.width;
      setScale(Math.min(1, sH, sW));
    };
    requestAnimationFrame(updateScale);
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [device.height, device.width, device.chrome]);

  // Scroll sync
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    let lastSent = 0;
    const handleScroll = () => {
      const now = Date.now();
      if (now - lastSent < 50) return;
      lastSent = now;
      const scrollY = iframe.contentWindow?.scrollY ?? 0;
      if (syncScrollRef.current) syncScrollRef.current.set(device.id, scrollY);
    };
    iframe.addEventListener("load", handleScroll);
    return () => iframe.removeEventListener("load", handleScroll);
  }, [device.id, syncScrollRef]);

  // Apply synced scroll from other frames
  useEffect(() => {
    const interval = setInterval(() => {
      if (!iframeRef.current || isScrolling) return;
      const map = syncScrollRef.current;
      if (!map) return;
      map.delete(device.id);
      if (map.size === 0) return;
      const entries = Array.from(map.entries());
      const avgScroll = entries.reduce((sum, [, v]) => sum + v, 0) / entries.length;
      const currentScroll = iframeRef.current.contentWindow?.scrollY ?? 0;
      if (Math.abs(avgScroll - currentScroll) > 50) {
        iframeRef.current.contentWindow?.scrollTo?.(0, avgScroll);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [syncScrollRef, device.id, isScrolling]);

  const w = device.width * scale;
  const h = device.height * scale;
  const chromeH = device.chrome ? 36 * scale : 0;
  const totalH = chromeH + h;
  const borderR = device.borderRounded ? 32 * scale : 6 * scale;

  return (
    <div
      ref={wrapperRef}
      className="flex flex-col items-center flex-1 min-w-0 device-frame"
      data-device-id={device.id}
    >
      <div
        className="relative overflow-hidden transition-shadow"
        style={{
          width: w,
          height: totalH,
          borderRadius: borderR,
          background: "#fff",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none border-gray-700"
          style={{ borderWidth: device.borderRounded ? 5 * scale : 1, borderRadius: borderR + 4 }}
        />
        {device.notch && (
          <div className="absolute left-1/2 -translate-x-1/2 top-0 bg-gray-800 rounded-b-xl z-20"
            style={{ width: 80 * scale, height: 20 * scale }} />
        )}
        {device.chrome && (
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 border-b border-gray-300 select-none"
            style={{ position: "relative", zIndex: 10 }}>
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
            </div>
            <div className="flex-1 bg-white rounded px-2 py-0.5 text-[10px] text-gray-500 font-mono border border-gray-200 truncate">
              valet-s.com{pageUrl.replace(window.location.origin, "")}
            </div>
          </div>
        )}
        <div
          className="overflow-y-auto overflow-x-hidden"
          style={{
            position: "absolute",
            top: chromeH,
            left: 0,
            width: device.width,
            height: device.height,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
          onScroll={() => {
            setIsScrolling(true);
            const t = setTimeout(() => setIsScrolling(false), 200);
            return () => clearTimeout(t);
          }}
        >
          <iframe
            key={`${device.id}-${refreshKey}`}
            ref={iframeRef}
            src={pageUrl}
            className="w-full h-full border-0"
            style={{ width: device.width, height: device.height, minHeight: device.height }}
            title={`${device.label} preview`}
            onLoad={() => setLoaded(true)}
          />
          {!loaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
              <div className="text-sm text-gray-400 animate-pulse">Loading...</div>
            </div>
          )}
        </div>
      </div>
      <div className="mt-2 flex items-center gap-3 select-none">
        <span className="text-xs text-gray-400">
          {device.icon} {device.label} — {device.width}×{device.height}
        </span>
        {loaded && <span className="text-[10px] text-green-500">✓ loaded</span>}
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────
export default function ViewPage() {
  const saved = loadSettings();
  const [targetPath, setTargetPath] = useState(saved.targetPath);
  const [showDevices, setShowDevices] = useState<string[]>(
    saved.showDevices.length > 0 ? saved.showDevices : DEVICES.map((d) => d.id)
  );
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastCapture, setLastCapture] = useState<string | null>(null);
  const [syncEnabled, setSyncEnabled] = useState(true);
  const syncScrollRef = useRef<Map<string, number> | null>(syncEnabled ? new Map() : null);

  // Editor state
  const [editorMode, setEditorMode] = useState(saved.editorMode || false);
  const [rightPanel, setRightPanel] = useState<"editor" | "nl">(saved.rightPanel || "editor");
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  // Toggle sync ref
  useEffect(() => {
    syncScrollRef.current = syncEnabled ? new Map() : null;
  }, [syncEnabled]);

  // Persist settings
  useEffect(() => {
    const t = setTimeout(() => saveSettings({ targetPath, showDevices, editorMode, rightPanel }), 300);
    return () => clearTimeout(t);
  }, [targetPath, showDevices, editorMode, rightPanel]);

  const pageUrl = window.location.origin + targetPath;

  const toggleDevice = (id: string) => {
    if (showDevices.length === 1 && showDevices[0] === id) return;
    setShowDevices((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id],
    );
  };

  const visibleDevices = DEVICES.filter((d) => showDevices.includes(d.id));

  const captureFrames = () => {
    const timestamp = new Date().toLocaleTimeString();
    setLastCapture(`📸 Frames flashed at ${timestamp} — use Cmd+Shift+4 (Mac) or Win+Shift+S (Win) to capture.`);
    const frames = document.querySelectorAll("[data-device-frame]");
    frames.forEach((el, i) => {
      setTimeout(() => {
        (el as HTMLElement).classList.add("ring-4", "ring-blue-400");
        setTimeout(() => (el as HTMLElement).classList.remove("ring-4", "ring-blue-400"), 500);
      }, i * 200);
    });
  };

  const handlePathSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setRefreshKey((k) => k + 1);
  };

  const handleSave = (path: string, content: string) => {
    // Trigger iframe refresh after save
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className="h-screen bg-gray-950 flex flex-col overflow-hidden">
      {/* ── Toolbar ─────────────────────────────────────────────── */}
      <div className="shrink-0 bg-gradient-to-r from-blue-950 via-blue-900 to-blue-950 shadow-2xl border-b border-blue-800">
        <div className="px-4 py-2 space-y-1.5">
          {/* Row 1: Title + URL + Mode toggle */}
          <form onSubmit={handlePathSubmit} className="flex items-center gap-3">
            <span className="text-xl">🔍</span>
            <span className="text-white font-bold text-sm">View Tester</span>
            <span className="text-blue-400 text-[10px] font-mono bg-blue-800/40 px-1.5 py-0.5 rounded">TESTING</span>

            <div className="flex-1 ml-2 flex items-center gap-2">
              <span className="text-blue-400 text-xs shrink-0">Path:</span>
              <input
                type="text"
                value={targetPath}
                onChange={(e) => setTargetPath(e.target.value)}
                className="flex-1 bg-blue-950/60 border border-blue-700 rounded-lg px-3 py-1 text-sm text-white font-mono placeholder-blue-600 focus:outline-none focus:border-blue-500"
                placeholder="/ or /sro or /staff ..."
              />
              <button
                type="submit"
                className="px-3 py-1 rounded-lg text-xs font-semibold bg-blue-700 text-white hover:bg-blue-600 transition-all shrink-0"
              >
                ↻ Load
              </button>
            </div>

            {/* Mode toggle */}
            <button
              type="button"
              onClick={() => setEditorMode(!editorMode)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                editorMode
                  ? "bg-green-700 text-white"
                  : "bg-blue-800 text-blue-300 hover:bg-blue-700"
              }`}
            >
              {editorMode ? "🔧 Editor ON" : "👁️ Preview Only"}
            </button>
          </form>

          {/* Row 2: Quick pages + Devices */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1">
              <span className="text-blue-400 text-[10px] mr-1">Pages:</span>
              {QUICK_PAGES.map((p) => (
                <button
                  key={p.path}
                  onClick={() => { setTargetPath(p.path); setRefreshKey((k) => k + 1); }}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                    targetPath === p.path
                      ? "bg-white text-blue-900"
                      : "text-blue-300 hover:bg-blue-800 hover:text-white"
                  }`}
                >
                  {p.icon} {p.label}
                </button>
              ))}
            </div>

            <div className="w-px h-4 bg-blue-700 hidden sm:block" />

            <div className="flex items-center gap-1">
              <span className="text-blue-400 text-[10px] mr-1">Devices:</span>
              {DEVICES.map((device) => {
                const isActive = showDevices.includes(device.id);
                return (
                  <button
                    key={device.id}
                    onClick={() => toggleDevice(device.id)}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                      isActive
                        ? "bg-white text-blue-900"
                        : "text-blue-400 hover:bg-blue-800 hover:text-blue-200"
                    }`}
                  >
                    {device.icon} {device.label}
                  </button>
                );
              })}
            </div>

            <div className="w-px h-4 bg-blue-700 hidden sm:block" />

            {/* Actions */}
            <button
              onClick={() => setSyncEnabled(!syncEnabled)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                syncEnabled ? "bg-green-700 text-white" : "text-blue-400 hover:bg-blue-800"
              }`}
            >
              🔄 {syncEnabled ? "ON" : "OFF"}
            </button>
            <button
              onClick={captureFrames}
              className="px-2 py-0.5 rounded text-[10px] text-blue-300 hover:bg-blue-800 hover:text-white transition-all"
            >
              📸 Snap
            </button>
          </div>

          {/* Capture message */}
          {lastCapture && (
            <div className="text-[10px] text-blue-300 bg-blue-950/40 rounded px-2 py-1 border border-blue-800 flex items-center gap-2">
              {lastCapture}
              <button onClick={() => setLastCapture(null)} className="text-blue-400 hover:text-white">✕</button>
            </div>
          )}
        </div>
      </div>

      {/* ── Main Content ────────────────────────────────────────── */}
      {editorMode ? (
        // Editor mode: 3-panel layout
        <div className="flex flex-1 min-h-0">
          {/* Left: File Tree */}
          <div className="w-56 border-r border-gray-800 shrink-0 overflow-hidden">
            <FileTree onSelectFile={setSelectedFile} selectedPath={selectedFile} />
          </div>

          {/* Center: Preview Frames */}
          <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
            <div
              key={refreshKey}
              className="flex items-start justify-center gap-4 p-4 flex-1 overflow-auto"
            >
              {visibleDevices.map((device) => (
                <DeviceFrame
                  key={device.id}
                  device={device}
                  pageUrl={pageUrl}
                  refreshKey={refreshKey}
                  syncScrollRef={syncScrollRef}
                />
              ))}
            </div>
          </div>

          {/* Right: Editor or NL Command */}
          <div className="w-96 border-l border-gray-800 shrink-0 flex flex-col overflow-hidden">
            {/* Panel tabs */}
            <div className="flex border-b border-gray-800 bg-gray-900">
              <button
                onClick={() => setRightPanel("editor")}
                className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                  rightPanel === "editor"
                    ? "bg-gray-800 text-white border-b-2 border-blue-500"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                ✏️ Code Editor
              </button>
              <button
                onClick={() => setRightPanel("nl")}
                className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                  rightPanel === "nl"
                    ? "bg-gray-800 text-white border-b-2 border-purple-500"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                🤖 NL Command
              </button>
            </div>

            {/* Panel content */}
            <div className="flex-1 overflow-hidden">
              {rightPanel === "editor" ? (
                <CodeEditor filePath={selectedFile} onSave={handleSave} />
              ) : (
                <NLCommandPanel />
              )}
            </div>
          </div>
        </div>
      ) : (
        // Preview-only mode (original layout)
        <div
          key={refreshKey}
          className="flex items-start justify-center gap-6 p-6 flex-1 overflow-auto"
        >
          {visibleDevices.map((device) => (
            <DeviceFrame
              key={device.id}
              device={device}
              pageUrl={pageUrl}
              refreshKey={refreshKey}
              syncScrollRef={syncScrollRef}
            />
          ))}
        </div>
      )}

      {/* ── Git Status Bar (editor mode only) ──────────────────── */}
      {editorMode && <GitStatusBar onReload={() => setRefreshKey(k => k + 1)} />}

      {/* ── Footer (preview mode) ──────────────────────────────── */}
      {!editorMode && (
        <div className="text-center py-2 text-[10px] text-gray-600 border-t border-gray-800 bg-gray-950 shrink-0">
          View Tester — type a page path above, see it rendered at each device size
        </div>
      )}
    </div>
  );
}
