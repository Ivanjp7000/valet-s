import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusTracker } from "@/components/status-tracker";
import { SystemLoginModal } from "@/components/system-login-modal";
import { FAQModal } from "@/components/faq-modal";
import { HelpCircle, Settings, Ticket, Car, Calendar, User, Building2, X, Clock, CheckCircle, ChevronLeft } from "lucide-react";
import luxuryCarImg from "@assets/generated_images/ultra_luxury_black_sedan_51d2.png";
import { useToast } from "@/hooks/use-toast";
import type { Faq } from "@shared/schema";
import { VISITOR_TYPES } from "@shared/schema";
import { format, addDays, startOfToday } from "date-fns";

interface TicketPreview {
  ticketNumber: string;
  status: string;
  visitorType: string;
  visitorSubType?: string | null;
  createdAt: string;
  stageStartedAt?: string | null;
}

export default function Landing() {
  const [ticketNumber, setTicketNumber] = useState("");
  const [showStatus, setShowStatus] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showSystemLogin, setShowSystemLogin] = useState(() => new URLSearchParams(window.location.search).get("login") === "1");
  const [showFAQModal, setShowFAQModal] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleConfirmed, setScheduleConfirmed] = useState(false);
  const [submittedTicket, setSubmittedTicket] = useState("");
  const [ticketPreview, setTicketPreview] = useState<TicketPreview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [guestNameInput, setGuestNameInput] = useState("");
  const [guestPinInput, setGuestPinInput] = useState("");
  const [nameError, setNameError] = useState("");
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

    const pinTrimmed = guestPinInput.trim().toUpperCase();
    if (!pinTrimmed) {
      setNameError("Please enter your PIN as printed on the label.");
      return;
    }

    setIsLoading(true);
    setNameError("");
    try {
      const params = new URLSearchParams();
      if (guestNameInput.trim()) params.set("name", guestNameInput.trim());
      if (pinTrimmed) params.set("pin", pinTrimmed);
      const response = await fetch(`/api/tickets/${ticketNumber}?${params.toString()}`);
      if (!response.ok) {
        if (response.status === 429) {
          toast({
            title: "Too Many Attempts",
            description: "Please wait a moment before trying again.",
            variant: "destructive",
          });
        } else {
          setNameError("Ticket not found, or the name does not match. Please check and try again.");
        }
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

  const handleCancelConfirmation = () => {
    setShowConfirmation(false);
    setTicketPreview(null);
    setSubmittedTicket("");
    setShowSchedule(false);
    setScheduleConfirmed(false);
    setScheduleDate("");
    setScheduleTime("");
    setGuestNameInput("");
    setGuestPinInput("");
    setNameError("");
  };

  const handleScheduleSubmit = async () => {
    if (!scheduleDate || !scheduleTime) {
      toast({ title: "Please select a date and time", variant: "destructive" });
      return;
    }
    setScheduleLoading(true);
    try {
      const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
      const response = await fetch(`/api/tickets/${submittedTicket}/schedule-retrieval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt, guestName: guestNameInput.trim() }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        toast({ title: "Scheduling Failed", description: err.message || "Please try again.", variant: "destructive" });
        return;
      }
      setScheduleConfirmed(true);
    } catch {
      toast({ title: "Connection Error", description: "Please try again.", variant: "destructive" });
    } finally {
      setScheduleLoading(false);
    }
  };

  const handleConfirmRetrieval = async () => {
    try {
      const response = await fetch(`/api/tickets/${submittedTicket}/request-retrieval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestName: guestNameInput.trim(), guestPin: guestPinInput.trim().toUpperCase() || undefined }),
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
    return <StatusTracker ticketNumber={submittedTicket} guestName={guestNameInput.trim()} guestPin={guestPinInput.trim().toUpperCase() || undefined} onBack={() => setShowStatus(false)} />;
  }

  // Schedule Screen
  if (showConfirmation && showSchedule && ticketPreview) {
    const today = format(startOfToday(), "yyyy-MM-dd");
    const maxDay = format(addDays(startOfToday(), 7), "yyyy-MM-dd");

    if (scheduleConfirmed) {
      const confirmedDate = new Date(`${scheduleDate}T${scheduleTime}`);
      return (
        <div className="min-h-screen bg-soft-gray flex flex-col">
          <div className="bg-regis-navy text-white px-6 py-8 text-center">
            <div className="w-16 h-16 bg-regis-gold rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="text-white" size={28} />
            </div>
            <h1 className="text-2xl font-semibold mb-1">Retrieval Scheduled</h1>
            <p className="text-blue-200 text-sm">Ticket #{ticketPreview.ticketNumber}</p>
          </div>
          <div className="max-w-md mx-auto px-6 py-10 w-full flex-1 flex flex-col justify-center">
            <Card className="shadow-lg border-0">
              <CardContent className="p-8 text-center">
                <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-5">
                  <Calendar className="text-green-600" size={24} />
                </div>
                <h2 className="text-xl font-bold text-regis-navy mb-1">Your retrieval is confirmed</h2>
                <p className="text-gray-500 text-sm mb-6">Our team will have your vehicle ready at the scheduled time.</p>
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-5 mb-6 text-left space-y-3">
                  <div className="flex items-center gap-3">
                    <Calendar className="text-regis-gold flex-shrink-0" size={16} />
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wide">Date</p>
                      <p className="font-semibold text-regis-navy">{format(confirmedDate, "EEEE, MMMM d, yyyy")}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Clock className="text-regis-gold flex-shrink-0" size={16} />
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wide">Time</p>
                      <p className="font-semibold text-regis-navy">{format(confirmedDate, "h:mm a")}</p>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mb-6">To change your time, scan your ticket again and select a new schedule.</p>
                <Button onClick={handleCancelConfirmation} variant="outline" className="w-full">
                  <ChevronLeft className="mr-2" size={15} />
                  Back to Home
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-soft-gray flex flex-col">
        <div className="bg-white shadow-sm">
          <div className="max-w-md mx-auto px-6 py-6 flex items-center gap-3">
            <button onClick={() => setShowSchedule(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
              <ChevronLeft size={22} />
            </button>
            <div>
              <h1 className="text-xl font-semibold text-regis-navy leading-tight">Schedule Retrieval</h1>
              <p className="text-gray-500 text-xs">Ticket #{ticketPreview.ticketNumber}</p>
            </div>
          </div>
        </div>

        <div className="max-w-md mx-auto px-6 py-8 w-full flex-1 flex flex-col justify-center">
          <Card className="shadow-xl border-0">
            <CardContent className="p-8">
              <div className="text-center mb-7">
                <div className="w-16 h-16 bg-regis-navy/5 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Calendar className="text-regis-navy" size={26} />
                </div>
                <h2 className="text-xl font-bold text-regis-navy mb-1">Choose a Date & Time</h2>
                <p className="text-gray-500 text-sm">We'll have your vehicle ready at the entrance.</p>
              </div>

              <div className="space-y-5">
                {/* Date */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Date</label>
                  <input
                    type="date"
                    min={today}
                    max={maxDay}
                    value={scheduleDate}
                    onChange={e => setScheduleDate(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 text-regis-navy text-sm focus:outline-none focus:ring-2 focus:ring-regis-gold/40 focus:border-regis-gold bg-white"
                  />
                  <p className="text-xs text-gray-400 mt-1">Up to 7 days in advance</p>
                </div>

                {/* Time */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Time</label>
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={e => setScheduleTime(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 text-regis-navy text-sm focus:outline-none focus:ring-2 focus:ring-regis-gold/40 focus:border-regis-gold bg-white"
                  />
                </div>

              </div>

              <div className="mt-7 space-y-3">
                <Button
                  onClick={handleScheduleSubmit}
                  disabled={scheduleLoading}
                  className="w-full bg-regis-navy hover:bg-regis-navy/90 text-white font-semibold py-4 h-auto text-base"
                >
                  <Calendar className="mr-2" size={18} />
                  {scheduleLoading ? "Confirming…" : "Confirm Schedule"}
                </Button>
                <Button
                  onClick={() => setShowSchedule(false)}
                  variant="ghost"
                  className="w-full py-2 h-auto text-gray-400 hover:text-gray-600"
                >
                  <ChevronLeft className="mr-1" size={15} />
                  Back
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
                <h2 className="text-2xl font-bold text-regis-navy mb-1">Ticket Found</h2>
                <p className="text-gray-500 text-sm">Please confirm your identity to proceed.</p>
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
                  onClick={() => setShowSchedule(true)}
                  variant="outline"
                  className="w-full py-3 h-auto text-regis-navy border-regis-navy/30 hover:bg-regis-navy/5 font-medium"
                >
                  <Calendar className="mr-2" size={16} />
                  Schedule a Retrieval Time
                </Button>
                <Button
                  onClick={handleCancelConfirmation}
                  variant="ghost"
                  className="w-full py-2 h-auto text-gray-400 hover:text-gray-600"
                >
                  <X className="mr-2" size={15} />
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
            {/* Luxury car hero image */}
            <div className="relative -mx-8 -mt-8 mb-6 overflow-hidden rounded-t-xl">
              <img
                src={luxuryCarImg}
                alt="Luxury valet car"
                className="w-full object-cover"
                style={{ height: '162px', objectPosition: 'center 60%' }}
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-white/60" />
            </div>

            <h2 className="text-xl font-semibold text-regis-navy mb-5 text-center">Enter Your Ticket Number</h2>

            {/* 5 Digit Boxes */}
            <div className="flex flex-col items-center mb-6">
              <div className="flex justify-center gap-2">
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
              {/* Start-here indicator under the first box */}
              <div className="flex justify-start w-full pl-[calc(50%-130px)] mt-1.5">
                <div className="flex flex-col items-center gap-0.5 w-12">
                  <svg width="10" height="8" viewBox="0 0 10 8" className="text-regis-gold fill-current">
                    <polygon points="5,0 10,8 0,8" />
                  </svg>
                  <span className="text-[10px] font-semibold text-regis-gold uppercase tracking-wide leading-none whitespace-nowrap">Start here</span>
                </div>
              </div>
            </div>

            {/* PIN Input */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                PIN (from label)
              </label>
              <input
                type="text"
                value={guestPinInput}
                onChange={e => { setGuestPinInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4)); setNameError(""); }}
                onKeyDown={e => { if (e.key === 'Enter') handleTicketSubmit(); }}
                placeholder="e.g. AC36"
                maxLength={4}
                className="w-full border border-gray-200 rounded-lg px-4 py-3 text-regis-navy text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-regis-gold/40 focus:border-regis-gold bg-white uppercase"
              />
              <p className="text-[11px] text-gray-400 mt-1">4-character code printed on your label</p>
              {nameError && (
                <p className="text-red-500 text-xs mt-1">{nameError}</p>
              )}
            </div>

            {/* Submit Button */}
            <Button 
              onClick={handleTicketSubmit}
              disabled={isLoading}
              className="w-full bg-regis-navy hover:bg-blue-900 text-white font-medium py-4 h-auto"
              data-testid="button-submit"
            >
              {isLoading ? "Looking up…" : "Submit"}
            </Button>
          </CardContent>
        </Card>

        {/* Quick FAQ Preview */}
        <Card className="shadow-sm">
          <CardContent className="p-6">
            <h3 className="font-medium text-regis-navy mb-3 flex items-center">
              <HelpCircle className="mr-2 text-regis-gold" size={18} />
              Quick Help
            </h3>
            <button 
              onClick={() => setShowFAQModal(true)}
              className="text-regis-gold text-sm font-medium hover:underline"
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
