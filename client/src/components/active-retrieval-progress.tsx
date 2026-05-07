import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Car, CheckCircle, Clock, Sparkles, X } from "lucide-react";
import type { ValetTicket } from "@shared/schema";

interface ActiveRetrievalProgressProps {
  ticket: ValetTicket;
  onStageComplete?: (ticketNumber: string, nextStage: number) => void;
}

// Per-stage durations
const STAGE_DURATIONS_MS = [
  5 * 60 * 1000, // Stage 0: Retrieving — 5 min
  5 * 60 * 1000, // Stage 1: In Transit — 5 min
  4 * 60 * 1000, // Stage 2: Final Preparations — 4 min
];

const stages = [
  { id: 1, name: "Retrieving",           icon: Car,         status: "retrieving" },
  { id: 2, name: "In Transit",           icon: Car,         status: "transit"    },
  { id: 3, name: "Final Preparations",   icon: Sparkles,    status: "preparing"  },
  { id: 4, name: "Ready",                icon: CheckCircle, status: "ready"      },
];

function getStageIndex(status: string): number {
  if (status === "retrieving") return 0;
  if (status === "transit")    return 1;
  if (status === "preparing")  return 2;
  if (status === "ready")      return 3;
  return -1;
}

function isTimedStage(status: string) {
  return status === "retrieving" || status === "transit" || status === "preparing";
}

