import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { X, Camera, RefreshCw, Check } from "lucide-react";
import Tesseract from "tesseract.js";

interface CameraScannerProps {
  onScanComplete: (ticketNumber: string) => void;
  onClose: () => void;
}

// Singleton digit-only Tesseract worker
let _worker: Tesseract.Worker | null = null;
let _workerReady = false;
let _workerPromise: Promise<Tesseract.Worker> | null = null;

function getDigitWorker(): Promise<Tesseract.Worker> {
  if (_worker && _workerReady) return Promise.resolve(_worker);
  if (_workerPromise) return _workerPromise;

  _workerPromise = (async () => {
    const w = await Tesseract.createWorker("eng", 1, { logger: () => {} });
    await w.setParameters({
      tessedit_char_whitelist: "0123456789",
      tessedit_pageseg_mode: "7" as any,
      preserve_interword_spaces: "0",
    });
    _worker = w;
    _workerReady = true;
    return w;
  })().catch((err) => {
    console.error("[DigitOCR] worker init failed", err);
    _workerPromise = null;
    throw err;
  });

  return _workerPromise;
}

function preprocessFrame(video: HTMLVideoElement, outputCanvas: HTMLCanvasElement): boolean {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return false;

  const cropW = Math.round(vw * 0.8);
  const cropH = Math.round(vh * 0.28);
  const cropX = Math.round((vw - cropW) / 2);
  const cropY = Math.round((vh - cropH) / 2);

  const outW = 900;
  const outH = Math.round((outW / cropW) * cropH);
  outputCanvas.width = outW;
  outputCanvas.height = outH;

  const ctx = outputCanvas.getContext("2d")!;
  ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, outW, outH);

  const imgData = ctx.getImageData(0, 0, outW, outH);
  const d = imgData.data;

  const gray = new Uint8ClampedArray(outW * outH);
  for (let i = 0; i < gray.length; i++) {
    gray[i] = Math.round(0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]);
  }
  let lo = 255, hi = 0;
  for (let i = 0; i < gray.length; i++) {
    if (gray[i] < lo) lo = gray[i];
    if (gray[i] > hi) hi = gray[i];
  }
  const range = hi - lo || 1;
  for (let i = 0; i < gray.length; i++) {
    const v = Math.round(((gray[i] - lo) / range) * 255);
    const sharpened = Math.max(0, Math.min(255, 128 + (v - 128) * 1.8));
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = sharpened;
    d[i * 4 + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);
  return true;
}

function extract5Digits(raw: string): string | null {
  const cleaned = raw
    .replace(/\s+/g, "")
    .replace(/[oO]/g, "0")
    .replace(/[lI|]/g, "1")
    .replace(/[sS]/g, "5")
    .replace(/[gq]/g, "9");
  const m = cleaned.match(/\d{5}/);
  return m ? m[0] : null;
}

