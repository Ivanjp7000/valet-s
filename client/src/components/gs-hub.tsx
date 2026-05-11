import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, Calendar, Plus, Send, ChevronDown, ChevronUp, CheckCircle2, CalendarPlus, Clock, Tag, Pencil, Trash2, ChevronLeft, ChevronRight, Users, UserCheck, UserX } from "lucide-react";

type GsMessage = {
  id: string;
  ouId: string;
  senderId: string;
  senderName: string;
  content: string;
  status: string;
  calendarEventId: string | null;
  acknowledgedAt: string | null;
  createdAt: string;
  replies: GsReply[];
};

type GsReply = {
  id: string;
  messageId: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: string;
};

type CalendarEvent = {
  id: string;
  ouId: string;
  title: string;
  eventDate: string;
  startTime: string | null;
  endTime: string | null;
  details: string | null;
  category: string;
  createdBy: string;
  createdByName: string;
  sourceMessageId: string | null;
  createdAt: string;
};

const CATEGORY_LABELS: Record<string, string> = {
  general: "General",
  vip: "VIP",
  wedding: "Wedding",
  event: "Event",
  transport: "Transport",
};

const CATEGORY_COLORS: Record<string, string> = {
  general: "bg-blue-100 text-blue-700 border-blue-200",
  vip: "bg-purple-100 text-purple-700 border-purple-200",
  wedding: "bg-pink-100 text-pink-700 border-pink-200",
  event: "bg-amber-100 text-amber-700 border-amber-200",
  transport: "bg-green-100 text-green-700 border-green-200",
};

