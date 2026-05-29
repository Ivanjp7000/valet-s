// View — simple responsive testing harness
// Type a URL in the input, see it rendered inside device frames
// The frames load the target page via iframe (same origin, auth works)

import { useState, useRef, useEffect } from "react";

// ── Device Presets ──────────────────────────────────────────────
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

// Quick page buttons
const QUICK_PAGES = [
  { label: "Landing", icon: "🏠", path: "/" },
  { label: "Login", icon: "🔐", path: "/sro" },
  { label: "Dashboard", icon: "📊", path: "/home" },
  { label: "Staff", icon: "👨‍💼", path: "/staff" },
  { label: "Admin", icon: "⚙️", path: "/admin" },
  { label: "Docs", icon: "📖", path: "/docs" },
];

// ── Device Frame ────────────────────────────────────────────────
function DeviceFrame({
  device,
  pageUrl,
  key: frameKey,
}: {
  device: DevicePreset;
  pageUrl: string;
  key: number;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);

  useEffect(() => {
    const updateScale = () => {
      const wrapper = wrapperRef.current;
      if (!wrapper) return;
      const availH = window.innerHeight - 160;
      const availW = wrapper.parentElement?.clientWidth ?? 500;
      const chromeOffset = device.chrome ? 40 : 0;
      const sH = availH / (device.height + chromeOffset);
      const sW = (availW - 20) / device.width;
      setScale(Math.min(1, sH, sW));
    };
    requestAnimationFrame(updateScale);
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [device.height, device.width, device.chrome]);

  const w = device.width * scale;
  const h = device.height * scale;
  const chromeH = device.chrome ? 36 * scale : 0;
  const totalH = chromeH + h;
  const borderR = device.borderRounded ? 32 * scale : 6 * scale;

  return (
    <div ref={wrapperRef} className="flex flex-col items-center flex-1 min-w-0">
      <div
        className="relative overflow-hidden"
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
        <div className="overflow-y-auto overflow-x-hidden"
          style={{
            position: "absolute",
            top: chromeH,
            left: 0,
            width: device.width,
            height: device.height,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}>
          <iframe
            key={`${device.id}-${frameKey}`}
            src={pageUrl}
            className="w-full h-full border-0"
            style={{ width: device.width, height: device.height, minHeight: device.height }}
            title={`${device.label} preview`}
          />
        </div>
      </div>

      <div className="mt-2 text-xs text-gray-400 select-none whitespace-nowrap">
        {device.icon} {device.label} — {device.width}×{device.height}
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────
export default function ViewPage() {
  const [targetPath, setTargetPath] = useState("/");
  const [showDevices, setShowDevices] = useState<string[]>(DEVICES.map((d) => d.id));
  const [refreshKey, setRefreshKey] = useState(0);

  const pageUrl = window.location.origin + targetPath;

  const toggleDevice = (id: string) => {
    if (showDevices.length === 1 && showDevices[0] === id) return;
    setShowDevices((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id],
    );
  };

  const visibleDevices = DEVICES.filter((d) => showDevices.includes(d.id));

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* ── Toolbar ─────────────────────────────────────────────── */}
      <div className="sticky top-0 z-[200] bg-gradient-to-r from-blue-950 via-blue-900 to-blue-950 shadow-2xl border-b border-blue-800">
        <div className="px-4 py-3 space-y-2.5">
          {/* Row 1: Title + URL input */}
          <div className="flex items-center gap-3">
            <span className="text-xl">🔍</span>
            <span className="text-white font-bold text-base">View Tester</span>
            <span className="text-blue-400 text-[10px] font-mono bg-blue-800/40 px-1.5 py-0.5 rounded">TESTING</span>

            <div className="flex-1 ml-4 flex items-center gap-2">
              <span className="text-blue-400 text-xs shrink-0">Page:</span>
              <input
                type="text"
                value={targetPath}
                onChange={(e) => setTargetPath(e.target.value)}
                className="flex-1 bg-blue-950/60 border border-blue-700 rounded-lg px-3 py-1.5 text-sm text-white font-mono placeholder-blue-600 focus:outline-none focus:border-blue-500"
                placeholder="/ or /sro or /staff ..."
              />
              <button
                onClick={() => setRefreshKey((k) => k + 1)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-700 text-white hover:bg-blue-600 transition-all shrink-0"
              >
                ↻ Refresh
              </button>
            </div>
          </div>

          {/* Row 2: Quick pages */}
          <div className="flex items-center gap-1.5">
            <span className="text-blue-400 text-xs mr-1">Quick:</span>
            {QUICK_PAGES.map((p) => (
              <button
                key={p.path}
                onClick={() => setTargetPath(p.path)}
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

          {/* Row 3: Device toggles */}
          <div className="flex items-center gap-1.5">
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
          </div>
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