export function CameraScanner({ onScanComplete, onClose }: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const processCanvas = useRef<HTMLCanvasElement>(document.createElement("canvas"));
  const streamRef = useRef<MediaStream | null>(null);
  const scanLoopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isScanningRef = useRef(false);
  const mountedRef = useRef(true);
  // Used inside the loop callback to stop without re-creating the loop effect
  const foundRef = useRef(false);
  const votesRef = useRef<Record<string, number>>({});

  const [workerReady, setWorkerReady] = useState(false);
  const [status, setStatus] = useState<"loading" | "scanning" | "found" | "error">("loading");
  const [liveResult, setLiveResult] = useState<string | null>(null);
  const [confidence, setConfidence] = useState(0);
  const [votes, setVotes] = useState<Record<string, number>>({});
  const [confirmedNumber, setConfirmedNumber] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Warm up the Tesseract worker
  useEffect(() => {
    getDigitWorker()
      .then(() => { if (mountedRef.current) setWorkerReady(true); })
      .catch(() => { if (mountedRef.current) setCameraError("OCR engine failed to load. Please close and try again."); });
  }, []);

  // Camera stream
  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
        streamRef.current = stream;
        if (videoRef.current && mountedRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch {
        if (mountedRef.current) setCameraError("Camera access denied. Please allow camera access and try again.");
      }
    };
    startCamera();
    return () => { streamRef.current?.getTracks().forEach((t) => t.stop()); };
  }, []);

  // Single OCR pass — returns the detected number or null
  const runOCR = useCallback(async (): Promise<string | null> => {
    if (isScanningRef.current || !videoRef.current || !mountedRef.current) return null;
    const video = videoRef.current;
    if (video.readyState < 2) return null;

    isScanningRef.current = true;
    try {
      if (!preprocessFrame(video, processCanvas.current)) return null;

      const worker = await getDigitWorker();
      const { data } = await worker.recognize(processCanvas.current);
      if (!mountedRef.current) return null;

      const result = extract5Digits(data.text);
      if (result && data.confidence > 55) {
        if (mountedRef.current) {
          setLiveResult(result);
          setConfidence(Math.round(data.confidence));
        }
        return result;
      }
    } catch (err) {
      console.warn("[OCR]", err);
    } finally {
      isScanningRef.current = false;
    }
    return null;
  }, []);

  // Scan loop — starts once when worker is ready, runs until found or unmounted
  useEffect(() => {
    if (!workerReady) return;

    foundRef.current = false;
    votesRef.current = {};
    setStatus("scanning");

    const loop = async () => {
      if (!mountedRef.current || foundRef.current) return;

      const result = await runOCR();

      if (!mountedRef.current || foundRef.current) return;

      if (result) {
        votesRef.current[result] = (votesRef.current[result] ?? 0) + 1;
        setVotes({ ...votesRef.current });

        if (votesRef.current[result] >= 2) {
          // Confirmed — stop loop and show confirmation button
          foundRef.current = true;
          setConfirmedNumber(result);
          setStatus("found");
          return;
        }
      }

      // Schedule next scan
      scanLoopRef.current = setTimeout(loop, 1200);
    };

    scanLoopRef.current = setTimeout(loop, 600);

    return () => {
      if (scanLoopRef.current) clearTimeout(scanLoopRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workerReady]); // intentionally only [workerReady] — loop manages itself via refs

  const handleManualCapture = () => {
    votesRef.current = {};
    setVotes({});
    setLiveResult(null);
    runOCR();
  };

  const handleUseNumber = () => {
    if (confirmedNumber) {
      foundRef.current = true;
      if (scanLoopRef.current) clearTimeout(scanLoopRef.current);
      onScanComplete(confirmedNumber);
    }
  };

  const handleScanAgain = () => {
    foundRef.current = false;
    votesRef.current = {};
    setVotes({});
    setLiveResult(null);
    setConfirmedNumber(null);
    setStatus("scanning");
    // Restart loop
    const loop = async () => {
      if (!mountedRef.current || foundRef.current) return;
      const result = await runOCR();
      if (!mountedRef.current || foundRef.current) return;
      if (result) {
        votesRef.current[result] = (votesRef.current[result] ?? 0) + 1;
        setVotes({ ...votesRef.current });
        if (votesRef.current[result] >= 2) {
          foundRef.current = true;
          setConfirmedNumber(result);
          setStatus("found");
          return;
        }
      }
      scanLoopRef.current = setTimeout(loop, 1200);
    };
    scanLoopRef.current = setTimeout(loop, 600);
  };

  const isFound = status === "found";

  return (
    <div className="fixed inset-0 z-[300] bg-black flex flex-col" style={{ touchAction: "none" }}>
      {/* Header */}
      <div className="bg-regis-navy text-white px-4 py-3 flex items-center justify-between shrink-0 safe-top">
        <div>
          <h2 className="font-semibold text-lg">Scan Ticket Number</h2>
          <p className="text-xs text-blue-200">Point camera at the 5-digit ticket number</p>
        </div>
        {/* Large tappable close button */}
        <button
          onClick={onClose}
          className="w-12 h-12 flex items-center justify-center rounded-full bg-white/10 active:bg-white/25 text-white"
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          <X size={22} />
        </button>
      </div>

      {/* Camera view */}
      <div className="relative flex-1 bg-black overflow-hidden" style={{ minHeight: 280 }}>
        {cameraError ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 px-8">
            <p className="text-white text-center text-sm">{cameraError}</p>
            <button
              onClick={onClose}
              className="px-6 py-3 rounded-xl bg-white/20 text-white font-semibold"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
            />

            {/* Overlay */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-0 left-0 right-0 bg-black/55" style={{ bottom: "calc(50% + 52px)" }} />
              <div className="absolute bottom-0 left-0 right-0 bg-black/55" style={{ top: "calc(50% + 52px)" }} />
              <div className="absolute left-0 bg-black/55" style={{ top: "calc(50% - 52px)", bottom: "calc(50% - 52px)", right: "calc(50% + 120px)" }} />
              <div className="absolute right-0 bg-black/55" style={{ top: "calc(50% - 52px)", bottom: "calc(50% - 52px)", left: "calc(50% + 120px)" }} />

              {/* Guide box corners */}
              <div className="absolute" style={{ left: "calc(50% - 120px)", top: "calc(50% - 52px)", width: 240, height: 104 }}>
                {[
                  "top-0 left-0 border-t-4 border-l-4 rounded-tl-md",
                  "top-0 right-0 border-t-4 border-r-4 rounded-tr-md",
                  "bottom-0 left-0 border-b-4 border-l-4 rounded-bl-md",
                  "bottom-0 right-0 border-b-4 border-r-4 rounded-br-md",
                ].map((cls, i) => (
                  <div key={i} className={`absolute w-8 h-8 transition-colors duration-300 ${cls} ${isFound ? "border-green-400" : "border-regis-gold"}`} />
                ))}
                {!isFound && (
                  <div className="absolute left-2 right-2 h-0.5 bg-regis-gold/70 animate-bounce" style={{ animationDuration: "1.6s", top: "50%" }} />
                )}
                {isFound && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-green-500/90 rounded-full p-3">
                      <Check size={28} className="text-white" />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Manual capture button */}
            {!isFound && (
              <button
                onClick={handleManualCapture}
                className="absolute bottom-6 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full flex items-center justify-center active:scale-95 transition-all"
                style={{ background: "#c9a84c", boxShadow: "0 0 0 4px rgba(201,168,76,0.35)", WebkitTapHighlightColor: "transparent" }}
              >
                <Camera size={26} className="text-white" />
              </button>
            )}
          </>
        )}
      </div>

      {/* Status bar */}
      <div className={`shrink-0 px-5 py-4 transition-colors duration-300 ${isFound ? "bg-green-700" : status === "loading" ? "bg-gray-800" : "bg-regis-navy"}`}>
        {!isFound && (
          <div className="flex items-center justify-between">
            <div>
              {status === "loading" && <p className="text-white/70 text-sm">Initialising scanner…</p>}
              {status === "scanning" && !liveResult && <p className="text-white/70 text-sm animate-pulse">Scanning for digits…</p>}
              {status === "scanning" && liveResult && (
                <>
                  <p className="text-white/60 text-xs uppercase tracking-wider mb-0.5">Reading</p>
                  <p className="text-white font-mono text-2xl font-bold tracking-[0.3em]">{liveResult}</p>
                  <p className="text-white/50 text-xs">Confidence {confidence}%</p>
                </>
              )}
            </div>
            {status === "scanning" && liveResult && (
              <div className="flex gap-1.5">
                {[0, 1].map((i) => (
                  <div key={i} className={`w-3 h-3 rounded-full transition-colors ${(votes[liveResult] ?? 0) > i ? "bg-regis-gold" : "bg-white/20"}`} />
                ))}
              </div>
            )}
          </div>
        )}

        {isFound && confirmedNumber && (
          <div className="space-y-3">
            <div className="text-center">
              <p className="text-green-200 text-xs uppercase tracking-wider mb-1">Number detected</p>
              <p className="text-white font-mono text-3xl font-bold tracking-[0.35em]">{confirmedNumber}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleScanAgain}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-white/15 text-white text-sm font-medium active:scale-95 transition-all"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                <RefreshCw size={16} />
                Scan again
              </button>
              <button
                onClick={handleUseNumber}
                className="flex-[2] flex items-center justify-center gap-2 py-3 rounded-xl bg-green-400 text-green-900 text-base font-bold active:scale-95 transition-all"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                <Check size={18} />
                Use {confirmedNumber}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Manual entry fallback */}
      <div className="shrink-0 bg-white px-5 py-4 border-t border-gray-100">
        <p className="text-center text-xs text-gray-500 mb-3">Or enter your 5-digit ticket number below</p>
        <ManualEntry onSubmit={onScanComplete} />
      </div>
    </div>
  );
}

function ManualEntry({ onSubmit }: { onSubmit: (n: string) => void }) {
  const [val, setVal] = useState("");

  return (
    <div className="flex gap-2">
      <input
        type="tel"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={5}
        placeholder="e.g. 12345"
        value={val}
        onChange={(e) => setVal(e.target.value.replace(/\D/g, "").slice(0, 5))}
        onKeyDown={(e) => { if (e.key === "Enter" && val.length === 5) onSubmit(val); }}
        className="flex-1 border border-gray-300 rounded-lg px-4 py-3 text-center font-mono text-lg tracking-[0.4em] focus:outline-none focus:ring-2 focus:ring-regis-navy/40"
      />
      <button
        onClick={() => { if (val.length === 5) onSubmit(val); }}
        disabled={val.length < 5}
        className="px-5 py-3 rounded-lg font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ background: "#1a2340", color: "white" }}
      >
        Go
      </button>
    </div>
  );
}