const STATUS_DOT: Record<string, string> = {
  open: "bg-yellow-400",
  scheduled: "bg-blue-500",
  resolved: "bg-gray-400",
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fmtDate(d: string) {
  const [y, mo, day] = d.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(mo)-1]} ${parseInt(day)}, ${y}`;
}

// ── Compose dialog ────────────────────────────────────────────────────────────
function ComposeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [content, setContent] = useState("");
  const qc = useQueryClient();
  const { toast } = useToast();

  const send = useMutation({
    mutationFn: () => apiRequest("POST", "/api/gs/messages", { content }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/gs/messages"] });
      toast({ title: "Message sent to GS" });
      setContent("");
      onClose();
    },
    onError: () => toast({ title: "Failed to send", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare size={18} className="text-regis-gold" />
            Message to GS
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-500">Describe the event, arrival, or request. GS team will handle and add to the calendar if needed.</p>
        <Textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="e.g. Wedding party arriving at 15:00 — 4 cars, bride: Yamamoto, white sedan + black SUV"
          rows={4}
          className="resize-none"
        />
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => send.mutate()} disabled={!content.trim() || send.isPending}
            className="bg-regis-navy hover:bg-regis-navy/90 text-white gap-2">
            <Send size={14} /> Send to GS
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Convert-to-Event dialog ───────────────────────────────────────────────────
function ConvertToEventDialog({ message, open, onClose }: { message: GsMessage | null; open: boolean; onClose: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState(today);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [category, setCategory] = useState("general");
  const [details, setDetails] = useState("");
  const qc = useQueryClient();
  const { toast } = useToast();

  const save = useMutation({
    mutationFn: () => apiRequest("POST", "/api/gs/messages/" + message!.id + "/convert-to-event", {
      title, eventDate, startTime: startTime || undefined, endTime: endTime || undefined, category, details: details || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/gs/messages"] });
      qc.invalidateQueries({ queryKey: ["/api/calendar/events"] });
      toast({ title: "Added to Calendar", description: "Sender will be notified." });
      onClose();
    },
    onError: () => toast({ title: "Failed to save event", variant: "destructive" }),
  });

  if (!message) return null;
  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus size={18} className="text-regis-gold" />
            Add to Calendar
          </DialogTitle>
        </DialogHeader>
        <div className="text-xs text-gray-500 bg-gray-50 rounded p-2 border line-clamp-2">"{message.content}"</div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Event Title *</label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Wedding Arrival – Yamamoto" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Date *</label>
              <Input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Category</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Start Time</label>
              <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">End Time</label>
              <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Additional Details</label>
            <Textarea value={details} onChange={e => setDetails(e.target.value)} placeholder="Car numbers, guest names, special instructions…" rows={2} className="resize-none" />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={!title.trim() || !eventDate || save.isPending}
            className="bg-regis-navy hover:bg-regis-navy/90 text-white gap-2">
            <CalendarPlus size={14} /> Save to Calendar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Add/Edit Calendar Event dialog ────────────────────────────────────────────
function CalendarEventDialog({ event, open, onClose }: { event?: CalendarEvent; open: boolean; onClose: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [title, setTitle] = useState(event?.title ?? "");
  const [eventDate, setEventDate] = useState(event?.eventDate ?? today);
  const [startTime, setStartTime] = useState(event?.startTime ?? "");
  const [endTime, setEndTime] = useState(event?.endTime ?? "");
  const [category, setCategory] = useState(event?.category ?? "general");
  const [details, setDetails] = useState(event?.details ?? "");
  const qc = useQueryClient();
  const { toast } = useToast();

  const save = useMutation({
    mutationFn: () => event
      ? apiRequest("PATCH", "/api/calendar/events/" + event.id, { title, eventDate, startTime: startTime || undefined, endTime: endTime || undefined, category, details: details || undefined })
      : apiRequest("POST", "/api/calendar/events", { title, eventDate, startTime: startTime || undefined, endTime: endTime || undefined, category, details: details || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/calendar/events"] });
      toast({ title: event ? "Event updated" : "Event created" });
      onClose();
    },
    onError: () => toast({ title: "Failed to save event", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus size={18} className="text-regis-gold" />
            {event ? "Edit Event" : "Add Calendar Event"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Event Title *</label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. VIP Lunch – Suzuki Party" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Date *</label>
              <Input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Category</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Start Time</label>
              <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">End Time</label>
              <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Details</label>
            <Textarea value={details} onChange={e => setDetails(e.target.value)} placeholder="Car numbers, guest names, special instructions…" rows={2} className="resize-none" />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={!title.trim() || !eventDate || save.isPending}
            className="bg-regis-navy hover:bg-regis-navy/90 text-white">
            {event ? "Update" : "Add to Calendar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Single message card ───────────────────────────────────────────────────────
function MessageCard({ msg, currentUserId, isGSMember }: { msg: GsMessage; currentUserId: string; isGSMember: boolean }) {
  const [repliesExpanded, setRepliesExpanded] = useState(true);
  const [replyText, setReplyText] = useState("");
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();

  const sendReply = (text: string) => {
    return apiRequest("POST", `/api/gs/messages/${msg.id}/reply`, { content: text });
  };

  const reply = useMutation({
    mutationFn: () => sendReply(replyText),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/gs/messages"] });
      setReplyText("");
      setShowReplyBox(false);
      setRepliesExpanded(true);
    },
    onError: () => toast({ title: "Failed to send reply", variant: "destructive" }),
  });

  const quickReply = useMutation({
    mutationFn: (text: string) => sendReply(text),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/gs/messages"] });
      setRepliesExpanded(true);
      toast({ title: "Reply sent" });
    },
    onError: () => toast({ title: "Failed to send reply", variant: "destructive" }),
  });

  const acknowledge = useMutation({
    mutationFn: () => apiRequest("POST", `/api/gs/messages/${msg.id}/acknowledge`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/gs/messages"] }); toast({ title: "Acknowledged!" }); },
    onError: () => toast({ title: "Failed to acknowledge", variant: "destructive" }),
  });

  const isMine = msg.senderId === currentUserId;
  const hasReplies = msg.replies.length > 0;
  const isScheduled = msg.status === "scheduled";
  const isAcknowledged = !!msg.acknowledgedAt;

  return (
    <div className={`rounded-xl border-2 ${isScheduled ? "border-blue-200 bg-blue-50/30" : "border-gray-200 bg-white"} p-4 space-y-3`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${STATUS_DOT[msg.status] || "bg-gray-300"}`} />
          <span className="text-sm font-bold text-gray-800 truncate">{msg.senderName}</span>
          <span className="text-xs text-gray-400">{timeAgo(msg.createdAt)}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isScheduled && (
            <span className="text-xs bg-blue-100 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
              <Calendar size={10} /> On Calendar
            </span>
          )}
          {msg.status === "open" && (
            <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-semibold">Open</span>
          )}
        </div>
      </div>

      {/* Message content */}
      <p className="text-sm text-gray-800 leading-relaxed">{msg.content}</p>

      {/* Replies */}
      {hasReplies && (
        <div className="space-y-1">
          <button
            onClick={() => setRepliesExpanded(e => !e)}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 font-medium"
          >
            <MessageSquare size={11} />
            <span>{msg.replies.length} {msg.replies.length === 1 ? "reply" : "replies"}</span>
            {repliesExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
          {repliesExpanded && (
            <div className="pl-3 border-l-2 border-gray-200 space-y-2">
              {msg.replies.map(r => (
                <div key={r.id} className="bg-gray-50 rounded-lg px-2.5 py-1.5">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-xs font-semibold text-gray-700">{r.senderName}</span>
                    <span className="text-[10px] text-gray-400">{timeAgo(r.createdAt)}</span>
                  </div>
                  <p className="text-xs text-gray-700">{r.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Acknowledge button — shown to original sender when event has been added to calendar */}
      {isScheduled && isMine && !isAcknowledged && (
        <div className="pt-2 border-t border-blue-200 bg-blue-50 rounded-lg px-3 py-2.5">
          <p className="text-xs text-blue-700 font-medium mb-2">GS has added this to the calendar. Please confirm you've seen it.</p>
          <Button size="sm" onClick={() => acknowledge.mutate()} disabled={acknowledge.isPending}
            className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1.5">
            <CheckCircle2 size={13} /> Confirm & Acknowledge
          </Button>
        </div>
      )}
      {isScheduled && isMine && isAcknowledged && (
        <div className="flex items-center gap-1.5 text-xs text-green-600 bg-green-50 rounded-lg px-3 py-2 border border-green-200">
          <CheckCircle2 size={13} /> Acknowledged by sender
        </div>
      )}

      {/* GS Member actions */}
      {isGSMember && (
        <div className="pt-2 border-t-2 border-dashed border-purple-100 space-y-2">
          <p className="text-[10px] font-semibold text-purple-600 uppercase tracking-wide">GS Actions</p>

          {/* Quick action row */}
          <div className="flex flex-wrap gap-2">
            {/* Quick "Taken care of" button */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => quickReply.mutate("Thank you — everything is taken care of. Please let us know if you need anything else.")}
              disabled={quickReply.isPending}
              className="h-8 text-xs gap-1.5 border-green-300 text-green-700 hover:bg-green-50 font-semibold"
            >
              <CheckCircle2 size={13} /> Taken care of
            </Button>

            {/* Custom reply toggle */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowReplyBox(r => !r)}
              className={`h-8 text-xs gap-1.5 font-semibold ${showReplyBox ? "bg-gray-100 border-gray-400 text-gray-700" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}
            >
              <MessageSquare size={13} /> {showReplyBox ? "Cancel" : "Write Reply"}
            </Button>

            {/* Add to calendar */}
            {!isScheduled && (
              <Button
                size="sm"
                onClick={() => setConvertOpen(true)}
                className="h-8 text-xs gap-1.5 bg-regis-navy hover:bg-regis-navy/90 text-white font-semibold"
              >
                <CalendarPlus size={13} /> Add to Calendar
              </Button>
            )}
          </div>

          {/* Custom reply box */}
          {showReplyBox && (
            <div className="space-y-2">
              <Textarea
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                placeholder="Type your reply to the sender…"
                rows={2}
                className="resize-none text-sm"
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey && replyText.trim()) {
                    e.preventDefault();
                    reply.mutate();
                  }
                }}
              />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={() => { setShowReplyBox(false); setReplyText(""); }} className="h-7 text-xs">Cancel</Button>
                <Button
                  size="sm"
                  onClick={() => reply.mutate()}
                  disabled={!replyText.trim() || reply.isPending}
                  className="h-7 text-xs bg-regis-navy hover:bg-regis-navy/90 text-white gap-1.5"
                >
                  <Send size={12} /> Send Reply
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <ConvertToEventDialog message={msg} open={convertOpen} onClose={() => setConvertOpen(false)} />
    </div>
  );
}

// ── Calendar view ─────────────────────────────────────────────────────────────
function CalendarView({ isGSMember }: { isGSMember: boolean }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-indexed
  const [addOpen, setAddOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<CalendarEvent | undefined>();
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: events = [] } = useQuery<CalendarEvent[]>({
    queryKey: ["/api/calendar/events"],
    queryFn: async () => {
      const res = await fetch("/api/calendar/events", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const deleteEvent = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/calendar/events/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/calendar/events"] }); toast({ title: "Event deleted" }); },
  });

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const DAY_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const monthStr = `${year}-${(month + 1).toString().padStart(2, "0")}`;
  const monthEvents = events.filter(e => e.eventDate.startsWith(monthStr));

  const todayStr = today.toISOString().slice(0, 10);

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const eventsForDay = (day: number) => monthEvents.filter(e => {
    const [,, d] = e.eventDate.split("-");
    return parseInt(d) === day;
  });

  return (
    <div className="space-y-3">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-1 rounded hover:bg-gray-100"><ChevronLeft size={16} /></button>
          <span className="text-sm font-semibold text-gray-700 w-36 text-center">{MONTH_NAMES[month]} {year}</span>
          <button onClick={nextMonth} className="p-1 rounded hover:bg-gray-100"><ChevronRight size={16} /></button>
        </div>
        {isGSMember && (
          <Button size="sm" onClick={() => setAddOpen(true)}
            className="h-7 text-xs bg-regis-navy hover:bg-regis-navy/90 text-white gap-1">
            <Plus size={12} /> Add Event
          </Button>
        )}
      </div>

      {/* Calendar grid */}
      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
          {DAY_NAMES.map(d => <div key={d} className="text-center text-xs font-semibold text-gray-500 py-1.5">{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            if (!day) return <div key={`e${i}`} className="min-h-[56px] border-r border-b border-gray-100 bg-gray-50/40" />;
            const dayStr = `${year}-${(month + 1).toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
            const dayEvents = eventsForDay(day);
            const isToday = dayStr === todayStr;
            return (
              <div key={day} className={`min-h-[56px] border-r border-b border-gray-100 p-1 ${isToday ? "bg-regis-gold/10" : ""}`}>
                <div className={`text-xs font-semibold mb-1 w-5 h-5 flex items-center justify-center rounded-full ${isToday ? "bg-regis-navy text-white" : "text-gray-600"}`}>
                  {day}
                </div>
                <div className="space-y-0.5">
                  {dayEvents.slice(0, 2).map(ev => (
                    <div key={ev.id} className={`text-[10px] leading-tight px-1 py-0.5 rounded truncate font-medium border cursor-pointer hover:opacity-80 ${CATEGORY_COLORS[ev.category] || CATEGORY_COLORS.general}`}
                      onClick={() => isGSMember && setEditEvent(ev)}
                      title={`${ev.title}${ev.startTime ? " · " + ev.startTime : ""}`}>
                      {ev.startTime ? ev.startTime + " " : ""}{ev.title}
                    </div>
                  ))}
                  {dayEvents.length > 2 && <div className="text-[10px] text-gray-400 pl-1">+{dayEvents.length - 2} more</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Upcoming events list */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">This Month's Events</p>
        {monthEvents.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">No events this month</p>
        ) : (
          <div className="space-y-1.5">
            {monthEvents.map(ev => (
              <div key={ev.id} className={`flex items-start gap-2 rounded-lg border p-2.5 ${CATEGORY_COLORS[ev.category] || CATEGORY_COLORS.general}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold">{ev.title}</span>
                    <span className="text-[10px] opacity-70">{fmtDate(ev.eventDate)}</span>
                    {ev.startTime && <span className="text-[10px] font-semibold">{ev.startTime}{ev.endTime ? "–" + ev.endTime : ""}</span>}
                  </div>
                  {ev.details && <p className="text-xs mt-0.5 opacity-80">{ev.details}</p>}
                  <p className="text-[10px] opacity-60 mt-0.5">By {ev.createdByName}</p>
                </div>
                {isGSMember && (
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => setEditEvent(ev)} className="p-1 rounded hover:bg-black/10"><Pencil size={12} /></button>
                    <button onClick={() => { if (confirm("Delete this event?")) deleteEvent.mutate(ev.id); }} className="p-1 rounded hover:bg-red-100 text-red-600"><Trash2 size={12} /></button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {addOpen && <CalendarEventDialog open={addOpen} onClose={() => setAddOpen(false)} />}
      {editEvent && <CalendarEventDialog event={editEvent} open={!!editEvent} onClose={() => setEditEvent(undefined)} />}
    </div>
  );
}

// ── Members management view (Privilege Admin / Super Admin only) ───────────────
type StaffUser = { id: string; firstName: string | null; lastName: string | null; email: string | null; role: string | null; };
type GsMemberRow = { id: string; userId: string; ouId: string; addedBy: string; createdAt: string; };

function MembersView() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: allUsers = [], isLoading: usersLoading } = useQuery<StaffUser[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await fetch("/api/users", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: gsMembers = [], isLoading: membersLoading } = useQuery<GsMemberRow[]>({
    queryKey: ["/api/gs/members"],
    queryFn: async () => {
      const res = await fetch("/api/gs/members", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const memberIds = new Set(gsMembers.map(m => m.userId));

  const addMember = useMutation({
    mutationFn: (userId: string) => apiRequest("POST", `/api/gs/members/${userId}`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/gs/members"] });
      qc.invalidateQueries({ queryKey: ["/api/gs/members/me"] });
      toast({ title: "Added to GS group" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const removeMember = useMutation({
    mutationFn: (userId: string) => apiRequest("DELETE", `/api/gs/members/${userId}`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/gs/members"] });
      qc.invalidateQueries({ queryKey: ["/api/gs/members/me"] });
      toast({ title: "Removed from GS group" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const isPending = addMember.isPending || removeMember.isPending;

  if (usersLoading || membersLoading) {
    return <p className="text-xs text-gray-400 text-center py-6">Loading…</p>;
  }

  const eligible = allUsers.filter(u => u.role !== 'superadmin');

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500 mb-3">
        GS Members can reply to messages and manage the shared calendar. Toggle membership below.
      </p>
      {eligible.length === 0 && (
        <p className="text-center text-xs text-gray-400 py-6">No staff users found in your OU.</p>
      )}
      {eligible.map(u => {
        const isMem = memberIds.has(u.id);
        const name = [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email || u.id;
        const roleLabel: Record<string, string> = { privilege_admin: "Privilege Admin", standard_admin: "Standard Admin", standard_user: "Standard User" };
        return (
          <div key={u.id} className="flex items-center justify-between gap-3 border border-gray-100 rounded-lg px-3 py-2.5 bg-white">
            <div className="flex items-center gap-2 min-w-0">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${isMem ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-500"}`}>
                {name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium truncate">{name}</p>
                <p className="text-[10px] text-gray-400">{roleLabel[u.role ?? ""] ?? u.role}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {isMem && (
                <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                  <UserCheck size={10} /> GS
                </span>
              )}
              <Button
                size="sm"
                variant={isMem ? "outline" : "default"}
                className={`h-7 text-[11px] px-2 ${isMem ? "border-red-300 text-red-600 hover:bg-red-50" : "bg-purple-600 hover:bg-purple-700 text-white"}`}
                disabled={isPending}
                onClick={() => isMem ? removeMember.mutate(u.id) : addMember.mutate(u.id)}
              >
                {isMem ? <><UserX size={11} className="mr-1" />Remove</> : <><UserCheck size={11} className="mr-1" />Add</>}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main GS Hub component ─────────────────────────────────────────────────────
export function GSHub({ wsSignal }: { wsSignal?: number }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'privilege_admin' || user?.role === 'superadmin';
  const [tab, setTab] = useState<"messages" | "calendar" | "members">("messages");
  const [composeOpen, setComposeOpen] = useState(false);
  const qc = useQueryClient();

  const { data: messages = [], isLoading } = useQuery<GsMessage[]>({
    queryKey: ["/api/gs/messages"],
    queryFn: async () => {
      const res = await fetch("/api/gs/messages", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    refetchInterval: 15000,
  });

  const { data: isMember = false } = useQuery<boolean>({
    queryKey: ["/api/gs/members/me"],
    queryFn: async () => {
      const res = await fetch("/api/gs/members/me", { credentials: "include" });
      if (!res.ok) return false;
      const d = await res.json();
      return !!d.isMember;
    },
  });

  // Admins automatically have GS member powers
  const isGSMember = isMember || isAdmin;

  const pendingCount = messages.filter(m => m.senderId === user?.id && m.status === "scheduled" && !m.acknowledgedAt).length;
  const openCount = messages.filter(m => m.status === "open").length;

  return (
    <div className="space-y-3">
      {/* Tabs */}
      <div className="flex items-center gap-2">
        <div className="flex rounded-lg border border-gray-200 overflow-hidden flex-1">
          <button
            onClick={() => setTab("messages")}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors ${tab === "messages" ? "bg-regis-navy text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
            <MessageSquare size={13} /> Messages
            {openCount > 0 && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${tab === "messages" ? "bg-white/20 text-white" : "bg-amber-500 text-white"}`}>{openCount}</span>}
          </button>
          <button
            onClick={() => setTab("calendar")}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors ${tab === "calendar" ? "bg-regis-navy text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
            <Calendar size={13} /> Calendar
          </button>
          {isAdmin && (
            <button
              onClick={() => setTab("members")}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors ${tab === "members" ? "bg-purple-700 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
              <Users size={13} /> Members
            </button>
          )}
        </div>
        {tab !== "members" && (
          <Button size="sm" onClick={() => setComposeOpen(true)}
            className="h-8 text-xs bg-regis-gold hover:bg-regis-gold/90 text-regis-navy font-bold gap-1 flex-shrink-0">
            <Plus size={12} /> Message GS
          </Button>
        )}
      </div>

      {/* Pending acknowledgements banner */}
      {pendingCount > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 flex items-center gap-2">
          <CheckCircle2 size={14} className="text-blue-500 flex-shrink-0" />
          <p className="text-xs text-blue-700">
            <strong>{pendingCount}</strong> of your messages {pendingCount === 1 ? "has" : "have"} been added to the calendar — please confirm below.
          </p>
        </div>
      )}

      {/* GS Member badge */}
      {isGSMember && (
        <div className="flex items-center gap-1.5 text-xs text-purple-700 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2">
          <Tag size={12} />
          <span className="font-semibold">GS Member</span>
          <span className="text-purple-500">— tap any message to reply or add it to the calendar</span>
        </div>
      )}

      {/* Content */}
      {tab === "messages" && (
        <div className="space-y-3">
          {isLoading ? (
            <p className="text-xs text-gray-400 text-center py-6">Loading…</p>
          ) : messages.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <MessageSquare size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No messages yet</p>
              <p className="text-xs mt-1">Send a message to GS to get started</p>
            </div>
          ) : (
            messages.map(m => (
              <MessageCard key={m.id} msg={m} currentUserId={user?.id ?? ""} isGSMember={isGSMember} />
            ))
          )}
        </div>
      )}

      {tab === "calendar" && <CalendarView isGSMember={isGSMember} />}

      {tab === "members" && isAdmin && <MembersView />}

      <ComposeDialog open={composeOpen} onClose={() => setComposeOpen(false)} />
    </div>
  );
}
