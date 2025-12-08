import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Car, CheckCircle, Clock } from "lucide-react";
import type { ValetTicket } from "@shared/schema";

interface ActiveRetrievalProgressProps {
  ticket: ValetTicket;
  onStageComplete?: (ticketNumber: string, nextStage: number) => void;
}

const STAGE_DURATION_MS = 5 * 60 * 1000; // 5 minutes per stage

const stages = [
  { id: 1, name: "Retrieving", icon: Car, color: "blue" },
  { id: 2, name: "In Transit", icon: Car, color: "yellow" },
  { id: 3, name: "Ready", icon: CheckCircle, color: "green" },
];

export function ActiveRetrievalProgress({ ticket, onStageComplete }: ActiveRetrievalProgressProps) {
  const [timeRemaining, setTimeRemaining] = useState<number>(STAGE_DURATION_MS);
  const [currentStageIndex, setCurrentStageIndex] = useState<number>(0);
  const hasTriggeredRef = useRef<string | null>(null);

  // Calculate initial time and stage
  useEffect(() => {
    let stageIndex = 0;
    if (ticket.status === "retrieving") stageIndex = 0;
    else if (ticket.status === "transit") stageIndex = 1;
    else if (ticket.status === "ready") stageIndex = 2;
    else return;

    setCurrentStageIndex(stageIndex);

    const stageStarted = ticket.stageStartedAt ? new Date(ticket.stageStartedAt).getTime() : Date.now();
    const elapsed = Date.now() - stageStarted;
    const remaining = Math.max(0, STAGE_DURATION_MS - elapsed);
    setTimeRemaining(remaining);
  }, [ticket.status, ticket.stageStartedAt]);

  // Countdown timer
  useEffect(() => {
    if (ticket.status !== "retrieving" && ticket.status !== "transit" && ticket.status !== "ready") {
      return;
    }

    const interval = setInterval(() => {
      setTimeRemaining((prev) => Math.max(0, prev - 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [ticket.status, ticket.ticketNumber]);

  // Auto-progression with ref-based guard to prevent infinite loops
  useEffect(() => {
    const key = `${ticket.ticketNumber}-${ticket.status}`;
    
    if (
      timeRemaining === 0 &&
      hasTriggeredRef.current !== key &&
      onStageComplete &&
      currentStageIndex < 2
    ) {
      hasTriggeredRef.current = key;
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
    return ((STAGE_DURATION_MS - timeRemaining) / STAGE_DURATION_MS) * 100;
  };

  if (ticket.status !== "retrieving" && ticket.status !== "transit" && ticket.status !== "ready") {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Clock className="text-regis-navy" size={18} />
          <span className="text-lg font-bold text-regis-navy">{formatTime(timeRemaining)}</span>
        </div>
        <Badge variant="outline" className="text-xs">
          Stage {currentStageIndex + 1} of 3
        </Badge>
      </div>

      <div className="flex items-center justify-between">
        {stages.map((stage, index) => {
          const StageIcon = stage.icon;
          const isActive = index === currentStageIndex;
          const isCompleted = index < currentStageIndex;
          const isPending = index > currentStageIndex;

          return (
            <div key={stage.id} className="flex flex-col items-center flex-1">
              <div className="flex items-center w-full">
                {index > 0 && (
                  <div 
                    className={`flex-1 h-1 ${isCompleted || isActive ? 'bg-regis-gold' : 'bg-gray-200'}`}
                  />
                )}
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    isActive
                      ? "bg-regis-gold text-regis-navy ring-4 ring-regis-gold/30 animate-pulse"
                      : isCompleted
                      ? "bg-green-500 text-white"
                      : "bg-gray-200 text-gray-400"
                  }`}
                >
                  <StageIcon size={20} />
                </div>
                {index < stages.length - 1 && (
                  <div 
                    className={`flex-1 h-1 ${isCompleted ? 'bg-regis-gold' : 'bg-gray-200'}`}
                  />
                )}
              </div>
              <span
                className={`text-xs mt-2 font-medium ${
                  isActive ? "text-regis-navy" : isCompleted ? "text-green-600" : "text-gray-400"
                }`}
              >
                {stage.name}
              </span>
              {isActive && (
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
  const [timeRemaining, setTimeRemaining] = useState<number>(STAGE_DURATION_MS);
  const [currentStageIndex, setCurrentStageIndex] = useState<number>(0);

  useEffect(() => {
    let stageIndex = 0;
    if (ticket.status === "retrieving") stageIndex = 0;
    else if (ticket.status === "transit") stageIndex = 1;
    else if (ticket.status === "ready") stageIndex = 2;
    else return;

    setCurrentStageIndex(stageIndex);

    const stageStarted = ticket.stageStartedAt ? new Date(ticket.stageStartedAt).getTime() : Date.now();
    const elapsed = Date.now() - stageStarted;
    const remaining = Math.max(0, STAGE_DURATION_MS - elapsed);
    setTimeRemaining(remaining);
  }, [ticket.status, ticket.stageStartedAt]);

  useEffect(() => {
    if (ticket.status !== "retrieving" && ticket.status !== "transit" && ticket.status !== "ready") {
      return;
    }
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

  if (ticket.status !== "retrieving" && ticket.status !== "transit" && ticket.status !== "ready") {
    return null;
  }

  return (
    <div className="flex items-center gap-1">
      {/* Compact 3-stage icons */}
      <div className="flex items-center gap-0.5">
        {stages.map((stage, index) => {
          const StageIcon = stage.icon;
          const isActive = index === currentStageIndex;
          const isCompleted = index < currentStageIndex;

          return (
            <div key={stage.id} className="flex items-center">
              {index > 0 && (
                <div className={`w-2 h-0.5 ${isCompleted || isActive ? 'bg-regis-gold' : 'bg-gray-300'}`} />
              )}
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center ${
                  isActive
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
      {/* Timer */}
      <span className="text-xs font-mono font-bold text-regis-navy ml-1">{formatTime(timeRemaining)}</span>
    </div>
  );
}

interface UnifiedRetrievalBoxProps {
  tickets: ValetTicket[];
  onStageComplete?: (ticketNumber: string, nextStage: number) => void;
}

export function UnifiedRetrievalBox({ tickets, onStageComplete }: UnifiedRetrievalBoxProps) {
  const activeRetrievalTickets = tickets.filter(
    (t) => t.status === "retrieving" || t.status === "transit" || t.status === "ready"
  );

  const retrievingCount = tickets.filter((t) => t.status === "retrieving").length;
  const transitCount = tickets.filter((t) => t.status === "transit").length;
  const readyCount = tickets.filter((t) => t.status === "ready").length;
  const totalActive = activeRetrievalTickets.length;

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

        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <p className="text-2xl font-bold text-blue-600">{retrievingCount}</p>
            <p className="text-xs text-blue-600 font-medium">Retrieving</p>
          </div>
          <div className="text-center p-3 bg-yellow-50 rounded-lg">
            <p className="text-2xl font-bold text-yellow-600">{transitCount}</p>
            <p className="text-xs text-yellow-600 font-medium">In Transit</p>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <p className="text-2xl font-bold text-green-600">{readyCount}</p>
            <p className="text-xs text-green-600 font-medium">Ready</p>
          </div>
        </div>

        {activeRetrievalTickets.length > 0 && (
          <div className="space-y-4 max-h-80 overflow-y-auto">
            {activeRetrievalTickets.map((ticket) => (
              <div
                key={ticket.id}
                className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="font-bold text-regis-navy">#{ticket.ticketNumber}</p>
                    <p className="text-xs text-gray-500">
                      {ticket.carMake} {ticket.carModel} • {ticket.carColor}
                    </p>
                  </div>
                  <Badge
                    variant={
                      ticket.status === "ready"
                        ? "default"
                        : ticket.status === "transit"
                        ? "secondary"
                        : "outline"
                    }
                  >
                    {ticket.status}
                  </Badge>
                </div>
                <ActiveRetrievalProgress ticket={ticket} onStageComplete={onStageComplete} />
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
