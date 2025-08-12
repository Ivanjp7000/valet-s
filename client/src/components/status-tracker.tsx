import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Car, Search, Construction, Check, X, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { ValetTicket } from "@shared/schema";

interface StatusTrackerProps {
  ticketNumber: string;
  onBack: () => void;
}

export function StatusTracker({ ticketNumber, onBack }: StatusTrackerProps) {
  const [currentStage, setCurrentStage] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [stageStartTime, setStageStartTime] = useState<Date | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const { lastMessage } = useWebSocket();

  const { data: ticket } = useQuery<ValetTicket>({
    queryKey: ["/api/tickets", ticketNumber],
    refetchInterval: 5000, // Poll every 5 seconds as backup
  });

  // Stage durations in minutes: 5 min, 5 min, 3 min
  const stageDurations = [5, 5, 3];

  // Listen for WebSocket updates
  useEffect(() => {
    if (lastMessage) {
      const message = JSON.parse(lastMessage);
      if (message.type === 'ticket_status_updated' && 
          message.data.ticketNumber === ticketNumber) {
        // Update will be handled by react-query cache invalidation
      }
    }
  }, [lastMessage, ticketNumber]);

  // Initialize timing when component mounts
  useEffect(() => {
    if (ticket && !stageStartTime && !isCompleted) {
      const now = new Date();
      setStageStartTime(now);
      setTimeRemaining(stageDurations[0] * 60); // Convert to seconds
    }
  }, [ticket, stageStartTime, isCompleted]);

  // Handle countdown and stage progression
  useEffect(() => {
    if (!stageStartTime || isCompleted || currentStage >= 3) return;

    const timer = setInterval(() => {
      const now = new Date();
      const elapsedSeconds = Math.floor((now.getTime() - stageStartTime.getTime()) / 1000);
      const currentStageDuration = stageDurations[currentStage] * 60;
      const remaining = Math.max(0, currentStageDuration - elapsedSeconds);
      
      setTimeRemaining(remaining);

      // Progress to next stage when time expires
      if (remaining === 0) {
        if (currentStage < 2) {
          const nextStage = currentStage + 1;
          setCurrentStage(nextStage);
          setStageStartTime(now);
          setTimeRemaining(stageDurations[nextStage] * 60);
        } else {
          // All stages completed
          setIsCompleted(true);
          setTimeout(() => {
            alert('Your vehicle is ready for pickup!');
            onBack();
          }, 2000);
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [stageStartTime, currentStage, isCompleted, onBack]);

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const stages = [
    {
      id: 0,
      name: "Retrieving Car",
      description: "Our valet is locating your vehicle",
      icon: Search,
      color: "yellow"
    },
    {
      id: 1,
      name: "Car in Transit",
      description: "Vehicle being brought to pickup area",
      icon: Construction,
      color: "blue"
    },
    {
      id: 2,
      name: "Car Ready",
      description: "Your vehicle is waiting for pickup",
      icon: Check,
      color: "green"
    }
  ];

  const getStageProgress = (stageId: number) => {
    if (stageId < currentStage) return 100;
    if (stageId === currentStage) return 100;
    return 0;
  };

  const getStageIcon = (stage: any, stageId: number) => {
    const IconComponent = stage.icon;
    
    if (stageId < currentStage) {
      return <Check className="text-white" size={20} />;
    } else if (stageId === currentStage) {
      return <IconComponent className="text-white" size={20} />;
    } else {
      return <IconComponent className="text-gray-500" size={20} />;
    }
  };

  const getStageColor = (stageId: number) => {
    if (stageId < currentStage) return "bg-green-500";
    if (stageId === currentStage) return "bg-regis-gold animate-pulse";
    return "bg-gray-300";
  };

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
            {stages.map((stage, index) => (
              <motion.div
                key={stage.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.2 }}
                className="flex items-center mb-8"
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mr-4 transition-all duration-500 ${getStageColor(stage.id)}`}>
                  {getStageIcon(stage, stage.id)}
                </div>
                <div className="flex-1">
                  <h3 className={`font-semibold transition-colors duration-300 ${
                    stage.id <= currentStage ? 'text-regis-navy' : 'text-gray-500'
                  }`}>
                    {stage.name}
                  </h3>
                  <p className={`text-sm transition-colors duration-300 ${
                    stage.id <= currentStage ? 'text-gray-600' : 'text-gray-400'
                  }`}>
                    {stage.description}
                  </p>
                  
                  {/* Show countdown timer for current stage */}
                  {stage.id === currentStage && !isCompleted && (
                    <div className="mt-2 flex items-center space-x-2">
                      <Clock className="text-regis-gold" size={16} />
                      <span className="text-lg font-bold text-regis-navy">
                        {formatTime(timeRemaining)}
                      </span>
                      <span className="text-sm text-gray-500">remaining</span>
                    </div>
                  )}
                  
                  {/* Show completion checkmark for completed stages */}
                  {stage.id < currentStage && (
                    <div className="mt-2 flex items-center space-x-2">
                      <Check className="text-green-500" size={16} />
                      <span className="text-sm text-green-600 font-medium">Completed</span>
                    </div>
                  )}
                  
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                    <motion.div
                      className={`h-2 rounded-full transition-all duration-1000 ${
                        stage.id <= currentStage ? 'bg-regis-gold' : 'bg-gray-300'
                      }`}
                      initial={{ width: 0 }}
                      animate={{ width: `${getStageProgress(stage.id)}%` }}
                      transition={{ duration: 1 }}
                    />
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Current Stage Progress */}
          {!isCompleted && (
            <Card className="mt-8 bg-light-gold">
              <CardContent className="p-4 text-center">
                <p className="text-regis-navy font-medium flex items-center justify-center">
                  <Clock className="mr-2" size={16} />
                  Current Stage: {stages[currentStage]?.name}
                </p>
                <p className="text-3xl font-bold text-regis-navy mt-2">
                  {formatTime(timeRemaining)}
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  {Math.floor(timeRemaining / 60)} minutes {timeRemaining % 60} seconds remaining
                </p>
              </CardContent>
            </Card>
          )}

          {/* Completion Message */}
          {isCompleted && (
            <Card className="mt-8 bg-green-100 border-green-300">
              <CardContent className="p-4 text-center">
                <Check className="mx-auto text-green-600 mb-2" size={48} />
                <p className="text-green-800 font-bold text-xl">
                  Vehicle Ready for Pickup!
                </p>
                <p className="text-green-600 text-sm mt-1">
                  Please proceed to the valet area
                </p>
              </CardContent>
            </Card>
          )}

          {/* Cancel Button */}
          <Button
            variant="ghost"
            onClick={onBack}
            className="w-full mt-6 text-gray-500 hover:text-gray-700"
          >
            <X className="mr-2" size={16} />
            Cancel Request
          </Button>
        </div>
      </div>
    </div>
  );
}
