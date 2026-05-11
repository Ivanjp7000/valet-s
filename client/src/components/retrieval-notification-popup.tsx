import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Car, MapPin, User, Bell, X } from "lucide-react";
import { VISITOR_TYPES } from "@shared/schema";

export interface RetrievalRequest {
  ticketNumber: string;
  guestName: string;
  carMake: string;
  carModel: string;
  carColor: string;
  licensePlate?: string | null;
  visitorType: string;
  visitorSubType?: string | null;
  ouId?: string | null;
  locationId?: string | null;
  parkingLocation?: string | null;
  parkingSector?: string | null;
}

interface RetrievalNotificationPopupProps {
  requests: RetrievalRequest[];
  onAccept: (ticketNumber: string) => void;
  onDismiss: (ticketNumber: string) => void;
}

// Single persistent AudioContext — created once and kept alive
let _audioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext | null {
  try {
    if (!_audioCtx) {
      _audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return _audioCtx;
  } catch {
    return null;
  }
}

// Register a one-time listener to unlock audio on first user gesture
function registerAudioUnlock() {
  const resume = () => {
    const ctx = getAudioCtx();
    if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
  };
  document.addEventListener("pointerdown", resume, { once: true });
  document.addEventListener("keydown", resume, { once: true });
}

function playAlertSound() {
  const ctx = getAudioCtx();
  if (!ctx) return;

  const doPlay = () => {
    try {
      const notes = [523, 659, 784, 659, 784]; // C5 E5 G5 E5 G5
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.value = freq;
        const start = ctx.currentTime + i * 0.15;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.35, start + 0.05);
        gain.gain.linearRampToValueAtTime(0, start + 0.13);
        osc.start(start);
        osc.stop(start + 0.15);
      });
    } catch {}
  };

  if (ctx.state === "suspended") {
    ctx.resume().then(doPlay).catch(() => {});
  } else {
    doPlay();
  }
}

export function RetrievalNotificationPopup({
  requests,
  onAccept,
  onDismiss,
}: RetrievalNotificationPopupProps) {
  const intervalsRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  // Unlock audio on first user gesture as early as possible
  useEffect(() => {
    registerAudioUnlock();
  }, []);

  // Repeat alert every 4 seconds per pending request until accepted/dismissed
  useEffect(() => {
    // Start alerting for new requests
    requests.forEach((r) => {
      if (!intervalsRef.current.has(r.ticketNumber)) {
        playAlertSound(); // play immediately
        const id = setInterval(() => playAlertSound(), 4000);
        intervalsRef.current.set(r.ticketNumber, id);
      }
    });

    // Stop alerting for requests no longer in the list (accepted or dismissed)
    const active = new Set(requests.map((r) => r.ticketNumber));
    intervalsRef.current.forEach((id, ticketNumber) => {
      if (!active.has(ticketNumber)) {
        clearInterval(id);
        intervalsRef.current.delete(ticketNumber);
      }
    });
  }, [requests]);

  // Clean up all intervals on unmount
  useEffect(() => {
    return () => {
      intervalsRef.current.forEach((id) => clearInterval(id));
    };
  }, []);

  if (requests.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 pointer-events-none">
      <div className="flex flex-col gap-3 w-full max-w-sm pointer-events-auto">
        {requests.map((req) => {
          const visitorLabel =
            VISITOR_TYPES[req.visitorType as keyof typeof VISITOR_TYPES] ||
            req.visitorType;
          const parking = [req.parkingSector, req.parkingLocation]
            .filter(Boolean)
            .join("-");

          return (
            <div
              key={req.ticketNumber}
              className="relative bg-white rounded-2xl shadow-2xl border-2 border-regis-gold overflow-hidden animate-in slide-in-from-top-4 duration-300"
            >
              {/* Gold top bar */}
              <div className="bg-regis-gold px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="text-regis-navy" size={16} />
                  <span className="text-regis-navy font-bold text-sm uppercase tracking-wide">
                    Car Retrieval Request
                  </span>
                </div>
                <button
                  onClick={() => onDismiss(req.ticketNumber)}
                  className="text-regis-navy/60 hover:text-regis-navy transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-4 space-y-3">
                {/* Ticket + Guest */}
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <User className="text-regis-navy" size={16} />
                  </div>
                  <div>
                    <p className="font-bold text-regis-navy text-base leading-tight">
                      {req.guestName}
                    </p>
                    <p className="text-xs text-gray-500">
                      Ticket #{req.ticketNumber} · {visitorLabel}
                    </p>
                  </div>
                </div>

                {/* Car info */}
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 bg-yellow-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Car className="text-regis-gold" size={16} />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">
                      {req.carColor} {req.carMake} {req.carModel}
                    </p>
                    {req.licensePlate && (
                      <p className="text-xs font-mono text-gray-600 tracking-widest">
                        {req.licensePlate}
                      </p>
                    )}
                  </div>
                </div>

                {/* Parking location */}
                {parking && (
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <MapPin className="text-green-600" size={16} />
                    </div>
                    <p className="font-semibold text-gray-800">
                      Parking: {parking}
                    </p>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2 pt-1">
                  <Button
                    onClick={() => onAccept(req.ticketNumber)}
                    className="flex-1 bg-regis-gold hover:bg-yellow-600 text-regis-navy font-bold h-10"
                  >
                    <Car className="mr-2" size={16} />
                    Accept Retrieval
                  </Button>
                  <Button
                    onClick={() => onDismiss(req.ticketNumber)}
                    variant="outline"
                    className="h-10 px-3 text-gray-500 border-gray-200"
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
