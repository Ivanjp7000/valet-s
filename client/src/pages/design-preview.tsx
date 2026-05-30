// Design & Preview — integrated design playground
// Tabs: Responsive, Components, States, Design System, Mock Data
// Access: admin-only (behind authentication)

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Eye, Layers, Palette, Database, LayoutGrid, Car, TicketIcon, Users, Building, MapPin, CreditCard, Phone, Clock, Calendar, CheckCircle, XCircle, AlertCircle, Loader2, Monitor, Smartphone, Tablet } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────
interface MockTicket {
  id: string;
  ticketNumber: string;
  guestName: string;
  licensePlate: string;
  carColor: string;
  carMake: string;
  carModel: string;
  status: "active" | "transit" | "ready" | "completed";
  visitorType: "hotel_guest" | "restaurant" | "other";
  createdAt: string;
}

interface MockUser {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

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

// ── Mock Data Generator ────────────────────────────────────────
const NAMES = ["John Smith", "Sarah Johnson", "Mike Chen", "Emma Wilson", "David Lee", "Lisa Brown", "Tom Anderson", "Anna Kim", "Chris Davis", "Maria Garcia"];
const CARS = [
  { color: "Black", make: "Mercedes", model: "S-Class" },
  { color: "Silver", make: "BMW", model: "7 Series" },
  { color: "White", make: "Audi", model: "A8" },
  { color: "Blue", make: "Porsche", model: "Taycan" },
  { color: "Red", make: "Ferrari", model: "Roma" },
  { color: "Gray", make: "Lexus", model: "LS 500" },
];
const PLATE_FORMATS = ["京A12345", "CA 123 ABC", "TOKYO 567", "OSAKA 890", "KB-12-34"];

function generateMockTicket(index: number): MockTicket {
  const car = CARS[index % CARS.length];
  return {
    id: `mock-${index}`,
    ticketNumber: `${1000 + index}`,
    guestName: NAMES[index % NAMES.length],
    licensePlate: PLATE_FORMATS[index % PLATE_FORMATS.length],
    carColor: car.color,
    carMake: car.make,
    carModel: car.model,
    status: (["active", "transit", "ready", "completed"] as const)[index % 4],
    visitorType: (["hotel_guest", "restaurant", "other"] as const)[index % 3],
    createdAt: new Date(Date.now() - (index * 3600000)).toISOString(),
  };
}

// ── Color Palette Preview ──────────────────────────────────────
const DESIGN_TOKENS = {
  colors: [
    { name: "regis-navy", hex: "#1a2332", usage: "Headers, primary text" },
    { name: "regis-gold", hex: "#d4af37", usage: "Accents, highlights" },
    { name: "success", hex: "#22c55e", usage: "Completed, active states" },
    { name: "warning", hex: "#f59e0b", usage: "Pending, transit states" },
    { name: "danger", hex: "#ef4444", usage: "Errors, cancelled" },
    { name: "info", hex: "#3b82f6", usage: "Information, links" },
  ],
  typography: [
    { name: "Display", size: "3rem", weight: "bold", example: "Valet-S" },
    { name: "Heading", size: "1.5rem", weight: "semibold", example: "Staff Dashboard" },
    { name: "Body", size: "1rem", weight: "normal", example: "Ticket information" },
    { name: "Caption", size: "0.75rem", weight: "normal", example: "Last updated 2 min ago" },
  ],
  spacing: [
    { name: "xs", value: "4px", classes: "p-1, m-1" },
    { name: "sm", value: "8px", classes: "p-2, m-2" },
    { name: "md", value: "16px", classes: "p-4, m-4" },
    { name: "lg", value: "24px", classes: "p-6, m-6" },
    { name: "xl", value: "32px", classes: "p-8, m-8" },
    { name: "2xl", value: "48px", classes: "p-12, m-12" },
  ],
};

// ── Ticket Card Component (standalone preview) ─────────────────
function TicketCardPreview({ ticket, state = "normal" }: { ticket: MockTicket; state?: "normal" | "loading" | "error" | "compact" }) {
  if (state === "loading") {
    return (
      <Card className="animate-pulse">
        <CardContent className="p-4 space-y-3">
          <div className="h-4 bg-gray-200 rounded w-1/3" />
          <div className="h-3 bg-gray-200 rounded w-2/3" />
          <div className="h-3 bg-gray-200 rounded w-1/2" />
          <div className="flex gap-2">
            <div className="h-8 bg-gray-200 rounded w-20" />
            <div className="h-8 bg-gray-200 rounded w-20" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (state === "error") {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-6 text-center">
          <XCircle size={32} className="text-red-400 mx-auto mb-2" />
          <p className="text-sm text-red-600 font-medium">Failed to load ticket</p>
          <p className="text-xs text-red-400 mt-1">Please try again</p>
        </CardContent>
      </Card>
    );
  }

  const statusConfig = {
    active: { color: "bg-blue-100 text-blue-700", icon: "🔵", label: "Active" },
    transit: { color: "bg-amber-100 text-amber-700", icon: "🟡", label: "In Transit" },
    ready: { color: "bg-purple-100 text-purple-700", icon: "🟣", label: "Ready" },
    completed: { color: "bg-green-100 text-green-700", icon: "🟢", label: "Completed" },
  };
  const sc = statusConfig[ticket.status];

  return (
    <Card className={state === "compact" ? "p-3" : ""}>
      <CardContent className={`space-y-2 ${state === "compact" ? "p-0" : "p-4"}`}>
        <div className="flex items-center justify-between">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${sc.color}`}>
            {sc.icon} {sc.label}
          </span>
          <span className="text-xs text-gray-400">#{ticket.ticketNumber}</span>
        </div>
        {state !== "compact" && (
          <>
            <h3 className="font-semibold text-regis-navy">{ticket.guestName}</h3>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">{ticket.licensePlate}</span>
              <span>{ticket.carColor} {ticket.carMake} {ticket.carModel}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Clock size={12} />
              <span>{new Date(ticket.createdAt).toLocaleString()}</span>
            </div>
            <Separator />
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="text-xs flex-1">
                <Eye size={12} className="mr-1" /> View
              </Button>
              <Button size="sm" variant="outline" className="text-xs flex-1">
                <Car size={12} className="mr-1" /> Retrieve
              </Button>
            </div>
          </>
        )}
        {state === "compact" && (
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{ticket.guestName}</span>
            <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{ticket.licensePlate}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Device Frame Component ─────────────────────────────────────
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
  const [isScrolling, setIsScrolling] = useState(false);

  // Auto-scale
  useEffect(() => {
    const updateScale = () => {
      const wrapper = wrapperRef.current;
      if (!wrapper) return;
      const availH = window.innerHeight - 220;
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
      className="flex flex-col items-center flex-1 min-w-0"
      data-device-frame
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
          <div
            className="absolute left-1/2 -translate-x-1/2 top-0 bg-gray-800 rounded-b-xl z-20"
            style={{ width: 80 * scale, height: 20 * scale }}
          />
        )}

        {/* Browser chrome */}
        {device.chrome && (
          <div
            className="flex items-center gap-2 px-3 py-2 bg-gray-100 border-b border-gray-300 select-none"
            style={{ position: "relative", zIndex: 10 }}
          >
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
            onLoad={() => setLoaded(true)}
          />
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

// ── ResponsivePreview Sub-component ─────────────────────────────
function ResponsivePreview({
  path,
  onPathChange,
  refreshKey,
  onRefresh,
  selectedDevices,
  onDeviceChange,
  syncScroll,
  onToggleSync,
  devices,
  quickPages,
}: {
  path: string;
  onPathChange: (p: string) => void;
  refreshKey: number;
  onRefresh: () => void;
  selectedDevices: string[];
  onDeviceChange: (d: string[]) => void;
  syncScroll: boolean;
  onToggleSync: () => void;
  devices: DevicePreset[];
  quickPages: { label: string; icon: string; path: string }[];
}) {
  const syncScrollRef = useRef<Map<string, number> | null>(syncScroll ? new Map() : null);

  useEffect(() => {
    syncScrollRef.current = syncScroll ? new Map() : null;
  }, [syncScroll]);

  const toggleDevice = (id: string) => {
    if (selectedDevices.length === 1 && selectedDevices[0] === id) return;
    onDeviceChange(
      selectedDevices.includes(id)
        ? selectedDevices.filter((d) => d !== id)
        : [...selectedDevices, id]
    );
  };

  const visibleDevices = devices.filter((d) => selectedDevices.includes(d.id));
  const pageUrl = window.location.origin + path;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="bg-gray-900 border-b border-gray-800 p-4 space-y-3">
        {/* Path input */}
        <form
          onSubmit={(e) => { e.preventDefault(); onRefresh(); }}
          className="flex items-center gap-3"
        >
          <span className="text-blue-400 text-xs">Path:</span>
          <Input
            type="text"
            value={path}
            onChange={(e) => onPathChange(e.target.value)}
            className="flex-1 bg-gray-800 border-gray-700 text-white text-sm font-mono placeholder-gray-500"
            placeholder="/ or /sro or /staff ..."
          />
          <Button type="submit" size="sm" className="bg-blue-700 hover:bg-blue-600">
            ↻ Load
          </Button>
        </form>

        {/* Quick pages */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-blue-400 text-xs mr-1">Pages:</span>
          {quickPages.map((p) => (
            <button
              key={p.path}
              onClick={() => { onPathChange(p.path); onRefresh(); }}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                path === p.path
                  ? "bg-white text-blue-900"
                  : "text-blue-300 hover:bg-blue-800 hover:text-white"
              }`}
            >
              {p.icon} {p.label}
            </button>
          ))}
        </div>

        {/* Devices */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-blue-400 text-xs mr-1">Devices:</span>
          {devices.map((device) => {
            const isActive = selectedDevices.includes(device.id);
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

          <div className="w-px h-6 bg-gray-700 mx-2" />

          {/* Sync toggle */}
          <button
            onClick={onToggleSync}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              syncScroll
                ? "bg-green-700 text-white"
                : "text-blue-400 hover:bg-blue-800 hover:text-blue-200"
            }`}
          >
            🔄 Sync {syncScroll ? "ON" : "OFF"}
          </button>
        </div>
      </div>

      {/* Device frames */}
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
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────
export default function DesignPreview() {
  const [activeTab, setActiveTab] = useState("responsive");
  const [mockTickets, setMockTickets] = useState<MockTicket[]>([]);
  const [mockUsers, setMockUsers] = useState<MockUser[]>([]);
  const [cardState, setCardState] = useState<"normal" | "loading" | "error" | "compact">("normal");
  const [cardVariant, setCardVariant] = useState(0);
  const [responsivePath, setResponsivePath] = useState("/");
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedDevices, setSelectedDevices] = useState<string[]>(["desktop", "iphone", "ipad"]);
  const [syncScroll, setSyncScroll] = useState(true);

  const generateTickets = useCallback(() => {
    const count = Math.floor(Math.random() * 5) + 1;
    setMockTickets(Array.from({ length: count }, (_, i) => generateMockTicket(i)));
  }, []);

  const generateUsers = useCallback(() => {
    const count = Math.floor(Math.random() * 3) + 1;
    setMockUsers(Array.from({ length: count }, (_, i) => ({
      id: `user-${i}`,
      username: `user${100 + i}`,
      email: `user${100 + i}@example.com`,
      firstName: NAMES[i % NAMES.length].split(" ")[0],
      lastName: NAMES[i % NAMES.length].split(" ")[1],
      role: (["superadmin", "privilege_admin", "standard_admin"])[i % 3],
    })));
  }, []);

  const QUICK_PAGES = [
    { label: "Landing", icon: "🏠", path: "/" },
    { label: "Login", icon: "🔐", path: "/sro" },
    { label: "Dashboard", icon: "📊", path: "/home" },
    { label: "Staff", icon: "👨‍💼", path: "/staff" },
    { label: "Admin", icon: "⚙️", path: "/admin" },
  ];

  const DEVICES: DevicePreset[] = [
    { id: "desktop", label: "Desktop", icon: "🖥️", width: 1280, height: 800, borderRounded: false, notch: false, chrome: true },
    { id: "ipad", label: "iPad", icon: "⬛", width: 810, height: 1080, borderRounded: true, notch: false, chrome: false },
    { id: "iphone", label: "iPhone", icon: "📱", width: 393, height: 852, borderRounded: true, notch: true, chrome: false },
    { id: "android", label: "Android", icon: "🤖", width: 412, height: 915, borderRounded: true, notch: false, chrome: false },
  ];

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="sticky top-0 z-50 bg-gradient-to-r from-blue-950 via-blue-900 to-blue-950 shadow-2xl border-b border-blue-800">
        <div className="px-6 py-4">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">🎨</span>
            <div>
              <h1 className="text-white font-bold text-xl">Design & Preview</h1>
              <p className="text-blue-300 text-xs">Test UI changes before deploying to production</p>
            </div>
            <Badge className="ml-auto bg-blue-800/50 text-blue-300 border-blue-700">PREVIEW</Badge>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-2">
            {[
              { id: "responsive", label: "Responsive", icon: <Monitor size={14} /> },
              { id: "components", label: "Components", icon: <Layers size={14} /> },
              { id: "states", label: "States", icon: <Eye size={14} /> },
              { id: "design", label: "Design System", icon: <Palette size={14} /> },
              { id: "mock", label: "Mock Data", icon: <Database size={14} /> },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? "bg-white text-blue-900 shadow-md"
                    : "text-blue-300 hover:bg-blue-800 hover:text-white"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        {/* Responsive Preview */}
        {activeTab === "responsive" && (
          <ResponsivePreview
            path={responsivePath}
            onPathChange={setResponsivePath}
            refreshKey={refreshKey}
            onRefresh={() => setRefreshKey((k) => k + 1)}
            selectedDevices={selectedDevices}
            onDeviceChange={setSelectedDevices}
            syncScroll={syncScroll}
            onToggleSync={() => setSyncScroll(!syncScroll)}
            devices={DEVICES}
            quickPages={QUICK_PAGES}
          />
        )}

        {/* Component Gallery */}
        {activeTab === "components" && (
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-white font-bold text-lg">Component Gallery</h2>
                <p className="text-blue-300 text-sm">Preview individual components in isolation</p>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => setCardState("normal")} variant={cardState === "normal" ? "default" : "outline"} size="sm" className="text-xs bg-blue-700 hover:bg-blue-600">Normal</Button>
                <Button onClick={() => setCardState("loading")} variant={cardState === "loading" ? "default" : "outline"} size="sm" className="text-xs bg-blue-700 hover:bg-blue-600">Loading</Button>
                <Button onClick={() => setCardState("error")} variant={cardState === "error" ? "default" : "outline"} size="sm" className="text-xs bg-blue-700 hover:bg-blue-600">Error</Button>
                <Button onClick={() => setCardState("compact")} variant={cardState === "compact" ? "default" : "outline"} size="sm" className="text-xs bg-blue-700 hover:bg-blue-600">Compact</Button>
              </div>
            </div>

            {/* Ticket Cards */}
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <TicketIcon size={18} /> Ticket Cards
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <TicketCardPreview
                      key={i}
                      ticket={generateMockTicket(i)}
                      state={cardState}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Buttons */}
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <LayoutGrid size={18} /> Buttons
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-sm text-gray-400">Primary</p>
                    <div className="flex gap-2">
                      <Button>Default</Button>
                      <Button variant="secondary">Secondary</Button>
                      <Button variant="destructive">Destructive</Button>
                      <Button variant="outline">Outline</Button>
                      <Button variant="ghost">Ghost</Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-400">Sizes</p>
                    <div className="flex items-center gap-2">
                      <Button size="sm">Small</Button>
                      <Button>Default</Button>
                      <Button size="lg">Large</Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-400">With Icons</p>
                    <div className="flex gap-2">
                      <Button><Car size={14} className="mr-2" /> New Ticket</Button>
                      <Button variant="outline"><Eye size={14} className="mr-2" /> View</Button>
                      <Button variant="outline"><Clock size={14} className="mr-2" /> Schedule</Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Badges */}
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Badge>Badges</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <Badge>Default</Badge>
                  <Badge variant="secondary">Secondary</Badge>
                  <Badge variant="destructive">Destructive</Badge>
                  <Badge variant="outline">Outline</Badge>
                  <Badge className="bg-green-600">Completed</Badge>
                  <Badge className="bg-amber-600">In Transit</Badge>
                  <Badge className="bg-blue-600">Active</Badge>
                  <Badge className="bg-purple-600">Ready</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* State Tester */}
        {activeTab === "states" && (
          <div className="p-6 space-y-6">
            <div>
              <h2 className="text-white font-bold text-lg">State Tester</h2>
              <p className="text-blue-300 text-sm">Test different UI states and transitions</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Empty States */}
              <Card className="bg-gray-900 border-gray-800">
                <CardHeader>
                  <CardTitle className="text-white text-sm">Empty States</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Card>
                    <CardContent className="p-8 text-center">
                      <TicketIcon size={40} className="text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500 font-medium">No tickets yet</p>
                      <p className="text-gray-400 text-xs mt-1">Create your first ticket to get started</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-8 text-center">
                      <Users size={40} className="text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500 font-medium">No users found</p>
                      <p className="text-gray-400 text-xs mt-1">Try adjusting your filters</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-8 text-center">
                      <AlertCircle size={40} className="text-amber-400 mx-auto mb-3" />
                      <p className="text-amber-600 font-medium">No data available</p>
                      <p className="text-gray-400 text-xs mt-1">Check back later or try a different date range</p>
                    </CardContent>
                  </Card>
                </CardContent>
              </Card>

              {/* Loading States */}
              <Card className="bg-gray-900 border-gray-800">
                <CardHeader>
                  <CardTitle className="text-white text-sm">Loading States</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Card className="animate-pulse">
                    <CardContent className="p-4 space-y-3">
                      <div className="h-4 bg-gray-700 rounded w-1/3" />
                      <div className="h-3 bg-gray-700 rounded w-2/3" />
                      <div className="h-3 bg-gray-700 rounded w-1/2" />
                      <div className="flex gap-2 mt-4">
                        <div className="h-8 bg-gray-700 rounded w-20" />
                        <div className="h-8 bg-gray-700 rounded w-20" />
                      </div>
                    </CardContent>
                  </Card>
                  <div className="flex items-center justify-center py-8">
                    <Loader2 size={32} className="animate-spin text-blue-500" />
                    <span className="ml-3 text-gray-400">Loading tickets...</span>
                  </div>
                </CardContent>
              </Card>

              {/* Error States */}
              <Card className="bg-gray-900 border-gray-800">
                <CardHeader>
                  <CardTitle className="text-white text-sm">Error States</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <XCircle size={20} className="text-red-500 mt-0.5" />
                      <div>
                        <p className="text-red-700 font-medium text-sm">Connection failed</p>
                        <p className="text-red-600 text-xs mt-1">Unable to reach the server. Please check your connection.</p>
                        <Button variant="outline" size="sm" className="mt-2 text-xs">Retry</Button>
                      </div>
                    </div>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle size={20} className="text-amber-500 mt-0.5" />
                      <div>
                        <p className="text-amber-700 font-medium text-sm">Session expired</p>
                        <p className="text-amber-600 text-xs mt-1">Your session has timed out. Please log in again.</p>
                        <Button variant="outline" size="sm" className="mt-2 text-xs">Log In</Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Success States */}
              <Card className="bg-gray-900 border-gray-800">
                <CardHeader>
                  <CardTitle className="text-white text-sm">Success States</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle size={20} className="text-green-500 mt-0.5" />
                      <div>
                        <p className="text-green-700 font-medium text-sm">Ticket created successfully</p>
                        <p className="text-green-600 text-xs mt-1">Ticket #1001 has been created and is ready for service.</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <Car size={20} className="text-blue-500 mt-0.5" />
                      <div>
                        <p className="text-blue-700 font-medium text-sm">Car retrieved</p>
                        <p className="text-blue-600 text-xs mt-1">Vehicle has been delivered to guest #1001.</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Design System */}
        {activeTab === "design" && (
          <div className="p-6 space-y-6">
            <div>
              <h2 className="text-white font-bold text-lg">Design System</h2>
              <p className="text-blue-300 text-sm">Brand tokens, typography, spacing, and patterns</p>
            </div>

            {/* Colors */}
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Palette size={18} /> Color Palette
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {DESIGN_TOKENS.colors.map((c) => (
                    <div key={c.name} className="space-y-2">
                      <div
                        className="h-16 rounded-lg border border-gray-700"
                        style={{ backgroundColor: c.hex }}
                      />
                      <p className="text-xs text-gray-300 font-mono">{c.name}</p>
                      <p className="text-[10px] text-gray-500">{c.hex}</p>
                      <p className="text-[10px] text-gray-400">{c.usage}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Typography */}
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">Typography Scale</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {DESIGN_TOKENS.typography.map((t) => (
                    <div key={t.name} className="flex items-baseline gap-4 border-b border-gray-800 pb-3">
                      <div className="w-24 text-xs text-gray-500">
                        <p className="font-medium">{t.name}</p>
                        <p>{t.size} / {t.weight}</p>
                      </div>
                      <p style={{ fontSize: t.size, fontWeight: t.weight as any }} className="text-gray-200">
                        {t.example}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Spacing */}
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">Spacing Scale</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {DESIGN_TOKENS.spacing.map((s) => (
                    <div key={s.name} className="flex items-center gap-3">
                      <div
                        className="bg-blue-500 rounded"
                        style={{ width: parseInt(s.value), height: 20 }}
                      />
                      <div>
                        <p className="text-xs text-gray-300 font-mono">{s.name}</p>
                        <p className="text-[10px] text-gray-500">{s.value}</p>
                        <p className="text-[10px] text-gray-400">{s.classes}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Shadows */}
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">Shadows & Elevation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { name: "sm", class: "shadow-sm" },
                    { name: "md", class: "shadow-md" },
                    { name: "lg", class: "shadow-lg" },
                    { name: "xl", class: "shadow-xl" },
                    { name: "2xl", class: "shadow-2xl" },
                    { name: "inner", class: "shadow-inner" },
                  ].map((s) => (
                    <div key={s.name} className={`bg-gray-800 rounded-lg p-6 ${s.class} flex items-center justify-center`}>
                      <span className="text-xs text-gray-400">{s.name}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Mock Data Generator */}
        {activeTab === "mock" && (
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-white font-bold text-lg">Mock Data Generator</h2>
                <p className="text-blue-300 text-sm">Generate fake data for testing UI components</p>
              </div>
              <div className="flex gap-2">
                <Button onClick={generateTickets} className="bg-blue-700 hover:bg-blue-600 text-xs">
                  <Database size={12} className="mr-1" /> Generate Tickets
                </Button>
                <Button onClick={generateUsers} variant="outline" className="text-xs">
                  <Users size={12} className="mr-1" /> Generate Users
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Mock Tickets */}
              <Card className="bg-gray-900 border-gray-800">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <TicketIcon size={18} /> Mock Tickets
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {mockTickets.length === 0 ? (
                    <div className="text-center py-8">
                      <Database size={40} className="text-gray-600 mx-auto mb-3" />
                      <p className="text-gray-500 text-sm">No tickets generated yet</p>
                      <p className="text-gray-600 text-xs mt-1">Click "Generate Tickets" to create mock data</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {mockTickets.map((ticket) => (
                        <div key={ticket.id} className="bg-gray-800 rounded-lg p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm text-blue-300">#{ticket.ticketNumber}</span>
                              <Badge
                                className={`text-xs ${
                                  ticket.status === "active" ? "bg-blue-600" :
                                  ticket.status === "transit" ? "bg-amber-600" :
                                  ticket.status === "ready" ? "bg-purple-600" :
                                  "bg-green-600"
                                }`}
                              >
                                {ticket.status}
                              </Badge>
                            </div>
                            <span className="text-xs text-gray-500">{ticket.visitorType.replace("_", " ")}</span>
                          </div>
                          <div className="flex items-center gap-3 text-sm">
                            <span className="text-gray-200 font-medium">{ticket.guestName}</span>
                            <span className="text-gray-400">·</span>
                            <span className="font-mono text-gray-300 text-xs bg-gray-700 px-2 py-0.5 rounded">{ticket.licensePlate}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <Car size={12} />
                            <span>{ticket.carColor} {ticket.carMake} {ticket.carModel}</span>
                            <span className="text-gray-600">·</span>
                            <Clock size={12} />
                            <span>{new Date(ticket.createdAt).toLocaleString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Mock Users */}
              <Card className="bg-gray-900 border-gray-800">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Users size={18} /> Mock Users
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {mockUsers.length === 0 ? (
                    <div className="text-center py-8">
                      <Users size={40} className="text-gray-600 mx-auto mb-3" />
                      <p className="text-gray-500 text-sm">No users generated yet</p>
                      <p className="text-gray-600 text-xs mt-1">Click "Generate Users" to create mock data</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {mockUsers.map((user) => (
                        <div key={user.id} className="bg-gray-800 rounded-lg p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-blue-700 flex items-center justify-center text-white text-sm font-bold">
                                {user.firstName[0]}{user.lastName[0]}
                              </div>
                              <div>
                                <p className="text-gray-200 font-medium text-sm">{user.firstName} {user.lastName}</p>
                                <p className="text-gray-500 text-xs">@{user.username}</p>
                              </div>
                            </div>
                            <Badge
                              variant={user.role === "superadmin" ? "default" : user.role === "privilege_admin" ? "secondary" : "outline"}
                              className={`text-xs ${
                                user.role === "superadmin" ? "bg-purple-700" :
                                user.role === "privilege_admin" ? "bg-blue-700" :
                                ""
                              }`}
                            >
                              {user.role.replace("_", " ")}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span>{user.email}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Raw Data View */}
            {mockTickets.length > 0 && (
              <Card className="bg-gray-900 border-gray-800">
                <CardHeader>
                  <CardTitle className="text-white text-sm">Raw JSON — Tickets</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="bg-gray-950 rounded-lg p-4 text-xs text-gray-300 overflow-auto max-h-64 font-mono">
                    {JSON.stringify(mockTickets, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            )}

            {mockUsers.length > 0 && (
              <Card className="bg-gray-900 border-gray-800">
                <CardHeader>
                  <CardTitle className="text-white text-sm">Raw JSON — Users</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="bg-gray-950 rounded-lg p-4 text-xs text-gray-300 overflow-auto max-h-64 font-mono">
                    {JSON.stringify(mockUsers, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
