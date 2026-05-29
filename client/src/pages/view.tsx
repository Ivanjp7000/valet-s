// View — responsive testing harness
// Renders the live app inside device-sized frames for visual QA
// Access at /view — testing only
//
// Each device frame renders the real React component tree at the
// correct viewport size, so routing, auth, and state all work.

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useLocation, Switch, Route, Router as WouterRouter } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import Landing from "@/pages/landing";
import Home from "@/pages/home";
import StaffDashboard from "@/pages/staff-dashboard";
import AdminPanel from "@/pages/admin-panel";
import Docs from "@/pages/docs";
import CreateAccount from "@/pages/create-account";
import VerifyEmail from "@/pages/verify-email";
import SroLogin from "@/pages/sro-login";
import NotFound from "@/pages/not-found";

// ── Device Presets ──────────────────────────────────────────────
interface DevicePreset {
  id: string;
  label: string;
  icon: string;
  width: number;
  height: number;
  ua: string;
  borderRounded: boolean;
  notch: boolean;
}

const DEVICES: DevicePreset[] = [
  {
    id: "desktop",
    label: "Desktop",
    icon: "🖥️",
    width: 1280,
    height: 800,
    ua: "desktop",
    borderRounded: false,
    notch: false,
  },
  {
    id: "ipad-pro",
    label: "iPad Pro",
    icon: "⬛",
    width: 1024,
    height: 1366,
    ua: "tablet",
    borderRounded: true,
    notch: false,
  },
  {
    id: "ipad",
    label: "iPad",
    icon: "📱",
    width: 810,
    height: 1080,
    ua: "tablet",
    borderRounded: true,
    notch: false,
  },
  {
    id: "iphone",
    label: "iPhone",
    icon: "📲",
    width: 393,
    height: 852,
    ua: "mobile",
    borderRounded: true,
    notch: true,
  },
  {
    id: "android",
    label: "Android",
    icon: "🤖",
    width: 412,
    height: 915,
    ua: "mobile",
    borderRounded: true,
    notch: false,
  },
];

// ── Page Presets for quick navigation ──────────────────────────
interface PagePreset {
  id: string;
  label: string;
  icon: string;
  path: string;
  authRequired: boolean;
}

const PAGES: PagePreset[] = [
  { id: "landing", label: "Landing", icon: "🏠", path: "/", authRequired: false },
  { id: "sro", label: "SRO Login", icon: "🔐", path: "/sro", authRequired: false },
  { id: "home", label: "Dashboard", icon: "📊", path: "/home", authRequired: true },
  { id: "staff", label: "Staff", icon: "👨‍💼", path: "/staff", authRequired: true },
  { id: "admin", label: "Admin", icon: "⚙️", path: "/admin", authRequired: true },
  { id: "docs", label: "Docs", icon: "📖", path: "/docs", authRequired: true },
  { id: "create", label: "Sign Up", icon: "📝", path: "/create-account", authRequired: false },
  { id: "verify", label: "Verify", icon: "✉️", path: "/verify-email", authRequired: false },
];

