import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Button } from "@/components/ui/button";
import { Car, Search, Construction, Check, X, Clock, Bell } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { ValetTicket } from "@shared/schema";

interface StatusTrackerProps {
  ticketNumber: string;
  onBack: () => void;
}

const STAGE_DURATION_S = 5 * 60; // 5 minutes in seconds

function getStageFromStatus(status: string): number {
  if (status === "retrieving") return 0;
  if (status === "transit") return 1;
  if (status === "ready") return 2;
  return -1;
}

export function StatusTracker({ ticketNumber, onBack }: StatusTrackerProps) {
  const [timeRemaining, setTimeRemaining] = useState<number>(STAGE_DURATION_S);
  const { lastMessage } = useWebSocket();
  const queryClient = useQueryClient();

  const { data: ticket } = useQuery<ValetTicket>({
    queryKey: ["/api/tickets", ticketNumber],
    refetchInterval: 5000,
  });

  const currentStage = ticket ? getStageFromStatus(ticket.status) : -1;
  const isReady = ticket?.status === "ready";
  const isActive = currentStage >= 0;

  // Immediately refetch when a WebSocket update arrives for this ticket
  useEffect(() => {
    if (!lastMessage) return;
    try {
      const message = JSON.parse(lastMessage);
      if (
        message.type === "ticket_status_updated" &&
        message.data?.ticketNumber === ticketNumber
      ) {
        queryClient.invalidateQueries({ queryKey: ["/api/tickets", ticketNumber] });
      }
    } catch {}
  }, [lastMessage, ticketNumber, queryClient]);

  // Sync timer with DB stageStartedAt when status changes
  useEffect(() => {
    if (!ticket || isReady) {
      setTimeRemaining(0);
      return;
    }
    if (currentStage < 0) return;

    const stageStarted = ticket.stageStartedAt
      ? new Date(ticket.stageStartedAt).getTime()
      : Date.now();
    const elapsedSeconds = Math.floor((Date.now() - stageStarted) / 1000);
    const remaining = Math.max(0, STAGE_DURATION_S - elapsedSeconds);
    setTimeRemaining(remaining);
  }, [ticket?.status, ticket?.stageStartedAt, isReady, currentStage]);

  // Countdown — only runs for retrieving and transit, stops at ready
  useEffect(() => {
    if (!ticket || ticket.status !== "retrieving" && ticket.status !== "transit") return;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [ticket?.status]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const stages = [
    {
      id: 0,
      name: "Retrieving Car",
      description: "Our valet is locating your vehicle",
      icon: Search,
    },
    {
      id: 1,
      name: "Car in Transit",
      description: "Vehicle being brought to pickup area",
      icon: Construction,
    },
    {
      id: 2,
      name: "Car Ready",
      description: "Your vehicle is waiting at the entrance",
      icon: Check,
    },
  ];

  // Waiting for staff to accept
  if (ticket?.status === "retrieval_requested") {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <div className="bg-regis-navy text-white px-6 py-8 text-center">
          <div className="w-16 h-16 bg-regis-gold rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Car className="text-white" size={24} />
          </div>
          <h2 className="text-xl font-semibold mb-2">Request Received!</h2>
          <p className="text-blue-200 text-sm">Ticket #{ticketNumber}</p>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto w-full">
          <div className="w-20 h-20 border-4 border-regis-gold border-t-transparent rounded-full animate-spin mb-6" />
          <h3 className="text-xl font-bold text-regis-navy mb-3">
            Waiting for a Valet Attendant
          </h3>
          <p className="text-gray-500 text-sm leading-relaxed mb-2">
            Your request has been added to the queue. A valet attendant will accept and bring your vehicle shortly.
          </p>
          <p className="text-xs text-gray-400">
            This page will update automatically — no need to refresh.
          </p>

          <div className="mt-8 w-full bg-gray-50 rounded-xl p-4 border border-gray-100 text-left space-y-2">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock className="text-regis-gold flex-shrink-0" size={15} />
              <span>Waiting in queue…</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <Search size={15} className="flex-shrink-0" />
              <span>Locating your vehicle</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <Construction size={15} className="flex-shrink-0" />
              <span>Car in transit</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <Check size={15} className="flex-shrink-0" />
              <span>Car ready for pickup</span>
            </div>
          </div>
        </div>

        <Button
          variant="ghost"
          onClick={onBack}
          className="mx-auto mb-8 text-gray-400 hover:text-gray-600"
        >
          <X className="mr-2" size={16} />
          Cancel Request
        </Button>
      </div>
    );
  }

  // Car is READY — show full-screen celebration
  if (isReady) {
    return (
      <div className="min-h-screen bg-green-50 flex flex-col">
        <div className="bg-green-600 text-white px-6 py-8 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4"
          >
            <Check className="text-green-600" size={40} />
          </motion.div>
          <h2 className="text-2xl font-bold mb-2">Your Car is Ready!</h2>
          <p className="text-green-100 text-sm">Ticket #{ticketNumber}</p>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto w-full">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="w-full"
          >
            <div className="bg-white rounded-2xl shadow-lg border-2 border-green-200 p-8 mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Car className="text-green-600" size={32} />
              </div>
              <h3 className="text-xl font-bold text-green-800 mb-2">
                Please proceed to the valet entrance
              </h3>
              <p className="text-gray-500 text-sm">
                Your vehicle is waiting for you at the pickup area. Please head over now.
              </p>
            </div>

            {/* Completed stages */}
            <div className="bg-white rounded-xl p-4 border border-green-100 text-left space-y-3">
              {stages.map((stage) => {
                const Icon = stage.icon;
                return (
                  <div key={stage.id} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                      <Check className="text-white" size={14} />
                    </div>
                    <span className="text-sm font-medium text-green-800">{stage.name}</span>
                    <Check className="text-green-400 ml-auto" size={14} />
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>

        <Button
          variant="ghost"
          onClick={onBack}
          className="mx-auto mb-8 text-gray-400 hover:text-gray-600"
        >
          <X className="mr-2" size={16} />
          Back to Home
        </Button>
      </div>
    );
  }

  // In progress (retrieving or transit)
  if (!isActive) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8 text-center">
        <div className="w-16 h-16 border-4 border-regis-gold border-t-transparent rounded-full animate-spin mb-6" />
        <p className="text-gray-500">Loading status…</p>
        <Button variant="ghost" onClick={onBack} className="mt-6 text-gray-400">
          <X className="mr-2" size={16} />
          Back
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-md mx-auto">
        {/* Status Header */}
        <div className="bg-regis-navy text-white px-6 py-8 text-center">
          <div className="w-16 h-16 bg-regis-gold rounded-full flex items-center justify-center mx-auto mb-4">
            <Car className="text-white" size={24} />
          </div>
          <h2 className="text-xl font-semibold mb-2">Retrieving Your Vehicle</h2>
          <p className="text-blue-200 text-sm">Ticket #{ticketNumber}</p>
        </div>

        {/* Progress Timeline */}
        <div className="p-8">
          <AnimatePresence>
            {stages.map((stage, index) => {
              const Icon = stage.icon;
              const isStageActive = index === currentStage;
              const isStageCompleted = index < currentStage;
              const isStageWaiting = index > currentStage;

              return (
                <motion.div
                  key={stage.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.2 }}
                  className="flex items-start mb-8"
                >
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center mr-4 flex-shrink-0 transition-all duration-500 ${
                      isStageCompleted
                        ? "bg-green-500"
                        : isStageActive
                        ? "bg-regis-gold animate-pulse"
                        : "bg-gray-200"
                    }`}
                  >
                    {isStageCompleted ? (
                      <Check className="text-white" size={20} />
                    ) : (
                      <Icon
                        className={isStageActive ? "text-white" : "text-gray-400"}
                        size={20}
                      />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3
                      className={`font-semibold transition-colors duration-300 ${
                        isStageWaiting ? "text-gray-400" : "text-regis-navy"
                      }`}
                    >
                      {stage.name}
                    </h3>
                    <p
                      className={`text-sm transition-colors duration-300 ${
                        isStageWaiting ? "text-gray-300" : "text-gray-600"
                      }`}
                    >
                      {stage.description}
                    </p>

                    {isStageActive && (
                      <div className="mt-2 flex items-center space-x-2">
                        <Clock className="text-regis-gold" size={16} />
                        <span className="text-lg font-bold text-regis-navy">
                          {formatTime(timeRemaining)}
                        </span>
                        <span className="text-sm text-gray-500">remaining</span>
                      </div>
                    )}

                    {isStageCompleted && (
                      <div className="mt-2 flex items-center space-x-2">
                        <Check className="text-green-500" size={16} />
                        <span className="text-sm text-green-600 font-medium">Completed</span>
                      </div>
                    )}

                    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                      <motion.div
                        className={`h-2 rounded-full transition-all duration-1000 ${
                          isStageCompleted || isStageActive ? "bg-regis-gold" : "bg-gray-200"
                        }`}
                        initial={{ width: 0 }}
                        animate={{ width: isStageCompleted || isStageActive ? "100%" : "0%" }}
                        transition={{ duration: 1 }}
                      />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* Current Stage Summary Card */}
          <div className="mt-4 bg-regis-gold/10 border border-regis-gold/30 rounded-xl p-4 text-center">
            <p className="text-regis-navy font-medium flex items-center justify-center gap-2">
              <Clock size={16} />
              {stages[currentStage]?.name}
            </p>
            <p className="text-3xl font-bold text-regis-navy mt-2">{formatTime(timeRemaining)}</p>
            <p className="text-sm text-gray-500 mt-1">estimated time remaining</p>
          </div>

          <p className="text-xs text-center text-gray-400 mt-4">
            This page updates automatically — no need to refresh
          </p>

          <Button
            variant="ghost"
            onClick={onBack}
            className="w-full mt-4 text-gray-400 hover:text-gray-600"
          >
            <X className="mr-2" size={16} />
            Cancel Request
          </Button>
        </div>
      </div>
    </div>
  );
}
