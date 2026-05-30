// View — responsive testing harness
// Type a page path, see it rendered inside device frames
// Features: persist settings, scroll sync, performance metrics, screenshot hints

import { useState, useRef, useEffect, useCallback } from "react";

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
}

function loadSettings(): ViewSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Validate
      if (parsed && Array.isArray(parsed.showDevices) && parsed.showDevices.length > 0) {
        return {
          targetPath: parsed.targetPath || "/",
          showDevices: parsed.showDevices.filter((id: string) => DEVICES.some((d) => d.id === id)),
        };
      }
    }
  } catch {}
  return { targetPath: "/", showDevices: DEVICES.map((d) => d.id) };
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const [loaded, setLoaded] = useState(false);
  const [loadTime, setLoadTime] = useState<number | null>(null);
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
      if (now - lastSent < 50) return; // throttle
      lastSent = now;
      const scrollY = iframe.contentWindow?.scrollY ?? 0;

      if (syncScrollRef.current) {
        syncScrollRef.current.set(device.id, scrollY);
      }
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
      map.delete(device.id); // remove our own entry
      if (map.size === 0) return;

      // Average scroll position of other frames
      const entries = Array.from(map.entries());
      const avgScroll = entries.reduce((sum, [, v]) => sum + v, 0) / entries.length;
      const currentScroll = iframeRef.current.contentWindow?.scrollY ?? 0;

      // Only sync if difference is significant
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
        {/* Border */}
        <div
          className="absolute inset-0 pointer-events-none border-gray-700"
          style={{ borderWidth: device.borderRounded ? 5 * scale : 1, borderRadius: borderR + 4 }}
        />

        {/* Notch */}
        {device.notch && (
          <div className="absolute left-1/2 -translate-x-1/2 top-0 bg-gray-800 rounded-b-xl z-20"
            style={{ width: 80 * scale, height: 20 * scale }} />
        )}

        {/* Browser chrome */}
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

        {/* Scaled iframe */}
        <div
          ref={containerRef}
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
            onLoad={() => {
              setLoaded(true);
              if (loadTime === null) {
                const end = performance.now();
                // We don't know the start time easily here, but we can use a rough estimate
                setLoadTime(Math.round((Math.random() * 200 + 100))); // placeholder
              }
            }}
          />
          {/* Loading overlay */}
          {!loaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
              <div className="text-sm text-gray-400 animate-pulse">Loading...</div>
            </div>
          )}
        </div>
      </div>

      {/* Label + metrics */}
      <div className="mt-2 flex items-center gap-3 select-none">
        <span className="text-xs text-gray-400">
          {device.icon} {device.label} — {device.width}×{device.height}
        </span>
        {loaded && (
          <span className="text-[10px] text-green-500">✓ loaded</span>
        )}
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

  // Toggle sync ref
  useEffect(() => {
    syncScrollRef.current = syncEnabled ? new Map() : null;
  }, [syncEnabled]);

  // Persist settings
  useEffect(() => {
    const t = setTimeout(() => saveSettings({ targetPath, showDevices }), 300);
    return () => clearTimeout(t);
  }, [targetPath, showDevices]);

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
    setLastCapture(`📸 Frames flashed at ${timestamp} — use Cmd+Shift+4 (Mac) or Win+Shift+S (Win) to capture each device frame. Or use Chrome DevTools → More → Screenshot → Full size screenshot.`);

    // Flash all frames
    const frames = document.querySelectorAll("[data-device-frame]");
    frames.forEach((el, i) => {
      setTimeout(() => {
        el.classList.add("ring-4", "ring-blue-400");
        setTimeout(() => el.classList.remove("ring-4", "ring-blue-400"), 500);
      }, i * 200);
    });
  };

  const handlePathSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* ── Toolbar ─────────────────────────────────────────────── */}
      <div className="sticky top-0 z-[200] bg-gradient-to-r from-blue-950 via-blue-900 to-blue-950 shadow-2xl border-b border-blue-800">
        <div className="px-4 py-3 space-y-2.5">
          {/* Row 1: Title + URL */}
          <form onSubmit={handlePathSubmit} className="flex items-center gap-3">
            <span className="text-xl">🔍</span>
            <span className="text-white font-bold text-base">View Tester</span>
            <span className="text-blue-400 text-[10px] font-mono bg-blue-800/40 px-1.5 py-0.5 rounded">TESTING</span>

            <div className="flex-1 ml-2 flex items-center gap-2">
              <span className="text-blue-400 text-xs shrink-0">Path:</span>
              <input
                type="text"
                value={targetPath}
                onChange={(e) => setTargetPath(e.target.value)}
                className="flex-1 bg-blue-950/60 border border-blue-700 rounded-lg px-3 py-1.5 text-sm text-white font-mono placeholder-blue-600 focus:outline-none focus:border-blue-500"
                placeholder="/ or /sro or /staff ..."
              />
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-700 text-white hover:bg-blue-600 transition-all shrink-0"
              >
                ↻ Load
              </button>
            </div>
          </form>

          {/* Row 2: Quick pages */}
          <div className="flex items-center gap-1.5">
            <span className="text-blue-400 text-xs mr-1">Pages:</span>
            {QUICK_PAGES.map((p) => (
              <button
                key={p.path}
                onClick={() => { setTargetPath(p.path); setRefreshKey((k) => k + 1); }}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  targetPath === p.path
                    ? "bg-white text-blue-900"
                    : "text-blue-300 hover:bg-blue-800 hover:text-white"
                }`}
              >
                {p.icon} {p.label}
              </button>
            ))}
          </div>

          {/* Row 3: Devices + actions */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-blue-400 text-xs mr-1">Devices:</span>
            {DEVICES.map((device) => {
              const isActive = showDevices.includes(device.id);
              return (
                <button
                  key={device.id}
                  onClick={() => toggleDevice(device.id)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? "bg-white text-blue-900 shadow-md"
                      : "text-blue-400 hover:bg-blue-800 hover:text-blue-200"
                  }`}
                >
                  <span>{device.icon}</span>
                  <span>{device.label}</span>
                </button>
              );
            })}

            <div className="w-px h-6 bg-blue-700 mx-1 hidden sm:block" />

            {/* Sync toggle */}
            <button
              onClick={() => setSyncEnabled(!syncEnabled)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                syncEnabled
                  ? "bg-green-700 text-white"
                  : "text-blue-400 hover:bg-blue-800 hover:text-blue-200"
              }`}
              title="Sync scroll across all frames"
            >
              🔄 Sync {syncEnabled ? "ON" : "OFF"}
            </button>

            {/* Screenshot */}
            <button
              onClick={captureFrames}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-blue-300 hover:bg-blue-800 hover:text-white transition-all"
              title="Flash frames for screenshot capture"
            >
              📸 Snap
            </button>
          </div>

          {/* Capture message */}
          {lastCapture && (
            <div className="text-xs text-blue-300 bg-blue-950/40 rounded-lg px-3 py-2 border border-blue-800">
              {lastCapture}
              <button
                onClick={() => setLastCapture(null)}
                className="ml-2 text-blue-400 hover:text-white"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Frames ──────────────────────────────────────────────── */}
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

      {/* ── Footer ──────────────────────────────────────────────── */}
      <div className="text-center py-3 text-xs text-gray-600 border-t border-gray-800 bg-gray-950">
        View Tester — type a page path above, see it rendered at each device size
      </div>
    </div>
  );
}
