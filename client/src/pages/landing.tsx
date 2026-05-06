import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CameraScanner } from "@/components/camera-scanner";
import { StatusTracker } from "@/components/status-tracker";
import { SystemLoginModal } from "@/components/system-login-modal";
import { FAQModal } from "@/components/faq-modal";
import { Camera, HelpCircle, Settings, Ticket, Car, Calendar, User, Building2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Faq } from "@shared/schema";
import { VISITOR_TYPES } from "@shared/schema";
import { format } from "date-fns";

interface TicketPreview {
  ticketNumber: string;
  status: string;
  guestName: string;
  visitorType: string;
  visitorSubType?: string | null;
  roomNumber?: string | null;
  createdAt: string;
}

export default function Landing() {
  const [ticketNumber, setTicketNumber] = useState("");
  const [showCamera, setShowCamera] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showSystemLogin, setShowSystemLogin] = useState(false);
  const [showFAQModal, setShowFAQModal] = useState(false);
  const [submittedTicket, setSubmittedTicket] = useState("");
  const [ticketPreview, setTicketPreview] = useState<TicketPreview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const { data: faqs } = useQuery<Faq[]>({
    queryKey: ["/api/faqs"],
  });

  const handleTicketSubmit = async () => {
    if (ticketNumber.length !== 5) {
      toast({
        title: "Invalid Ticket",
        description: "Please enter 5 digits of your ticket number",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/tickets/${ticketNumber}`);
      if (!response.ok) {
        toast({
          title: "Ticket Not Found",
          description: "No valet ticket found with that number. Please check and try again.",
          variant: "destructive",
        });
        return;
      }
      const data: TicketPreview = await response.json();
      setTicketPreview(data);
      setSubmittedTicket(ticketNumber);
      setShowConfirmation(true);
      setTicketNumber("");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to look up ticket. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleScanComplete = (scannedNumber: string) => {
    setTicketNumber(scannedNumber);
    setShowCamera(false);
  };

  const handleCancelConfirmation = () => {
    setShowConfirmation(false);
    setTicketPreview(null);
    setSubmittedTicket("");
  };

  const handleConfirmRetrieval = async () => {
    try {
      const response = await fetch(`/api/tickets/${submittedTicket}/request-retrieval`, {
        method: "POST",
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        toast({
          title: "Request Failed",
          description: err.message || "Could not add to queue. Please ask a staff member.",
          variant: "destructive",
        });
        return;
      }
    } catch {
      toast({
        title: "Connection Error",
        description: "Please try again or ask a staff member.",
        variant: "destructive",
      });
      return;
    }
    setShowConfirmation(false);
    setShowStatus(true);
  };

  if (showStatus) {
    return <StatusTracker ticketNumber={submittedTicket} onBack={() => setShowStatus(false)} />;
  }

  if (showCamera) {
    return <CameraScanner onScanComplete={handleScanComplete} onClose={() => setShowCamera(false)} />;
  }

  // Confirmation Screen
  if (showConfirmation && ticketPreview) {
    const arrivedAt = new Date(ticketPreview.createdAt);
    const visitorLabel = VISITOR_TYPES[ticketPreview.visitorType as keyof typeof VISITOR_TYPES] || ticketPreview.visitorType;

    return (
      <div className="min-h-screen bg-soft-gray flex flex-col">
        <div className="bg-white shadow-sm">
          <div className="max-w-md mx-auto px-6 py-8 text-center">
            <h1 className="text-3xl font-semibold text-regis-navy mb-2">Valet Service</h1>
            <p className="text-gray-600 text-sm">Vehicle Retrieval</p>
          </div>
        </div>

        <div className="max-w-md mx-auto px-6 py-8 w-full flex-1 flex flex-col justify-center">
          {/* Welcome Card */}
          <Card className="shadow-xl border-2 border-regis-gold/20 mb-6">
            <CardContent className="p-8">
              {/* Welcome Header */}
              <div className="text-center mb-6">
                <div className="w-20 h-20 bg-regis-gold/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Car className="text-regis-gold" size={36} />
                </div>
                <h2 className="text-2xl font-bold text-regis-navy mb-1">Welcome Back!</h2>
                <p className="text-gray-500 text-sm">We found your ticket. Ready to retrieve your vehicle?</p>
              </div>

              {/* Divider */}
              <div className="border-t border-gray-100 my-5" />

              {/* Ticket Info */}
              <div className="space-y-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Ticket className="text-regis-navy" size={16} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide">Ticket Number</p>
                    <p className="font-bold text-regis-navy text-lg">#{ticketPreview.ticketNumber}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-yellow-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <User className="text-regis-gold" size={16} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide">Guest Name</p>
                    <p className="font-semibold text-gray-800">{ticketPreview.guestName}</p>
                    {ticketPreview.roomNumber && (
                      <p className="text-xs text-gray-500">Room {ticketPreview.roomNumber}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-purple-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Building2 className="text-purple-500" size={16} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide">Venue / Visit Type</p>
                    <p className="font-semibold text-gray-800">{visitorLabel}</p>
                    {ticketPreview.visitorSubType && (
                      <p className="text-xs text-gray-500 capitalize">{ticketPreview.visitorSubType.replace(/_/g, ' ')}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Calendar className="text-green-600" size={16} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide">Car Arrived</p>
                    <p className="font-semibold text-gray-800">{format(arrivedAt, "dd MMM yyyy")}</p>
                    <p className="text-xs text-gray-500">{format(arrivedAt, "hh:mm a")}</p>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-gray-100 my-5" />

              {/* Action Buttons */}
              <div className="space-y-3">
                <Button
                  onClick={handleConfirmRetrieval}
                  className="w-full bg-regis-gold hover:bg-yellow-600 text-regis-navy font-bold py-4 h-auto text-base"
                >
                  <Car className="mr-2" size={20} />
                  Retrieve My Car Now
                </Button>
                <Button
                  onClick={handleCancelConfirmation}
                  variant="outline"
                  className="w-full py-3 h-auto text-gray-500 border-gray-200"
                >
                  <X className="mr-2" size={16} />
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowSystemLogin(true)}
          className="fixed bottom-4 left-4 w-8 h-8 bg-gray-300 hover:bg-gray-400 opacity-30 hover:opacity-60 transition-all duration-300"
        >
          <Settings size={12} className="text-gray-600" />
        </Button>
        {showSystemLogin && <SystemLoginModal onClose={() => setShowSystemLogin(false)} />}
      </div>
    );
  }

  const handleDigitChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const digits = ticketNumber.padEnd(5, ' ').split('');
    digits[index] = digit;
    setTicketNumber(digits.join('').trim());
    
    // Auto-focus next input
    if (digit && index < 4) {
      const nextInput = document.getElementById(`digit-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !ticketNumber[index] && index > 0) {
      const prevInput = document.getElementById(`digit-${index - 1}`);
      prevInput?.focus();
    }
  };

  return (
    <div className="min-h-screen bg-soft-gray">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-md mx-auto px-6 py-8 text-center">
          <h1 className="text-3xl font-semibold text-regis-navy mb-2">Valet Service</h1>
          <p className="text-gray-600 text-sm">Retrieve your vehicle with ease</p>
        </div>
      </div>

      {/* Main Customer Interface */}
      <div className="max-w-md mx-auto px-6 py-8">
        {/* Ticket Input Card */}
        <Card className="mb-6 shadow-lg">
          <CardContent className="p-8">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-light-gold rounded-full flex items-center justify-center mx-auto mb-4">
                <Ticket className="text-regis-gold" size={24} />
              </div>
              <h2 className="text-xl font-semibold text-regis-navy mb-2">Enter Your Ticket</h2>
            </div>

            {/* Camera Scan Button */}
            <Button 
              onClick={() => setShowCamera(true)}
              className="w-full bg-regis-gold hover:bg-yellow-600 text-white font-medium py-4 mb-4 h-auto"
              data-testid="button-scan-ticket"
            >
              <Camera className="mr-3" size={18} />
              Scan Ticket Number
            </Button>

            {/* Manual Input Option */}
            <div className="text-center mb-6">
              <span className="text-regis-navy text-xl font-semibold">Or Enter Manually</span>
            </div>

            {/* 5 Digit Boxes */}
            <div className="flex justify-center gap-2 mb-6">
              {[0, 1, 2, 3, 4].map((index) => (
                <input
                  key={index}
                  id={`digit-${index}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={ticketNumber[index] || ''}
                  onChange={(e) => handleDigitChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className="w-12 h-14 text-center text-2xl font-mono font-bold border-2 border-gray-300 rounded-lg focus:border-regis-gold focus:outline-none focus:ring-2 focus:ring-regis-gold/20"
                  data-testid={`input-digit-${index}`}
                />
              ))}
            </div>

            {/* Submit Button */}
            <Button 
              onClick={handleTicketSubmit}
              className="w-full bg-regis-navy hover:bg-blue-900 text-white font-medium py-4 h-auto"
              data-testid="button-submit"
            >
              Submit
            </Button>
          </CardContent>
        </Card>

        {/* Quick FAQ Preview */}
        <Card className="shadow-sm">
          <CardContent className="p-6">
            <h3 className="font-medium text-regis-navy mb-4 flex items-center">
              <HelpCircle className="mr-2 text-regis-gold" size={18} />
              Quick Help
            </h3>
            <div className="space-y-3 text-sm text-gray-600">
              {faqs?.slice(0, 3).map((faq, index) => (
                <div key={index}>• {faq.question}</div>
              )) || (
                <>
                  <div>• Where do I find my ticket number?</div>
                  <div>• How long does vehicle retrieval take?</div>
                  <div>• What if I lost my ticket?</div>
                </>
              )}
            </div>
            <button 
              onClick={() => setShowFAQModal(true)}
              className="text-regis-gold text-sm font-medium mt-3 hover:underline"
            >
              View all FAQs →
            </button>
          </CardContent>
        </Card>
      </div>

      {/* Discrete System Login Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setShowSystemLogin(true)}
        className="fixed bottom-4 left-4 w-8 h-8 bg-gray-300 hover:bg-gray-400 opacity-30 hover:opacity-60 transition-all duration-300"
        data-testid="button-system-login"
      >
        <Settings size={12} className="text-gray-600" />
      </Button>

      {/* System Login Modal */}
      {showSystemLogin && (
        <SystemLoginModal onClose={() => setShowSystemLogin(false)} />
      )}

      {/* FAQ Modal */}
      <FAQModal 
        isOpen={showFAQModal} 
        onClose={() => setShowFAQModal(false)} 
      />
    </div>
  );
}