// ── Inner App Router (same as App.tsx) ─────────────────────────
function InnerRouter() {
  const { isAuthenticated, isLoading, user } = useAuth();

  return (
    <Switch>
      <Route path="/create-account" component={CreateAccount} />
      <Route path="/verify-email" component={VerifyEmail} />
      <Route path="/sro" component={SroLogin} />

      {isLoading || !isAuthenticated ? (
        <Route path="/" component={Landing} />
      ) : (
        <>
          <Route path="/" component={Home} />
          <Route path="/staff" component={StaffDashboard} />
          <Route path="/docs" component={Docs} />
          {(user?.role === "superadmin" ||
            user?.role === "privilege_admin") && (
            <Route path="/admin" component={AdminPanel} />
          )}
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

// ── Device Frame ────────────────────────────────────────────────
function DeviceFrame({
  device,
  frameLocation,
}: {
  device: DevicePreset;
  frameLocation: string;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const [mounted, setMounted] = useState(false);

  // Auto-scale to fit available space
  useEffect(() => {
    if (!mounted) return;
    const updateScale = () => {
      const wrapper = wrapperRef.current?.parentElement;
      if (!wrapper) return;
      const availH = wrapper.clientHeight - 50;
      const availW = wrapper.clientWidth - 30;
      const sH = availH / device.height;
      const sW = availW / device.width;
      setScale(Math.min(1, sH, sW));
    };
    // Delay to let layout settle
    const t = setTimeout(updateScale, 100);
    window.addEventListener("resize", updateScale);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", updateScale);
    };
  }, [device.height, device.width, mounted]);

  // Trigger scale after first render
  useEffect(() => {
    setMounted(true);
  }, []);

  const w = device.width * scale;
  const h = device.height * scale;
  const borderRadius = device.borderRounded ? 36 * scale : 6 * scale;
  const borderW = device.borderRounded ? 6 * scale : 1;

  return (
    <div ref={wrapperRef} className="flex flex-col items-center flex-1 min-w-0">
      {/* Device shell */}
      <div
        className="relative bg-white overflow-hidden shadow-2xl select-none"
        style={{
          width: w,
          height: h,
          borderRadius,
        }}
      >
        {/* Physical border */}
        {device.borderRounded && (
          <div
            className="absolute inset-0 pointer-events-none border-gray-800"
            style={{
              borderWidth: borderW,
              borderRadius: borderRadius + borderW,
            }}
          />
        )}
        {!device.borderRounded && (
          <div className="absolute inset-0 pointer-events-none border border-gray-300 rounded-md" />
        )}

        {/* iPhone notch */}
        {device.notch && (
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 bg-gray-800 rounded-b-xl z-50"
            style={{ width: 100 * scale, height: 24 * scale }}
          />
        )}

        {/* Desktop browser chrome */}
        {!device.borderRounded && (
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 border-b border-gray-300"
            style={{ position: "relative", zIndex: 10 }}
          >
            <div className="flex gap-1">
              <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
            </div>
            <div
              className="flex-1 bg-white rounded px-2 py-0.5 text-[10px] text-gray-500 font-mono border border-gray-200 truncate"
            >
              valet-s.com{frameLocation}
            </div>
          </div>
        )}

        {/* Scaled content area */}
        <div
          className="overflow-hidden"
          style={{
            width: device.width,
            height: device.borderRounded ? device.height : device.height - 36,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            position: "absolute",
            top: device.borderRounded ? 0 : 36,
            left: 0,
          }}
        >
          <WouterRouter base={frameLocation}>
            <InnerRouter />
          </WouterRouter>
        </div>
      </div>

      {/* Label */}
      <div className="mt-2 text-xs font-medium text-gray-500 select-none whitespace-nowrap">
        {device.icon} {device.label} ({device.width}×{device.height})
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────
export default function ViewPage() {
  const [currentLocation] = useLocation();
  const { isAuthenticated } = useAuth();

  const [activeDevice, setActiveDevice] = useState(DEVICES[0]);
  const [showAll, setShowAll] = useState(false);
  const [testPath, setTestPath] = useState("/");

  const navigateToPage = useCallback(
    (page: PagePreset) => {
      if (page.authRequired && !isAuthenticated) {
        alert("This page requires authentication. Please log in first.");
        return;
      }
      setTestPath(page.path);
    },
    [isAuthenticated],
  );

  // Sync testPath with selected page
  const currentPage = useMemo(
    () => PAGES.find((p) => p.path === testPath) || PAGES[0],
    [testPath],
  );

  const visibleDevices = showAll ? DEVICES : [activeDevice];

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* ── Blue Ribbon Toolbar ─────────────────────────────────── */}
      <div className="sticky top-0 z-[200] bg-gradient-to-r from-blue-950 via-blue-900 to-blue-950 shadow-2xl border-b border-blue-800">
        <div className="px-4 py-3">
          {/* Row 1: title + controls */}
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔍</span>
              <div>
                <span className="text-white font-bold text-lg tracking-tight">
                  Valet-s View Tester
                </span>
                <div className="text-blue-400 text-xs font-mono">
                  Responsive QA Harness
                </div>
              </div>
              <span className="text-blue-300 text-[10px] font-mono bg-blue-800/60 px-2 py-0.5 rounded-full uppercase tracking-wider">
                Testing Only
              </span>
            </div>

            <button
              onClick={() => setShowAll(!showAll)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all uppercase tracking-wide ${
                showAll
                  ? "bg-white text-blue-900 shadow-lg"
                  : "bg-blue-800/50 text-blue-200 hover:bg-blue-700"
              }`}
            >
              {showAll ? "✕ Single" : "⊞ Show All"}
            </button>
          </div>

          {/* Row 2: device selector */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1 bg-blue-950/60 rounded-xl p-1">
              {DEVICES.map((device) => (
                <button
                  key={device.id}
                  onClick={() => {
                    setActiveDevice(device);
                    setShowAll(false);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    (!showAll && activeDevice.id === device.id)
                      ? "bg-white text-blue-900 shadow-md"
                      : "text-blue-300 hover:bg-blue-800 hover:text-white"
                  }`}
                >
                  <span>{device.icon}</span>
                  <span className="hidden md:inline">{device.label}</span>
                </button>
              ))}
            </div>

            <div className="hidden sm:block w-px h-6 bg-blue-700" />

            {/* Page selector */}
            <div className="flex items-center gap-1 bg-blue-950/60 rounded-xl p-1 flex-wrap">
              {PAGES.map((page) => {
                const locked = page.authRequired && !isAuthenticated;
                return (
                  <button
                    key={page.id}
                    onClick={() => navigateToPage(page)}
                    disabled={locked}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      locked
                        ? "text-blue-600 cursor-not-allowed opacity-50"
                        : currentPage.path === page.path
                          ? "bg-blue-600 text-white shadow"
                          : "text-blue-300 hover:bg-blue-800 hover:text-white"
                    }`}
                  >
                    <span>{page.icon}</span>
                    <span className="hidden lg:inline">{page.label}</span>
                    {locked && <span className="text-[10px]">🔒</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Info Bar ────────────────────────────────────────────── */}
      <div className="bg-blue-950/30 border-b border-blue-800/50 px-4 py-1.5">
        <div className="flex items-center justify-between text-xs text-blue-400">
          <div className="flex items-center gap-4">
            <span>
              Viewport:{" "}
              <strong className="text-blue-200">
                {activeDevice.width}×{activeDevice.height}
              </strong>
            </span>
            <span>
              Type: <strong className="text-blue-200">{activeDevice.ua}</strong>
            </span>
            <span>
              Route: <strong className="text-blue-200">{testPath}</strong>
            </span>
            <span>
              Auth:{" "}
              <strong className={isAuthenticated ? "text-green-400" : "text-red-400"}>
                {isAuthenticated ? "✓" : "✗"}
              </strong>
            </span>
          </div>
          <span className="text-blue-500 text-[10px]">
            💡 Interact inside the frames — auth & routing work live
          </span>
        </div>
      </div>

      {/* ── Device Frames ───────────────────────────────────────── */}
      <div className="flex items-start justify-center gap-6 p-6 flex-1 overflow-auto">
        {visibleDevices.map((device) => (
          <DeviceFrame
            key={device.id}
            device={device}
            frameLocation={testPath}
          />
        ))}
      </div>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <div className="text-center py-3 text-xs text-gray-600 border-t border-gray-800 bg-gray-950">
        Valet-s View Tester — For QA purposes only
      </div>
    </div>
  );
}
