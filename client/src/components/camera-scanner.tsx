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
    const w = await Tesseract.createWorker("eng", 1, {
      logger: () => {},
    });
    await w.setParameters({
      tessedit_char_whitelist: "0123456789",
      tessedit_pageseg_mode: "7" as any, // single text line
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

// Preprocess the canvas: crop guide box region, upscale, grayscale, contrast-stretch, sharpen
function preprocessFrame(
  video: HTMLVideoElement,
  outputCanvas: HTMLCanvasElement
): boolean {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return false;

  // Guide box is centred at 50% × 50% of the viewport, ~70% wide, ~20% tall
  // We crop a generous band: centre 80% wide × 30% tall of the video frame
  const cropW = Math.round(vw * 0.8);
  const cropH = Math.round(vh * 0.28);
  const cropX = Math.round((vw - cropW) / 2);
  const cropY = Math.round((vh - cropH) / 2);

  // Upscale to a fixed 900px wide output for Tesseract
  const outW = 900;
  const outH = Math.round((outW / cropW) * cropH);
  outputCanvas.width = outW;
  outputCanvas.height = outH;

  const ctx = outputCanvas.getContext("2d")!;

  // Draw scaled crop
  ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, outW, outH);

  // Grayscale + contrast stretch + threshold
  const imgData = ctx.getImageData(0, 0, outW, outH);
  const d = imgData.data;

  // Convert to grayscale and find range for contrast stretch
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

  // Apply contrast stretch and adaptive threshold for white text on dark or dark on white
  for (let i = 0; i < gray.length; i++) {
    const v = Math.round(((gray[i] - lo) / range) * 255);
    // Sharpen: simple unsharp mask (amplify deviation from 128)
    const sharpened = Math.max(0, Math.min(255, 128 + (v - 128) * 1.8));
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = sharpened;
    d[i * 4 + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);
  return true;
}

// Extract exactly 5 consecutive digits from raw OCR text
function extract5Digits(raw: string): string | null {
  const cleaned = raw.replace(/\s+/g, "").replace(/[oO]/g, "0").replace(/[lI|]/g, "1").replace(/[sS]/g, "5").replace(/[gq]/g, "9");
  const m = cleaned.match(/\d{5}/);
  return m ? m[0] : null;
}

export function CameraScanner({ onScanComplete, onClose }: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const processCanvas = useRef<HTMLCanvasElement>(document.createElement("canvas"));
  const previewCanvas = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanLoopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isScanningRef = useRef(false);

  const [workerReady, setWorkerReady] = useState(false);
  const [status, setStatus] = useState<"loading" | "scanning" | "found" | "error">("loading");
  const [liveResult, setLiveResult] = useState<string | null>(null);
  const [confidence, setConfidence] = useState(0);
  const [votes, setVotes] = useState<Record<string, number>>({});
  const [confirmedNumber, setConfirmedNumber] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Warm up the Tesseract worker immediately
  useEffect(() => {
    getDigitWorker()
      .then(() => setWorkerReady(true))
      .catch(() => setCameraError("OCR engine failed to load"));
  }, []);

  // Start camera
  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch {
        setCameraError("Camera access denied. Please allow camera access and try again.");
      }
    };
    startCamera();
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const runOCR = useCallback(async () => {
    if (isScanningRef.current || !videoRef.current || !workerReady) return;
    const video = videoRef.current;
    if (video.readyState < 2) return;

    isScanningRef.current = true;
    try {
      const ok = preprocessFrame(video, processCanvas.current);
      if (!ok) return;

      // Show preprocessed preview
      if (previewCanvas.current) {
        const pCtx = previewCanvas.current.getContext("2d")!;
        previewCanvas.current.width = processCanvas.current.width;
        previewCanvas.current.height = processCanvas.current.height;
        pCtx.drawImage(processCanvas.current, 0, 0);
      }

      const worker = await getDigitWorker();
      const { data } = await worker.recognize(processCanvas.current);
      const result = extract5Digits(data.text);

      if (result && data.confidence > 55) {
        setLiveResult(result);
        setConfidence(Math.round(data.confidence));

        setVotes((prev) => {
          const next = { ...prev, [result]: (prev[result] ?? 0) + 1 };

          // Auto-confirm when same number seen 2+ times
          const winner = Object.entries(next).find(([, c]) => c >= 2);
          if (winner) {
            setStatus("found");
            setConfirmedNumber(winner[0]);
            setLiveResult(winner[0]);
            // Auto-submit after short delay for visual feedback
            setTimeout(() => onScanComplete(winner[0]), 900);
          } else {
            setStatus("scanning");
          }
          return next;
        });
      } else {
        setStatus("scanning");
      }
    } catch (err) {
      console.warn("[OCR]", err);
    } finally {
      isScanningRef.current = false;
    }
  }, [workerReady, onScanComplete]);

  // Auto-scan loop
  useEffect(() => {
    if (!workerReady) return;
    setStatus("scanning");

    const loop = () => {
      runOCR().finally(() => {
        scanLoopRef.current = setTimeout(loop, 1200);
      });
    };
    scanLoopRef.current = setTimeout(loop, 600);

    return () => {
      if (scanLoopRef.current) clearTimeout(scanLoopRef.current);
    };
  }, [workerReady, runOCR]);

  // Manual capture (reset votes + scan immediately)
  const handleManualCapture = () => {
    setVotes({});
    setLiveResult(null);
    setConfirmedNumber(null);
    setStatus("scanning");
    runOCR();
  };

  const isFound = status === "found";

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <div className="bg-regis-navy text-white px-6 py-4 flex items-center justify-between shrink-0">
        <div>
          <h2 className="font-semibold text-lg">Scan Ticket Number</h2>
          <p className="text-xs text-blue-200">Point camera at the 5-digit ticket number</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:text-gray-300">
          <X size={20} />
        </Button>
      </div>

      {/* Camera view */}
      <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden" style={{ minHeight: 320 }}>
        {cameraError ? (
          <p className="text-white text-center px-8 text-sm">{cameraError}</p>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
            />

            {/* Darkened overlay with clear guide window */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              {/* Top dark band */}
              <div className="absolute top-0 left-0 right-0 bg-black/55" style={{ bottom: "calc(50% + 52px)" }} />
              {/* Bottom dark band */}
              <div className="absolute bottom-0 left-0 right-0 bg-black/55" style={{ top: "calc(50% + 52px)" }} />
              {/* Left dark band */}
              <div className="absolute left-0 bg-black/55" style={{ top: "calc(50% - 52px)", bottom: "calc(50% - 52px)", right: "calc(50% + 120px)" }} />
              {/* Right dark band */}
              <div className="absolute right-0 bg-black/55" style={{ top: "calc(50% - 52px)", bottom: "calc(50% - 52px)", left: "calc(50% + 120px)" }} />

              {/* Guide box */}
              <div
                className={`w-60 h-26 relative transition-all duration-300 ${isFound ? "scale-105" : ""}`}
                style={{ width: 240, height: 104 }}
              >
                {/* Animated border corners */}
                {[
                  "top-0 left-0 border-t-4 border-l-4 rounded-tl-md",
                  "top-0 right-0 border-t-4 border-r-4 rounded-tr-md",
                  "bottom-0 left-0 border-b-4 border-l-4 rounded-bl-md",
                  "bottom-0 right-0 border-b-4 border-r-4 rounded-br-md",
                ].map((cls, i) => (
                  <div
                    key={i}
                    className={`absolute w-8 h-8 transition-colors duration-300 ${cls} ${
                      isFound ? "border-green-400" : "border-regis-gold"
                    }`}
                  />
                ))}

                {/* Scan line animation */}
                {!isFound && (
                  <div
                    className="absolute left-2 right-2 h-0.5 bg-regis-gold/70 animate-bounce"
                    style={{ animationDuration: "1.6s", top: "50%" }}
                  />
                )}

                {/* Confirmed tick overlay */}
                {isFound && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-green-500/90 rounded-full p-3">
                      <Check size={28} className="text-white" />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Capture button (bottom centre) */}
            {!isFound && (
              <button
                onClick={handleManualCapture}
                className="absolute bottom-6 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full flex items-center justify-center transition-all active:scale-95"
                style={{ background: "#c9a84c", boxShadow: "0 0 0 4px rgba(201,168,76,0.35)" }}
                title="Capture now"
              >
                <Camera size={26} className="text-white" />
              </button>
            )}

            {/* Reset button when found */}
            {isFound && (
              <button
                onClick={() => { setVotes({}); setLiveResult(null); setConfirmedNumber(null); setStatus("scanning"); }}
                className="absolute bottom-6 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full bg-white/20 flex items-center justify-center"
                title="Scan again"
              >
                <RefreshCw size={22} className="text-white" />
              </button>
            )}
          </>
        )}
      </div>

      {/* Status bar */}
      <div className={`shrink-0 px-6 py-4 flex items-center justify-between transition-colors duration-300 ${
        isFound ? "bg-green-700" : status === "loading" ? "bg-gray-800" : "bg-regis-navy"
      }`}>
        <div>
          {status === "loading" && (
            <p className="text-white/70 text-sm">Initialising scanner…</p>
          )}
          {status === "scanning" && !liveResult && (
            <p className="text-white/70 text-sm animate-pulse">Scanning for digits…</p>
          )}
          {status === "scanning" && liveResult && (
            <>
              <p className="text-white/60 text-xs uppercase tracking-wider mb-0.5">Reading</p>
              <p className="text-white font-mono text-2xl font-bold tracking-[0.3em]">{liveResult}</p>
              <p className="text-white/50 text-xs">Confidence {confidence}%</p>
            </>
          )}
          {isFound && confirmedNumber && (
            <>
              <p className="text-green-200 text-xs uppercase tracking-wider mb-0.5">Confirmed</p>
              <p className="text-white font-mono text-2xl font-bold tracking-[0.3em]">{confirmedNumber}</p>
            </>
          )}
        </div>

        {/* Dots showing vote progress */}
        {status === "scanning" && liveResult && (
          <div className="flex gap-1.5">
            {[0, 1].map((i) => (
              <div
                key={i}
                className={`w-3 h-3 rounded-full transition-colors ${
                  (votes[liveResult] ?? 0) > i ? "bg-regis-gold" : "bg-white/20"
                }`}
              />
            ))}
          </div>
        )}
        {isFound && (
          <div className="flex gap-1.5">
            {[0, 1].map((i) => (
              <div key={i} className="w-3 h-3 rounded-full bg-green-300" />
            ))}
          </div>
        )}
      </div>

      {/* Manual entry fallback */}
      <div className="shrink-0 bg-white px-6 py-4 border-t border-gray-100">
        <p className="text-center text-xs text-gray-500 mb-3">Or enter your 5-digit ticket number below</p>
        <ManualEntry onSubmit={onScanComplete} />
      </div>

      {/* Hidden processing canvas */}
      <canvas ref={previewCanvas} className="hidden" />
    </div>
  );
}

function ManualEntry({ onSubmit }: { onSubmit: (n: string) => void }) {
  const [val, setVal] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex gap-2">
      <input
        ref={inputRef}
        type="tel"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={5}
        placeholder="e.g. 12345"
        value={val}
        onChange={(e) => setVal(e.target.value.replace(/\D/g, "").slice(0, 5))}
        onKeyDown={(e) => { if (e.key === "Enter" && val.length === 5) onSubmit(val); }}
        className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-center font-mono text-lg tracking-[0.4em] focus:outline-none focus:ring-2 focus:ring-regis-navy/40"
      />
      <button
        onClick={() => { if (val.length === 5) onSubmit(val); }}
        disabled={val.length < 5}
        className="px-5 py-2.5 rounded-lg font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ background: "#1a2340", color: "white" }}
      >
        Go
      </button>
    </div>
  );
}
