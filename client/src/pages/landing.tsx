import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { CameraScanner } from "@/components/camera-scanner";
import { StatusTracker } from "@/components/status-tracker";
import { SystemLoginModal } from "@/components/system-login-modal";
import { FAQModal } from "@/components/faq-modal";
import { Camera, Car, Crown, HelpCircle, Settings, Ticket } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Faq } from "@shared/schema";

export default function Landing() {
  const [ticketNumber, setTicketNumber] = useState("");
  const [showCamera, setShowCamera] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const [showSystemLogin, setShowSystemLogin] = useState(false);
  const [showFAQModal, setShowFAQModal] = useState(false);
  const [submittedTicket, setSubmittedTicket] = useState("");
  const { toast } = useToast();

  const { data: faqs } = useQuery<Faq[]>({
    queryKey: ["/api/faqs"],
  });

  const handleTicketSubmit = async () => {
    if (ticketNumber.length < 5 || ticketNumber.length > 6) {
      toast({
        title: "Invalid Ticket",
        description: "Please enter a valid 5-6 digit ticket number",
        variant: "destructive",
      });
      return;
    }

    try {
      await apiRequest("POST", "/api/tickets", { ticketNumber });
      setSubmittedTicket(ticketNumber);
      setShowStatus(true);
      setTicketNumber("");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit ticket. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleScanComplete = (scannedNumber: string) => {
    setTicketNumber(scannedNumber);
    setShowCamera(false);
  };

  if (showStatus) {
    return <StatusTracker ticketNumber={submittedTicket} onBack={() => setShowStatus(false)} />;
  }

  if (showCamera) {
    return <CameraScanner onScanComplete={handleScanComplete} onClose={() => setShowCamera(false)} />;
  }

  return (
    <div className="min-h-screen bg-soft-gray">
      {/* Header with St. Regis Branding */}
      <div className="bg-white shadow-sm">
        <div className="max-w-md mx-auto px-6 py-8 text-center">
          <div className="w-48 h-16 mx-auto mb-4 bg-regis-navy rounded-lg flex items-center justify-center relative">
            <div className="text-regis-gold font-bold text-lg tracking-wider">
              <Crown className="mr-2 inline-block" size={20} />
              ST. REGIS OSAKA
            </div>
            {/* Hidden Super Admin Login Button */}
            <button
              onClick={() => setShowSystemLogin(true)}
              className="absolute top-0 right-0 w-6 h-6 opacity-0 hover:opacity-10 cursor-pointer transition-opacity"
              aria-label="System Login"
              title="Super Admin Login"
            />
          </div>
          <h1 className="text-2xl font-semibold text-regis-navy mb-2">Valet Service</h1>
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
              <p className="text-gray-600 text-sm">Scan or enter your 5-6 digit ticket number</p>
            </div>

            {/* Camera Scan Button */}
            <Button 
              onClick={() => setShowCamera(true)}
              className="w-full bg-regis-gold hover:bg-yellow-600 text-white font-medium py-4 mb-4 h-auto"
            >
              <Camera className="mr-3" size={18} />
              Scan Ticket Number
            </Button>

            {/* Manual Input Option */}
            <div className="text-center mb-4">
              <span className="text-gray-400 text-sm bg-white px-3 relative">or enter manually</span>
            </div>

            {/* Manual Ticket Entry */}
            <div className="mb-6">
              <Input
                type="text"
                placeholder="Enter 5-6 digit number"
                maxLength={6}
                value={ticketNumber}
                onChange={(e) => setTicketNumber(e.target.value.replace(/\D/g, ''))}
                className="text-center text-2xl font-mono font-semibold py-4 mb-4 border-2 focus:border-regis-gold"
              />

              <Button 
                onClick={handleTicketSubmit}
                className="w-full bg-regis-navy hover:bg-blue-900 text-white font-medium py-4 h-auto"
              >
                <Car className="mr-2" size={18} />
                Request Vehicle
              </Button>
            </div>
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
      >
        <Settings size={12} className="text-gray-600" />
      </Button>

      {/* Hint for staff */}
      <div className="fixed bottom-4 right-4 text-xs text-gray-400 opacity-40 hover:opacity-80 transition-opacity">
        Staff: Click logo corner or settings icon
      </div>

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
