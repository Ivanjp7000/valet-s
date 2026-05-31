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
import { useContent } from "@/content";

interface TicketPreview {
  ticketNumber: string;
  status: string;
  visitorType: string;
  visitorSubType?: string | null;
  createdAt: string;
  stageStartedAt?: string | null;
  guestName?: string | null;
  carMake?: string | null;
  carModel?: string | null;
  carColor?: string | null;
  scheduledRetrievalAt?: string | null;
}

export default function Landing() {
  const { content } = useContent();
  const t = content.landing;
  const [ticketNumber, setTicketNumber] = useState("");
  const [showStatus, setShowStatus] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showSystemLogin, setShowSystemLogin] = useState(() => new URLSearchParams(window.location.search).get("login") === "1");
  const [showFAQModal, setShowFAQModal] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduleEmail, setScheduleEmail] = useState("");
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
      toast({ title: t.errors.invalidTicket, description: t.errors.invalidTicketDesc, variant: "destructive" });
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
            title: t.errors.tooManyAttempts,
            description: t.errors.tooManyAttemptsDesc,
            variant: "destructive",
          });
        } else {
          toast({ title: t.errors.lookupError, description: t.errors.lookupErrorDesc, variant: "destructive" });
        }
        return;
      }

      const data = await response.json();
      if (data.success) {
        setTicketPreview(data.ticket);
        setShowConfirmation(true);
      }
    } catch (err: any) {
      toast({ title: t.errors.connectionError, description: t.errors.connectionErrorDesc, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmRetrieval = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/tickets/${ticketNumber}/queue`, { method: "POST" });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        toast({
          title: t.errors.requestFailed,
          description: err.message || t.errors.requestFailedDesc,
          variant: "destructive",
        });
        return;
      }
      setShowStatus(true);
      setSubmittedTicket(ticketNumber);
    } catch (err: any) {
      toast({ title: t.errors.connectionError, description: t.errors.connectionErrorDesc, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelConfirmation = () => {
    setShowConfirmation(false);
    setTicketPreview(null);
    setTicketNumber("");
    setGuestNameInput("");
    setGuestPinInput("");
  };

  const handleScheduleSubmit = async () => {
    if (!scheduleDate || !scheduleTime) {
      toast({ title: t.errors.noDate, variant: "destructive" });
      return;
    }
    setScheduleLoading(true);
    try {
      const response = await fetch(`/api/tickets/${ticketNumber}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: scheduleDate, time: scheduleTime, email: scheduleEmail }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        toast({ title: t.errors.scheduleFailed, description: err.message || t.errors.scheduleFailedDesc, variant: "destructive" });
        return;
      }
      setScheduleConfirmed(true);
    } catch (err: any) {
      toast({ title: t.errors.connectionError, description: t.errors.connectionErrorDesc, variant: "destructive" });
    } finally {
      setScheduleLoading(false);
    }
  };

  // Status Tracking Screen
  if (showStatus) {
    return (
      <div className="min-h-screen bg-soft-gray">
        <StatusTracker ticketNumber={submittedTicket} />
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

  // Schedule Screen
  if (showSchedule && ticketPreview) {
    const minDate = format(startOfToday(), "yyyy-MM-dd");
    const maxDate = format(addDays(startOfToday(), 7), "yyyy-MM-dd");

    // Build time options: every 15 min from 08:00 to 23:45
    const timeOptions: string[] = [];
    for (let h = 8; h <= 23; h++) {
      for (let m = 0; m < 60; m += 15) {
        timeOptions.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
      }
    }

    return (
      <div className="min-h-screen bg-soft-gray flex flex-col">
        <div className="max-w-md mx-auto px-6 py-8 w-full flex-1 flex flex-col justify-center">
          {/* Schedule Card */}
          <Card className="shadow-xl border-2 border-regis-gold/20 mb-6">
            <CardContent className="p-8">
              <div className="flex items-center gap-3 mb-5">
                <Button variant="ghost" size="icon" onClick={() => setShowSchedule(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <ChevronLeft size={20} />
                </Button>
                <div className="flex-1 text-left">
                  <h1 className="text-xl font-semibold text-regis-navy leading-tight">{t.schedule.heading}</h1>
                  <p className="text-gray-500 text-xs">{t.scheduled.ticketPrefix}{ticketPreview.ticketNumber}</p>
                </div>
              </div>

              <div className="text-center mb-7">
                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Calendar className="text-regis-navy" size={26} />
                </div>
                <h2 className="text-xl font-bold text-regis-navy mb-1">{t.schedule.subheading}</h2>
                <p className="text-gray-500 text-sm">We'll have your vehicle ready at the entrance.</p>
              </div>

              <div className="space-y-5">
                {/* Date */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{t.schedule.dateLabel}</label>
                  <input
                    type="date"
                    min={minDate}
                    max={maxDate}
                    value={scheduleDate}
                    onChange={e => setScheduleDate(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 text-regis-navy text-sm focus:outline-none focus:ring-2 focus:ring-regis-gold/40 focus:border-regis-gold bg-white"
                  />
                  <p className="text-xs text-gray-400 mt-1">{t.schedule.dateHint}</p>
                </div>

                {/* Time */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{t.schedule.timeLabel}</label>
                  <select
                    value={scheduleTime}
                    onChange={e => setScheduleTime(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 text-regis-navy text-sm focus:outline-none focus:ring-2 focus:ring-regis-gold/40 focus:border-regis-gold bg-white appearance-none"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%239CA3AF' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center" }}
                  >
                    <option value="">Select a time</option>
                    {timeOptions.map(time => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                </div>

                {/* Email reminder */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    {t.schedule.emailLabel} <span className="text-gray-400 font-normal normal-case">{t.schedule.emailOptional}</span>
                  </label>
                  <input
                    type="email"
                    placeholder={t.schedule.emailPlaceholder}
                    value={scheduleEmail}
                    onChange={e => setScheduleEmail(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 text-regis-navy text-sm focus:outline-none focus:ring-2 focus:ring-regis-gold/40 focus:border-regis-gold bg-white"
                  />
                  <p className="text-xs text-gray-400 mt-1">{t.schedule.emailHint}</p>
                </div>

              </div>

              <div className="mt-7 space-y-3">
                <Button
                  onClick={handleScheduleSubmit}
                  disabled={scheduleLoading}
                  className="w-full bg-regis-navy hover:bg-regis-navy/90 text-white font-semibold py-4 h-auto text-base"
                >
                  <Calendar className="mr-2" size={18} />
                  {scheduleLoading ? t.schedule.confirming : t.schedule.confirm}
                </Button>
                <Button
                  onClick={() => setShowSchedule(false)}
                  variant="ghost"
                  className="w-full py-2 h-auto text-gray-400 hover:text-gray-600"
                >
                  <ChevronLeft className="mr-1" size={15} />
                  {t.schedule.back}
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
            <h1 className="text-3xl font-semibold text-regis-navy mb-2">{t.confirmation.pageTitle}</h1>
            <p className="text-gray-600 text-sm">{t.confirmation.pageSubtitle}</p>
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
                <h2 className="text-2xl font-bold text-regis-navy mb-1">{t.confirmation.ticketFound}</h2>
                <p className="text-gray-500 text-sm">{t.confirmation.confirmIdentity}</p>
              </div>

              {/* Divider */}
              <div className="border-t border-gray-100 my-5" />

              {/* Ticket Info */}
              <div className="bg-gray-50 rounded-xl border border-gray-100 divide-y divide-gray-100 mb-6 text-sm">
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-xs text-gray-400 uppercase tracking-wide flex items-center gap-1.5"><Ticket size={11} />{t.ticketInfo.ticket}</span>
                  <span className="font-bold text-regis-navy">#{ticketPreview.ticketNumber}</span>
                </div>
                {ticketPreview.guestName && (
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-xs text-gray-400 uppercase tracking-wide flex items-center gap-1.5"><User size={11} />{t.ticketInfo.guest}</span>
                    <span className="font-semibold text-gray-800 text-right">{ticketPreview.guestName}</span>
                  </div>
                )}
                {(ticketPreview.carMake || ticketPreview.carModel || ticketPreview.carColor) && (
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-xs text-gray-400 uppercase tracking-wide flex items-center gap-1.5"><Car size={11} />{t.ticketInfo.vehicle}</span>
                    <span className="font-semibold text-gray-800 text-right">
                      {[ticketPreview.carColor, ticketPreview.carMake, ticketPreview.carModel].filter(Boolean).join(' ')}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-xs text-gray-400 uppercase tracking-wide flex items-center gap-1.5"><Building2 size={11} />{t.ticketInfo.visit}</span>
                  <span className="font-semibold text-gray-800 text-right">
                    {visitorLabel}
                    {ticketPreview.visitorSubType && <span className="text-gray-400 font-normal"> · {ticketPreview.visitorSubType.replace(/_/g, ' ')}</span>}
                  </span>
                </div>
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-xs text-gray-400 uppercase tracking-wide flex items-center gap-1.5"><Calendar size={11} />{t.ticketInfo.arrived}</span>
                  <span className="font-semibold text-gray-800">{format(arrivedAt, "dd MMM yyyy")} <span className="text-gray-400 font-normal text-xs">{format(arrivedAt, "hh:mm a")}</span></span>
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
                  {t.confirmation.retrieveNow}
                </Button>
                <Button
                  onClick={() => setShowSchedule(true)}
                  className="w-full py-3 h-auto bg-blue-600 hover:bg-blue-700 text-white font-medium"
                >
                  <Calendar className="mr-2" size={16} />
                  {t.confirmation.scheduleTime}
                </Button>
                <Button
                  onClick={handleCancelConfirmation}
                  variant="ghost"
                  className="w-full py-2 h-auto text-gray-400 hover:text-gray-600"
                >
                  <X className="mr-2" size={15} />
                  {t.confirmation.cancel}
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

  // Scheduled Confirmation
  if (scheduleConfirmed) {
    const confirmedDate = new Date(`${scheduleDate}T${scheduleTime}`);

    return (
      <div className="min-h-screen bg-soft-gray">
        <div className="max-w-md mx-auto px-6 py-8 w-full flex-1 flex flex-col justify-center">
          <Card className="shadow-xl border-2 border-regis-gold/20 mb-6">
            <CardContent className="p-8 text-center">
              <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="text-white" size={28} />
              </div>
              <h1 className="text-2xl font-semibold mb-1">{t.scheduled.header}</h1>
              <p className="text-blue-200 text-sm">{t.scheduled.ticketPrefix}{submittedTicket}</p>
            </CardContent>
          </Card>

          <Card className="shadow-lg">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar className="text-green-600" size={24} />
              </div>
              <h2 className="text-xl font-bold text-regis-navy mb-1">{t.scheduled.confirmedTitle}</h2>
              <p className="text-gray-500 text-sm mb-6">{t.scheduled.confirmedSub}</p>
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-5 mb-6 text-left space-y-3">
                <div className="flex items-center gap-3">
                  <Calendar className="text-regis-gold flex-shrink-0" size={16} />
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide">{t.scheduled.dateLabel}</p>
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
              <p className="text-xs text-gray-400 mb-6">{t.scheduled.changeHint}</p>
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
    const char = index === 0
      ? value.replace(/[^A-Za-z0-9]/g, '').slice(-1).toUpperCase()
      : value.replace(/\D/g, '').slice(-1);
    const digits = ticketNumber.padEnd(5, ' ').split('');
    digits[index] = char;
    setTicketNumber(digits.join('').trim());

    if (char && index < 4) {
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
      <div className="max-w-md mx-auto px-6 py-8">
        <Card className="mb-6 shadow-lg overflow-hidden">
          <CardContent className="p-0">
            <div className="bg-regis-navy text-center px-6 py-5">
              <p className="text-[10px] font-semibold tracking-[0.25em] text-regis-gold uppercase mb-1">{t.header.tagline}</p>
              <h1 className="text-2xl font-bold tracking-widest text-white uppercase mb-1">{t.header.title}</h1>
              <div className="flex items-center justify-center gap-3 mt-2">
                <div className="h-px w-10 bg-regis-gold/60" />
                <p className="text-[11px] tracking-[0.18em] text-white/60 uppercase">{t.header.subtitle}</p>
                <div className="h-px w-10 bg-regis-gold/60" />
              </div>
            </div>

            <div className="p-8">
              <div className="flex justify-center mb-6">
                <div
                  className="overflow-hidden"
                  style={{
                    width: '90%',
                    borderRadius: '14px',
                    border: '2px solid rgba(220, 230, 245, 0.9)',
                    boxShadow: '0 0 0 1px rgba(180,200,230,0.4), 0 4px 24px rgba(160,190,220,0.25), inset 0 1px 0 rgba(255,255,255,0.8)',
                  }}
                >
                  <img
                    src={luxuryCarImg}
                    alt="Luxury valet car"
                    className="w-full object-cover"
                    style={{ height: '160px', objectPosition: 'center 55%' }}
                  />
                </div>
              </div>

              <h2 className="text-xl font-semibold text-regis-navy mb-5 text-center">{t.input.heading}</h2>

              <div className="flex flex-col items-center mb-6">
                <div className="flex justify-center gap-2">
                  {[0, 1, 2, 3, 4].map((index) => (
                    <input
                      key={index}
                      id={`digit-${index}`}
                      type="text"
                      inputMode={index === 0 ? "text" : "numeric"}
                      maxLength={1}
                      value={ticketNumber[index] || ''}
                      onChange={(e) => handleDigitChange(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      className="w-12 h-14 text-center text-2xl font-mono font-bold border-2 border-gray-300 rounded-lg focus:border-regis-gold focus:outline-none focus:ring-2 focus:ring-regis-gold/20"
                      data-testid={`input-digit-${index}`}
                    />
                  ))}
                </div>
                <div className="flex justify-start w-full pl-[calc(50%-130px)] mt-1.5">
                  <div className="flex flex-col items-center gap-0.5 w-12">
                    <svg width="10" height="8" viewBox="0 0 10 8" className="text-regis-gold fill-current">
                      <polygon points="5,0 10,8 0,8" />
                    </svg>
                    <span className="text-[10px] font-semibold text-regis-gold uppercase tracking-wide leading-none whitespace-nowrap">{t.input.startHere}</span>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  {t.input.pinLabel}
                </label>
                <input
                  type="text"
                  value={guestPinInput}
                  onChange={e => { setGuestPinInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4)); setNameError(""); }}
                  onKeyDown={e => { if (e.key === 'Enter') handleTicketSubmit(); }}
                  placeholder={t.input.pinPlaceholder}
                  maxLength={4}
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 text-regis-navy text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-regis-gold/40 focus:border-regis-gold bg-white uppercase"
                />
                <p className="text-[11px] text-gray-400 mt-1">{t.input.pinHint}</p>
                {nameError && (
                  <p className="text-red-500 text-xs mt-1">{nameError}</p>
                )}
              </div>

              <Button 
                onClick={handleTicketSubmit}
                disabled={isLoading}
                className="w-full bg-regis-navy hover:bg-blue-900 text-white font-medium py-4 h-auto"
                data-testid="button-submit"
              >
                {isLoading ? t.input.searching : t.input.submit}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-6">
            <h3 className="font-medium text-regis-navy mb-3 flex items-center">
              <HelpCircle className="mr-2 text-regis-gold" size={18} />
              {t.faq.sectionTitle}
            </h3>
            <button 
              onClick={() => setShowFAQModal(true)}
              className="text-regis-gold text-sm font-medium hover:underline"
            >
              {t.faq.viewAll}
            </button>
          </CardContent>
        </Card>
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={() => setShowSystemLogin(true)}
        className="fixed bottom-4 left-4 w-8 h-8 bg-gray-300 hover:bg-gray-400 opacity-30 hover:opacity-60 transition-all duration-300"
        data-testid="button-system-login"
      >
        <Settings size={12} className="text-gray-600" />
      </Button>

      {showSystemLogin && (
        <SystemLoginModal onClose={() => setShowSystemLogin(false)} />
      )}

      <FAQModal 
        isOpen={showFAQModal} 
        onClose={() => setShowFAQModal(false)} 
      />
    </div>
  );
}