export function ActiveRetrievalProgress({ ticket, onStageComplete }: ActiveRetrievalProgressProps) {
  const [timeRemaining, setTimeRemaining] = useState<number>(STAGE_DURATIONS_MS[0]);
  const [currentStageIndex, setCurrentStageIndex] = useState<number>(0);
  const hasTriggeredRef = useRef<string | null>(null);

  useEffect(() => {
    const idx = getStageIndex(ticket.status);
    if (idx < 0) return;

    setCurrentStageIndex(idx);

    if (!isTimedStage(ticket.status)) {
      setTimeRemaining(0);
      return;
    }

    const duration = STAGE_DURATIONS_MS[idx];
    const stageStarted = ticket.stageStartedAt ? new Date(ticket.stageStartedAt).getTime() : Date.now();
    const elapsed = Date.now() - stageStarted;
    setTimeRemaining(Math.max(0, duration - elapsed));
  }, [ticket.status, ticket.stageStartedAt]);

  // Countdown — only for timed stages
  useEffect(() => {
    if (!isTimedStage(ticket.status)) return;
    const interval = setInterval(() => {
      setTimeRemaining((prev) => Math.max(0, prev - 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [ticket.status, ticket.ticketNumber]);

  // Auto-progression — stages 0,1,2 can auto-advance; stage 3 (ready) is terminal
  useEffect(() => {
    const key = `${ticket.ticketNumber}-${ticket.status}`;
    if (
      timeRemaining === 0 &&
      hasTriggeredRef.current !== key &&
      onStageComplete &&
      currentStageIndex < 3
    ) {
      hasTriggeredRef.current = key;
      // nextStage passed to parent: 2=transit, 3=preparing, 4=ready
      onStageComplete(ticket.ticketNumber, currentStageIndex + 2);
    }
  }, [timeRemaining, ticket.ticketNumber, ticket.status, onStageComplete, currentStageIndex]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const getProgressPercentage = () => {
    const duration = STAGE_DURATIONS_MS[currentStageIndex] ?? STAGE_DURATIONS_MS[0];
    return ((duration - timeRemaining) / duration) * 100;
  };

  if (getStageIndex(ticket.status) < 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {ticket.status === "ready" ? (
            <CheckCircle className="text-green-600" size={18} />
          ) : (
            <Clock className="text-regis-navy" size={18} />
          )}
          {ticket.status === "ready" ? (
            <span className="text-lg font-bold text-green-600">Car Ready!</span>
          ) : (
            <span className="text-lg font-bold text-regis-navy">{formatTime(timeRemaining)}</span>
          )}
        </div>
        <Badge variant="outline" className="text-xs">
          Stage {currentStageIndex + 1} of {stages.length}
        </Badge>
      </div>

      <div className="flex items-center justify-between">
        {stages.map((stage, index) => {
          const StageIcon = stage.icon;
          const isActive    = index === currentStageIndex;
          const isCompleted = index < currentStageIndex;

          return (
            <div key={stage.id} className="flex flex-col items-center flex-1">
              <div className="flex items-center w-full">
                {index > 0 && (
                  <div className={`flex-1 h-1 ${isCompleted || isActive ? "bg-regis-gold" : "bg-gray-200"}`} />
                )}
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                    isActive && ticket.status === "ready"
                      ? "bg-green-500 text-white"
                      : isActive
                      ? "bg-regis-gold text-regis-navy ring-4 ring-regis-gold/30 animate-pulse"
                      : isCompleted
                      ? "bg-green-500 text-white"
                      : "bg-gray-200 text-gray-400"
                  }`}
                >
                  <StageIcon size={16} />
                </div>
                {index < stages.length - 1 && (
                  <div className={`flex-1 h-1 ${isCompleted ? "bg-regis-gold" : "bg-gray-200"}`} />
                )}
              </div>
              <span
                className={`text-[10px] mt-1.5 font-medium text-center leading-tight ${
                  isActive && ticket.status === "ready"
                    ? "text-green-600"
                    : isActive
                    ? "text-regis-navy"
                    : isCompleted
                    ? "text-green-600"
                    : "text-gray-400"
                }`}
              >
                {stage.name}
              </span>
              {isActive && isTimedStage(ticket.status) && (
                <div className="w-full mt-1 bg-gray-200 rounded-full h-1.5">
                  <div
                    className="bg-regis-gold h-1.5 rounded-full transition-all duration-1000"
                    style={{ width: `${getProgressPercentage()}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Compact version for mobile view
export function CompactRetrievalProgress({ ticket }: { ticket: ValetTicket }) {
  const [timeRemaining, setTimeRemaining] = useState<number>(STAGE_DURATIONS_MS[0]);
  const [currentStageIndex, setCurrentStageIndex] = useState<number>(0);

  useEffect(() => {
    const idx = getStageIndex(ticket.status);
    if (idx < 0) return;

    setCurrentStageIndex(idx);

    if (!isTimedStage(ticket.status)) {
      setTimeRemaining(0);
      return;
    }

    const duration = STAGE_DURATIONS_MS[idx];
    const stageStarted = ticket.stageStartedAt ? new Date(ticket.stageStartedAt).getTime() : Date.now();
    const elapsed = Date.now() - stageStarted;
    setTimeRemaining(Math.max(0, duration - elapsed));
  }, [ticket.status, ticket.stageStartedAt]);

  useEffect(() => {
    if (!isTimedStage(ticket.status)) return;
    const interval = setInterval(() => {
      setTimeRemaining((prev) => Math.max(0, prev - 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [ticket.status, ticket.ticketNumber]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  if (getStageIndex(ticket.status) < 0) return null;

  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center gap-0.5">
        {stages.map((stage, index) => {
          const StageIcon = stage.icon;
          const isActive    = index === currentStageIndex;
          const isCompleted = index < currentStageIndex;

          return (
            <div key={stage.id} className="flex items-center">
              {index > 0 && (
                <div className={`w-2 h-0.5 ${isCompleted || isActive ? "bg-regis-gold" : "bg-gray-300"}`} />
              )}
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center ${
                  isActive && ticket.status === "ready"
                    ? "bg-green-500 text-white"
                    : isActive
                    ? "bg-regis-gold text-regis-navy animate-pulse"
                    : isCompleted
                    ? "bg-green-500 text-white"
                    : "bg-gray-200 text-gray-400"
                }`}
              >
                <StageIcon size={10} />
              </div>
            </div>
          );
        })}
      </div>
      {ticket.status === "ready" ? (
        <span className="text-xs font-bold text-green-600 ml-1">Ready!</span>
      ) : (
        <span className="text-xs font-mono font-bold text-regis-navy ml-1">{formatTime(timeRemaining)}</span>
      )}
    </div>
  );
}

interface UnifiedRetrievalBoxProps {
  tickets: ValetTicket[];
  onStageComplete?: (ticketNumber: string, nextStage: number) => void;
  onStatusChange?: (ticketNumber: string, status: string) => void;
  canEdit?: boolean;
}

export function UnifiedRetrievalBox({ tickets, onStageComplete, onStatusChange, canEdit = true }: UnifiedRetrievalBoxProps) {
  const activeRetrievalTickets = tickets.filter(
    (t) => t.status === "retrieving" || t.status === "transit" || t.status === "preparing" || t.status === "ready"
  );

  const retrievingCount = tickets.filter((t) => t.status === "retrieving").length;
  const transitCount    = tickets.filter((t) => t.status === "transit").length;
  const preparingCount  = tickets.filter((t) => t.status === "preparing").length;
  const readyCount      = tickets.filter((t) => t.status === "ready").length;
  const totalActive     = activeRetrievalTickets.length;

  const getStatusLabel = (status: string) => {
    if (status === "retrieving") return "Retrieving";
    if (status === "transit")    return "In Transit";
    if (status === "preparing")  return "Final Prep";
    if (status === "ready")      return "Ready";
    return status;
  };

  const getStatusBadgeClass = (status: string) => {
    if (status === "ready")      return "bg-green-600 text-white";
    if (status === "preparing")  return "bg-purple-500 text-white";
    if (status === "transit")    return "bg-yellow-500 text-white";
    return "bg-blue-500 text-white";
  };

  const getCardClass = (status: string) => {
    if (status === "ready")     return "bg-green-50 border-green-300";
    if (status === "preparing") return "bg-purple-50 border-purple-300";
    return "bg-white border-gray-200";
  };

  return (
    <Card className="shadow-lg border-2 border-regis-gold/20 bg-gradient-to-br from-white to-regis-gold/5">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-regis-navy flex items-center gap-2">
            <Car className="text-regis-gold" size={24} />
            Active Retrievals
          </h3>
          <Badge className="bg-regis-navy text-white text-lg px-4 py-1">
            {totalActive}
          </Badge>
        </div>

        <div className="grid grid-cols-4 gap-2 mb-4">
          <div className="text-center p-2 bg-blue-50 rounded-lg">
            <p className="text-xl font-bold text-blue-600">{retrievingCount}</p>
            <p className="text-[10px] text-blue-600 font-medium">Retrieving</p>
          </div>
          <div className="text-center p-2 bg-yellow-50 rounded-lg">
            <p className="text-xl font-bold text-yellow-600">{transitCount}</p>
            <p className="text-[10px] text-yellow-600 font-medium">In Transit</p>
          </div>
          <div className="text-center p-2 bg-purple-50 rounded-lg">
            <p className="text-xl font-bold text-purple-600">{preparingCount}</p>
            <p className="text-[10px] text-purple-600 font-medium">Final Prep</p>
          </div>
          <div className="text-center p-2 bg-green-50 rounded-lg">
            <p className="text-xl font-bold text-green-600">{readyCount}</p>
            <p className="text-[10px] text-green-600 font-medium">Ready</p>
          </div>
        </div>

        {activeRetrievalTickets.length > 0 && (
          <div className="space-y-4 max-h-80 overflow-y-auto">
            {activeRetrievalTickets.map((ticket) => (
              <div
                key={ticket.id}
                className={`p-4 rounded-lg border shadow-sm ${getCardClass(ticket.status)}`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="font-bold text-regis-navy">#{ticket.ticketNumber}</p>
                    <p className="text-xs text-gray-500">
                      {ticket.carMake} {ticket.carModel} • {ticket.carColor}
                    </p>
                  </div>
                  <Badge className={getStatusBadgeClass(ticket.status)}>
                    {getStatusLabel(ticket.status)}
                  </Badge>
                </div>
                <ActiveRetrievalProgress ticket={ticket} onStageComplete={onStageComplete} />
                {canEdit && onStatusChange && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                    {ticket.status === "retrieving" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-xs border-yellow-400 text-yellow-700 hover:bg-yellow-50"
                        onClick={() => onStatusChange(ticket.ticketNumber, "transit")}
                      >
                        → In Transit
                      </Button>
                    )}
                    {ticket.status === "transit" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-xs border-purple-400 text-purple-700 hover:bg-purple-50"
                        onClick={() => onStatusChange(ticket.ticketNumber, "preparing")}
                      >
                        ✦ Final Prep
                      </Button>
                    )}
                    {(ticket.status === "retrieving" || ticket.status === "transit" || ticket.status === "preparing") && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-xs border-green-500 text-green-700 hover:bg-green-50 font-semibold"
                        onClick={() => onStatusChange(ticket.ticketNumber, "ready")}
                      >
                        ✓ Ready Now
                      </Button>
                    )}
                    {ticket.status === "ready" && (
                      <>
                        <Button
                          size="sm"
                          className="flex-1 text-xs bg-gray-700 hover:bg-gray-800 text-white"
                          onClick={() => onStatusChange(ticket.ticketNumber, "completed")}
                        >
                          Departed
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                          onClick={() => onStatusChange(ticket.ticketNumber, "out_with_guest")}
                        >
                          Coming Back
                        </Button>
                      </>
                    )}
                    {(ticket.status === "retrieving" || ticket.status === "transit") && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400"
                        onClick={() => onStatusChange(ticket.ticketNumber, "active")}
                      >
                        <X size={12} className="mr-1" />
                        Cancel
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {activeRetrievalTickets.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <Car size={40} className="mx-auto mb-2 opacity-40" />
            <p>No active retrievals</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
