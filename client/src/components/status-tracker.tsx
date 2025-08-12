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
  const { lastMessage } = useWebSocket();

  const { data: ticket } = useQuery<ValetTicket>({
    queryKey: ["/api/tickets", ticketNumber],
    refetchInterval: 5000, // Poll every 5 seconds as backup
  });

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

  // Update current stage based on ticket status
  useEffect(() => {
    if (ticket) {
      switch (ticket.status) {
        case 'retrieving':
          setCurrentStage(0);
          break;
        case 'transit':
          setCurrentStage(1);
          break;
        case 'ready':
          setCurrentStage(2);
          break;
        case 'completed':
          // Show success message and redirect
          setTimeout(() => {
            alert('Your vehicle is ready for pickup!');
            onBack();
          }, 2000);
          break;
      }
    }
  }, [ticket, onBack]);

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

          {/* Estimated Time */}
          <Card className="mt-8 bg-light-gold">
            <CardContent className="p-4 text-center">
              <p className="text-regis-navy font-medium flex items-center justify-center">
                <Clock className="mr-2" size={16} />
                Estimated Time
              </p>
              <p className="text-2xl font-bold text-regis-navy mt-1">
                {ticket?.estimatedTime || 5} minutes
              </p>
            </CardContent>
          </Card>

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
