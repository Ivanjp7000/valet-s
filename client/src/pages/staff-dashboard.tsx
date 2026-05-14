import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CarPhotoUploader } from "@/components/car-photo-uploader";
import { ValetTicketWizard } from "@/components/valet-ticket-wizard";
import { UnifiedRetrievalBox, CompactRetrievalProgress } from "@/components/active-retrieval-progress";
import { RetrievalNotificationPopup } from "@/components/retrieval-notification-popup";
import type { RetrievalRequest } from "@/components/retrieval-notification-popup";
import { CircularTimer } from "@/components/circular-timer";
import { Crown, Clock, Construction, Check, Timer, LogOut, Car, Camera, MapPin, User, Edit, Save, X, Plus, Users, TicketIcon, Settings, Home, Eye, EyeOff, Trash2, Archive, AlertTriangle, Play, ChevronDown, ChevronLeft, ChevronRight, Printer, GripVertical, BarChart2, Database, TrendingUp, TrendingDown, CalendarDays, Download, FileText, FileJson, CheckSquare, Square, Loader2, FileDown, List, ShieldCheck, Building2, Key, Copy, CheckCircle2, Ban, Monitor, Smartphone, Globe, Activity, MessageSquare, Mail } from "lucide-react";
import { GSHub } from "@/components/gs-hub";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import valetBanner6 from "@assets/ValetS-Banner6_1778475115501.png";
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { ValetTicket, SafeUser as UserType, OULicense, OrganizationalUnit } from "@shared/schema";
import { RESTAURANT_SUB_TYPES, VISITOR_TYPES } from "@shared/schema";
import { PDFDocument, rgb, StandardFonts, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import licenseCertImg from "@assets/Valet-S_Software_License1_1778373848645.png";

// Strip leading honorifics (Mr., Mrs., Ms., Mx., Dr., etc.) from a guest name
const stripHonorifics = (name: string) =>
  name.replace(/^(Mr\.|Mrs\.|Ms\.|Mx\.|Dr\.|Miss|Sir|Lord)\s*/i, '').trim();
// Display-ready guest name: stripped prefix + 様
const fmtGuest = (name: string | null | undefined) =>
  name ? stripHonorifics(name) + '\u0020\u69D8' : '';

// Helper: format a Date to datetime-local input value (YYYY-MM-DDTHH:MM)
function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

async function printFullTicket(ticket: import("@shared/schema").ValetTicket): Promise<void> {
  const visitorLabel = ticket.visitorType === 'hotel_guest' ? 'Hotel Staying Guest'
    : ticket.visitorType === 'restaurant'
      ? `Restaurant${ticket.visitorSubType ? `<br>${(RESTAURANT_SUB_TYPES as Record<string,string>)[ticket.visitorSubType] || ticket.visitorSubType}` : ''}`
      : ticket.visitorType === 'event' ? 'Event'
      : ticket.visitorType === 'others' ? 'Others'
      : ticket.visitorType || '–';

  const carLine = [ticket.carMake, ticket.carModel, ticket.carColor].filter(Boolean).join(' ');

  const checkinStr = ticket.createdAt ? (() => {
    const d = new Date(ticket.createdAt as unknown as string);
    const p = (n: number) => n.toString().padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth()+1)}/${d.getFullYear()}  ${p(d.getHours())}:${p(d.getMinutes())}`;
  })() : '';

  const row = (label: string, value: string | null | undefined) => value
    ? `<div class="row"><span class="label">${label}</span><span class="value">${value}</span></div>`
    : '';

  const restaurantLine = ticket.visitorType === 'restaurant' && ticket.visitorSubType
    ? (RESTAURANT_SUB_TYPES as Record<string,string>)[ticket.visitorSubType] || ticket.visitorSubType
    : null;

  const line = (value: string | null | undefined, cls = '') => value
    ? `<div class="line${cls ? ' ' + cls : ''}">${value}</div>`
    : '';

  const plateLine1 = ticket.licensePlate || '–';

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page { size: 50mm 80mm; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 50mm; height: 80mm; overflow: hidden;
    font-family: 'Noto Sans JP', 'Hiragino Sans', 'Yu Gothic', sans-serif;
    color: #1a1f45;
  }
  .header {
    background: #1a1f45; color: #fff;
    text-align: center; padding: 1.5mm 0;
    font-size: 7pt; letter-spacing: 2px; font-weight: bold;
  }
  .ticket-num {
    text-align: center; font-size: 20pt; font-weight: bold;
    color: #1a1f45; line-height: 1; padding: 1mm 0;
  }
  .gold-line { height: 0.4mm; background: #c9a84c; margin: 0 2.5mm 1.5mm; }
  .body { padding: 0 3mm; }
  .line {
    font-size: 9pt; font-weight: bold;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    margin-bottom: 1.2mm; line-height: 1.2;
  }
  .line.pin { font-size: 12pt; margin-top: 0.5mm; }
  .footer-block { text-align: center; margin-top: 2mm; }
  .footer-block .site { font-size: 9pt; font-weight: bold; color: #1a1f45; margin-bottom: 1.5mm; }
  .footer-block img { width: 18mm; height: 18mm; display: block; margin: 0 auto; }
</style>
</head>
<body>
  <div class="header">VALET TICKET</div>
  <div class="ticket-num">#${ticket.ticketNumber}</div>
  <div class="gold-line"></div>
  <div class="body">
    ${line(ticket.guestName || '–')}
    ${line(visitorLabel.replace(/<br>/g, ' '))}
    ${ticket.roomNumber ? line(`Room ${ticket.roomNumber}`) : ''}
    ${line(plateLine1)}
    ${ticket.parkingLocation ? line(ticket.parkingLocation) : ''}
    ${carLine ? line(carLine) : ''}
    ${checkinStr ? line(checkinStr) : ''}
    ${ticket.guestPin ? line(ticket.guestPin, 'pin') : ''}
  </div>
  <div class="footer-block">
    <div class="site">Valet-s.com</div>
    <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=https://valet-s.com" alt="QR"/>
  </div>
  <script>window.onload = function(){ window.print(); }<\/script>
</body>
</html>`;

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups for this site to print tickets.');
    return;
  }
  printWindow.document.write(html);
  printWindow.document.close();
}

function TripLogSection({
  trips,
  ticketNumber,
  canEdit,
  onRefresh,
}: {
  trips: { id: string; ticketId: string; departedAt: string; returnedAt: string | null; durationSeconds: number | null; createdAt: string }[];
  ticketNumber: string;
  canEdit: boolean;
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDeparted, setEditDeparted] = useState('');
  const [editReturned, setEditReturned] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const startEdit = (trip: { id: string; departedAt: string; returnedAt: string | null }) => {
    setEditingId(trip.id);
    setEditDeparted(toDatetimeLocal(new Date(trip.departedAt)));
    setEditReturned(trip.returnedAt ? toDatetimeLocal(new Date(trip.returnedAt)) : '');
  };

  const saveEdit = async () => {
    if (!editingId || !editDeparted) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/staff/trips/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ departedAt: new Date(editDeparted).toISOString(), returnedAt: editReturned ? new Date(editReturned).toISOString() : null }),
      });
      if (!res.ok) throw new Error('Failed');
      setEditingId(null);
      onRefresh();
      toast({ title: "Trip updated" });
    } catch {
      toast({ title: "Failed to update trip", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async (tripId: string) => {
    try {
      const res = await fetch(`/api/staff/trips/${tripId}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('Failed');
      setDeletingId(null);
      onRefresh();
      toast({ title: "Trip deleted" });
    } catch {
      toast({ title: "Failed to delete trip", variant: "destructive" });
    }
  };

  return (
    <div className="border-t pt-4">
      <h3 className="font-semibold text-regis-navy mb-3 flex items-center gap-2">
        <Car size={16} />
        Car Out with Guest — Trip Log ({trips.length} trip{trips.length !== 1 ? 's' : ''})
      </h3>
      <div className="space-y-2">
        {trips.map((trip, index) => {
          const departedAt = new Date(trip.departedAt);
          const returnedAt = trip.returnedAt ? new Date(trip.returnedAt) : null;
          const dur = trip.durationSeconds;
          const isEditing = editingId === trip.id;
          const isDeleting = deletingId === trip.id;

          return (
            <div key={trip.id} className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
              {/* Header row */}
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-blue-800 text-xs">Trip #{trips.length - index}</span>
                <div className="flex items-center gap-1">
                  {dur != null ? (
                    <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full border border-blue-300">
                      {formatDuration(dur)}
                    </span>
                  ) : (
                    <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full border border-amber-300">
                      Still Out
                    </span>
                  )}
                  {canEdit && !isEditing && !isDeleting && (
                    <>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 ml-1" onClick={() => startEdit(trip)}>
                        <Edit size={12} className="text-gray-500" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setDeletingId(trip.id)}>
                        <Trash2 size={12} className="text-red-400" />
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Delete confirmation */}
              {isDeleting && (
                <div className="bg-red-50 border border-red-200 rounded p-2 text-xs space-y-2">
                  <p className="text-red-700 font-medium">Delete this trip record?</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="destructive" className="h-6 text-xs px-3" onClick={() => confirmDelete(trip.id)}>
                      Delete
                    </Button>
                    <Button size="sm" variant="outline" className="h-6 text-xs px-3" onClick={() => setDeletingId(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {/* Edit form */}
              {isEditing && (
                <div className="space-y-2 mt-1">
                  <div>
                    <label className="text-xs text-gray-500 block mb-0.5">Departed</label>
                    <input
                      type="datetime-local"
                      value={editDeparted}
                      onChange={e => setEditDeparted(e.target.value)}
                      className="w-full text-xs border border-gray-300 rounded px-2 py-1 bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-0.5">Returned (leave blank if still out)</label>
                    <input
                      type="datetime-local"
                      value={editReturned}
                      onChange={e => setEditReturned(e.target.value)}
                      className="w-full text-xs border border-gray-300 rounded px-2 py-1 bg-white"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="h-6 text-xs px-3 bg-regis-gold hover:bg-yellow-600 text-regis-navy" onClick={saveEdit} disabled={saving}>
                      <Save size={11} className="mr-1" />{saving ? 'Saving…' : 'Save'}
                    </Button>
                    <Button size="sm" variant="outline" className="h-6 text-xs px-3" onClick={() => setEditingId(null)}>
                      <X size={11} className="mr-1" />Cancel
                    </Button>
                  </div>
                </div>
              )}

              {/* Normal view */}
              {!isEditing && !isDeleting && (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-gray-500">Departed</p>
                    <p className="font-medium text-gray-800">{departedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    <p className="text-gray-400">{departedAt.toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Returned</p>
                    {returnedAt ? (
                      <>
                        <p className="font-medium text-green-700">{returnedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        <p className="text-gray-400">{returnedAt.toLocaleDateString()}</p>
                      </>
                    ) : (
                      <p className="font-medium text-amber-600">Not yet returned</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GuestOutCard({ ticket, onBack, onView, canEdit = true }: { ticket: ValetTicket; onBack: () => void; onView: () => void; canEdit?: boolean }) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!ticket.guestDepartedAt) return;
    
    const departedAt = new Date(ticket.guestDepartedAt).getTime();
    const updateTimer = () => {
      setElapsedSeconds(Math.floor((Date.now() - departedAt) / 1000));
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [ticket.guestDepartedAt]);

  const mins = Math.floor(elapsedSeconds / 60);
  const secs = elapsedSeconds % 60;

  return (
    <div className="bg-blue-50 rounded p-2 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <span className="font-medium" style={{ fontSize: 'var(--panel-card-title-size, 14px)' }}>#{ticket.ticketNumber}</span>
          <span className="text-xs text-gray-500 ml-1">{ticket.carMake}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs font-mono font-bold text-blue-700">{mins}:{secs.toString().padStart(2, '0')}</span>
          <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={onView}>
            <Eye size={12} className="text-gray-500" />
          </Button>
        </div>
      </div>
      <span className={`inline-flex items-center px-1.5 py-0 rounded-full font-bold ${
        ticket.parkingLocation ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-red-100 text-red-700 border border-red-300'
      }`} style={{ fontSize: 'var(--panel-card-title-size, 14px)' }}>

        {ticket.parkingLocation || 'Unassigned'}
      </span>
      {canEdit && (
        <Button 
          size="sm" 
          className="h-6 px-3 text-xs bg-green-600 hover:bg-green-700 text-white w-full"
          onClick={onBack}
        >
          Guest is Back
        </Button>
      )}
    </div>
  );
}

function useParkedTimers(createdAt: Date | string | undefined | null) {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (!createdAt) return;
    const created = new Date(createdAt).getTime();
    const update = () => setElapsedMs(Date.now() - created);
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [createdAt]);

  const maxMs = 24 * 60 * 60 * 1000;
  const cycleElapsed = elapsedMs % maxMs;
  const remainingInCycle = maxMs - cycleElapsed;
  const dayNumber = Math.floor(elapsedMs / maxMs) + 1;
  const isOvernight = elapsedMs >= maxMs;

  const rh = Math.floor(remainingInCycle / 3600000);
  const rm = Math.floor((remainingInCycle % 3600000) / 60000);
  const rs = Math.floor((remainingInCycle % 60000) / 1000);
  const countdownDisplay = `${rh}:${rm.toString().padStart(2, '0')}:${rs.toString().padStart(2, '0')}`;
  const isUrgent = remainingInCycle < 3600000 && !isOvernight;

  const totalSecs = Math.floor(elapsedMs / 1000);
  const tDays = Math.floor(totalSecs / 86400);
  const tHours = Math.floor((totalSecs % 86400) / 3600);
  const tMins = Math.floor((totalSecs % 3600) / 60);
  const totalDisplay = tDays > 0
    ? `${tDays}d ${tHours}h ${tMins}m`
    : tHours > 0
    ? `${tHours}h ${tMins}m`
    : `${tMins}m`;

  return { countdownDisplay, isUrgent, isOvernight, dayNumber, totalDisplay };
}

function useScheduleCountdown(scheduledAt: Date | string | undefined | null) {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    if (!scheduledAt) return;
    const target = new Date(scheduledAt as string).getTime();
    const update = () => setRemaining(target - Date.now());
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [scheduledAt]);

  if (!scheduledAt) return { display: '', isOverdue: false, isUrgent: false };
  const isOverdue = remaining <= 0;
  const abs = Math.abs(remaining);
  const h = Math.floor(abs / 3600000);
  const m = Math.floor((abs % 3600000) / 60000);
  const s = Math.floor((abs % 60000) / 1000);
  const display = h > 0
    ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    : `${m}:${s.toString().padStart(2, '0')}`;
  const isUrgent = !isOverdue && remaining < 15 * 60 * 1000;
  return { display, isOverdue, isUrgent };
}

function ScheduleCountdownBadge({ scheduledAt }: { scheduledAt: string }) {
  const { display, isOverdue, isUrgent } = useScheduleCountdown(scheduledAt);
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded ${isOverdue ? 'bg-red-100 text-red-600 border border-red-200' : isUrgent ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-blue-50 text-blue-600 border border-blue-200'}`}>
      ⏱ {isOverdue ? `+${display} overdue` : display}
    </span>
  );
}

function carColorStyle(name: string): { bg: string; text: string } {
  const n = name.toLowerCase().trim();
  const map: Record<string, { bg: string; text: string }> = {
    black:   { bg: '#1a1a1a', text: '#ffffff' },
    white:   { bg: '#f5f5f5', text: '#1a1a1a' },
    silver:  { bg: '#c0c0c0', text: '#1a1a1a' },
    gray:    { bg: '#6b7280', text: '#ffffff' },
    grey:    { bg: '#6b7280', text: '#ffffff' },
    red:     { bg: '#dc2626', text: '#ffffff' },
    blue:    { bg: '#2563eb', text: '#ffffff' },
    navy:    { bg: '#1e3a5f', text: '#ffffff' },
    green:   { bg: '#16a34a', text: '#ffffff' },
    yellow:  { bg: '#eab308', text: '#1a1a1a' },
    gold:    { bg: '#d97706', text: '#ffffff' },
    orange:  { bg: '#ea580c', text: '#ffffff' },
    brown:   { bg: '#92400e', text: '#ffffff' },
    beige:   { bg: '#e8dcc8', text: '#1a1a1a' },
    cream:   { bg: '#fffdd0', text: '#1a1a1a' },
    pink:    { bg: '#ec4899', text: '#ffffff' },
    purple:  { bg: '#7c3aed', text: '#ffffff' },
    maroon:  { bg: '#7f1d1d', text: '#ffffff' },
    champagne: { bg: '#f7e7ce', text: '#1a1a1a' },
    bronze:  { bg: '#cd7f32', text: '#ffffff' },
  };
  return map[n] ?? { bg: '#e2e8f0', text: '#1a1a1a' };
}

function sortInHouseTickets(tickets: any[], sortBy: string) {
  const s = [...tickets];
  switch (sortBy) {
    case 'newest':    return s.sort((a,b) => new Date(b.createdAt||0).getTime() - new Date(a.createdAt||0).getTime());
    case 'oldest':    return s.sort((a,b) => new Date(a.createdAt||0).getTime() - new Date(b.createdAt||0).getTime());
    case 'name_az':   return s.sort((a,b) => (a.guestName||'').localeCompare(b.guestName||''));
    case 'name_za':   return s.sort((a,b) => (b.guestName||'').localeCompare(a.guestName||''));
    case 'ticket_asc':  return s.sort((a,b) => (a.ticketNumber||'').localeCompare(b.ticketNumber||''));
    case 'ticket_desc': return s.sort((a,b) => (b.ticketNumber||'').localeCompare(a.ticketNumber||''));
    default: return s;
  }
}

function CarColorBadge({ color }: { color: string }) {
  if (!color) return null;
  const { bg, text } = carColorStyle(color);
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-gray-500 font-medium">Color:</span>
      <span
        className="text-xs font-bold tracking-wide rounded px-2 py-0.5 border"
        style={{ backgroundColor: bg, color: text, borderColor: bg === '#f5f5f5' ? '#d1d5db' : bg }}
      >{color}</span>
    </div>
  );
}

function CompactInHouseCard({ ticket, onRetrieve, onEdit, onView, onDepart, onAutoClose, onCancelAutoClose, canEdit = true, collapsed = false, onToggleCollapse }: {
  ticket: ValetTicket;
  onRetrieve: () => void;
  onEdit: () => void;
  onView: () => void;
  onDepart: () => void;
  onAutoClose: () => void;
  onCancelAutoClose: () => void;
  canEdit?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const { countdownDisplay, isUrgent, isOvernight, dayNumber, totalDisplay } = useParkedTimers(ticket.createdAt);
  const scheduled = (ticket as any).scheduledDepartureAt;
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);
  const [scheduleInput, setScheduleInput] = useState('');
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const queryClient = useQueryClient();

  const fmtScheduled = (dt: string) => {
    const d = new Date(dt);
    return `${d.getMonth()+1}/${d.getDate()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
  };

  return (
    <div className={`rounded-lg p-2 space-y-1 ${isOvernight ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50'}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-regis-navy cursor-pointer select-none" style={{ fontSize: 'var(--panel-card-title-size, 14px)' }} onClick={onToggleCollapse}>#{ticket.ticketNumber}</span>
            <span className={`inline-flex items-center px-1.5 py-0 rounded-full font-bold ${
              ticket.parkingLocation
                ? 'bg-green-100 text-green-700 border border-green-300'
                : 'bg-red-100 text-red-700 border border-red-300'
            }`} style={{ fontSize: 'var(--panel-card-title-size, 14px)' }}>
      
              {ticket.parkingLocation || 'Unassigned'}
            </span>
            {isOvernight && (
              <span className="text-[9px] font-bold text-amber-700 bg-amber-100 border border-amber-300 rounded px-1 leading-tight">
                Day {dayNumber}
              </span>
            )}
            <span className={`text-xs font-mono ${isUrgent ? 'text-red-600 font-bold' : isOvernight ? 'text-amber-600' : 'text-gray-500'}`}>
              {countdownDisplay}
            </span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="font-bold text-regis-navy truncate" style={{ fontSize: 'var(--panel-card-title-size, 14px)' }}>{fmtGuest(ticket.guestName)}</p>
            {ticket.guestPin && (
              <span className="inline-flex items-center gap-0.5 font-mono font-bold text-regis-navy bg-regis-gold/20 border border-regis-gold/50 rounded px-1.5 py-0.5 shrink-0" style={{ fontSize: 'var(--panel-card-title-size, 14px)' }}>
                PIN&nbsp;{ticket.guestPin}
              </span>
            )}
          </div>
          {!collapsed && (
            <>
              <p className="text-[10px] text-blue-600 font-semibold">⏱ {totalDisplay} in parking</p>
              <div className="mt-1 w-fit rounded-md bg-slate-100 border border-slate-300 px-2 py-1.5 space-y-1">
                <p className="text-xs font-extrabold text-slate-800 uppercase tracking-widest leading-none text-center whitespace-nowrap">{ticket.carMake} {ticket.carModel}</p>
                <div className="flex justify-center">
                  {ticket.licensePlate ? (
                    <span className="text-[11px] font-bold tracking-widest text-slate-900 bg-yellow-50 border border-yellow-400 rounded px-1.5 py-0.5 font-mono leading-tight whitespace-nowrap">{ticket.licensePlate}</span>
                  ) : (
                    <span className="text-[10px] text-slate-400 italic">No plate</span>
                  )}
                </div>
              </div>
              <CarColorBadge color={ticket.carColor || ''} />
              {ticket.visitorType && (
                <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                  <span className={`inline-block text-[9px] font-semibold px-1.5 py-0.5 rounded leading-tight border ${
                    ticket.visitorType === 'hotel_guest'
                      ? 'bg-blue-100 text-blue-700 border-blue-300'
                      : ticket.visitorType === 'restaurant'
                        ? 'bg-orange-100 text-orange-700 border-orange-300'
                        : ticket.visitorType === 'event'
                          ? 'bg-purple-100 text-purple-700 border-purple-300'
                          : 'bg-teal-100 text-teal-700 border-teal-300'
                  }`}>
                    {ticket.visitorType === 'hotel_guest'
                      ? 'Hotel Guest'
                      : ticket.visitorType === 'restaurant'
                        ? `Restaurant${ticket.visitorSubType ? ` - ${RESTAURANT_SUB_TYPES[ticket.visitorSubType as keyof typeof RESTAURANT_SUB_TYPES]}` : ''}`
                        : ticket.visitorType === 'event'
                          ? 'Event'
                          : 'Others'}
                  </span>
                  {ticket.visitorType === 'hotel_guest' && !ticket.roomNumber && (
                    <span className="text-[9px] font-semibold text-amber-700 bg-amber-50 border border-amber-300 rounded px-1 leading-tight">Room Pending</span>
                  )}
                  {ticket.roomNumber && (
                    <span className="text-[9px] font-semibold text-gray-600">Rm {ticket.roomNumber}</span>
                  )}
                </div>
              )}
              {scheduled && (
                <div className="flex items-center gap-1 mt-0.5">
                  <p className="text-[10px] text-purple-600 font-semibold">
                    ⏰ Auto-close: {fmtScheduled(scheduled)}
                  </p>
                  <button
                    className="text-[9px] text-red-400 hover:text-red-600 font-semibold border border-red-200 hover:border-red-400 rounded px-1 leading-tight"
                    onClick={onCancelAutoClose}
                  >✕ Cancel</button>
                </div>
              )}
              {ticket.scheduledRetrievalAt && (
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <p className="text-[10px] text-amber-600 font-semibold">
                    🚗 Pickup: {fmtScheduled(ticket.scheduledRetrievalAt as unknown as string)}
                  </p>
                  <ScheduleCountdownBadge scheduledAt={ticket.scheduledRetrievalAt as unknown as string} />
                </div>
              )}
            </>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={onView}>
            <Eye size={14} className="text-gray-500" />
          </Button>
          {canEdit && (
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={onEdit}>
              <Edit size={14} className="text-gray-500" />
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={onToggleCollapse} title={collapsed ? "Expand" : "Collapse"}>
            <ChevronDown size={13} className={`text-gray-400 transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`} />
          </Button>
        </div>
      </div>
      {!collapsed && canEdit && (
        <div className="space-y-1">
          {/* Row 1: Retrieve | Schedule */}
          <div className="flex gap-1">
            <Button
              size="sm"
              className="h-7 flex-1 text-xs bg-regis-gold hover:bg-yellow-600 text-regis-navy font-semibold"
              onClick={onRetrieve}
            >
              <Play size={12} className="mr-1" />Retrieve
            </Button>
            <Button
              size="sm"
              className={`h-7 flex-1 text-xs font-semibold ${ticket.scheduledRetrievalAt ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
              onClick={() => {
                if (ticket.scheduledRetrievalAt) {
                  const d = new Date(ticket.scheduledRetrievalAt as unknown as string);
                  const pad = (n: number) => n.toString().padStart(2, '0');
                  setScheduleInput(`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
                }
                setShowSchedulePicker(v => !v);
              }}
            >
              <CalendarDays size={12} className="mr-1" />Schedule
            </Button>
          </div>
          {/* Row 2: Departed | Auto Close */}
          <div className="flex gap-1">
            <Button
              size="sm"
              className="h-7 flex-1 text-xs bg-red-500 hover:bg-red-600 text-white font-semibold"
              onClick={onDepart}
            >
              <LogOut size={12} className="mr-1" />Departed
            </Button>
            <Button
              size="sm"
              className="h-7 flex-1 text-xs bg-purple-600 hover:bg-purple-700 text-white font-semibold"
              onClick={onAutoClose}
            >
              <Timer size={12} className="mr-1" />Auto Close
            </Button>
          </div>
          {/* Print Ticket */}
          <Button
            size="sm"
            variant="outline"
            className="h-7 w-full text-xs border-regis-navy text-regis-navy hover:bg-regis-navy hover:text-white font-semibold"
            onClick={() => printFullTicket(ticket)}
          >
            <Printer size={12} className="mr-1" />Print Ticket
          </Button>
          {/* Inline schedule picker — shown when Schedule button is toggled */}
          {showSchedulePicker && (
            <div className="bg-blue-50 border border-blue-200 rounded p-1.5 space-y-1">
              <input
                type="datetime-local"
                className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                value={scheduleInput}
                min={new Date().toISOString().slice(0, 16)}
                onChange={e => setScheduleInput(e.target.value)}
              />
              <div className="flex gap-1">
                <Button
                  size="sm"
                  disabled={!scheduleInput || scheduleSaving}
                  className="h-6 flex-1 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={async () => {
                    if (!scheduleInput) return;
                    setScheduleSaving(true);
                    try {
                      const resp = await fetch(`/api/staff/tickets/${ticket.ticketNumber}/schedule-retrieval`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ scheduledAt: new Date(scheduleInput).toISOString() }),
                      });
                      if (!resp.ok) {
                        const err = await resp.json().catch(() => ({}));
                        alert((err as { message?: string }).message ?? 'Failed to schedule');
                        return;
                      }
                      queryClient.invalidateQueries({ queryKey: ["/api/staff/tickets"] });
                      setShowSchedulePicker(false);
                      setScheduleInput('');
                    } catch { alert('Failed to schedule'); }
                    finally { setScheduleSaving(false); }
                  }}
                >
                  {scheduleSaving ? <Loader2 size={10} className="animate-spin" /> : 'Set'}
                </Button>
                {ticket.scheduledRetrievalAt && (
                  <Button
                    size="sm"
                    className="h-6 flex-1 text-xs bg-red-500 hover:bg-red-600 text-white"
                    onClick={async () => {
                      try {
                        await fetch(`/api/staff/tickets/${ticket.ticketNumber}/schedule-retrieval`, { method: 'DELETE' });
                        queryClient.invalidateQueries({ queryKey: ["/api/staff/tickets"] });
                        setShowSchedulePicker(false);
                      } catch { alert('Failed to clear'); }
                    }}
                  >
                    Clear
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-xs"
                  onClick={() => { setShowSchedulePicker(false); setScheduleInput(''); }}
                >
                  ✕
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GuestOutCardFull({ ticket, onBack, onView, canEdit = true }: { ticket: ValetTicket; onBack: () => void; onView: () => void; canEdit?: boolean }) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!ticket.guestDepartedAt) return;
    
    const departedAt = new Date(ticket.guestDepartedAt).getTime();
    const updateTimer = () => {
      setElapsedSeconds(Math.floor((Date.now() - departedAt) / 1000));
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [ticket.guestDepartedAt]);

  const hours = Math.floor(elapsedSeconds / 3600);
  const mins = Math.floor((elapsedSeconds % 3600) / 60);
  const secs = elapsedSeconds % 60;
  const timeDisplay = hours > 0 
    ? `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    : `${mins}:${secs.toString().padStart(2, '0')}`;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 shadow-sm">
      <div className="flex justify-between items-start mb-3">
        <div>
          <p className="font-bold text-regis-navy" style={{ fontSize: 'var(--panel-card-title-size, 14px)' }}>#{ticket.ticketNumber}</p>
          <p className="text-xs text-gray-500">{ticket.carMake} {ticket.carModel} • {ticket.carColor}</p>
        </div>
        <div className="text-right flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <Badge className="bg-blue-600 text-white">Out with Guest</Badge>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 border border-gray-200 bg-white hover:bg-gray-50" onClick={onView}>
              <Eye size={14} className="text-gray-500" />
            </Button>
          </div>
          <p className="text-lg font-mono font-bold text-blue-700">{timeDisplay}</p>
        </div>
      </div>
      <div className="text-sm text-gray-600 mb-3 space-y-1">
        <p style={{ fontSize: 'var(--panel-card-title-size, 14px)' }}><strong>Guest:</strong> {fmtGuest(ticket.guestName)}</p>
        <span className={`inline-flex items-center px-1.5 py-0 rounded-full font-bold ${
          ticket.parkingLocation ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-red-100 text-red-700 border border-red-300'
        }`} style={{ fontSize: 'var(--panel-card-title-size, 14px)' }}>
  
          {ticket.parkingLocation || 'Unassigned'}
        </span>
      </div>
      {canEdit && (
        <Button 
          size="sm" 
          className="w-full bg-green-600 hover:bg-green-700 text-white"
          onClick={onBack}
        >
          Guest is Back
        </Button>
      )}
    </div>
  );
}

// ── Draggable, collapsible dashboard panel ──────────────────────────────────
const DESKTOP_PANELS_DEFAULT = ['in-house', 'retrievals', 'ready', 'guest-out', 'departed-today', 'departed-history'];
const MOBILE_PANELS_DEFAULT  = ['ready', 'retrievals', 'guest-out', 'in-house', 'departed-today', 'departed-history'];

const SECTION_FONT_MIN = 10;
const SECTION_FONT_MAX = 22;
const SECTION_FONT_DEFAULT = 14;

function SortablePanel({
  id, title, icon, badge, borderClass, headerClass, expanded, onToggle, children, wrapCard = true,
  fontSize, onFontSizeChange,
}: {
  id: string; title?: string; icon?: React.ReactNode; badge?: React.ReactNode;
  borderClass?: string; headerClass?: string; expanded?: boolean; onToggle?: () => void;
  children: React.ReactNode; wrapCard?: boolean;
  fontSize?: number; onFontSizeChange?: (size: number) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  const dragHandle = (
    <button
      ref={setActivatorNodeRef} {...attributes} {...listeners}
      onClick={e => e.stopPropagation()}
      className="cursor-grab active:cursor-grabbing touch-none p-1 rounded hover:bg-black/5 flex-shrink-0"
      title="Drag to reorder"
    >
      <GripVertical size={16} className="text-gray-400" />
    </button>
  );

  const fontControls = onFontSizeChange ? (
    <div className="flex items-center gap-0.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
      <button
        onClick={() => onFontSizeChange(Math.max(SECTION_FONT_MIN, (fontSize ?? SECTION_FONT_DEFAULT) - 1))}
        className="w-5 h-5 flex items-center justify-center rounded text-gray-500 hover:bg-gray-100 hover:text-gray-700 font-bold text-sm leading-none select-none"
        title="Decrease text size"
      >−</button>
      <span className="text-[10px] text-gray-400 w-6 text-center tabular-nums">{fontSize ?? SECTION_FONT_DEFAULT}</span>
      <button
        onClick={() => onFontSizeChange(Math.min(SECTION_FONT_MAX, (fontSize ?? SECTION_FONT_DEFAULT) + 1))}
        className="w-5 h-5 flex items-center justify-center rounded text-gray-500 hover:bg-gray-100 hover:text-gray-700 font-bold text-sm leading-none select-none"
        title="Increase text size"
      >+</button>
    </div>
  ) : null;

  if (!wrapCard) {
    return (
      <div ref={setNodeRef} style={style} className="relative">
        <div className="absolute top-4 right-14 z-10">{dragHandle}</div>
        {children}
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={style} id={`panel-${id}`}>
      <Card className={`border-2 ${borderClass || 'border-gray-200'} shadow-sm`}>
        <CardHeader className="p-4 cursor-pointer select-none" onClick={onToggle}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              {dragHandle}
              {icon}
              <span className={`font-semibold text-sm sm:text-base truncate ${headerClass || 'text-regis-navy'}`}>{title}</span>
              {badge}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {fontControls}
              <ChevronDown size={18} className={`text-gray-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
            </div>
          </div>
        </CardHeader>
        {expanded && (
          <CardContent className="p-4 pt-0" style={{ '--panel-card-title-size': `${fontSize ?? SECTION_FONT_DEFAULT}px` } as React.CSSProperties}>
            {children}
          </CardContent>
        )}
      </Card>
    </div>
  );
}

export default function StaffDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Standard User has read-only access - cannot create/edit/delete
  const canEdit = user?.role !== 'standard_user';
  const [editingTicket, setEditingTicket] = useState<ValetTicket | null>(null);
  const [showCarDetails, setShowCarDetails] = useState<string | null>(null);
  const [carFormData, setCarFormData] = useState({
    licensePlate: "",
    parkingLocation: "",
    staffNotes: "",
    carPhoto: "",
  });
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showAddUser, setShowAddUser] = useState(false);
  const [deleteUserTarget, setDeleteUserTarget] = useState<UserType | null>(null);
  const [workingOUId, setWorkingOUId] = useState<string | null>(null);
  const [showOUPicker, setShowOUPicker] = useState(false);
  const [showTicketWizard, setShowTicketWizard] = useState(false);
  const [showVehicleRoster, setShowVehicleRoster] = useState(false);
  const [showGSHub, setShowGSHub] = useState(false);

  const { data: gsOpenCount = 0 } = useQuery<number>({
    queryKey: ["/api/gs/messages/open-count"],
    queryFn: async () => {
      const res = await fetch("/api/gs/messages", { credentials: "include" });
      if (!res.ok) return 0;
      const msgs: { status: string }[] = await res.json();
      return msgs.filter(m => m.status === "open").length;
    },
    refetchInterval: 15000,
  });
  const [rosterTab, setRosterTab] = useState<'arriving' | 'departing' | 'events' | 'others'>('arriving');
  const [rosterDate, setRosterDate] = useState<Date>(new Date());
  const [copiedRowId, setCopiedRowId] = useState<string | null>(null);
  const [rosterNotesPopup, setRosterNotesPopup] = useState<{ ticketNumber: string; notes: string } | null>(null);
  const [newUserData, setNewUserData] = useState({
    email: "",
    firstName: "",
    lastName: "",
    role: "standard",
  });
  
  // Edit user state
  const [editUserData, setEditUserData] = useState<UserType | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  
  // Password change modal state
  const [showPasswordChangeModal, setShowPasswordChangeModal] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  // Reset password state (for Super Admin)
  const [resetPasswordData, setResetPasswordData] = useState({
    newPassword: '',
    confirmPassword: '',
    forceChange: true
  });
  
  // Per-section font size (persisted in localStorage)
  const [sectionFontSize, setSectionFontSize] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem('sectionFontSize') || '{}'); } catch { return {}; }
  });
  const getSectionFontSize = (id: string) => sectionFontSize[id] ?? SECTION_FONT_DEFAULT;
  const setSectionFont = (id: string, size: number) => {
    setSectionFontSize(prev => {
      const next = { ...prev, [id]: size };
      localStorage.setItem('sectionFontSize', JSON.stringify(next));
      return next;
    });
  };

  // Auto Close dialog state
  const [autoCloseTicket, setAutoCloseTicket] = useState<ValetTicket | null>(null);
  const [desktopSchedulingId, setDesktopSchedulingId] = useState<string | null>(null);
  const [desktopScheduleInput, setDesktopScheduleInput] = useState('');
  const [desktopScheduleSaving, setDesktopScheduleSaving] = useState(false);
  const [inHouseCollapsed, setInHouseCollapsed] = useState(false);
  const [inHouseSortBy, setInHouseSortBy] = useState<'newest'|'oldest'|'name_az'|'name_za'|'ticket_asc'|'ticket_desc'>('newest');
  const [autoCloseDate, setAutoCloseDate] = useState('');
  const [autoCloseTime, setAutoCloseTime] = useState('12:00');

  // Schedule alert state — fired by the server 15 minutes before a guest's scheduled pickup
  const [scheduleAlerts, setScheduleAlerts] = useState<Array<{ ticketNumber: string; guestName: string | null; scheduledRetrievalAt: string }>>([]);
  // Schedule picker state inside viewTicket dialog
  const [viewTicketScheduleInput, setViewTicketScheduleInput] = useState('');
  const [viewTicketScheduleSaving, setViewTicketScheduleSaving] = useState(false);

  // Ticket management modals state
  const [viewTicket, setViewTicket] = useState<ValetTicket | null>(null);
  const [editTicketData, setEditTicketData] = useState<ValetTicket | null>(null);
  const [deleteTicket, setDeleteTicket] = useState<ValetTicket | null>(null);
  const [reportPeriod, setReportPeriod] = useState<'day' | 'week' | 'month' | 'year' | 'storage'>('day');
  const [archiveTicket, setArchiveTicket] = useState<ValetTicket | null>(null);

  // License wizard state
  const [licenseWizardOpen, setLicenseWizardOpen] = useState(false);
  const [licenseWizardStep, setLicenseWizardStep] = useState(1);
  const [licenseForm, setLicenseForm] = useState({ ouId: '', orgName: '', address: '', contactNumber: '', version: 'professional', notes: '', validTo: '' });
  const [editLicenseId, setEditLicenseId] = useState<string | null>(null);
  const [brandingForm, setBrandingForm] = useState({ logoUrl: '', primaryColor: '#1a2744', accentColor: '#c9a84c' });
  const [showBranding, setShowBranding] = useState(false);

  // V-info Import dialog state (privilege_admin only)
  const [showVInfoImport, setShowVInfoImport] = useState(false);
  const [vInfoTab, setVInfoTab] = useState<'import'|'manage'>('import');
  const [vInfoStep, setVInfoStep] = useState<1|2>(1);
  const [vInfoVisitorType, setVInfoVisitorType] = useState('');
  const [vInfoMethod, setVInfoMethod] = useState<'csv'|'paste'|null>(null);
  const [vInfoPasteText, setVInfoPasteText] = useState('');
  const [vInfoCsvFile, setVInfoCsvFile] = useState<File|null>(null);
  const [vInfoImportedCount, setVInfoImportedCount] = useState<number|null>(null);

  // Security / Audit state
  const [auditArchiveDate, setAuditArchiveDate] = useState('');
  const [auditViewMode, setAuditViewMode] = useState<'live'|'archive'>('live');

  // Backup state
  const [backupRange, setBackupRange] = useState<'1d'|'7d'|'30d'|'3m'|'6m'|'1y'|'all'>('30d');
  const [backupFormat, setBackupFormat] = useState<'csv'|'json'>('csv');
  const [backupIncludeTickets, setBackupIncludeTickets] = useState(true);
  const [backupIncludeUsers, setBackupIncludeUsers] = useState(false);
  const [backupIncludeLocations, setBackupIncludeLocations] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [pdfRange, setPdfRange] = useState<'1d'|'7d'|'30d'|'3m'|'6m'|'1y'|'all'>('7d');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfIncludeCarPhoto, setPdfIncludeCarPhoto] = useState(false);
  const [pdfIncludePlatePhoto, setPdfIncludePlatePhoto] = useState(false);
  
  // Compact view toggle for mobile
  
  // ── Panel order & collapse state (persisted to localStorage) ──────────────
  const [desktopPanelOrder, setDesktopPanelOrder] = useState<string[]>(() => {
    try {
      const s = localStorage.getItem('valet-desktop-panel-order');
      if (!s) return DESKTOP_PANELS_DEFAULT;
      const stored: string[] = JSON.parse(s);
      // Merge any new panels from default that aren't in the stored order yet
      const missing = DESKTOP_PANELS_DEFAULT.filter(p => !stored.includes(p));
      return missing.length ? [...stored, ...missing] : stored;
    } catch { return DESKTOP_PANELS_DEFAULT; }
  });
  const [mobilePanelOrder, setMobilePanelOrder] = useState<string[]>(() => {
    try {
      const s = localStorage.getItem('valet-mobile-panel-order');
      if (!s) return MOBILE_PANELS_DEFAULT;
      let order: string[] = JSON.parse(s);
      // Migrate: replace old 'departed' with the two new panels
      if (order.includes('departed') && !order.includes('departed-today')) {
        const idx = order.indexOf('departed');
        order = [...order.slice(0, idx), 'departed-today', 'departed-history', ...order.slice(idx + 1)];
      }
      // Ensure any new panels not yet in saved order are appended
      MOBILE_PANELS_DEFAULT.forEach(p => { if (!order.includes(p)) order.push(p); });
      return order;
    } catch { return MOBILE_PANELS_DEFAULT; }
  });
  const [expandedPanels, setExpandedPanels] = useState<Set<string>>(new Set()); // all start collapsed

  // Font size for the 5 mobile status buttons (number + label), persisted
  const [statBtnFontSize, setStatBtnFontSize] = useState<number>(() => {
    try { return Number(localStorage.getItem('valet-stat-btn-font')) || 0; } catch { return 0; }
  });
  const changeStatBtnFont = (delta: number) => {
    setStatBtnFontSize(prev => {
      const next = Math.max(-3, Math.min(5, prev + delta));
      try { localStorage.setItem('valet-stat-btn-font', String(next)); } catch {}
      return next;
    });
  };

  const scrollToPanel = (panelId: string) => {
    setExpandedPanels(prev => { const next = new Set(prev); next.add(panelId); return next; });
    setTimeout(() => {
      const el = document.getElementById(`panel-${panelId}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const togglePanel = (id: string) => {
    const isOpen = expandedPanels.has(id);
    if (!isOpen) {
      // Both mobile + desktop panels share the same id — find the VISIBLE one
      const allEls = Array.from(document.querySelectorAll<HTMLElement>(`[id="panel-${id}"]`));
      const el = allEls.find(e => e.offsetParent !== null) ?? allEls[0];
      if (el) {
        const absoluteTop = el.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({ top: Math.max(0, absoluteTop - 8), behavior: 'smooth' });
      }
    }
    setExpandedPanels(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDesktopDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setDesktopPanelOrder(prev => {
        const next = arrayMove(prev, prev.indexOf(active.id as string), prev.indexOf(over.id as string));
        localStorage.setItem('valet-desktop-panel-order', JSON.stringify(next));
        return next;
      });
    }
  };

  const handleMobileDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setMobilePanelOrder(prev => {
        const next = arrayMove(prev, prev.indexOf(active.id as string), prev.indexOf(over.id as string));
        localStorage.setItem('valet-mobile-panel-order', JSON.stringify(next));
        return next;
      });
    }
  };
  const [historyFilterYear, setHistoryFilterYear] = useState<string>('all');
  const [historyFilterMonth, setHistoryFilterMonth] = useState<string>('all');
  const [historyFilterDay, setHistoryFilterDay] = useState<string>('all');
  const [historySearchExpanded, setHistorySearchExpanded] = useState(false);

  // Retrieval queue notifications
  const [retrievalRequests, setRetrievalRequests] = useState<RetrievalRequest[]>([]);
  
  // WebSocket connection for real-time updates
  const { lastMessage } = useWebSocket();

  const { data: activeTickets, isLoading: ticketsLoading } = useQuery<ValetTicket[]>({
    queryKey: ["/api/staff/tickets"],
    refetchInterval: 20000,
    refetchOnWindowFocus: true,
    staleTime: 10000,
  });

  const { data: stats, isLoading: statsLoading } = useQuery<{
    pending: number;
    transit: number;
    ready: number;
    completed: number;
    avgTime: string;
  }>({
    queryKey: ["/api/staff/stats"],
    refetchInterval: 30000,
    staleTime: 0,
  });

  const { data: allUsers, isLoading: usersLoading } = useQuery<UserType[]>({
    queryKey: ["/api/admin/users"],
    enabled: user?.role === 'superadmin',
  });

  const { data: allTickets, isLoading: allTicketsLoading } = useQuery<ValetTicket[]>({
    queryKey: ["/api/admin/tickets"],
    enabled: user?.role === 'superadmin',
  });

  const { data: allOUs } = useQuery<OrganizationalUnit[]>({
    queryKey: ["/api/ous"],
    enabled: user?.role === 'superadmin' || user?.role === 'privilege_admin',
  });

  // Pre-populate branding form from saved OU data
  useEffect(() => {
    if (user?.role === 'privilege_admin' && allOUs && user?.ouId) {
      const myOU = allOUs.find(o => o.id === user.ouId);
      if (myOU) {
        setBrandingForm({
          logoUrl: myOU.logoUrl ?? '',
          primaryColor: myOU.primaryColor ?? '#1a2744',
          accentColor: myOU.accentColor ?? '#c9a84c',
        });
      }
    }
  }, [allOUs, user?.ouId, user?.role]);

  const { data: allLicenses, isLoading: licensesLoading } = useQuery<OULicense[]>({
    queryKey: ["/api/admin/licenses"],
    enabled: user?.role === 'superadmin',
  });

  const { data: myLicense, isLoading: myLicenseLoading } = useQuery<OULicense | null>({
    queryKey: ["/api/licenses/my"],
    enabled: !!user && user.role !== 'superadmin',
  });

  // Security / Audit queries (privilege_admin only)
  const { data: auditSessions, isLoading: auditLoading, refetch: refetchAudit } = useQuery<any[]>({
    queryKey: ["/api/audit/sessions"],
    enabled: !!user && user.role === 'privilege_admin',
    refetchInterval: 30000,
  });
  const { data: auditArchiveResults, isLoading: auditArchiveLoading } = useQuery<any[]>({
    queryKey: ["/api/audit/sessions/archive", auditArchiveDate],
    queryFn: async () => {
      if (!auditArchiveDate) return [];
      const res = await fetch(`/api/audit/sessions/archive?date=${encodeURIComponent(auditArchiveDate)}`, { credentials: 'include' });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: !!user && (user.role === 'privilege_admin' || user.role === 'superadmin') && auditViewMode === 'archive' && !!auditArchiveDate,
  });
  const { data: auditDates } = useQuery<string[]>({
    queryKey: ["/api/audit/dates"],
    enabled: !!user && user.role === 'privilege_admin',
  });

  const { data: vInfoNameList, isLoading: vInfoListLoading } = useQuery<{ id: string; name: string; visitorType: string; createdAt: string }[]>({
    queryKey: ["/api/name-imports/list"],
    enabled: !!user && user.role === 'privilege_admin' && showVInfoImport && vInfoTab === 'manage',
  });

  const vInfoImportMutation = useMutation({
    mutationFn: async ({ names, visitorType }: { names: string[]; visitorType: string }) => {
      const res = await apiRequest("POST", "/api/name-imports", { names, visitorType });
      return res.json();
    },
    onSuccess: (data: any) => {
      setVInfoImportedCount(data.imported ?? 0);
      queryClient.invalidateQueries({ queryKey: ['/api/name-imports/list'] });
    },
    onError: (e: any) => toast({ title: "Import failed", description: e.message ?? "Could not import names", variant: "destructive" }),
  });

  const vInfoDeleteOneMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/name-imports/${id}`);
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/name-imports/list'] }),
    onError: (e: any) => toast({ title: "Delete failed", description: e.message ?? "Could not delete name", variant: "destructive" }),
  });

  const vInfoDeleteTypeMutation = useMutation({
    mutationFn: async (visitorType: string) => {
      const res = await apiRequest("DELETE", `/api/name-imports/type/${encodeURIComponent(visitorType)}`);
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/name-imports/list'] }),
    onError: (e: any) => toast({ title: "Delete failed", description: e.message ?? "Could not clear names", variant: "destructive" }),
  });

  const issueLicenseMutation = useMutation({
    mutationFn: async (data: typeof licenseForm) => apiRequest("POST", "/api/admin/licenses", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/licenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/licenses/my"] });
      setLicenseWizardOpen(false);
      setLicenseWizardStep(1);
      setLicenseForm({ ouId: '', orgName: '', address: '', contactNumber: '', version: 'professional', notes: '', validTo: '' });
      setEditLicenseId(null);
      toast({ title: "License issued", description: "A new software license has been issued successfully." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message ?? "Failed to issue license", variant: "destructive" }),
  });

  const updateLicenseMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof licenseForm> & { isActive?: boolean } }) =>
      apiRequest("PATCH", `/api/admin/licenses/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/licenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/licenses/my"] });
      setLicenseWizardOpen(false);
      setLicenseWizardStep(1);
      setEditLicenseId(null);
      toast({ title: "License updated", description: "The license has been updated." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message ?? "Failed to update license", variant: "destructive" }),
  });

  const updateBrandingMutation = useMutation({
    mutationFn: async (data: typeof brandingForm) => apiRequest("PATCH", "/api/licenses/branding", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ous"] });
      toast({ title: "Branding saved", description: "Your organization's branding has been updated." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message ?? "Failed to save branding", variant: "destructive" }),
  });

  const rosterNotesMutation = useMutation({
    mutationFn: async ({ ticketNumber, staffNotes, nightCheckDone }: { ticketNumber: string; staffNotes?: string; nightCheckDone?: boolean }) =>
      apiRequest("PATCH", `/api/staff/tickets/${ticketNumber}/roster-notes`, { staffNotes, nightCheckDone }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff/tickets"] });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ ticketNumber, status }: { ticketNumber: string; status: string }) => {
      await apiRequest("PATCH", `/api/staff/tickets/${ticketNumber}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff/tickets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/staff/stats"] });
    },
  });

  const departMutation = useMutation({
    mutationFn: async (ticketNumber: string) => {
      await apiRequest("POST", `/api/staff/tickets/${ticketNumber}/depart`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff/tickets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/staff/stats"] });
      toast({ title: "Departed", description: "Ticket closed — guest has departed." });
    },
    onError: () => toast({ title: "Error", description: "Failed to mark as departed.", variant: "destructive" }),
  });

  const scheduleDepMutation = useMutation({
    mutationFn: async ({ ticketNumber, scheduledDepartureAt }: { ticketNumber: string; scheduledDepartureAt: string }) => {
      await apiRequest("POST", `/api/staff/tickets/${ticketNumber}/schedule-departure`, { scheduledDepartureAt });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff/tickets"] });
      setAutoCloseTicket(null);
      toast({ title: "Auto Close Scheduled", description: "Ticket will close automatically at the chosen time." });
    },
    onError: () => toast({ title: "Error", description: "Failed to schedule departure.", variant: "destructive" }),
  });

  const cancelSchedDepMutation = useMutation({
    mutationFn: async (ticketNumber: string) => {
      await apiRequest("DELETE", `/api/staff/tickets/${ticketNumber}/schedule-departure`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff/tickets"] });
      toast({ title: "Cancelled", description: "Scheduled auto-close removed." });
    },
  });

  const addUserMutation = useMutation({
    mutationFn: async (userData: typeof newUserData) => {
      await apiRequest("POST", "/api/admin/users", userData);
    },
    onSuccess: () => {
      setShowAddUser(false);
      setNewUserData({ email: "", firstName: "", lastName: "", role: "standard" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Success", description: "User added successfully" });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: "Error", description: "Failed to add user", variant: "destructive" });
    },
  });

  // Password change mutation
  const changePasswordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      await apiRequest("POST", "/api/auth/change-password", data);
    },
    onSuccess: () => {
      setShowPasswordChangeModal(false);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "Success", description: "Password changed successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error?.message || "Failed to change password", 
        variant: "destructive" 
      });
    },
  });

  // Reset password mutation (Super Admin)
  const resetPasswordMutation = useMutation({
    mutationFn: async (data: { userId: string; newPassword: string; forceChange: boolean }) => {
      await apiRequest("POST", `/api/admin/users/${data.userId}/reset-password`, {
        newPassword: data.newPassword,
        forceChange: data.forceChange
      });
    },
    onSuccess: () => {
      setResetPasswordData({ newPassword: '', confirmPassword: '', forceChange: true });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Success", description: "Password reset successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error?.message || "Failed to reset password", 
        variant: "destructive" 
      });
    },
  });


  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/users/${id}`);
    },
    onSuccess: () => {
      setDeleteUserTarget(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Account deleted", description: "The user account has been removed." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error?.message || "Failed to delete account.", variant: "destructive" });
    },
  });

  // Check if user must change password on mount
  useEffect(() => {
    if (user?.mustChangePassword) {
      setShowPasswordChangeModal(true);
    }
  }, [user?.mustChangePassword]);

  // Show OU picker on first load for superadmin
  useEffect(() => {
    if (user?.role === 'superadmin' && workingOUId === null && allOUs && allOUs.length > 0) {
      setShowOUPicker(true);
    }
  }, [user?.role, allOUs]);

  // Guest trip history for the currently viewed ticket
  const { data: viewTicketTrips } = useQuery<{ id: string; ticketId: string; departedAt: string; returnedAt: string | null; durationSeconds: number | null; createdAt: string }[]>({
    queryKey: ["/api/staff/tickets", viewTicket?.ticketNumber, "trips"],
    queryFn: async () => {
      if (!viewTicket) return [];
      const res = await fetch(`/api/staff/tickets/${viewTicket.ticketNumber}/trips`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!viewTicket,
  });

  // Update ticket details mutation
  const updateTicketMutation = useMutation({
    mutationFn: async (ticketData: Partial<ValetTicket> & { ticketNumber: string }) => {
      await apiRequest("PATCH", `/api/staff/tickets/${ticketData.ticketNumber}/edit`, ticketData);
    },
    onSuccess: () => {
      setEditTicketData(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tickets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/staff/tickets"] });
      toast({ title: "Success", description: "Ticket updated successfully" });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "Session expired", variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: "Error", description: "Failed to update ticket", variant: "destructive" });
    },
  });

  // Guest returned mutation (when car comes back after "Coming Back")
  const guestReturnedMutation = useMutation({
    mutationFn: async (ticketNumber: string) => {
      await apiRequest("POST", `/api/staff/tickets/${ticketNumber}/guest-returned`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff/tickets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/staff/stats"] });
      toast({ title: "Welcome Back", description: "Guest has returned, car moved to Cars Parked On-Site" });
    },
  });

  // Delete ticket mutation
  const deleteTicketMutation = useMutation({
    mutationFn: async (ticketNumber: string) => {
      await apiRequest("DELETE", `/api/admin/tickets/${ticketNumber}`);
    },
    onSuccess: () => {
      setDeleteTicket(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tickets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/staff/tickets"] });
      toast({ title: "Success", description: "Ticket deleted permanently" });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "Session expired", variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: "Error", description: "Failed to delete ticket", variant: "destructive" });
    },
  });

  // Archive ticket mutation (sets status to 'cancelled')
  const archiveTicketMutation = useMutation({
    mutationFn: async (ticketNumber: string) => {
      await apiRequest("PATCH", `/api/admin/tickets/${ticketNumber}/archive`);
    },
    onSuccess: () => {
      setArchiveTicket(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tickets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/staff/tickets"] });
      toast({ title: "Success", description: "Ticket archived successfully" });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "Session expired", variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: "Error", description: "Failed to archive ticket", variant: "destructive" });
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'retrieving': return <Clock className="text-yellow-600" size={20} />;
      case 'transit': return <Construction className="text-blue-600" size={20} />;
      case 'ready': return <Check className="text-green-600" size={20} />;
      default: return <Clock className="text-gray-600" size={20} />;
    }
  };

  useEffect(() => {
    if (lastMessage) {
      try {
        const data = JSON.parse(lastMessage);
        if (data.type === 'ticket_created' || data.type === 'ticket_status_updated' || data.type === 'status_updated' || data.type === 'retrieval_accepted') {
          queryClient.invalidateQueries({ queryKey: ["/api/staff/tickets"] });
          queryClient.invalidateQueries({ queryKey: ["/api/staff/stats"] });
          // Dismiss schedule alerts globally when the ticket is no longer active
          if (data.type === 'ticket_status_updated' || data.type === 'status_updated') {
            const updatedTicket = data.data;
            if (updatedTicket?.ticketNumber && updatedTicket.status !== 'active') {
              setScheduleAlerts(prev => prev.filter(a => a.ticketNumber !== updatedTicket.ticketNumber));
            }
          }
        }
        if (data.type === 'retrieval_requested') {
          const req: RetrievalRequest = data.data;
          // Show popup only for users in the same OU (or superadmin sees all)
          const isSameOU = user?.role === 'superadmin' || !req.ouId || req.ouId === user?.ouId;
          if (isSameOU) {
            setRetrievalRequests(prev => {
              if (prev.some(r => r.ticketNumber === req.ticketNumber)) return prev;
              return [...prev, req];
            });
          }
        }
        if (data.type === 'retrieval_accepted') {
          const ticket = data.data;
          setRetrievalRequests(prev => prev.filter(r => r.ticketNumber !== ticket?.ticketNumber));
        }
        if (data.type === 'retrieval_cancelled') {
          const cancelled = data.data;
          setRetrievalRequests(prev => prev.filter(r => r.ticketNumber !== cancelled?.ticketNumber));
          queryClient.invalidateQueries({ queryKey: ["/api/staff/tickets"] });
        }
        if (data.type === 'ticket_scheduled') {
          queryClient.invalidateQueries({ queryKey: ["/api/staff/tickets"] });
          queryClient.invalidateQueries({ queryKey: ["/api/staff/stats"] });
          const d = data.data;
          if (d?.scheduledAt) {
            toast({
              title: 'Retrieval Scheduled',
              description: `Ticket #${d.ticketNumber}${d.guestName ? ` (${d.guestName})` : ''} scheduled for ${new Date(d.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
            });
          }
        }
        if (data.type === 'schedule_alert') {
          const d = data.data;
          const isSameOU = user?.role === 'superadmin' || !d?.ouId || d.ouId === user?.ouId;
          if (isSameOU && d?.ticketNumber) {
            setScheduleAlerts(prev => {
              if (prev.some(a => a.ticketNumber === d.ticketNumber)) return prev;
              return [...prev, { ticketNumber: d.ticketNumber, guestName: d.guestName, scheduledRetrievalAt: (d.scheduledAt ?? d.scheduledRetrievalAt) as string }];
            });
            // Play notification sound
            try {
              const ctx = new AudioContext();
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.type = 'sine';
              osc.frequency.setValueAtTime(880, ctx.currentTime);
              osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3);
              gain.gain.setValueAtTime(0.4, ctx.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
              osc.start(ctx.currentTime);
              osc.stop(ctx.currentTime + 0.5);
            } catch {}
          }
        }
        if (['gs_message', 'gs_reply', 'gs_event_created', 'gs_event_updated', 'gs_event_deleted', 'gs_acknowledged', 'gs_member_added', 'gs_member_removed'].includes(data.type)) {
          queryClient.invalidateQueries({ queryKey: ["/api/gs/messages"] });
          queryClient.invalidateQueries({ queryKey: ["/api/calendar/events"] });
          queryClient.invalidateQueries({ queryKey: ["/api/gs/members/me"] });
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    }
  }, [lastMessage, queryClient, user]);

  // Reconcile popup with polled data — shows popup for any retrieval_requested ticket
  // even if the WS event was missed (e.g. page was loading when request arrived)
  useEffect(() => {
    if (!activeTickets) return;
    const pendingSet = new Set(
      activeTickets.filter(t => t.status === 'retrieval_requested').map(t => t.ticketNumber)
    );

    // Add any pending tickets not yet in the popup queue
    const missing = activeTickets.filter(
      t => t.status === 'retrieval_requested'
    );
    if (missing.length > 0) {
      setRetrievalRequests(prev => {
        const next = [...prev];
        missing.forEach(t => {
          if (!next.some(r => r.ticketNumber === t.ticketNumber)) {
            const isSameOU = user?.role === 'superadmin' || !t.ouId || t.ouId === user?.ouId;
            if (isSameOU) {
              next.push({
                ticketNumber: t.ticketNumber,
                guestName: t.guestName,
                carMake: t.carMake,
                carModel: t.carModel,
                carColor: t.carColor,
                licensePlate: t.licensePlate,
                visitorType: t.visitorType,
                visitorSubType: t.visitorSubType,
                ouId: t.ouId,
                locationId: t.locationId,
                parkingLocation: t.parkingLocation,
                parkingSector: t.parkingSector,
              });
            }
          }
        });
        return next;
      });
    }

    // Remove from queue any tickets no longer retrieval_requested (cancelled/accepted by another staff)
    setRetrievalRequests(prev => prev.filter(r => pendingSet.has(r.ticketNumber)));
  }, [activeTickets, user]);

  const acceptRetrievalMutation = useMutation({
    mutationFn: async (ticketNumber: string) => {
      await apiRequest("POST", `/api/tickets/${ticketNumber}/accept-retrieval`);
    },
    onSuccess: (_, ticketNumber) => {
      setRetrievalRequests(prev => prev.filter(r => r.ticketNumber !== ticketNumber));
      queryClient.invalidateQueries({ queryKey: ["/api/staff/tickets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/staff/stats"] });
      toast({ title: "Retrieval Accepted", description: "You have accepted the car retrieval. Process started." });
    },
    onError: (error: any) => {
      const msg = error?.message || "Failed to accept retrieval. It may have already been accepted.";
      toast({ title: "Could Not Accept", description: msg, variant: "destructive" });
      // Remove from queue anyway — another staff member may have accepted it
      setRetrievalRequests([]);
      queryClient.invalidateQueries({ queryKey: ["/api/staff/tickets"] });
    },
  });

  const BACKUP_RANGE_LABELS: Record<string, string> = {
    '1d': 'Today', '7d': 'Last 7 days', '30d': 'Last 30 days',
    '3m': 'Last 3 months', '6m': 'Last 6 months', '1y': 'Last year', 'all': 'All time',
  };

  function toCSVBackup(rows: Record<string, any>[]): string {
    if (!rows.length) return '';
    const keys = Object.keys(rows[0]);
    const header = keys.join(',');
    const body = rows.map(r =>
      keys.map(k => { const v = r[k] ?? ''; return `"${String(v).replace(/"/g, '""')}"`; }).join(',')
    );
    return [header, ...body].join('\n');
  }

  function triggerDownloadBackup(content: string, filename: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  async function handleFullExport() {
    if (!backupIncludeTickets && !backupIncludeUsers && !backupIncludeLocations) {
      toast({ title: 'Nothing selected', description: 'Select at least one data type to export.', variant: 'destructive' }); return;
    }
    setBackupLoading(true);
    try {
      const params = new URLSearchParams({
        range: backupRange,
        includeTickets: String(backupIncludeTickets),
        includeUsers: String(backupIncludeUsers),
        includeLocations: String(backupIncludeLocations),
      });
      const res = await fetch(`/api/backup/export?${params}`);
      if (!res.ok) throw new Error('Export failed');
      const data = await res.json();
      const stamp = new Date().toISOString().slice(0,10);
      if (backupFormat === 'json') {
        triggerDownloadBackup(JSON.stringify(data, null, 2), `backup_${stamp}.json`, 'application/json');
      } else {
        const parts: string[] = [];
        if (data.tickets?.length)   parts.push(`=== TICKETS ===\n${toCSVBackup(data.tickets)}`);
        if (data.users?.length)     parts.push(`=== USERS ===\n${toCSVBackup(data.users)}`);
        if (data.locations?.length) parts.push(`=== LOCATIONS ===\n${toCSVBackup(data.locations)}`);
        triggerDownloadBackup(parts.join('\n\n'), `backup_${stamp}.csv`, 'text/csv');
      }
      toast({ title: 'Export complete', description: `Downloaded as ${backupFormat.toUpperCase()}.` });
    } catch (e) {
      toast({ title: 'Export failed', description: 'Could not generate export. Try again.', variant: 'destructive' });
    } finally {
      setBackupLoading(false);
    }
  }

  async function handlePdfExport() {
    setPdfLoading(true);
    try {
      const params = new URLSearchParams({ range: pdfRange, includeTickets: 'true', includeUsers: 'false', includeLocations: 'false' });
      const res = await fetch(`/api/backup/export?${params}`);
      if (!res.ok) throw new Error('Export failed');
      const data = await res.json();
      const departed: any[] = (data.tickets || []).filter((t: any) => t.status === 'completed');

      const doc = await PDFDocument.create();

      // Try to fetch Noto Sans CJK JP for proper Japanese character support
      let jpFont: PDFFont | null = null;
      try {
        const fontResp = await fetch(
          'https://cdn.jsdelivr.net/npm/noto-sans-japanese@1.0.0/fonts/NotoSansJP-Regular.otf'
        );
        if (fontResp.ok) {
          jpFont = await doc.embedFont(await fontResp.arrayBuffer());
        }
      } catch (e) {
        console.warn('[PDF] Japanese font unavailable, falling back to Helvetica');
      }

      // Use JP font for all text when available (it includes Latin too); else strip non-Latin
      const sanitize = (s: string) => {
        const clean = (s || '-').replace(/\u2014/g, '-').replace(/\u2013/g, '-').replace(/\u2012/g, '-');
        return jpFont ? clean : clean.replace(/[^\x20-\x7E\xA0-\xFF]/g, '?');
      };

      const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
      const font = await doc.embedFont(StandardFonts.Helvetica);
      // Primary text font: JP-capable when available, else Helvetica
      const textFont: PDFFont = jpFont ?? font;
      const W = 595, H = 842, M = 40;
      let page = doc.addPage([W, H]);
      let y = H - M;
      const stamp = new Date().toISOString().slice(0,10);

      page.drawText('Departed History Report', { x: M, y, font: fontBold, size: 18, color: rgb(0.1,0.1,0.1) });
      y -= 22;
      page.drawText(`Range: ${BACKUP_RANGE_LABELS[pdfRange]}   |   Generated: ${stamp}   |   Total: ${departed.length} records`, { x: M, y, font, size: 10, color: rgb(0.45,0.45,0.45) });
      y -= 18;
      page.drawRectangle({ x: M, y, width: W - M*2, height: 1, color: rgb(0.8,0.7,0.2) });
      y -= 16;

      if (departed.length === 0) {
        page.drawText('No departed tickets found for the selected period.', { x: M, y, font, size: 12, color: rgb(0.5,0.5,0.5) });
      }

      // Fetch image bytes — uses proxy for object storage paths, direct fetch for data: URLs
      const fetchPhotoBytes = async (photoPath: string): Promise<Uint8Array | null> => {
        try {
          const url = photoPath.startsWith('data:')
            ? photoPath
            : `/api/backup/photo?path=${encodeURIComponent(photoPath)}`;
          const r = await fetch(url);
          if (!r.ok) return null;
          return new Uint8Array(await r.arrayBuffer());
        } catch { return null; }
      };
      const tryEmbedPhoto = async (bytes: Uint8Array) => {
        try { return await doc.embedJpg(bytes); } catch {}
        try { return await doc.embedPng(bytes); } catch {}
        return null;
      };

      for (const t of departed) {
        const hasCarPhoto = pdfIncludeCarPhoto && !!t.carPhoto;
        const hasPlatePhoto = pdfIncludePlatePhoto && !!t.platePhotoUrl;
        const hasAnyPhoto = hasCarPhoto || hasPlatePhoto;
        const neededHeight = 50 + (hasAnyPhoto ? 130 : 0);
        if (y < 60 + neededHeight) { page = doc.addPage([W, H]); y = H - M; }

        const car = sanitize(`${t.carColor || ''} ${t.carMake || ''} ${t.carModel || ''}`.trim() || '-');
        const plate = sanitize(t.licensePlate || '-');
        const checkedIn = t.createdAt ? new Date(t.createdAt).toLocaleString('en-GB', { hour12: false }) : '-';
        const departedStr = t.departedAt ? new Date(t.departedAt).toLocaleString('en-GB', { hour12: false }) : '-';
        const stay = t.totalStaySeconds ? `${Math.floor(t.totalStaySeconds/3600)}h ${Math.floor((t.totalStaySeconds%3600)/60)}m` : '-';
        const subTypeLabel = t.visitorSubType
          ? RESTAURANT_SUB_TYPES[t.visitorSubType as keyof typeof RESTAURANT_SUB_TYPES]
          : null;
        const visitor = t.visitorType === 'hotel_guest'
          ? 'Hotel Staying Guest'
          : t.visitorType === 'restaurant'
            ? subTypeLabel ? `Restaurant - ${subTypeLabel}` : 'Restaurant'
            : t.visitorType === 'event' ? 'Event' : 'Others';
        const guestName = sanitize(t.guestName || '-');

        page.drawText(`#${t.ticketNumber}`, { x: M, y, font: fontBold, size: 11, color: rgb(0.15,0.15,0.15) });
        page.drawText(guestName, { x: M + 54, y, font: textFont, size: 11, color: rgb(0.15,0.15,0.15) });
        page.drawText(visitor, { x: W - M - 120, y, font: textFont, size: 9, color: rgb(0.5,0.5,0.5) });
        y -= 14;
        page.drawText(car, { x: M + 10, y, font: textFont, size: 9, color: rgb(0.3,0.3,0.3) });
        page.drawText(`Plate: ${plate}`, { x: M + 220, y, font: textFont, size: 9, color: rgb(0.3,0.3,0.3) });
        page.drawText(`Stay: ${stay}`, { x: W - M - 80, y, font: textFont, size: 9, color: rgb(0.3,0.3,0.3) });
        y -= 12;
        page.drawText(`In: ${checkedIn}`, { x: M + 10, y, font, size: 8, color: rgb(0.5,0.5,0.5) });
        page.drawText(`Out: ${departedStr}`, { x: M + 200, y, font, size: 8, color: rgb(0.5,0.5,0.5) });
        y -= 12;

        if (hasAnyPhoto) {
          let photoRowH = 0;
          let xOff = M + 10;

          // Car photo (full vehicle shot)
          if (hasCarPhoto) {
            const bytes = await fetchPhotoBytes(t.carPhoto);
            if (bytes) {
              const img = await tryEmbedPhoto(bytes);
              if (img) {
                const iW = 160, iH = 120;
                page.drawImage(img, { x: xOff, y: y - iH, width: iW, height: iH });
                photoRowH = Math.max(photoRowH, iH);
                xOff += iW + 8;
              }
            }
          }

          // Plate photo (cropped plate image, typically wide/short)
          if (hasPlatePhoto) {
            const bytes = await fetchPhotoBytes(t.platePhotoUrl);
            if (bytes) {
              const img = await tryEmbedPhoto(bytes);
              if (img) {
                const iW = 170, iH = 60;
                page.drawImage(img, { x: xOff, y: y - iH, width: iW, height: iH });
                photoRowH = Math.max(photoRowH, iH);
              }
            }
          }

          if (photoRowH > 0) y -= (photoRowH + 8);
        }

        page.drawRectangle({ x: M, y, width: W - M*2, height: 0.5, color: rgb(0.88,0.88,0.88) });
        y -= 12;
      }

      const bytes = await doc.save();
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `departed_history_${stamp}.pdf`; a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'PDF ready', description: `${departed.length} departed tickets exported.` });
    } catch (e: any) {
      toast({ title: 'PDF failed', description: e?.message || 'Could not generate PDF. Try again.', variant: 'destructive' });
    } finally {
      setPdfLoading(false);
    }
  }

  // Sync schedule picker input when viewTicket opens or changes
  useEffect(() => {
    if (viewTicket?.scheduledRetrievalAt) {
      setViewTicketScheduleInput(toDatetimeLocal(new Date(viewTicket.scheduledRetrievalAt as unknown as string)));
    } else {
      setViewTicketScheduleInput('');
    }
  }, [viewTicket?.ticketNumber, viewTicket?.scheduledRetrievalAt]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Retrieval request popup — shown to all staff in the OU */}
      <RetrievalNotificationPopup
        requests={retrievalRequests}
        onAccept={(ticketNumber) => acceptRetrievalMutation.mutate(ticketNumber)}
        onDismiss={(ticketNumber) =>
          setRetrievalRequests(prev => prev.filter(r => r.ticketNumber !== ticketNumber))
        }
      />

      {/* 15-minute pre-alert popups — one card per scheduled pickup, only closeable by starting retrieval */}
      {scheduleAlerts.length > 0 && (
        <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full">
          {scheduleAlerts.map(alert => (
            <div key={alert.ticketNumber} className="bg-white border-2 border-amber-400 rounded-xl shadow-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <Clock className="text-amber-600" size={18} />
                </div>
                <div>
                  <p className="font-bold text-sm text-regis-navy">Pickup in ~15 min</p>
                  <p className="text-xs text-gray-500">Ticket #{alert.ticketNumber}</p>
                </div>
              </div>
              {alert.guestName && (
                <p className="text-sm text-gray-700 mb-1 font-medium">{fmtGuest(alert.guestName)}</p>
              )}
              <p className="text-xs text-amber-700 mb-3">
                Scheduled: {new Date(alert.scheduledRetrievalAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
              <Button
                size="sm"
                className="w-full bg-regis-navy text-white hover:bg-regis-navy/90 text-xs"
                onClick={async () => {
                  try {
                    const startResp = await fetch(`/api/staff/tickets/${alert.ticketNumber}/status`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ status: 'retrieving' }),
                    });
                    if (!startResp.ok) {
                      const err = await startResp.json().catch(() => ({}));
                      toast({ title: 'Failed to start retrieval', description: (err as { message?: string }).message ?? `Error ${startResp.status}`, variant: 'destructive' });
                      return;
                    }
                    setScheduleAlerts(prev => prev.filter(a => a.ticketNumber !== alert.ticketNumber));
                    queryClient.invalidateQueries({ queryKey: ["/api/staff/tickets"] });
                    toast({ title: 'Retrieval started', description: `Ticket #${alert.ticketNumber}` });
                  } catch {
                    toast({ title: 'Failed to start retrieval', variant: 'destructive' });
                  }
                }}
              >
                <Car size={12} className="mr-1" />
                Start Retrieval
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="border-b bg-white">
        <div className="px-3 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
            <Crown className="text-regis-navy flex-shrink-0" size={20} />
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-bold text-regis-navy truncate">Dashboard</h1>
              <p className="text-xs sm:text-sm text-gray-600 truncate">The St. Regis Osaka</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Link href="/">
              <Button
                variant="outline"
                size="sm"
                className="text-regis-navy border-regis-navy hover:bg-regis-navy hover:text-white px-2 sm:px-3"
                data-testid="button-back-home"
              >
                <Home size={16} />
                <span className="hidden sm:inline ml-2">Home</span>
              </Button>
            </Link>
            <a href="/api/logout">
              <Button
                variant="outline"
                size="sm"
                className="text-regis-navy border-regis-navy hover:bg-regis-navy hover:text-white px-2 sm:px-3"
              >
                <LogOut size={16} />
                <span className="hidden sm:inline ml-2">Logout</span>
              </Button>
            </a>
          </div>
        </div>
        {/* Full-width banner — desktop only, white padding clipped */}
        <div className="hidden sm:block w-full overflow-hidden">
          <img
            src={valetBanner6}
            alt="Valet-S"
            className="w-full h-auto block"
            style={{ marginTop: '-18%', marginBottom: '-18%' }}
          />
        </div>
      </div>

      <div className="p-3 sm:p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
          <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
            <TabsList className={`inline-flex w-auto min-w-full sm:grid sm:w-full ${user?.role === 'superadmin' ? 'sm:grid-cols-7' : user?.role === 'privilege_admin' ? 'sm:grid-cols-5' : 'sm:grid-cols-3'}`}>
              <TabsTrigger value="dashboard" className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 text-xs sm:text-sm whitespace-nowrap">
                <Car size={14} className="sm:w-4 sm:h-4" />
                <span>Dashboard</span>
              </TabsTrigger>
              {user?.role === 'superadmin' && (
                <TabsTrigger value="users" className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 text-xs sm:text-sm whitespace-nowrap">
                  <Users size={14} className="sm:w-4 sm:h-4" />
                  <span>Users</span>
                </TabsTrigger>
              )}
              {user?.role === 'superadmin' && (
                <TabsTrigger value="tickets" className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 text-xs sm:text-sm whitespace-nowrap">
                  <TicketIcon size={14} className="sm:w-4 sm:h-4" />
                  <span>Tickets</span>
                </TabsTrigger>
              )}
              {(user?.role === 'superadmin' || user?.role === 'privilege_admin') && (
                <TabsTrigger value="reports" className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 text-xs sm:text-sm whitespace-nowrap">
                  <BarChart2 size={14} className="sm:w-4 sm:h-4" />
                  <span>Reports</span>
                </TabsTrigger>
              )}
              {(user?.role === 'superadmin' || user?.role === 'privilege_admin') && (
                <TabsTrigger value="backup" className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 text-xs sm:text-sm whitespace-nowrap">
                  <Database size={14} className="sm:w-4 sm:h-4" />
                  <span>Backup</span>
                </TabsTrigger>
              )}
              {user?.role === 'privilege_admin' && (
                <TabsTrigger value="security" className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 text-xs sm:text-sm whitespace-nowrap">
                  <Activity size={14} className="sm:w-4 sm:h-4" />
                  <span>Audit</span>
                </TabsTrigger>
              )}
              <TabsTrigger value="license" className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 text-xs sm:text-sm whitespace-nowrap">
                <ShieldCheck size={14} className="sm:w-4 sm:h-4" />
                <span>License</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-4 sm:space-y-6">
            {/* ── Persistent Retrieval Requests Banner (poll-based, never missed) ── */}
            {(() => {
              const pendingRetrievals = activeTickets?.filter(t => t.status === 'retrieval_requested') ?? [];
              if (pendingRetrievals.length === 0) return null;
              return (
                <div className="space-y-2">
                  {pendingRetrievals.map(ticket => (
                    <div key={ticket.ticketNumber} className="flex items-center gap-3 bg-regis-gold/10 border-2 border-regis-gold rounded-xl px-4 py-3 animate-pulse">
                      <div className="w-9 h-9 bg-regis-gold rounded-full flex items-center justify-center flex-shrink-0">
                        <Car className="text-regis-navy" size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-regis-navy text-sm">
                          Car Retrieval Requested — #{ticket.ticketNumber}
                        </p>
                        <p className="text-xs text-gray-600 truncate">
                          {fmtGuest(ticket.guestName)} · {ticket.carColor} {ticket.carMake} {ticket.carModel}
                          {ticket.licensePlate ? ` · ${ticket.licensePlate}` : ''}
                          {ticket.parkingSector || ticket.parkingLocation ? ` · Parking: ${[ticket.parkingSector, ticket.parkingLocation].filter(Boolean).join('-')}` : ''}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        className="bg-regis-gold hover:bg-yellow-600 text-regis-navy font-bold flex-shrink-0"
                        onClick={() => acceptRetrievalMutation.mutate(ticket.ticketNumber)}
                        disabled={acceptRetrievalMutation.isPending}
                      >
                        Accept
                      </Button>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Header with New Ticket Button + Vehicle Roster Toggle */}
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                className="border-regis-navy text-regis-navy hover:bg-regis-navy/10"
                onClick={() => { setShowVehicleRoster(false); setShowGSHub(false); }}
              >
                <Home size={16} className="mr-1 sm:mr-2" />
                Home
              </Button>
              {canEdit && (
                <Button 
                  onClick={() => setShowTicketWizard(true)}
                  size="sm"
                  className="bg-regis-gold hover:bg-yellow-600 text-regis-navy font-semibold"
                  data-testid="button-new-valet-ticket"
                >
                  <Plus size={16} className="mr-1 sm:mr-2" />
                  New Valet Ticket
                </Button>
              )}
              {canEdit && (
                <Button
                  size="sm"
                  variant={showVehicleRoster ? "default" : "outline"}
                  className={showVehicleRoster ? "bg-regis-navy text-white hover:bg-regis-navy/90" : "border-regis-navy text-regis-navy hover:bg-regis-navy/10"}
                  onClick={() => { setShowVehicleRoster(v => !v); setShowGSHub(false); }}
                >
                  <List size={16} className="mr-1 sm:mr-2" />
                  Vehicle Roster
                </Button>
              )}
              <Button
                size="sm"
                variant={showGSHub ? "default" : "outline"}
                className={`relative ${showGSHub ? "bg-regis-gold text-regis-navy hover:bg-regis-gold/90 font-semibold" : "border-regis-gold text-regis-navy hover:bg-regis-gold/10"}`}
                onClick={() => { setShowGSHub(v => !v); setShowVehicleRoster(false); }}
              >
                <MessageSquare size={16} className="mr-1 sm:mr-2" />
                GS Hub
                {gsOpenCount > 0 && !showGSHub && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
                    {gsOpenCount > 99 ? "99+" : gsOpenCount}
                  </span>
                )}
              </Button>
              {user?.role === 'privilege_admin' && (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-blue-600 text-blue-700 hover:bg-blue-50"
                  onClick={() => { setShowVInfoImport(true); setVInfoStep(1); setVInfoVisitorType(''); setVInfoMethod(null); setVInfoPasteText(''); setVInfoCsvFile(null); setVInfoImportedCount(null); }}
                >
                  <FileText size={16} className="mr-1 sm:mr-2" />
                  V-info Import
                </Button>
              )}
            </div>

            {/* Vehicle Roster Panel */}
            {showVehicleRoster && canEdit && (() => {
              const allTickets = activeTickets || [];
              const selDateStr = rosterDate.toDateString(); // e.g. "Thu May 08 2026"
              const fmtDateDisplay = (d: Date) =>
                `${d.getFullYear()}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getDate().toString().padStart(2,'0')}`;
              const isToday = rosterDate.toDateString() === new Date().toDateString();
              const prevDay = () => { const d = new Date(rosterDate); d.setDate(d.getDate()-1); setRosterDate(d); };
              const nextDay = () => { const d = new Date(rosterDate); d.setDate(d.getDate()+1); setRosterDate(d); };

              // Date-based filtering per tab
              // Arriving: hotel guests who arrived on selected date.
              // For TODAY also include any active hotel guests still in-house from a previous day.
              const arrivingTickets = (() => {
                const byId = new Map<string, ValetTicket>();
                allTickets
                  .filter(t => t.visitorType === 'hotel_guest' && new Date(t.createdAt!).toDateString() === selDateStr)
                  .forEach(t => byId.set(t.id, t));
                if (isToday) {
                  allTickets
                    .filter(t => t.visitorType === 'hotel_guest' && t.status === 'active')
                    .forEach(t => byId.set(t.id, t));
                }
                return Array.from(byId.values())
                  .sort((a, b) => new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime());
              })();
              const departingTickets = allTickets
                .filter(t => t.visitorType === 'hotel_guest' && t.status === 'completed' && t.departedAt && new Date(t.departedAt).toDateString() === selDateStr)
                .sort((a, b) => new Date(a.departedAt!).getTime() - new Date(b.departedAt!).getTime());
              const eventsTickets = allTickets
                .filter(t => ['restaurant', 'event'].includes(t.visitorType || '') && new Date(t.createdAt!).toDateString() === selDateStr)
                .sort((a, b) => new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime());
              const othersTickets = allTickets
                .filter(t => t.visitorType === 'others' && new Date(t.createdAt!).toDateString() === selDateStr)
                .sort((a, b) => new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime());

              const tabDefs: { key: 'arriving' | 'departing' | 'events' | 'others'; label: string; sublabel: string; tickets: typeof arrivingTickets }[] = [
                { key: 'arriving',  label: 'Cars Arriving Today & Staying Cars',  sublabel: 'ARRIVAL',   tickets: arrivingTickets },
                { key: 'departing', label: 'Departed Cars Today', sublabel: 'DEPARTURE', tickets: departingTickets },
                { key: 'events',    label: 'Restaurants & Events',     sublabel: 'R&E',       tickets: eventsTickets },
                { key: 'others',    label: 'Others',                   sublabel: 'OTHERS',    tickets: othersTickets },
              ];
              const rosterTickets = tabDefs.find(t => t.key === rosterTab)?.tickets ?? [];
              const todayStr = fmtDateDisplay(rosterDate);
              const fmtRosterDate = (dt: Date | string | null | undefined) => {
                if (!dt) return '';
                const d = new Date(dt);
                const dd = d.getDate().toString().padStart(2, '0');
                const mm = (d.getMonth() + 1).toString().padStart(2, '0');
                const yy = d.getFullYear().toString().slice(2);
                return `${dd}/${mm}/${yy}`;
              };
              const fmtTime = (dt: Date | string | null | undefined) => {
                if (!dt) return '';
                const d = new Date(dt);
                return `${d.getHours()}:${d.getMinutes().toString().padStart(2,'0')}`;
              };
              const ColorDisplay = ({ color }: { color: string }) => {
                return (
                  <span className="text-xs whitespace-nowrap">
                    <span className="text-gray-400">色</span>
                    {color
                      ? <span className="font-bold text-regis-navy ml-1">（{color}）</span>
                      : <span className="text-gray-300">（　）</span>
                    }
                  </span>
                );
              };
              // 備考 split cell — top: NOTES popup, bottom: NC Done toggle (hidden for R&E and Others tabs)
              const todayDateStr = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
              const showNC = rosterTab !== 'events' && rosterTab !== 'others' && rosterTab !== 'departing';
              const BikouCell = ({ ticket }: { ticket: ValetTicket }) => {
                const hasNotes = !!(ticket.staffNotes && ticket.staffNotes.trim());
                const ncDone = (ticket as any).nightCheckDone === todayDateStr;
                return (
                  <div className="flex flex-col h-full" style={{ minHeight: 54 }}>
                    {/* Top half — NOTES */}
                    <button
                      onClick={() => setRosterNotesPopup({ ticketNumber: ticket.ticketNumber, notes: ticket.staffNotes || '' })}
                      className={`flex-1 w-full flex items-center justify-center text-[10px] font-bold transition-colors ${showNC ? 'border-b border-black' : ''} ${
                        hasNotes
                          ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                          : 'bg-white text-gray-400 hover:bg-gray-50'
                      }`}
                      title={hasNotes ? ticket.staffNotes! : 'Add notes'}
                    >
                      NOTES
                    </button>
                    {/* Bottom half — NC Done (hotel guests only) */}
                    {showNC && (
                      <button
                        onClick={() => rosterNotesMutation.mutate({ ticketNumber: ticket.ticketNumber, nightCheckDone: !ncDone })}
                        className={`flex-1 w-full flex items-center justify-center text-[10px] font-bold transition-colors ${
                          ncDone
                            ? 'bg-green-500 text-white hover:bg-green-600'
                            : 'bg-red-500 text-white hover:bg-red-600'
                        }`}
                      >
                        {ncDone ? 'NC Done' : 'NC Pending'}
                      </button>
                    )}
                  </div>
                );
              };

              const buildRowText = (ticket: ValetTicket, index: number) => [
                `${index + 1}.`,
                `#${ticket.ticketNumber}`,
                `${fmtGuest(ticket.guestName)}`,
                ticket.roomNumber ? `Rm${ticket.roomNumber}` : '',
                `${ticket.carMake} ${ticket.carModel}`,
                ticket.carColor ? `(${ticket.carColor})` : '',
                ticket.licensePlate || '',
                `C/IN ${fmtRosterDate(ticket.createdAt)} ${fmtTime(ticket.createdAt)}`,
                ticket.status === 'completed' ? `C/OUT ${fmtRosterDate(ticket.departedAt)} ${fmtTime(ticket.departedAt)}` : '',
                ticket.parkingLocation || '',
              ].filter(Boolean).join('  ');

              const handleCopyRow = (ticket: ValetTicket, index: number) => {
                navigator.clipboard.writeText(buildRowText(ticket, index)).then(() => {
                  setCopiedRowId(ticket.id);
                  setTimeout(() => setCopiedRowId(prev => prev === ticket.id ? null : prev), 2000);
                });
              };

              const RosterTable = ({ tickets, pageNum = 1, totalPages = 1 }: { tickets: ValetTicket[]; pageNum?: number; totalPages?: number }) => (
                <div>
                  {/* Title bar */}
                  <div className="border border-black flex items-center justify-between px-4 py-2 bg-white">
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-semibold text-gray-500 border-r border-black pr-4">Page {pageNum}{totalPages > 1 ? ` / ${totalPages}` : ''}</span>
                      <h2 className="text-lg font-bold tracking-[0.2em]">VALET PARKING LIST</h2>
                    </div>
                    <div className="flex items-center gap-6 text-sm font-semibold">
                      <span className="border-l border-black pl-4">{tabDefs.find(t => t.key === rosterTab)?.sublabel}</span>
                      <span>DATE: {todayStr}</span>
                    </div>
                  </div>
                  {/* Table */}
                  <table className="w-full border-collapse border border-black" style={{fontSize: 13, fontFamily: 'sans-serif'}}>
                    <thead>
                      <tr className="bg-gray-100">
                        <th rowSpan={2} className="border border-black px-1 py-1 text-center align-middle w-12" style={{writingMode: 'vertical-rl', letterSpacing: '0.15em', fontSize: 11}}>コピー</th>
                        <th rowSpan={2} className="border border-black px-1 py-1 text-center align-middle w-8 text-[11px]">No.</th>
                        <th rowSpan={2} className="border border-black px-1 py-1 text-center align-middle w-20">チケット</th>
                        <th rowSpan={2} className="border border-black px-2 py-1 text-center align-middle">ゲストフルネーム</th>
                        <th className="border border-black px-1 py-0.5 text-center text-[11px]">ＶＩＰ</th>
                        <th className="border border-black px-1 py-0.5 text-center text-[11px]">社名</th>
                        <th className="border border-black px-1 py-0.5 text-center text-[11px]">（地域）</th>
                        <th rowSpan={2} className="border border-black px-1 py-1 text-center align-middle w-16">C/IN</th>
                        <th rowSpan={2} className="border border-black px-1 py-1 text-center align-middle w-16">C/OUT</th>
                        <th rowSpan={2} className="border border-black px-1 py-1 text-center align-middle w-20">駐車場所</th>
                        <th rowSpan={2} className="border border-black px-1 py-1 text-center align-middle w-24" style={{ position: 'sticky', right: 0, zIndex: 20, background: '#f3f4f6' }}>備考</th>
                      </tr>
                      <tr className="bg-gray-100">
                        <th className="border border-black px-1 py-0.5 text-center text-[11px]">部屋番号</th>
                        <th className="border border-black px-1 py-0.5 text-center text-[11px]">車輌／位</th>
                        <th className="border border-black px-1 py-0.5 text-center text-[11px]">ナンバー</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: Math.max(10, tickets.length) }, (_, index) => {
                        const ticket = tickets[index] ?? null;
                        if (ticket) {
                          const isCopied = copiedRowId === ticket.id;
                          return (
                            <tr key={ticket.id} className={
                              ticket.status === 'cancelled' ? 'bg-red-50' :
                              ticket.status === 'completed' ? 'bg-gray-50' : 'bg-white'
                            } style={{height: 58}}>
                              {/* Copy checkbox */}
                              <td className="border border-black text-center px-1 py-1 align-middle">
                                <button
                                  onClick={() => handleCopyRow(ticket, index)}
                                  title="Click to copy row"
                                  className={`w-6 h-6 rounded border-2 flex items-center justify-center mx-auto transition-all ${
                                    isCopied
                                      ? 'bg-green-500 border-green-500 text-white'
                                      : 'border-gray-400 hover:border-regis-navy hover:bg-regis-navy/5'
                                  }`}
                                >
                                  {isCopied && <Check size={14} />}
                                </button>
                              </td>
                              {/* Row number + status */}
                              <td className="border border-black text-center px-1 py-1 align-middle">
                                <div className="font-bold text-xs">{index + 1}</div>
                                {(() => {
                                  const isOver24h = (Date.now() - new Date(ticket.createdAt!).getTime()) >= 24 * 60 * 60 * 1000;
                                  const dotColor = ticket.status === 'completed' ? '#16a34a' : isOver24h ? '#ea580c' : '#16a34a';
                                  return <div className="text-base font-bold leading-none" style={{ color: dotColor }}>{ticket.status === 'completed' ? '✓' : '●'}</div>;
                                })()}
                              </td>
                              <td className="border border-black text-center px-1 py-1 font-mono font-bold align-middle text-sm">#{ticket.ticketNumber}</td>
                              <td className="border border-black px-2 py-1 align-middle">
                                <span className="font-semibold">{stripHonorifics(ticket.guestName || '')}</span>
                                {ticket.visitorType === 'hotel_guest' && !ticket.roomNumber && (
                                  <span className="ml-1 text-[8px] font-semibold text-amber-700 bg-amber-50 border border-amber-300 rounded px-1">Room Pending</span>
                                )}
                              </td>
                              <td className="border border-black text-center px-1 py-1 align-middle">
                                {ticket.roomNumber && <div className="font-bold text-sm">{ticket.roomNumber}</div>}
                              </td>
                              <td className="border border-black px-1 py-1 align-middle">
                                <div className="font-medium">{ticket.carMake} {ticket.carModel}</div>
                                <ColorDisplay color={ticket.carColor || ''} />
                              </td>
                              <td className="border border-black text-center px-1 py-1 font-mono align-middle">{ticket.licensePlate || ''}</td>
                              <td className="border border-black text-center px-1 py-1 font-mono tabular-nums align-middle leading-tight">
                                <div>{fmtRosterDate(ticket.createdAt)}</div>
                                <div>{fmtTime(ticket.createdAt)}</div>
                              </td>
                              <td className="border border-black text-center px-1 py-1 font-mono tabular-nums align-middle leading-tight">
                                {ticket.status === 'completed' && ticket.departedAt ? (<>
                                  <div>{fmtRosterDate(ticket.departedAt)}</div>
                                  <div>{fmtTime(ticket.departedAt)}</div>
                                </>) : ''}
                              </td>
                              <td className="border border-black text-center px-1 py-1 font-bold align-middle">{ticket.parkingLocation || ''}</td>
                              <td className="border border-black p-0 align-middle overflow-hidden" style={{ position: 'sticky', right: 0, zIndex: 10, background: ticket.status === 'cancelled' ? '#fef2f2' : ticket.status === 'completed' ? '#f9fafb' : '#ffffff' }}><BikouCell ticket={ticket} /></td>
                            </tr>
                          );
                        }
                        return (
                          <tr key={`empty-${index}`} className="bg-white" style={{height: 58}}>
                            <td className="border border-black text-center px-1 align-middle">
                              <div className="w-6 h-6 rounded border-2 border-gray-200 mx-auto" />
                            </td>
                            <td className="border border-black text-center px-1 align-middle">
                              <div className="font-bold text-xs text-gray-300">{index + 1}</div>
                            </td>
                            <td className="border border-black px-1 py-1 align-top"><div className="text-xs text-gray-300">#</div></td>
                            <td className="border border-black px-2 align-bottom pb-1">
                              <div className="text-xs text-gray-300"></div>
                            </td>
                            <td className="border border-black"></td>
                            <td className="border border-black text-center align-middle"><span className="text-xs text-gray-300 whitespace-nowrap">黒白銀（　）</span></td>
                            <td className="border border-black text-center align-middle"><span className="text-xs text-gray-300">—</span></td>
                            <td className="border border-black text-center align-middle"><span className="text-xs text-gray-300 font-mono">：</span></td>
                            <td className="border border-black text-center align-middle"><span className="text-xs text-gray-300 font-mono">：</span></td>
                            <td className="border border-black"></td>
                            <td className="border border-black p-0 align-middle overflow-hidden" style={{ position: 'sticky', right: 0, zIndex: 10, background: '#ffffff' }}>
                              <div className="flex flex-col" style={{ minHeight: 54 }}>
                                <div className="flex-1 flex items-center justify-center border-b border-gray-200 text-[10px] text-gray-200 font-bold">NOTES</div>
                                <div className="flex-1 flex items-center justify-center text-[10px] text-gray-200 font-bold">NC Pending</div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {/* Footer totals */}
                  <div className="border border-t-0 border-black px-3 py-1 bg-gray-50 flex justify-between text-xs text-gray-500">
                    <span>合計 Total: {tickets.length} 台</span>
                    <span>Cars Parked On-Site: {tickets.filter(t => !['completed','cancelled'].includes(t.status)).length} · Departed: {tickets.filter(t => t.status === 'completed').length}</span>
                  </div>
                </div>
              );

              return (
                <div>
                  {/* ── DATE NAVIGATION BAR ── */}
                  <div className="flex items-center justify-between gap-2 px-1 py-2 border-b border-gray-200 bg-gray-50 mb-0">
                    <div className="flex items-center gap-1">
                      <button onClick={prevDay} className="h-7 w-7 flex items-center justify-center rounded border border-gray-300 bg-white hover:bg-gray-100 transition-colors">
                        <ChevronLeft size={14} />
                      </button>
                      <div className="flex items-center gap-1.5 px-2">
                        <CalendarDays size={14} className="text-regis-navy" />
                        <input
                          type="date"
                          value={`${rosterDate.getFullYear()}-${(rosterDate.getMonth()+1).toString().padStart(2,'0')}-${rosterDate.getDate().toString().padStart(2,'0')}`}
                          onChange={e => { const d = new Date(e.target.value + 'T00:00:00'); if (!isNaN(d.getTime())) setRosterDate(d); }}
                          className="text-xs font-mono border-0 bg-transparent outline-none cursor-pointer w-[120px]"
                        />
                        {isToday && <span className="text-[10px] font-bold bg-regis-navy text-white px-1.5 py-0.5 rounded">TODAY</span>}
                      </div>
                      <button onClick={nextDay} disabled={isToday} className="h-7 w-7 flex items-center justify-center rounded border border-gray-300 bg-white hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                        <ChevronRight size={14} />
                      </button>
                    </div>
                    <button
                      onClick={() => window.print()}
                      className="flex items-center gap-1.5 h-7 px-3 text-xs font-semibold border border-regis-navy text-regis-navy rounded hover:bg-regis-navy/10 transition-colors"
                    >
                      <Printer size={13} />
                      Print
                    </button>
                  </div>

                  {/* ── SHARED SCROLL CONTAINER: tabs + table share same minWidth ── */}
                  <div className="overflow-x-auto print:overflow-visible">
                    <div style={{minWidth: 960}}>

                      {/* SUB-TABS */}
                      <div className="flex print:hidden">
                        {tabDefs.map(tab => {
                          const isActive = rosterTab === tab.key;
                          return (
                            <button
                              key={tab.key}
                              onClick={() => setRosterTab(tab.key)}
                              style={{ borderBottom: isActive ? '2px solid #1a2744' : '1px solid black', flex: 1 }}
                              className={`px-3 py-2 text-xs font-semibold border-t border-l border-r border-black -mb-px transition-colors ${
                                isActive ? 'bg-regis-navy text-white' : 'bg-white text-regis-navy hover:bg-regis-navy/5'
                              }`}
                            >
                              <div className="leading-tight">{tab.label}</div>
                              <div className={`text-[10px] mt-0.5 ${isActive ? 'text-blue-200' : 'text-gray-400'}`}>{tab.tickets.length} 台</div>
                            </button>
                          );
                        })}
                      </div>

                      {/* DESKTOP TABLE — split into pages of 10 */}
                      {(() => {
                        const PAGE_SIZE = 10;
                        const chunks: ValetTicket[][] = [];
                        for (let i = 0; i < Math.max(rosterTickets.length, 1); i += PAGE_SIZE) {
                          chunks.push(rosterTickets.slice(i, i + PAGE_SIZE));
                        }
                        const totalPages = chunks.length;
                        return (
                          <div id="roster-printable" className="hidden sm:block print:block">
                            {chunks.map((chunk, pageIdx) => (
                              <div key={pageIdx} className={pageIdx > 0 ? 'mt-10 print:mt-0 print:break-before-page' : ''}>
                                <RosterTable tickets={chunk} pageNum={pageIdx + 1} totalPages={totalPages} />
                              </div>
                            ))}
                          </div>
                        );
                      })()}

                    </div>
                  </div>

                  {/* ── MOBILE CARDS ── */}
                  <div className="sm:hidden print:hidden space-y-2 mt-2">
                    <div className="flex items-center justify-between py-1 border-b border-gray-200">
                      <h3 className="font-bold text-regis-navy text-sm">{tabDefs.find(t => t.key === rosterTab)?.label}</h3>
                      <span className="text-[11px] text-gray-500">{todayStr} · {rosterTickets.length}台</span>
                    </div>
                    {rosterTickets.map((ticket, index) => (
                      <div key={ticket.id} className={`border rounded-lg p-2.5 ${
                        ticket.status === 'cancelled' ? 'border-red-300 bg-red-50' :
                        ticket.status === 'completed' ? 'border-gray-300 bg-gray-50' :
                        ticket.status === 'ready'     ? 'border-green-400 bg-green-50' :
                        'border-blue-200 bg-white'
                      }`}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-gray-400 font-bold w-4">{index + 1}</span>
                            <span className="font-bold text-xs" style={{ color: ticket.status === 'completed' ? '#16a34a' : (Date.now() - new Date(ticket.createdAt!).getTime()) >= 24 * 60 * 60 * 1000 ? '#ea580c' : '#16a34a' }}>
                              {ticket.status === 'completed' ? '✓' : '●'}
                            </span>
                            <span className="font-bold text-regis-navy text-sm">#{ticket.ticketNumber}</span>
                            {ticket.status === 'cancelled' && <span className="text-red-600 font-bold text-[10px]">VOID</span>}
                            {ticket.status === 'completed' && <span className="text-green-700 font-bold text-[10px]">転記</span>}
                          </div>
                          <div className="text-right font-mono text-[10px] text-gray-500">
                            <div>C/IN <span className="font-mono">{fmtRosterDate(ticket.createdAt)}</span><br/><span className="font-mono">{fmtTime(ticket.createdAt)}</span></div>
                            {ticket.status === 'completed' && ticket.departedAt && <div>C/OUT <span className="font-mono">{fmtRosterDate(ticket.departedAt)}</span><br/><span className="font-mono">{fmtTime(ticket.departedAt)}</span></div>}
                          </div>
                        </div>
                        <div className="flex items-baseline gap-1 mb-0.5 flex-wrap">
                          <span className="text-sm font-medium text-gray-800">{stripHonorifics(ticket.guestName || '')}</span>
                          {ticket.roomNumber && <span className="text-[10px] text-gray-400 ml-1">Rm {ticket.roomNumber}</span>}
                          {ticket.visitorType === 'hotel_guest' && !ticket.roomNumber && (
                            <span className="text-[9px] font-semibold text-amber-700 bg-amber-50 border border-amber-300 rounded px-1">Room Pending</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <ColorDisplay color={ticket.carColor || ''} />
                            <span className="text-[10px] text-gray-400">{ticket.carMake} {ticket.carModel}</span>
                          </div>
                          <span className={`text-[10px] font-bold border px-1.5 py-0.5 rounded ${ticket.parkingLocation ? 'border-gray-400 text-gray-700' : 'border-red-300 text-red-500'}`}>
                            {ticket.parkingLocation || 'N/A'}
                          </span>
                        </div>
                        {ticket.licensePlate && <p className="text-[10px] font-mono text-gray-400 mt-0.5">{ticket.licensePlate}</p>}
                        {/* NOTES + NC Done buttons */}
                        <div className="flex mt-1.5 rounded overflow-hidden border border-gray-300" style={{ height: 36 }}>
                          {(() => {
                            const hasNotes = !!(ticket.staffNotes && ticket.staffNotes.trim());
                            const ncDone = (ticket as any).nightCheckDone === todayDateStr;
                            return (<>
                              <button
                                onClick={() => setRosterNotesPopup({ ticketNumber: ticket.ticketNumber, notes: ticket.staffNotes || '' })}
                                className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-bold transition-colors ${showNC ? 'border-r border-gray-300' : ''} ${
                                  hasNotes ? 'bg-amber-100 text-amber-800 hover:bg-amber-200' : 'bg-white text-gray-400 hover:bg-gray-50'
                                }`}
                                title={hasNotes ? ticket.staffNotes! : 'Add notes'}
                              >
                                <FileText size={12} />
                                NOTES{hasNotes ? ' ✓' : ''}
                              </button>
                              {showNC && (
                                <button
                                  onClick={() => rosterNotesMutation.mutate({ ticketNumber: ticket.ticketNumber, nightCheckDone: !ncDone })}
                                  className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-bold transition-colors ${
                                    ncDone ? 'bg-green-500 text-white hover:bg-green-600' : 'bg-red-500 text-white hover:bg-red-600'
                                  }`}
                                >
                                  <CheckSquare size={12} />
                                  {ncDone ? 'NC Done ✓' : 'NC Pending'}
                                </button>
                              )}
                            </>);
                          })()}
                        </div>
                      </div>
                    ))}
                    {rosterTickets.length === 0 && (
                      <div className="text-center py-8 text-gray-400 text-xs">
                        <Car size={28} className="mx-auto mb-2 opacity-30" />
                        No entries for this date
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* GS Hub Inline Panel */}
            {showGSHub && (
              <div className="mt-2">
                <GSHub user={user} />
              </div>
            )}

            {!showVehicleRoster && !showGSHub && (<>
            {/* Standard View for Mobile */}
            <div className="space-y-3 sm:hidden">
                {/* Compact Stats Row — tap any to jump to that section */}
                {(() => {
                  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
                  const departedTodayCount = activeTickets?.filter(t => t.status === 'completed' && t.updatedAt && new Date(t.updatedAt) >= todayStart).length || 0;
                  const retrievingCount = activeTickets?.filter(t => ['retrieving', 'transit', 'preparing'].includes(t.status)).length || 0;
                  const numSz = 24 + statBtnFontSize * 2;
                  const lblSz = 10 + statBtnFontSize;
                  return (
                    <div className="space-y-2">
                      {/* Font size controls */}
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="text-[10px] text-gray-400 font-medium mr-0.5">Text size</span>
                        <button
                          onClick={() => changeStatBtnFont(-1)}
                          disabled={statBtnFontSize <= -3}
                          className="w-6 h-6 rounded-md border border-gray-300 bg-white text-gray-600 text-sm font-bold flex items-center justify-center disabled:opacity-30 active:bg-gray-100"
                        >−</button>
                        <button
                          onClick={() => changeStatBtnFont(1)}
                          disabled={statBtnFontSize >= 5}
                          className="w-6 h-6 rounded-md border border-gray-300 bg-white text-gray-600 text-sm font-bold flex items-center justify-center disabled:opacity-30 active:bg-gray-100"
                        >+</button>
                      </div>
                      {/* Row 1: 3 statuses */}
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          className="rounded-xl border-2 border-blue-400 bg-blue-50 active:bg-blue-100 p-2.5 text-center w-full focus:outline-none shadow-sm"
                          onClick={() => scrollToPanel('in-house')}
                        >
                          <p style={{ fontSize: numSz }} className="font-extrabold text-blue-700 leading-none">{activeTickets?.filter(t => t.status === 'active').length || 0}</p>
                          <p style={{ fontSize: lblSz }} className="text-blue-600 font-semibold leading-tight mt-1">Cars Parked On-Site</p>
                        </button>
                        <button
                          className="rounded-xl border-2 border-indigo-400 bg-indigo-50 active:bg-indigo-100 p-2.5 text-center w-full focus:outline-none shadow-sm"
                          onClick={() => scrollToPanel('guest-out')}
                        >
                          <p style={{ fontSize: numSz }} className="font-extrabold text-indigo-700 leading-none">{activeTickets?.filter(t => t.status === 'out_with_guest').length || 0}</p>
                          <p style={{ fontSize: lblSz }} className="text-indigo-600 font-semibold leading-tight mt-1">Out Returning Later</p>
                        </button>
                        <button
                          className="rounded-xl border-2 border-amber-400 bg-amber-50 active:bg-amber-100 p-2.5 text-center w-full focus:outline-none shadow-sm"
                          onClick={() => scrollToPanel('retrievals')}
                        >
                          <p style={{ fontSize: numSz }} className="font-extrabold text-amber-700 leading-none">{retrievingCount}</p>
                          <p style={{ fontSize: lblSz }} className="text-amber-600 font-semibold leading-tight mt-1">Retrieving Car</p>
                        </button>
                      </div>
                      {/* Row 2: 2 statuses */}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          className="rounded-xl border-2 border-green-400 bg-green-50 active:bg-green-100 p-2.5 text-center w-full focus:outline-none shadow-sm"
                          onClick={() => scrollToPanel('ready')}
                        >
                          <p style={{ fontSize: numSz }} className="font-extrabold text-green-700 leading-none">{activeTickets?.filter(t => t.status === 'ready').length || 0}</p>
                          <p style={{ fontSize: lblSz }} className="text-green-600 font-semibold leading-tight mt-1">Ready for Collection</p>
                        </button>
                        <button
                          className="rounded-xl border-2 border-gray-400 bg-gray-50 active:bg-gray-100 p-2.5 text-center w-full focus:outline-none shadow-sm"
                          onClick={() => scrollToPanel('departed-today')}
                        >
                          <p style={{ fontSize: numSz }} className="font-extrabold text-gray-700 leading-none">{departedTodayCount}</p>
                          <p style={{ fontSize: lblSz }} className="text-gray-600 font-semibold leading-tight mt-1">Departed Today</p>
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* Draggable Mobile Compact Panels - all start collapsed */}
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleMobileDragEnd}>
                  <SortableContext items={mobilePanelOrder} strategy={verticalListSortingStrategy}>
                    <div className="flex flex-col gap-3">
                      {mobilePanelOrder.map(panelId => {
                        const isExpanded = expandedPanels.has(panelId);
                        const toggle = () => togglePanel(panelId);

                        if (panelId === 'ready') return (
                          <SortablePanel key="ready" id="ready"
                            title={`Ready for Collection (${activeTickets?.filter(t => t.status === 'ready').length || 0})`}
                            icon={<Check size={14} />} borderClass="border-green-200" headerClass="text-green-700"
                            expanded={isExpanded} onToggle={toggle}
                          >
                            <div className="space-y-2 max-h-40 overflow-y-auto mt-2">
                              {activeTickets?.filter(t => t.status === 'ready').map((ticket) => (
                                <div key={ticket.id} className="bg-green-50 rounded p-2 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <span className="font-medium text-sm">#{ticket.ticketNumber}</span>
                                      <span className="text-xs text-gray-500 ml-1">{ticket.carMake}</span>
                                    </div>
                                  </div>
                                  {canEdit && (
                                    <div className="flex gap-1">
                                      <Button size="sm" className="h-6 px-2 text-xs bg-gray-600 hover:bg-gray-700 text-white flex-1"
                                        onClick={() => updateStatusMutation.mutate({ ticketNumber: ticket.ticketNumber, status: 'completed' })}>Departed</Button>
                                      <Button size="sm" className="h-6 px-2 text-xs bg-blue-600 hover:bg-blue-700 text-white flex-1"
                                        onClick={() => updateStatusMutation.mutate({ ticketNumber: ticket.ticketNumber, status: 'out_with_guest' })}>Coming Back</Button>
                                    </div>
                                  )}
                                </div>
                              ))}
                              {activeTickets?.filter(t => t.status === 'ready').length === 0 && (
                                <p className="text-xs text-gray-400 text-center py-2">No cars ready for collection</p>
                              )}
                            </div>
                          </SortablePanel>
                        );

                        if (panelId === 'retrievals') return (
                          <SortablePanel key="retrievals" id="retrievals"
                            title={`Retrieving Car (${activeTickets?.filter(t => ['retrieving', 'transit'].includes(t.status)).length || 0})`}
                            icon={<Car size={14} />}
                            expanded={isExpanded} onToggle={toggle}
                            fontSize={getSectionFontSize('retrievals')} onFontSizeChange={s => setSectionFont('retrievals', s)}
                          >
                            <div className="space-y-2 max-h-40 overflow-y-auto mt-2">
                              {activeTickets?.filter(t => ['retrieving', 'transit', 'preparing'].includes(t.status)).map((ticket) => (
                                <div key={ticket.id} className="bg-gray-50 rounded p-2 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium text-sm">#{ticket.ticketNumber}</span>
                                    {canEdit && (
                                      <div className="flex gap-1">
                                        {ticket.status === 'retrieving' && (
                                          <Button size="sm" variant="outline" className="h-6 px-2 text-xs"
                                            onClick={() => updateStatusMutation.mutate({ ticketNumber: ticket.ticketNumber, status: 'transit' })}>Transit</Button>
                                        )}
                                        {ticket.status === 'transit' && (
                                          <Button size="sm" variant="outline" className="h-6 px-2 text-xs"
                                            onClick={() => updateStatusMutation.mutate({ ticketNumber: ticket.ticketNumber, status: 'preparing' })}>Final Prep</Button>
                                        )}
                                        <Button size="sm" className="h-6 px-2 text-xs bg-green-600 hover:bg-green-700 text-white font-bold"
                                          onClick={() => updateStatusMutation.mutate({ ticketNumber: ticket.ticketNumber, status: 'ready' })}>✓ Ready</Button>
                                        <Button size="sm" variant="outline" className="h-6 px-2 text-xs border-red-300 text-red-600 hover:bg-red-50"
                                          onClick={() => updateStatusMutation.mutate({ ticketNumber: ticket.ticketNumber, status: 'active' })}>✕</Button>
                                      </div>
                                    )}
                                  </div>
                                  <CompactRetrievalProgress ticket={ticket} />
                                </div>
                              ))}
                              {activeTickets?.filter(t => ['retrieving', 'transit', 'preparing'].includes(t.status)).length === 0 && (
                                <p className="text-xs text-gray-400 text-center py-2">No active retrievals</p>
                              )}
                            </div>
                          </SortablePanel>
                        );

                        if (panelId === 'guest-out') return (
                          <SortablePanel key="guest-out" id="guest-out"
                            title={`Out Returning Later (${activeTickets?.filter(t => t.status === 'out_with_guest').length || 0})`}
                            icon={<Car size={14} />} borderClass="border-blue-200" headerClass="text-blue-700"
                            expanded={isExpanded} onToggle={toggle}
                            fontSize={getSectionFontSize('guest-out')} onFontSizeChange={s => setSectionFont('guest-out', s)}
                          >
                            <div className="space-y-2 max-h-40 overflow-y-auto mt-2">
                              {activeTickets?.filter(t => t.status === 'out_with_guest').map((ticket) => (
                                <GuestOutCard key={ticket.id} ticket={ticket}
                                  onBack={() => guestReturnedMutation.mutate(ticket.ticketNumber)}
                                  onView={() => setViewTicket(ticket)} canEdit={canEdit} />
                              ))}
                              {activeTickets?.filter(t => t.status === 'out_with_guest').length === 0 && (
                                <p className="text-xs text-gray-400 text-center py-2">No cars out with guests</p>
                              )}
                            </div>
                          </SortablePanel>
                        );

                        if (panelId === 'in-house') {
                          const allActive = activeTickets?.filter(t => t.status === 'active') || [];
                          const now = Date.now();
                          const freshTickets = sortInHouseTickets(allActive.filter(t => (now - new Date(t.createdAt||0).getTime()) < 24*60*60*1000), inHouseSortBy);
                          const overnightTickets = sortInHouseTickets(allActive.filter(t => (now - new Date(t.createdAt||0).getTime()) >= 24*60*60*1000), inHouseSortBy);
                          const renderCompact = (ticket: any) => (
                            <CompactInHouseCard key={ticket.id} ticket={ticket}
                              onRetrieve={() => updateStatusMutation.mutate({ ticketNumber: ticket.ticketNumber, status: 'retrieving' })}
                              onEdit={() => setEditTicketData(ticket)}
                              onView={() => setViewTicket(ticket)}
                              onDepart={() => departMutation.mutate(ticket.ticketNumber)}
                              onAutoClose={() => {
                                setAutoCloseTicket(ticket);
                                const today = new Date();
                                const localDate = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
                                const localTime = `${String(today.getHours()).padStart(2,'0')}:${String(today.getMinutes()).padStart(2,'0')}`;
                                setAutoCloseDate(localDate);
                                setAutoCloseTime(localTime);
                              }}
                              onCancelAutoClose={() => cancelSchedDepMutation.mutate(ticket.ticketNumber)}
                              canEdit={canEdit}
                              collapsed={inHouseCollapsed}
                              onToggleCollapse={() => setInHouseCollapsed(c => !c)} />
                          );
                          return (
                            <SortablePanel key="in-house" id="in-house"
                              title={`Cars Parked On-Site (${allActive.length})`}
                              icon={<Clock size={14} />}
                              expanded={isExpanded} onToggle={toggle}
                              fontSize={getSectionFontSize('in-house')} onFontSizeChange={s => setSectionFont('in-house', s)}
                            >
                              {/* Sort control */}
                              <div className="flex items-center justify-end gap-2 mt-2 mb-1">
                                <span className="text-[10px] text-gray-400 font-medium">Sort:</span>
                                <select
                                  value={inHouseSortBy}
                                  onChange={e => setInHouseSortBy(e.target.value as any)}
                                  className="text-[10px] border border-gray-200 rounded px-1.5 py-0.5 text-gray-600 bg-white focus:outline-none"
                                >
                                  <option value="newest">Newest first</option>
                                  <option value="oldest">Oldest first</option>
                                  <option value="name_az">Name A→Z</option>
                                  <option value="name_za">Name Z→A</option>
                                  <option value="ticket_asc">Ticket ↑</option>
                                  <option value="ticket_desc">Ticket ↓</option>
                                </select>
                              </div>
                              {/* Fresh section */}
                              <div className="mb-2">
                                <div className="flex items-center gap-1.5 px-1 py-0.5 mb-1">
                                  <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                                  <span className="text-[10px] font-bold text-green-700 uppercase tracking-wide">Under 24h ({freshTickets.length})</span>
                                </div>
                                <div className="space-y-2 max-h-52 overflow-y-auto">
                                  {freshTickets.length > 0 ? freshTickets.map(renderCompact) : (
                                    <p className="text-[10px] text-gray-400 text-center py-1">None</p>
                                  )}
                                </div>
                              </div>
                              {/* Overnight section */}
                              <div>
                                <div className="flex items-center gap-1.5 px-1 py-0.5 mb-1 border-t border-amber-200 pt-2">
                                  <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                                  <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wide">Overnight 24h+ ({overnightTickets.length})</span>
                                </div>
                                <div className="space-y-2 max-h-52 overflow-y-auto">
                                  {overnightTickets.length > 0 ? overnightTickets.map(renderCompact) : (
                                    <p className="text-[10px] text-gray-400 text-center py-1">None</p>
                                  )}
                                </div>
                              </div>
                              {allActive.length === 0 && (
                                <p className="text-xs text-gray-400 text-center py-2">No vehicles in house</p>
                              )}
                            </SortablePanel>
                          );
                        }

                        if (panelId === 'departed-today') {
                          const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
                          const departedToday = activeTickets?.filter(t => t.status === 'completed' && t.updatedAt && new Date(t.updatedAt) >= todayStart) || [];
                          return (
                            <SortablePanel key="departed-today" id="departed-today"
                              title={`Departed Today (${departedToday.length})`}
                              icon={<LogOut size={14} />} headerClass="text-gray-600"
                              expanded={isExpanded} onToggle={toggle}
                              fontSize={getSectionFontSize('departed-today')} onFontSizeChange={s => setSectionFont('departed-today', s)}
                            >
                              <div className="space-y-2 max-h-60 overflow-y-auto mt-2">
                                {departedToday.map((ticket) => {
                                  const stayHours = ticket.totalStaySeconds ? Math.floor(ticket.totalStaySeconds / 3600) : null;
                                  const stayMins = ticket.totalStaySeconds ? Math.floor((ticket.totalStaySeconds % 3600) / 60) : null;
                                  return (
                                    <div key={ticket.id} className="bg-gray-50 rounded p-2">
                                      <div className="flex items-center justify-between">
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2">
                                            <span className="font-medium text-gray-600" style={{ fontSize: 'var(--panel-card-title-size, 14px)' }}>#{ticket.ticketNumber}</span>
                                            <span className="text-gray-500 truncate" style={{ fontSize: 'var(--panel-card-title-size, 14px)' }}>{fmtGuest(ticket.guestName)}</span>
                                          </div>
                                          <p className="text-xs text-gray-400">{ticket.carMake} {ticket.carModel}</p>
                                          {stayHours !== null && <p className="text-xs text-blue-600 font-medium">⏱️ Stayed: {stayHours}h {stayMins}m</p>}
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setViewTicket(ticket)}>
                                            <Eye size={14} className="text-gray-400" />
                                          </Button>
                                          {user?.role === 'superadmin' && (<>
                                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setEditTicketData(ticket)}>
                                              <Edit size={14} className="text-blue-400" />
                                            </Button>
                                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setDeleteTicket(ticket)}>
                                              <Trash2 size={14} className="text-red-400" />
                                            </Button>
                                          </>)}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                                {departedToday.length === 0 && <p className="text-xs text-gray-400 text-center py-2">No departures today yet</p>}
                              </div>
                            </SortablePanel>
                          );
                        }

                        if (panelId === 'departed-history') {
                          const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
                          const departedHistory = activeTickets?.filter(t => t.status === 'completed' && (!t.updatedAt || new Date(t.updatedAt) < todayStart)) || [];
                          return (
                            <SortablePanel key="departed-history" id="departed-history"
                              title={`Departed History (${departedHistory.length})`}
                              icon={<LogOut size={14} />} headerClass="text-gray-500"
                              expanded={isExpanded} onToggle={toggle}
                              fontSize={getSectionFontSize('departed-history')} onFontSizeChange={s => setSectionFont('departed-history', s)}
                            >
                              <div className="space-y-2 max-h-60 overflow-y-auto mt-2">
                                {departedHistory.map((ticket) => {
                                  const stayHours = ticket.totalStaySeconds ? Math.floor(ticket.totalStaySeconds / 3600) : null;
                                  const stayMins = ticket.totalStaySeconds ? Math.floor((ticket.totalStaySeconds % 3600) / 60) : null;
                                  return (
                                    <div key={ticket.id} className="bg-gray-50 rounded p-2 flex items-center justify-between">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                          <span className="font-medium text-gray-600" style={{ fontSize: 'var(--panel-card-title-size, 14px)' }}>#{ticket.ticketNumber}</span>
                                          <span className="text-gray-500 truncate" style={{ fontSize: 'var(--panel-card-title-size, 14px)' }}>{fmtGuest(ticket.guestName)}</span>
                                        </div>
                                        <p className="text-xs text-gray-400">{ticket.carMake} {ticket.carModel}</p>
                                        {stayHours !== null && <p className="text-xs text-blue-600 font-medium">⏱️ Stayed: {stayHours}h {stayMins}m</p>}
                                        {ticket.updatedAt && <p className="text-xs text-gray-400">Departed: {new Date(ticket.updatedAt).toLocaleDateString()}</p>}
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setViewTicket(ticket)}>
                                          <Eye size={14} className="text-gray-400" />
                                        </Button>
                                        {user?.role === 'superadmin' && (<>
                                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setEditTicketData(ticket)}>
                                            <Edit size={14} className="text-blue-400" />
                                          </Button>
                                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setDeleteTicket(ticket)}>
                                            <Trash2 size={14} className="text-red-400" />
                                          </Button>
                                        </>)}
                                      </div>
                                    </div>
                                  );
                                })}
                                {departedHistory.length === 0 && <p className="text-xs text-gray-400 text-center py-2">No historical departures</p>}
                              </div>
                            </SortablePanel>
                          );
                        }


                        return null;
                      })}
                    </div>
                  </SortableContext>
                </DndContext>

                {/* Staff Quick Access - Super Admin Only (Mobile Compact View) */}
                {user?.role === 'superadmin' && (
                  <div className="bg-white border-2 border-yellow-200 rounded-lg p-3">
                    <h3 className="text-sm font-semibold text-regis-navy mb-2 flex items-center gap-1">
                      <Crown size={14} className="text-regis-gold" /> Staff Quick Access
                    </h3>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {allUsers?.filter(u => u.id !== user?.id).map((staffUser) => (
                        <div key={staffUser.id} className="bg-yellow-50 rounded p-2 flex items-center justify-between">
                          <div>
                            <span className="font-medium text-sm">{staffUser.firstName} {staffUser.lastName}</span>
                            <p className="text-xs text-gray-500 capitalize">{staffUser.role?.replace('_', ' ')}</p>
                          </div>
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="h-6 px-2 text-xs"
                            onClick={() => {
                              setEditUserData(staffUser);
                              setResetPasswordData({ newPassword: '', confirmPassword: '', forceChange: true });
                            }}
                          >
                            Reset PW
                          </Button>
                        </div>
                      ))}
                      {(!allUsers || allUsers.filter(u => u.id !== user?.id).length === 0) && (
                        <p className="text-xs text-gray-400 text-center py-2">No other staff users</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

            {/* Desktop Dashboard Panels — Draggable & Collapsible (hidden on mobile) */}
            {(() => {
              const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
              const departedToday = activeTickets?.filter(t => t.status === 'completed' && t.updatedAt && new Date(t.updatedAt) >= todayStart) || [];
              const departedHistory = activeTickets?.filter(t => t.status === 'completed' && (!t.updatedAt || new Date(t.updatedAt) < todayStart)) || [];

              const DepartedCard = ({ ticket }: { ticket: ValetTicket }) => {
                const stayHours = ticket.totalStaySeconds ? Math.floor(ticket.totalStaySeconds / 3600) : null;
                const stayMins = ticket.totalStaySeconds ? Math.floor((ticket.totalStaySeconds % 3600) / 60) : null;
                return (
                  <div className="border border-gray-200 rounded-lg p-3 sm:p-4 bg-gray-50 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-gray-600" style={{ fontSize: 'var(--panel-card-title-size, 14px)' }}>#{ticket.ticketNumber}</p>
                        </div>
                        <p className="text-xs text-gray-400">{ticket.carMake} {ticket.carModel} • {ticket.carColor}</p>
                        {ticket.licensePlate && <p className="text-xs font-semibold text-gray-700 tracking-wide">{ticket.licensePlate}</p>}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setViewTicket(ticket)}>
                          <Eye size={16} className="text-gray-400" />
                        </Button>
                        {user?.role === 'superadmin' && (<>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setEditTicketData(ticket)}>
                            <Edit size={16} className="text-blue-400" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setDeleteTicket(ticket)}>
                            <Trash2 size={16} className="text-red-400" />
                          </Button>
                        </>)}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">
                      <p style={{ fontSize: 'var(--panel-card-title-size, 14px)' }}><strong>Guest:</strong> {fmtGuest(ticket.guestName)}{ticket.visitorType === 'hotel_guest' && !ticket.roomNumber && (
                        <span className="ml-1 text-[9px] font-semibold text-amber-700 bg-amber-50 border border-amber-300 rounded px-1">Room Pending</span>
                      )}</p>
                      {ticket.roomNumber && <p><strong>Room:</strong> {ticket.roomNumber}</p>}
                      {stayHours !== null && <p className="text-blue-600 font-medium mt-1">⏱️ Total Stay: {stayHours}h {stayMins}m</p>}
                      {ticket.updatedAt && <p className="text-gray-400 mt-0.5">Departed: {new Date(ticket.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>}
                    </div>
                  </div>
                );
              };

              return (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDesktopDragEnd}>
                  <SortableContext items={desktopPanelOrder} strategy={verticalListSortingStrategy}>
                    <div className="hidden sm:flex sm:flex-col gap-4">
                      {desktopPanelOrder.map(panelId => {
                        const isExpanded = expandedPanels.has(panelId);
                        const toggle = () => togglePanel(panelId);

                        if (panelId === 'in-house') {
                          const allActiveD = activeTickets?.filter(t => t.status === 'active') || [];
                          const nowD = Date.now();
                          const freshD = sortInHouseTickets(allActiveD.filter(t => (nowD - new Date(t.createdAt||0).getTime()) < 24*60*60*1000), inHouseSortBy);
                          const overnightD = sortInHouseTickets(allActiveD.filter(t => (nowD - new Date(t.createdAt||0).getTime()) >= 24*60*60*1000), inHouseSortBy);
                          const renderDesktopCard = (ticket: any) => (
                                  <div key={ticket.id} className={`rounded-lg p-3 sm:p-4 shadow-sm hover:shadow-md transition-shadow border-2 ${ticket.parkingLocation ? 'border-green-400 bg-green-50/40' : 'border-red-400 bg-red-50/40'}`}>
                                    <div className="flex justify-between items-start mb-2 sm:mb-3">
                                      <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <p className="font-bold text-regis-navy" style={{ fontSize: 'var(--panel-card-title-size, 14px)' }}>#{ticket.ticketNumber}</p>
                                          <span className={`inline-flex items-center px-1.5 py-0 rounded-full font-bold ${ticket.parkingLocation ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-red-100 text-red-700 border border-red-300'}`} style={{ fontSize: 'var(--panel-card-title-size, 14px)' }}>
                                    
                                            {ticket.parkingLocation || 'Unassigned'}
                                          </span>
                                        </div>
                                        <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                                          <p className="font-bold text-regis-navy" style={{ fontSize: 'var(--panel-card-title-size, 14px)' }}>{fmtGuest(ticket.guestName)}</p>
                                          {ticket.guestPin && (
                                            <span className="inline-flex items-center gap-0.5 font-mono font-bold text-regis-navy bg-regis-gold/20 border border-regis-gold/50 rounded px-1.5 py-0.5 shrink-0" style={{ fontSize: 'var(--panel-card-title-size, 14px)' }}>
                                              PIN&nbsp;{ticket.guestPin}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      <div className="flex items-start gap-2">
                                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setViewTicket(ticket)}>
                                          <Eye size={16} className="text-gray-500" />
                                        </Button>
                                        {canEdit && (
                                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setEditTicketData(ticket)}>
                                            <Edit size={16} className="text-gray-500" />
                                          </Button>
                                        )}
                                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setInHouseCollapsed(c => !c)} title={inHouseCollapsed ? "Expand all" : "Collapse all"}>
                                          <ChevronDown size={15} className={`text-gray-400 transition-transform duration-200 ${inHouseCollapsed ? '' : 'rotate-180'}`} />
                                        </Button>
                                        <CircularTimer createdAt={ticket.createdAt || new Date()} maxHours={24} size={40} strokeWidth={3} />
                                      </div>
                                    </div>
                                    {!inHouseCollapsed && <div className="space-y-1.5 text-xs sm:text-sm text-gray-600 mb-2 sm:mb-3">
                                      <div className="w-fit rounded-md bg-slate-100 border border-slate-300 px-2.5 py-1.5 space-y-1">
                                        <p className="text-sm font-extrabold text-slate-800 uppercase tracking-widest leading-none text-center whitespace-nowrap">{ticket.carMake} {ticket.carModel}</p>
                                        <div className="flex justify-center">
                                          {ticket.licensePlate ? (
                                            <span className="text-xs font-bold tracking-widest text-slate-900 bg-yellow-50 border border-yellow-400 rounded px-2 py-0.5 font-mono leading-tight whitespace-nowrap">{ticket.licensePlate}</span>
                                          ) : (
                                            <span className="text-[10px] text-slate-400 italic">No plate</span>
                                          )}
                                        </div>
                                      </div>
                                      <CarColorBadge color={ticket.carColor || ''} />
                                      {ticket.visitorType && (
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded border ${
                                            ticket.visitorType === 'hotel_guest'
                                              ? 'bg-blue-100 text-blue-700 border-blue-300'
                                              : ticket.visitorType === 'restaurant'
                                                ? 'bg-orange-100 text-orange-700 border-orange-300'
                                                : ticket.visitorType === 'event'
                                                  ? 'bg-purple-100 text-purple-700 border-purple-300'
                                                  : 'bg-teal-100 text-teal-700 border-teal-300'
                                          }`}>
                                            {ticket.visitorType === 'hotel_guest'
                                              ? 'Hotel Guest'
                                              : ticket.visitorType === 'restaurant'
                                                ? `Restaurant${ticket.visitorSubType ? ` - ${RESTAURANT_SUB_TYPES[ticket.visitorSubType as keyof typeof RESTAURANT_SUB_TYPES]}` : ''}`
                                                : ticket.visitorType === 'event'
                                                  ? 'Event'
                                                  : 'Others'}
                                          </span>
                                          {ticket.visitorType === 'hotel_guest' && !ticket.roomNumber && (
                                            <span className="text-[9px] font-semibold text-amber-700 bg-amber-50 border border-amber-300 rounded px-1 leading-tight">Room Pending</span>
                                          )}
                                          {ticket.roomNumber && (
                                            <span className="text-xs font-semibold text-gray-600">Rm {ticket.roomNumber}</span>
                                          )}
                                        </div>
                                      )}
                                    </div>}
                                    {!inHouseCollapsed && (ticket as any).scheduledDepartureAt && (
                                      <div className="flex items-center gap-2 mb-1.5">
                                        <p className="text-xs text-purple-600 font-semibold">
                                          ⏰ Auto-close: {(() => { const d = new Date((ticket as any).scheduledDepartureAt); return `${d.getMonth()+1}/${d.getDate()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`; })()}
                                        </p>
                                        <button
                                          className="text-[10px] text-red-400 hover:text-red-600 font-semibold border border-red-200 hover:border-red-400 rounded px-1.5 py-0.5 leading-tight"
                                          onClick={() => cancelSchedDepMutation.mutate(ticket.ticketNumber)}
                                        >✕ Cancel</button>
                                      </div>
                                    )}
                                    {!inHouseCollapsed && ticket.scheduledRetrievalAt && (
                                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                        <p className="text-xs text-amber-600 font-semibold">
                                          🚗 Pickup: {(() => { const d = new Date(ticket.scheduledRetrievalAt as unknown as string); return `${d.getMonth()+1}/${d.getDate()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`; })()}
                                        </p>
                                        <ScheduleCountdownBadge scheduledAt={ticket.scheduledRetrievalAt as unknown as string} />
                                      </div>
                                    )}
                                    {!inHouseCollapsed && canEdit && (
                                      <div className="space-y-1.5">
                                        {/* Row 1: Retrieve | Schedule */}
                                        <div className="flex gap-1.5">
                                          <Button size="sm" className="flex-1 bg-regis-gold hover:bg-yellow-600 text-regis-navy font-semibold text-xs sm:text-sm"
                                            onClick={() => updateStatusMutation.mutate({ ticketNumber: ticket.ticketNumber, status: 'retrieving' })}
                                            data-testid={`button-start-retrieval-desktop-${ticket.ticketNumber}`}
                                          >
                                            <Play size={14} className="mr-1" /> Retrieve
                                          </Button>
                                          <Button size="sm"
                                            className={`flex-1 font-semibold text-xs sm:text-sm ${ticket.scheduledRetrievalAt ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                                            onClick={() => {
                                              if (desktopSchedulingId === ticket.id) {
                                                setDesktopSchedulingId(null);
                                                setDesktopScheduleInput('');
                                              } else {
                                                if (ticket.scheduledRetrievalAt) {
                                                  const d = new Date(ticket.scheduledRetrievalAt as unknown as string);
                                                  const pad = (n: number) => n.toString().padStart(2, '0');
                                                  setDesktopScheduleInput(`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
                                                } else {
                                                  setDesktopScheduleInput('');
                                                }
                                                setDesktopSchedulingId(ticket.id);
                                              }
                                            }}
                                          >
                                            <CalendarDays size={13} className="mr-1" /> Schedule
                                          </Button>
                                        </div>
                                        {/* Row 2: Departed | Auto Close */}
                                        <div className="flex gap-1.5">
                                          <Button size="sm"
                                            className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold text-xs"
                                            onClick={() => departMutation.mutate(ticket.ticketNumber)}
                                          >
                                            <LogOut size={13} className="mr-1" /> Departed
                                          </Button>
                                          <Button size="sm"
                                            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs"
                                            onClick={() => {
                                              setAutoCloseTicket(ticket);
                                              const today = new Date();
                                              const localDate = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
                                              const localTime = `${String(today.getHours()).padStart(2,'0')}:${String(today.getMinutes()).padStart(2,'0')}`;
                                              setAutoCloseDate(localDate);
                                              setAutoCloseTime(localTime);
                                            }}
                                          >
                                            <Timer size={13} className="mr-1" /> Auto Close
                                          </Button>
                                        </div>
                                        {/* Print Ticket */}
                                        <Button size="sm" variant="outline"
                                          className="w-full text-xs border-regis-navy text-regis-navy hover:bg-regis-navy hover:text-white font-semibold"
                                          onClick={() => printFullTicket(ticket)}
                                        >
                                          <Printer size={13} className="mr-1" /> Print Ticket
                                        </Button>
                                        {/* Inline schedule picker */}
                                        {desktopSchedulingId === ticket.id && (
                                          <div className="bg-blue-50 border border-blue-200 rounded p-2 space-y-1.5">
                                            <input
                                              type="datetime-local"
                                              className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                                              value={desktopScheduleInput}
                                              min={new Date().toISOString().slice(0, 16)}
                                              onChange={e => setDesktopScheduleInput(e.target.value)}
                                            />
                                            <div className="flex gap-1.5">
                                              <Button size="sm"
                                                disabled={!desktopScheduleInput || desktopScheduleSaving}
                                                className="flex-1 h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                                                onClick={async () => {
                                                  if (!desktopScheduleInput) return;
                                                  setDesktopScheduleSaving(true);
                                                  try {
                                                    const resp = await fetch(`/api/staff/tickets/${ticket.ticketNumber}/schedule-retrieval`, {
                                                      method: 'POST',
                                                      headers: { 'Content-Type': 'application/json' },
                                                      body: JSON.stringify({ scheduledAt: new Date(desktopScheduleInput).toISOString() }),
                                                    });
                                                    if (!resp.ok) {
                                                      const err = await resp.json().catch(() => ({}));
                                                      alert((err as { message?: string }).message ?? 'Failed to schedule');
                                                      return;
                                                    }
                                                    queryClient.invalidateQueries({ queryKey: ["/api/staff/tickets"] });
                                                    setDesktopSchedulingId(null);
                                                    setDesktopScheduleInput('');
                                                  } catch { alert('Failed to schedule'); }
                                                  finally { setDesktopScheduleSaving(false); }
                                                }}
                                              >
                                                {desktopScheduleSaving ? <Loader2 size={12} className="animate-spin" /> : 'Set'}
                                              </Button>
                                              {ticket.scheduledRetrievalAt && (
                                                <Button size="sm"
                                                  className="flex-1 h-7 text-xs bg-red-500 hover:bg-red-600 text-white"
                                                  onClick={async () => {
                                                    try {
                                                      await fetch(`/api/staff/tickets/${ticket.ticketNumber}/schedule-retrieval`, { method: 'DELETE' });
                                                      queryClient.invalidateQueries({ queryKey: ["/api/staff/tickets"] });
                                                      setDesktopSchedulingId(null);
                                                    } catch { alert('Failed to clear'); }
                                                  }}
                                                >Clear</Button>
                                              )}
                                              <Button size="sm" variant="outline" className="h-7 text-xs px-2"
                                                onClick={() => { setDesktopSchedulingId(null); setDesktopScheduleInput(''); }}
                                              >✕</Button>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                          );
                          return (
                            <SortablePanel key="in-house" id="in-house"
                              title="Cars Parked On-Site"
                              badge={<Badge className="bg-regis-navy text-white text-sm px-3 py-1 ml-2">{allActiveD.length}</Badge>}
                              icon={<Clock className="text-regis-navy" size={18} />}
                              expanded={isExpanded} onToggle={toggle}
                              fontSize={getSectionFontSize('in-house')} onFontSizeChange={s => setSectionFont('in-house', s)}
                            >
                              {ticketsLoading ? <div className="text-center py-6">Loading tickets...</div> : (
                                <div>
                                  {/* Sort control */}
                                  <div className="flex items-center justify-end gap-2 mb-3">
                                    <span className="text-xs text-gray-400 font-medium">Sort:</span>
                                    <select
                                      value={inHouseSortBy}
                                      onChange={e => setInHouseSortBy(e.target.value as any)}
                                      className="text-xs border border-gray-200 rounded px-2 py-1 text-gray-600 bg-white focus:outline-none"
                                    >
                                      <option value="newest">Newest first</option>
                                      <option value="oldest">Oldest first</option>
                                      <option value="name_az">Name A→Z</option>
                                      <option value="name_za">Name Z→A</option>
                                      <option value="ticket_asc">Ticket ↑</option>
                                      <option value="ticket_desc">Ticket ↓</option>
                                    </select>
                                  </div>
                                  {/* Fresh section */}
                                  <div className="mb-4">
                                    <div className="flex items-center gap-2 mb-2 pb-1 border-b border-green-200">
                                      <span className="w-2.5 h-2.5 rounded-full bg-green-400 flex-shrink-0" />
                                      <span className="text-xs font-bold text-green-700 uppercase tracking-wide">Under 24h</span>
                                      <span className="ml-auto text-xs font-semibold text-green-600 bg-green-50 border border-green-200 rounded-full px-2">{freshD.length}</span>
                                    </div>
                                    {freshD.length > 0 ? (
                                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                                        {freshD.map(renderDesktopCard)}
                                      </div>
                                    ) : (
                                      <p className="text-xs text-gray-400 text-center py-2">None</p>
                                    )}
                                  </div>
                                  {/* Overnight section */}
                                  <div>
                                    <div className="flex items-center gap-2 mb-2 pb-1 border-b border-amber-200">
                                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400 flex-shrink-0" />
                                      <span className="text-xs font-bold text-amber-700 uppercase tracking-wide">Overnight 24h+</span>
                                      <span className="ml-auto text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2">{overnightD.length}</span>
                                    </div>
                                    {overnightD.length > 0 ? (
                                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                                        {overnightD.map(renderDesktopCard)}
                                      </div>
                                    ) : (
                                      <p className="text-xs text-gray-400 text-center py-2">None</p>
                                    )}
                                  </div>
                                  {allActiveD.length === 0 && (
                                    <div className="text-center py-6 sm:py-8 text-gray-400">
                                      <Clock size={36} className="mx-auto mb-2 opacity-40" />
                                      <p className="text-sm">No vehicles in house</p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </SortablePanel>
                          );
                        }

                        if (panelId === 'retrievals') return (
                          <SortablePanel key="retrievals" id="retrievals"
                            title="Active Retrievals"
                            badge={<Badge className="bg-orange-500 text-white text-sm px-3 py-1 ml-2">{activeTickets?.filter(t => ['retrieving', 'transit', 'preparing'].includes(t.status)).length || 0}</Badge>}
                            icon={<Car className="text-orange-500" size={18} />}
                            expanded={isExpanded} onToggle={toggle}
                            fontSize={getSectionFontSize('retrievals')} onFontSizeChange={s => setSectionFont('retrievals', s)}
                          >
                            <UnifiedRetrievalBox
                              tickets={(activeTickets || []).filter(t => t.status !== 'ready')}
                              canEdit={canEdit}
                              onStatusChange={(ticketNumber, status) => { updateStatusMutation.mutate({ ticketNumber, status }); }}
                              onStageComplete={(ticketNumber, nextStage) => {
                                const statusMap: Record<number, string> = { 2: 'transit', 3: 'preparing', 4: 'ready' };
                                const newStatus = statusMap[nextStage];
                                if (newStatus) updateStatusMutation.mutate({ ticketNumber, status: newStatus });
                              }}
                            />
                          </SortablePanel>
                        );

                        if (panelId === 'ready') {
                          const readyTickets = activeTickets?.filter(t => t.status === 'ready') || [];
                          return (
                            <SortablePanel key="ready" id="ready"
                              title="Ready for Collection"
                              badge={<Badge className="bg-green-600 text-white text-sm px-3 py-1 ml-2">{readyTickets.length}</Badge>}
                              icon={<Check className="text-green-600" size={18} />}
                              borderClass="border-green-200" headerClass="text-green-700"
                              expanded={isExpanded} onToggle={toggle}
                              fontSize={getSectionFontSize('ready')} onFontSizeChange={s => setSectionFont('ready', s)}
                            >
                              {readyTickets.length === 0 ? (
                                <div className="text-center py-8 text-gray-400">
                                  <Check size={36} className="mx-auto mb-2 opacity-40" />
                                  <p className="text-sm">No cars ready for collection</p>
                                </div>
                              ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                  {readyTickets.map((ticket) => (
                                    <div key={ticket.id} className="rounded-lg p-4 bg-green-50 border-2 border-green-300 shadow-sm flex flex-col gap-3">
                                      <div className="flex justify-between items-start">
                                        <div>
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <p className="font-bold text-green-800" style={{ fontSize: 'var(--panel-card-title-size, 14px)' }}>#{ticket.ticketNumber}</p>
                                            {ticket.parkingLocation && (
                                              <span className="inline-flex items-center px-1.5 py-0 rounded-full font-bold bg-green-100 text-green-700 border border-green-300" style={{ fontSize: 'var(--panel-card-title-size, 14px)' }}>
                                                {ticket.parkingLocation}
                                              </span>
                                            )}
                                          </div>
                                          <p className="font-semibold text-green-900 mt-0.5" style={{ fontSize: 'var(--panel-card-title-size, 14px)' }}>{fmtGuest(ticket.guestName)}</p>
                                          <p className="text-xs text-gray-500 mt-0.5">{ticket.carMake} {ticket.carModel} · {ticket.carColor}</p>
                                          <p className="text-xs text-gray-400 font-mono mt-0.5">{ticket.licensePlate}</p>
                                        </div>
                                        <div className="flex gap-1">
                                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setViewTicket(ticket)}>
                                            <Eye size={15} className="text-gray-500" />
                                          </Button>
                                          {canEdit && (
                                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setEditTicketData(ticket)}>
                                              <Edit size={15} className="text-gray-500" />
                                            </Button>
                                          )}
                                        </div>
                                      </div>
                                      {canEdit && (
                                        <div className="flex gap-2 pt-2 border-t border-green-200">
                                          <Button size="sm" className="flex-1 h-8 text-xs bg-gray-700 hover:bg-gray-800 text-white"
                                            onClick={() => updateStatusMutation.mutate({ ticketNumber: ticket.ticketNumber, status: 'completed' })}>
                                            Departed
                                          </Button>
                                          <Button size="sm" className="flex-1 h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                                            onClick={() => updateStatusMutation.mutate({ ticketNumber: ticket.ticketNumber, status: 'out_with_guest' })}>
                                            Coming Back
                                          </Button>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </SortablePanel>
                          );
                        }

                        if (panelId === 'guest-out') return (
                          <SortablePanel key="guest-out" id="guest-out"
                            title="Out Returning Later"
                            badge={<Badge className="bg-blue-600 text-white text-sm px-3 py-1 ml-2">{activeTickets?.filter(t => t.status === 'out_with_guest').length || 0}</Badge>}
                            icon={<Car className="text-blue-700" size={18} />}
                            borderClass="border-blue-200" headerClass="text-blue-700"
                            expanded={isExpanded} onToggle={toggle}
                            fontSize={getSectionFontSize('guest-out')} onFontSizeChange={s => setSectionFont('guest-out', s)}
                          >
                            {activeTickets?.filter(t => t.status === 'out_with_guest').length === 0 ? (
                              <div className="text-center py-6 text-gray-400">
                                <Car size={36} className="mx-auto mb-2 opacity-40" />
                                <p className="text-sm">No cars out with guests</p>
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {activeTickets?.filter(t => t.status === 'out_with_guest').map((ticket) => (
                                  <GuestOutCardFull key={ticket.id} ticket={ticket}
                                    onBack={() => guestReturnedMutation.mutate(ticket.ticketNumber)}
                                    onView={() => setViewTicket(ticket)} canEdit={canEdit} />
                                ))}
                              </div>
                            )}
                          </SortablePanel>
                        );

                        if (panelId === 'departed-today') return (
                          <SortablePanel key="departed-today" id="departed-today"
                            title="Checked-Out Departures Today"
                            badge={<span className="ml-2 bg-gray-200 text-gray-700 text-xs font-bold px-2 py-0.5 rounded-full">{departedToday.length}</span>}
                            icon={<LogOut className="text-gray-600" size={18} />} headerClass="text-gray-600"
                            expanded={isExpanded} onToggle={toggle}
                            fontSize={getSectionFontSize('departed-today')} onFontSizeChange={s => setSectionFont('departed-today', s)}
                          >
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                              {departedToday.length === 0 ? (
                                <div className="col-span-full text-center py-6 text-gray-400">
                                  <LogOut size={36} className="mx-auto mb-2 opacity-40" />
                                  <p className="text-sm">No departures today yet</p>
                                </div>
                              ) : departedToday.map(t => <DepartedCard key={t.id} ticket={t} />)}
                            </div>
                          </SortablePanel>
                        );

                        if (panelId === 'departed-history') return (
                          <SortablePanel key="departed-history" id="departed-history"
                            title="Checked-Out Departure History"
                            badge={<span className="ml-2 bg-gray-200 text-gray-600 text-xs font-bold px-2 py-0.5 rounded-full">{departedHistory.length}</span>}
                            icon={<LogOut className="text-gray-500" size={18} />} headerClass="text-gray-500"
                            expanded={isExpanded} onToggle={toggle}
                            fontSize={getSectionFontSize('departed-history')} onFontSizeChange={s => setSectionFont('departed-history', s)}
                          >
                            {(() => {
                              const availableYears = Array.from(new Set(departedHistory.map(t => t.updatedAt ? new Date(t.updatedAt).getFullYear().toString() : null).filter(Boolean))).sort((a,b) => Number(b)-Number(a)) as string[];
                              const daysInMonth = (() => {
                                if (historyFilterMonth === 'all') return Array.from({length:31},(_,i)=>(i+1).toString());
                                const year = historyFilterYear !== 'all' ? Number(historyFilterYear) : new Date().getFullYear();
                                const count = new Date(year, Number(historyFilterMonth), 0).getDate();
                                return Array.from({length:count},(_,i)=>(i+1).toString());
                              })();
                              const filtered = departedHistory.filter(t => {
                                if (!t.updatedAt) return historyFilterYear === 'all' && historyFilterMonth === 'all' && historyFilterDay === 'all';
                                const d = new Date(t.updatedAt);
                                if (historyFilterYear !== 'all' && d.getFullYear().toString() !== historyFilterYear) return false;
                                if (historyFilterMonth !== 'all' && (d.getMonth()+1).toString() !== historyFilterMonth) return false;
                                if (historyFilterDay !== 'all' && d.getDate().toString() !== historyFilterDay) return false;
                                return true;
                              });
                              const hasFilter = historyFilterYear !== 'all' || historyFilterMonth !== 'all' || historyFilterDay !== 'all';
                              return (
                                <>
                                  <div className="mb-4 rounded-lg border border-gray-200 overflow-hidden">
                                    <button onClick={() => setHistorySearchExpanded(!historySearchExpanded)}
                                      className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Search:</span>
                                        {hasFilter && !historySearchExpanded && (
                                          <span className="text-xs bg-regis-navy text-white px-1.5 py-0.5 rounded font-medium">
                                            {filtered.length} result{filtered.length !== 1 ? 's' : ''}
                                          </span>
                                        )}
                                      </div>
                                      <ChevronDown size={14} className={`text-gray-400 transition-transform ${historySearchExpanded ? 'rotate-180' : ''}`} />
                                    </button>
                                    {historySearchExpanded && (
                                      <div className="p-3 bg-gray-50 border-t border-gray-200 space-y-3">
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs text-gray-500 w-10 shrink-0">Year</span>
                                          <select value={historyFilterYear} onChange={e => { setHistoryFilterYear(e.target.value); setHistoryFilterMonth('all'); setHistoryFilterDay('all'); }}
                                            className="text-sm border border-gray-300 rounded-md px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-regis-gold">
                                            <option value="all">All</option>
                                            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                                          </select>
                                        </div>
                                        <div className="flex items-start gap-2">
                                          <span className="text-xs text-gray-500 w-10 shrink-0 pt-1">Month</span>
                                          <div className="grid grid-cols-6 gap-1">
                                            {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((abbr, i) => {
                                              const val = (i+1).toString(); const active = historyFilterMonth === val;
                                              return <button key={val} onClick={() => { setHistoryFilterMonth(active ? 'all' : val); setHistoryFilterDay('all'); }}
                                                className={`text-xs px-1.5 py-1 rounded font-medium transition-colors ${active ? 'bg-regis-navy text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-100'}`}>{abbr}</button>;
                                            })}
                                          </div>
                                        </div>
                                        <div className="flex items-start gap-2">
                                          <span className="text-xs text-gray-500 w-10 shrink-0 pt-1">Day</span>
                                          <div className="grid grid-cols-10 gap-1">
                                            {daysInMonth.map(d => {
                                              const active = historyFilterDay === d;
                                              return <button key={d} onClick={() => setHistoryFilterDay(active ? 'all' : d)}
                                                className={`text-xs px-1.5 py-1 rounded font-medium transition-colors ${active ? 'bg-regis-navy text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-100'}`}>{d}</button>;
                                            })}
                                          </div>
                                        </div>
                                        <div className="flex items-center justify-between pt-1">
                                          <span className="text-xs text-gray-400">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
                                          {hasFilter && (
                                            <button onClick={() => { setHistoryFilterYear('all'); setHistoryFilterMonth('all'); setHistoryFilterDay('all'); }}
                                              className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-0.5 rounded border border-red-200 hover:bg-red-50 transition-colors">Clear</button>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                                    {filtered.length === 0 ? (
                                      <div className="col-span-full text-center py-6 text-gray-400">
                                        <LogOut size={36} className="mx-auto mb-2 opacity-40" />
                                        <p className="text-sm">{hasFilter ? 'No departures match this filter' : 'No historical departures'}</p>
                                      </div>
                                    ) : filtered.map(t => <DepartedCard key={t.id} ticket={t} />)}
                                  </div>
                                </>
                              );
                            })()}
                          </SortablePanel>
                        );


                        return null;
                      })}
                    </div>
                  </SortableContext>
                </DndContext>
              );
            })()}

            {/* Stats Summary - At bottom (hidden on mobile when compact view is on) */}
            <div className="grid grid-cols-2 gap-4 mt-4 hidden sm:grid">
              <Card className="shadow-sm">
                <CardContent className="p-4 text-center">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                    <Check className="text-gray-600" size={18} />
                  </div>
                  <p className="text-xl font-bold text-gray-900">{statsLoading ? '-' : stats?.completed || 0}</p>
                  <p className="text-xs text-gray-600">Completed Today</p>
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardContent className="p-4 text-center">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                    <Timer className="text-purple-600" size={18} />
                  </div>
                  <p className="text-xl font-bold text-gray-900">{statsLoading ? '-' : stats?.avgTime || '—'}</p>
                  <p className="text-xs text-gray-600">Avg. Time</p>
                </CardContent>
              </Card>
            </div>
            </>)}

          </TabsContent>

          {/* User Management Tab */}
          {user?.role === 'superadmin' && (
            <TabsContent value="users" className="space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-xl font-semibold text-regis-navy">User Management</h2>
                <div className="flex items-center gap-2">
                  {workingOUId && (
                    <span className="text-xs px-2 py-1 rounded-full bg-regis-navy/10 text-regis-navy font-medium">
                      {allOUs?.find(o => o.id === workingOUId)?.name ?? 'Selected OU'}
                    </span>
                  )}
                  <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => setShowOUPicker(true)}>
                    <Building2 size={13} /> Switch OU
                  </Button>
                </div>
              </div>

              <Card>
                <CardContent className="p-6">
                  {usersLoading ? (
                    <div className="text-center py-8">Loading users...</div>
                  ) : (
                    <div className="space-y-4">
                      {(allUsers ?? [])
                        .filter(u => !workingOUId || (u as any).ouId === workingOUId || u.role === 'superadmin')
                        .map((staffUser) => (
                        <div key={staffUser.id} className="border border-gray-200 rounded-lg p-4 flex justify-between items-center gap-2">
                          <div className="min-w-0">
                            <p className="font-medium">{staffUser.firstName} {staffUser.lastName}</p>
                            <p className="text-sm text-gray-600 truncate">{staffUser.email}</p>
                            <p className="text-xs text-gray-500 capitalize">{staffUser.role?.replace(/_/g, ' ')}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => { setEditUserData(staffUser); setShowPassword(false); }}
                              data-testid={`button-edit-user-${staffUser.id}`}
                            >
                              <Edit size={14} className="mr-1" /> Edit
                            </Button>
                            {staffUser.role !== 'superadmin' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-red-200 text-red-600 hover:bg-red-50"
                                onClick={() => setDeleteUserTarget(staffUser)}
                                disabled={deleteUserMutation.isPending}
                                data-testid={`button-delete-user-${staffUser.id}`}
                              >
                                <Trash2 size={14} />
                              </Button>
                            )}
                            <Badge variant={staffUser.role === 'superadmin' ? 'default' : 'secondary'}>
                              {staffUser.role?.replace(/_/g, ' ')}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Ticket Management Tab */}
          {user?.role === 'superadmin' && (
            <TabsContent value="tickets" className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-regis-navy">Ticket Management</h2>
              </div>

              <Card>
                <CardContent className="p-3 sm:p-6">
                  {allTicketsLoading ? (
                    <div className="text-center py-8">Loading tickets...</div>
                  ) : (
                    <div className="space-y-3 sm:space-y-4">
                      {allTickets?.map((ticket) => (
                        <div key={ticket.id} className={`rounded-lg p-3 sm:p-4 border-2 ${ticket.parkingLocation ? 'border-green-400 bg-green-50/30' : 'border-red-400 bg-red-50/30'}`}>
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 sm:gap-0 mb-3">
                            <div className="flex items-center justify-between sm:block">
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-medium text-sm sm:text-base">Ticket #{ticket.ticketNumber}</p>
                                  <span className={`inline-flex items-center px-1.5 py-0 rounded-full font-bold ${ticket.parkingLocation ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-red-100 text-red-700 border border-red-300'}`} style={{ fontSize: 'var(--panel-card-title-size, 14px)' }}>
                            
                                    {ticket.parkingLocation || 'Unassigned'}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-500 sm:hidden">
                                  {ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString() : 'Unknown'}
                                </p>
                              </div>
                              <Badge variant={
                                ticket.status === 'completed' ? 'default' :
                                ticket.status === 'ready' ? 'default' :
                                ticket.status === 'cancelled' ? 'destructive' :
                                ticket.status === 'transit' ? 'secondary' : 'outline'
                              } className="text-xs">
                                {ticket.status === 'cancelled' ? 'Archived' : ticket.status}
                              </Badge>
                            </div>
                            <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                              <p className="text-sm text-gray-500 mr-2 hidden sm:block">
                                {ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString() : 'Unknown'}
                              </p>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setViewTicket(ticket)}
                                className="h-7 sm:h-8 px-2 text-xs sm:text-sm"
                                data-testid={`button-view-ticket-${ticket.ticketNumber}`}
                              >
                                <Eye size={12} className="sm:mr-1" />
                                <span className="hidden sm:inline">View</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditTicketData(ticket)}
                                className="h-7 sm:h-8 px-2 text-xs sm:text-sm"
                                data-testid={`button-edit-ticket-${ticket.ticketNumber}`}
                              >
                                <Edit size={12} className="sm:mr-1" />
                                <span className="hidden sm:inline">Edit</span>
                              </Button>
                              {user?.role === 'superadmin' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setArchiveTicket(ticket)}
                                  className="h-7 sm:h-8 px-2 text-xs sm:text-sm text-orange-600 border-orange-300 hover:bg-orange-50"
                                  disabled={ticket.status === 'cancelled'}
                                  data-testid={`button-archive-ticket-${ticket.ticketNumber}`}
                                >
                                  <Archive size={12} className="sm:mr-1" />
                                  <span className="hidden sm:inline">Archive</span>
                                </Button>
                              )}
                              {user?.role === 'superadmin' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setDeleteTicket(ticket)}
                                  className="h-7 sm:h-8 px-2 text-xs sm:text-sm text-red-600 border-red-300 hover:bg-red-50"
                                  data-testid={`button-delete-ticket-${ticket.ticketNumber}`}
                                >
                                  <Trash2 size={12} className="sm:mr-1" />
                                  <span className="hidden sm:inline">Delete</span>
                                </Button>
                              )}
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-1 sm:gap-2 text-xs sm:text-sm text-gray-600">
                            {ticket.guestName && (
                              <p className="truncate"><strong>Guest:</strong> {fmtGuest(ticket.guestName)}</p>
                            )}
                            {ticket.carMake && ticket.carModel && (
                              <p className="truncate"><strong>Vehicle:</strong> {ticket.carMake} {ticket.carModel}</p>
                            )}
                            {ticket.licensePlate && (
                              <p className="truncate"><strong>Plate:</strong> {ticket.licensePlate}</p>
                            )}
                            {ticket.parkingLocation && (
                              <p className="truncate"><strong>Parking:</strong> {ticket.parkingLocation}</p>
                            )}
                          </div>
                          
                          {ticket.staffNotes && (
                            <p className="text-xs sm:text-sm text-gray-600 mt-2 line-clamp-2">
                              <strong>Notes:</strong> {ticket.staffNotes}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Reports Tab */}
          {(user?.role === 'superadmin' || user?.role === 'privilege_admin') && (
            <TabsContent value="reports" className="space-y-6">
              {(() => {
                const allTickets = activeTickets || [];
                const now = new Date();

                // Period boundaries
                const todayStart = new Date(now); todayStart.setHours(0,0,0,0);
                const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay()); weekStart.setHours(0,0,0,0);
                const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                const yearStart = new Date(now.getFullYear(), 0, 1);

                const completed = allTickets.filter(t => t.status === 'completed');
                const completedToday = completed.filter(t => t.updatedAt && new Date(t.updatedAt) >= todayStart);
                const completedWeek = completed.filter(t => t.updatedAt && new Date(t.updatedAt) >= weekStart);
                const completedMonth = completed.filter(t => t.updatedAt && new Date(t.updatedAt) >= monthStart);
                const completedYear = completed.filter(t => t.updatedAt && new Date(t.updatedAt) >= yearStart);

                // Avg stay time (in minutes) for completed tickets with totalStaySeconds
                const avgStay = (tickets: typeof completed) => {
                  const withTime = tickets.filter(t => t.totalStaySeconds && t.totalStaySeconds > 0);
                  if (!withTime.length) return null;
                  const avg = withTime.reduce((s, t) => s + (t.totalStaySeconds || 0), 0) / withTime.length;
                  const h = Math.floor(avg / 3600); const m = Math.floor((avg % 3600) / 60);
                  return h > 0 ? `${h}h ${m}m` : `${m}m`;
                };

                // Bar chart data
                const barData = (() => {
                  if (reportPeriod === 'day') {
                    return Array.from({length: 24}, (_, h) => ({
                      label: `${h.toString().padStart(2,'0')}:00`,
                      Departures: completedToday.filter(t => t.updatedAt && new Date(t.updatedAt).getHours() === h).length,
                      Arrivals: allTickets.filter(t => t.createdAt && new Date(t.createdAt) >= todayStart && new Date(t.createdAt).getHours() === h).length,
                    }));
                  }
                  if (reportPeriod === 'week') {
                    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
                    return days.map((d, i) => {
                      const dayStart = new Date(weekStart); dayStart.setDate(weekStart.getDate() + i);
                      const dayEnd = new Date(dayStart); dayEnd.setDate(dayStart.getDate() + 1);
                      return {
                        label: d,
                        Departures: completed.filter(t => t.updatedAt && new Date(t.updatedAt) >= dayStart && new Date(t.updatedAt) < dayEnd).length,
                        Arrivals: allTickets.filter(t => t.createdAt && new Date(t.createdAt) >= dayStart && new Date(t.createdAt) < dayEnd).length,
                      };
                    });
                  }
                  if (reportPeriod === 'month') {
                    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                    return Array.from({length: daysInMonth}, (_, i) => {
                      const d = i + 1;
                      const dayStart = new Date(now.getFullYear(), now.getMonth(), d);
                      const dayEnd = new Date(now.getFullYear(), now.getMonth(), d + 1);
                      return {
                        label: `${d}`,
                        Departures: completed.filter(t => t.updatedAt && new Date(t.updatedAt) >= dayStart && new Date(t.updatedAt) < dayEnd).length,
                        Arrivals: allTickets.filter(t => t.createdAt && new Date(t.createdAt) >= dayStart && new Date(t.createdAt) < dayEnd).length,
                      };
                    });
                  }
                  // year
                  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                  return months.map((m, i) => {
                    const mStart = new Date(now.getFullYear(), i, 1);
                    const mEnd = new Date(now.getFullYear(), i + 1, 1);
                    return {
                      label: m,
                      Departures: completed.filter(t => t.updatedAt && new Date(t.updatedAt) >= mStart && new Date(t.updatedAt) < mEnd).length,
                      Arrivals: allTickets.filter(t => t.createdAt && new Date(t.createdAt) >= mStart && new Date(t.createdAt) < mEnd).length,
                    };
                  });
                })();

                // Status pie data
                const statusCounts = [
                  { name: 'Cars Parked On-Site', value: allTickets.filter(t => t.status === 'active').length, color: '#1e3a5f' },
                  { name: 'Retrieving', value: allTickets.filter(t => t.status === 'retrieving' || t.status === 'transit').length, color: '#f59e0b' },
                  { name: 'Ready', value: allTickets.filter(t => t.status === 'ready').length, color: '#10b981' },
                  { name: 'Out Returning Later', value: allTickets.filter(t => t.status === 'out_with_guest').length, color: '#3b82f6' },
                  { name: 'Departed', value: allTickets.filter(t => t.status === 'completed').length, color: '#6b7280' },
                ].filter(s => s.value > 0);

                const periodLabel = reportPeriod === 'day' ? 'Today' : reportPeriod === 'week' ? 'This Week' : reportPeriod === 'month' ? 'This Month' : 'This Year';
                const periodCount = reportPeriod === 'day' ? completedToday.length : reportPeriod === 'week' ? completedWeek.length : reportPeriod === 'month' ? completedMonth.length : completedYear.length;
                const periodArrivals = reportPeriod === 'day'
                  ? allTickets.filter(t => t.createdAt && new Date(t.createdAt) >= todayStart).length
                  : reportPeriod === 'week' ? allTickets.filter(t => t.createdAt && new Date(t.createdAt) >= weekStart).length
                  : reportPeriod === 'month' ? allTickets.filter(t => t.createdAt && new Date(t.createdAt) >= monthStart).length
                  : allTickets.filter(t => t.createdAt && new Date(t.createdAt) >= yearStart).length;
                const periodAvg = reportPeriod === 'day' ? avgStay(completedToday) : reportPeriod === 'week' ? avgStay(completedWeek) : reportPeriod === 'month' ? avgStay(completedMonth) : avgStay(completedYear);

                return (
                  <div className="space-y-6">
                    {/* Header & Period Selector */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h2 className="text-xl font-bold text-regis-navy flex items-center gap-2">
                          <BarChart2 size={22} className="text-regis-gold" /> Operations Report
                        </h2>
                        <p className="text-sm text-gray-500 mt-0.5">Statistics and performance overview</p>
                      </div>
                      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 flex-wrap">
                        {(['day','week','month','year','storage'] as const).map(p => (
                          <button key={p} onClick={() => setReportPeriod(p)}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${reportPeriod === p ? 'bg-regis-navy text-white shadow-sm' : 'text-gray-600 hover:bg-white'}`}>
                            {p === 'day' ? 'Day' : p === 'week' ? 'Week' : p === 'month' ? 'Month' : p === 'year' ? 'Year' : 'Storage'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {reportPeriod !== 'storage' ? (
                      <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <Card className="border-l-4 border-l-regis-navy">
                        <CardContent className="p-4">
                          <p className="text-xs text-gray-500 uppercase tracking-wide">Arrivals</p>
                          <p className="text-3xl font-bold text-regis-navy mt-1">{periodArrivals}</p>
                          <p className="text-xs text-gray-400 mt-1">{periodLabel}</p>
                        </CardContent>
                      </Card>
                      <Card className="border-l-4 border-l-gray-400">
                        <CardContent className="p-4">
                          <p className="text-xs text-gray-500 uppercase tracking-wide">Departures</p>
                          <p className="text-3xl font-bold text-gray-600 mt-1">{periodCount}</p>
                          <p className="text-xs text-gray-400 mt-1">{periodLabel}</p>
                        </CardContent>
                      </Card>
                      <Card className="border-l-4 border-l-regis-gold">
                        <CardContent className="p-4">
                          <p className="text-xs text-gray-500 uppercase tracking-wide">Avg Stay</p>
                          <p className="text-3xl font-bold text-amber-600 mt-1">{periodAvg ?? '—'}</p>
                          <p className="text-xs text-gray-400 mt-1">{periodLabel}</p>
                        </CardContent>
                      </Card>
                      <Card className="border-l-4 border-l-green-500">
                        <CardContent className="p-4">
                          <p className="text-xs text-gray-500 uppercase tracking-wide">Currently In</p>
                          <p className="text-3xl font-bold text-green-600 mt-1">{allTickets.filter(t => t.status !== 'completed').length}</p>
                          <p className="text-xs text-gray-400 mt-1">Active tickets</p>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Bar Chart */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <TrendingUp size={18} className="text-regis-gold" />
                          Arrivals & Departures — {periodLabel}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {barData.every(d => d.Arrivals === 0 && d.Departures === 0) ? (
                          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                            <BarChart2 size={40} className="opacity-30 mb-2" />
                            <p className="text-sm">No data for this period yet</p>
                          </div>
                        ) : (
                          <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={barData} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={reportPeriod === 'month' ? 4 : reportPeriod === 'day' ? 3 : 0} />
                              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                              <Tooltip />
                              <Legend wrapperStyle={{ fontSize: 12 }} />
                              <Bar dataKey="Arrivals" fill="#1e3a5f" radius={[3,3,0,0]} />
                              <Bar dataKey="Departures" fill="#6b7280" radius={[3,3,0,0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        )}
                      </CardContent>
                    </Card>

                    {/* Status Breakdown Pie + Totals */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base flex items-center gap-2">
                            <CalendarDays size={18} className="text-regis-gold" />
                            Current Status Breakdown
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          {statusCounts.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                              <p className="text-sm">No active tickets</p>
                            </div>
                          ) : (
                            <ResponsiveContainer width="100%" height={220}>
                              <PieChart>
                                <Pie data={statusCounts} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                                  {statusCounts.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                                </Pie>
                                <Tooltip formatter={(value, name) => [value, name]} />
                                <Legend wrapperStyle={{ fontSize: 12 }} />
                              </PieChart>
                            </ResponsiveContainer>
                          )}
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base flex items-center gap-2">
                            <TrendingUp size={18} className="text-regis-gold" />
                            All-Time Totals
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 pt-2">
                          {[
                            { label: 'Total Tickets Ever', value: allTickets.length, color: 'text-regis-navy' },
                            { label: 'Total Departures', value: completed.length, color: 'text-gray-600' },
                            { label: 'Departed Today', value: completedToday.length, color: 'text-green-600' },
                            { label: 'Departed This Week', value: completedWeek.length, color: 'text-blue-600' },
                            { label: 'Departed This Month', value: completedMonth.length, color: 'text-amber-600' },
                            { label: 'Avg Stay (All Time)', value: avgStay(completed) ?? '—', color: 'text-purple-600' },
                          ].map(row => (
                            <div key={row.label} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                              <span className="text-sm text-gray-600">{row.label}</span>
                              <span className={`font-bold text-lg ${row.color}`}>{row.value}</span>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    </div>
                      </>
                    ) : (() => {
                      const ticketCount = allTickets.length;
                      const userCount = allUsers?.length ?? 0;
                      const imgBytes = ticketCount * 80 * 1024;
                      const textBytes = (ticketCount * 2 + userCount * 1) * 1024;
                      const docBytes = ticketCount * 12 * 1024;
                      const sessionBytes = userCount * 4 * 1024;
                      const totalBytes = imgBytes + textBytes + docBytes + sessionBytes;
                      const fmt = (b: number) => b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`;
                      const pct = (b: number) => totalBytes > 0 ? Math.round((b / totalBytes) * 100) : 0;
                      const categories = [
                        { label: 'Images', sublabel: 'License plate photos', bytes: imgBytes, color: 'bg-blue-500', textColor: 'text-blue-600', icon: '🖼️' },
                        { label: 'Documents', sublabel: 'PDF thermal labels', bytes: docBytes, color: 'bg-amber-500', textColor: 'text-amber-600', icon: '📄' },
                        { label: 'Text & Records', sublabel: 'Tickets, users & sessions', bytes: textBytes, color: 'bg-green-500', textColor: 'text-green-600', icon: '📝' },
                        { label: 'Sessions', sublabel: 'Auth & session data', bytes: sessionBytes, color: 'bg-purple-500', textColor: 'text-purple-600', icon: '🔐' },
                      ];
                      const pieData = categories.map(c => ({ name: c.label, value: c.bytes }));
                      const COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6'];
                      return (
                        <div className="space-y-6">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <Card className="border-l-4 border-l-blue-500 col-span-2 sm:col-span-1">
                              <CardContent className="p-4">
                                <p className="text-xs text-gray-500 uppercase tracking-wide">Total Estimated</p>
                                <p className="text-2xl font-bold text-regis-navy mt-1">{fmt(totalBytes)}</p>
                                <p className="text-xs text-gray-400 mt-1">Across all categories</p>
                              </CardContent>
                            </Card>
                            <Card className="border-l-4 border-l-blue-400">
                              <CardContent className="p-4">
                                <p className="text-xs text-gray-500 uppercase tracking-wide">Images</p>
                                <p className="text-2xl font-bold text-blue-600 mt-1">{fmt(imgBytes)}</p>
                                <p className="text-xs text-gray-400 mt-1">{pct(imgBytes)}% of total</p>
                              </CardContent>
                            </Card>
                            <Card className="border-l-4 border-l-amber-400">
                              <CardContent className="p-4">
                                <p className="text-xs text-gray-500 uppercase tracking-wide">Documents</p>
                                <p className="text-2xl font-bold text-amber-600 mt-1">{fmt(docBytes)}</p>
                                <p className="text-xs text-gray-400 mt-1">{pct(docBytes)}% of total</p>
                              </CardContent>
                            </Card>
                            <Card className="border-l-4 border-l-green-400">
                              <CardContent className="p-4">
                                <p className="text-xs text-gray-500 uppercase tracking-wide">Text & Records</p>
                                <p className="text-2xl font-bold text-green-600 mt-1">{fmt(textBytes)}</p>
                                <p className="text-xs text-gray-400 mt-1">{pct(textBytes)}% of total</p>
                              </CardContent>
                            </Card>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Card>
                              <CardHeader className="pb-2">
                                <CardTitle className="text-base flex items-center gap-2">
                                  <Database size={18} className="text-regis-gold" />
                                  Usage by Category
                                </CardTitle>
                              </CardHeader>
                              <CardContent>
                                <ResponsiveContainer width="100%" height={220}>
                                  <PieChart>
                                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                                      {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip formatter={(v: number) => fmt(v)} />
                                    <Legend wrapperStyle={{ fontSize: 12 }} />
                                  </PieChart>
                                </ResponsiveContainer>
                              </CardContent>
                            </Card>

                            <Card>
                              <CardHeader className="pb-2">
                                <CardTitle className="text-base flex items-center gap-2">
                                  <Database size={18} className="text-regis-gold" />
                                  Breakdown Detail
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-4 pt-2">
                                {categories.map(cat => (
                                  <div key={cat.label}>
                                    <div className="flex items-center justify-between mb-1">
                                      <div className="flex items-center gap-2">
                                        <span>{cat.icon}</span>
                                        <div>
                                          <p className="text-sm font-medium text-gray-800">{cat.label}</p>
                                          <p className="text-xs text-gray-400">{cat.sublabel}</p>
                                        </div>
                                      </div>
                                      <span className={`text-sm font-bold ${cat.textColor}`}>{fmt(cat.bytes)}</span>
                                    </div>
                                    <div className="w-full bg-gray-100 rounded-full h-2">
                                      <div className={`${cat.color} h-2 rounded-full transition-all`} style={{ width: `${pct(cat.bytes)}%` }} />
                                    </div>
                                    <p className="text-xs text-gray-400 mt-0.5 text-right">{pct(cat.bytes)}%</p>
                                  </div>
                                ))}
                              </CardContent>
                            </Card>
                          </div>

                          <Card className="border border-amber-200 bg-amber-50">
                            <CardContent className="p-4 flex items-start gap-3">
                              <span className="text-2xl">ℹ️</span>
                              <div>
                                <p className="text-sm font-medium text-amber-800">Estimated figures</p>
                                <p className="text-xs text-amber-700 mt-1">
                                  Calculated from record counts using typical file size estimates (plate image ≈ 80 KB, PDF label ≈ 12 KB, text record ≈ 1–3 KB).
                                  Based on <strong>{ticketCount}</strong> ticket{ticketCount !== 1 ? 's' : ''} and <strong>{userCount}</strong> user{userCount !== 1 ? 's' : ''}.
                                </p>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      );
                    })()}
                  </div>
                );
              })()}
            </TabsContent>
          )}

          {/* Backup Tab */}
          {(user?.role === 'superadmin' || user?.role === 'privilege_admin') && (
            <TabsContent value="backup" className="space-y-6">

              {/* Section 1 — Full Data Export */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Download size={20} className="text-regis-gold" />
                    Full Data Export
                  </CardTitle>
                  <p className="text-sm text-gray-500 mt-1">Export your data as a file. All data is scoped to your organization.</p>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Include in export</p>
                    <div className="flex flex-wrap gap-3">
                      {[
                        { label: 'Tickets', value: backupIncludeTickets, set: setBackupIncludeTickets },
                        { label: 'Staff Users', value: backupIncludeUsers, set: setBackupIncludeUsers },
                        { label: 'Locations', value: backupIncludeLocations, set: setBackupIncludeLocations },
                      ].map(({ label, value, set }) => (
                        <button key={label} onClick={() => set(!value)}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${value ? 'border-regis-gold bg-amber-50 text-amber-800' : 'border-gray-200 bg-white text-gray-500'}`}>
                          {value ? <CheckSquare size={15} /> : <Square size={15} />}
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Date range</p>
                    <div className="flex flex-wrap gap-2">
                      {(['1d','7d','30d','3m','6m','1y','all'] as const).map(r => (
                        <button key={r} onClick={() => setBackupRange(r)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${backupRange === r ? 'bg-regis-gold text-white border-regis-gold' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}>
                          {BACKUP_RANGE_LABELS[r]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Format</p>
                    <div className="flex flex-wrap gap-3">
                      <button onClick={() => setBackupFormat('csv')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${backupFormat === 'csv' ? 'border-regis-gold bg-amber-50 text-amber-800' : 'border-gray-200 bg-white text-gray-500'}`}>
                        <FileText size={15} />
                        CSV
                        <span className="text-xs font-normal opacity-60">— opens in Excel</span>
                      </button>
                      <button onClick={() => setBackupFormat('json')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${backupFormat === 'json' ? 'border-regis-gold bg-amber-50 text-amber-800' : 'border-gray-200 bg-white text-gray-500'}`}>
                        <FileJson size={15} />
                        JSON
                        <span className="text-xs font-normal opacity-60">— structured data</span>
                      </button>
                    </div>
                  </div>

                  <Button onClick={handleFullExport} disabled={backupLoading} className="bg-regis-gold hover:bg-amber-600 text-white gap-2">
                    {backupLoading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                    {backupLoading ? 'Preparing export…' : `Export as ${backupFormat.toUpperCase()}`}
                  </Button>
                </CardContent>
              </Card>

              {/* Section 2 — Departed History PDF */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileDown size={20} className="text-regis-gold" />
                    Departed History — PDF Report
                  </CardTitle>
                  <p className="text-sm text-gray-500 mt-1">Export a formatted PDF of all checked-out (departed) tickets. Ideal for record-keeping and audits.</p>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Date range</p>
                    <div className="flex flex-wrap gap-2">
                      {(['1d','7d','30d','3m','6m','1y','all'] as const).map(r => (
                        <button key={r} onClick={() => setPdfRange(r)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${pdfRange === r ? 'bg-regis-gold text-white border-regis-gold' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}>
                          {BACKUP_RANGE_LABELS[r]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Photo options */}
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Photos to include</p>
                    <div className="flex flex-wrap gap-3">
                      <button onClick={() => setPdfIncludeCarPhoto(!pdfIncludeCarPhoto)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${pdfIncludeCarPhoto ? 'border-regis-gold bg-amber-50 text-amber-800' : 'border-gray-200 bg-white text-gray-500'}`}>
                        {pdfIncludeCarPhoto ? <CheckSquare size={15} /> : <Square size={15} />}
                        Car photo
                        <span className="text-xs font-normal opacity-60">— full vehicle shot</span>
                      </button>
                      <button onClick={() => setPdfIncludePlatePhoto(!pdfIncludePlatePhoto)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${pdfIncludePlatePhoto ? 'border-regis-gold bg-amber-50 text-amber-800' : 'border-gray-200 bg-white text-gray-500'}`}>
                        {pdfIncludePlatePhoto ? <CheckSquare size={15} /> : <Square size={15} />}
                        Plate photo
                        <span className="text-xs font-normal opacity-60">— cropped plate image</span>
                      </button>
                    </div>
                    {(pdfIncludeCarPhoto || pdfIncludePlatePhoto) && (
                      <p className="text-xs text-amber-700 mt-1.5 ml-1">Photos are fetched from storage — generation may take longer for large exports.</p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200">
                    <FileText size={18} className="text-gray-400 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">What's included in the PDF</p>
                      <p className="text-xs text-gray-500">
                        Ticket #, Guest name, Car details, Plate number, Check-in & departure time, Stay duration, Visitor type
                        {pdfIncludeCarPhoto ? ' · Car photo' : ''}{pdfIncludePlatePhoto ? ' · Plate photo' : ''}
                      </p>
                    </div>
                  </div>

                  <Button onClick={handlePdfExport} disabled={pdfLoading} className="bg-regis-gold hover:bg-amber-600 text-white gap-2">
                    {pdfLoading ? <Loader2 size={15} className="animate-spin" /> : <FileDown size={15} />}
                    {pdfLoading ? 'Generating PDF…' : 'Download PDF Report'}
                  </Button>
                </CardContent>
              </Card>

            </TabsContent>
          )}

          {/* Security, Audit & Usage Tab — privilege_admin only */}
          {user?.role === 'privilege_admin' && (
            <TabsContent value="security" className="space-y-6">

              {/* Header + toggle */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-regis-navy flex items-center gap-2">
                    <Activity size={18} className="text-blue-600" />
                    Security, Audit &amp; Usage Data
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">Staff sessions scoped to your organisation. Live view refreshes every 30 s.</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setAuditViewMode('live')}
                    className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${auditViewMode === 'live' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    Live
                  </button>
                  <button
                    onClick={() => setAuditViewMode('archive')}
                    className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${auditViewMode === 'archive' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    Archive
                  </button>
                  {auditViewMode === 'live' && (
                    <button
                      onClick={() => refetchAudit()}
                      className="px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors flex items-center gap-1"
                    >
                      <Activity size={12} /> Refresh
                    </button>
                  )}
                </div>
              </div>

              {/* Archive date picker */}
              {auditViewMode === 'archive' && (
                <Card className="border-blue-100">
                  <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1">
                      <label className="text-xs font-medium text-gray-600 block mb-1">Select Archive Date</label>
                      <input
                        type="date"
                        value={auditArchiveDate}
                        max={new Date().toISOString().slice(0, 10)}
                        onChange={(e) => setAuditArchiveDate(e.target.value)}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-full sm:w-auto"
                      />
                    </div>
                    {(auditDates?.length ?? 0) > 0 && (
                      <div className="flex-1">
                        <label className="text-xs font-medium text-gray-600 block mb-1">Recent dates with activity</label>
                        <div className="flex flex-wrap gap-1.5">
                          {auditDates?.slice(0, 8).map(d => (
                            <button
                              key={d}
                              onClick={() => setAuditArchiveDate(d)}
                              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${auditArchiveDate === d ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:border-blue-400'}`}
                            >
                              {d}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Session cards */}
              {(() => {
                const isLive = auditViewMode === 'live';
                const loading = isLive ? auditLoading : auditArchiveLoading;
                const rows: any[] = isLive ? (auditSessions ?? []) : (auditArchiveResults ?? []);

                if (loading) return (
                  <div className="flex items-center justify-center py-16 text-gray-400 gap-2">
                    <Loader2 size={22} className="animate-spin" /> Loading session data…
                  </div>
                );

                if (!isLive && !auditArchiveDate) return (
                  <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
                    <Archive size={40} className="text-gray-300" />
                    <p className="text-sm">Pick a date above to browse archived sessions.</p>
                  </div>
                );

                if (rows.length === 0) return (
                  <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
                    <Monitor size={40} className="text-gray-300" />
                    <p className="text-sm">{isLive ? 'No active sessions in the last 30 minutes.' : 'No sessions found for this date.'}</p>
                  </div>
                );

                const roleBadge = (role: string) => {
                  const map: Record<string, string> = { superadmin: 'bg-purple-100 text-purple-700', privilege_admin: 'bg-yellow-100 text-yellow-700', standard_admin: 'bg-blue-100 text-blue-700', standard_user: 'bg-gray-100 text-gray-600' };
                  const label: Record<string, string> = { superadmin: 'Super Admin', privilege_admin: 'Privilege Admin', standard_admin: 'Standard Admin', standard_user: 'Standard User' };
                  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[role] ?? 'bg-gray-100 text-gray-600'}`}>{label[role] ?? role}</span>;
                };

                const DeviceIcon = ({ type }: { type: string }) => {
                  if (type === 'Mobile' || type === 'Tablet') return <Smartphone size={15} className="text-blue-500" />;
                  return <Monitor size={15} className="text-gray-500" />;
                };

                const fmtTime = (ts: string) => {
                  if (!ts) return '—';
                  const d = new Date(ts);
                  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                };

                const fmtDateTime = (ts: string) => {
                  if (!ts) return '—';
                  const d = new Date(ts);
                  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                };

                return (
                  <div className="space-y-3">
                    <p className="text-xs text-gray-500">{rows.length} session{rows.length !== 1 ? 's' : ''} {isLive ? 'active' : `on ${auditArchiveDate}`}</p>
                    {rows.map((s: any, i: number) => (
                      <Card key={s.id ?? i} className={`border ${isLive ? 'border-green-100 bg-green-50/30' : 'border-gray-100'}`}>
                        <CardContent className="p-4">
                          <div className="flex flex-col sm:flex-row sm:items-start gap-3">

                            {/* Avatar + name */}
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className="w-9 h-9 rounded-full bg-regis-navy/10 flex items-center justify-center flex-shrink-0">
                                <User size={16} className="text-regis-navy" />
                              </div>
                              <div className="min-w-0">
                                <div className="font-semibold text-regis-navy text-sm truncate">
                                  {s.displayName || s.username}
                                </div>
                                <div className="text-xs text-gray-500 truncate">{s.username}</div>
                              </div>
                              <div className="flex-shrink-0">{roleBadge(s.role)}</div>
                            </div>

                            {/* Time info */}
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 sm:text-right">
                              <span>First seen: <span className="font-medium text-gray-700">{fmtDateTime(s.firstSeenAt)}</span></span>
                              <span>Last active: <span className="font-medium text-gray-700">{fmtTime(s.lastSeenAt)}</span></span>
                            </div>
                          </div>

                          {/* Details row */}
                          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">

                            {/* IP + Geo */}
                            <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-100 px-3 py-2">
                              <Globe size={14} className="text-blue-500 flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-medium text-gray-700 truncate">{s.ipAddress || '—'}</span>
                                  {s.ipAddress && s.ipAddress !== 'Local' && (
                                    <a
                                      href={`https://www.iplocation.net/?query=${s.ipAddress}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-500 hover:text-blue-700 flex-shrink-0"
                                      title="Lookup IP location"
                                    >
                                      <Globe size={11} />
                                    </a>
                                  )}
                                </div>
                                <div className="text-xs text-gray-500 font-medium truncate">
                                  {[s.city, s.country].filter(Boolean).join(', ') || 'Unknown location'}
                                </div>
                              </div>
                            </div>

                            {/* Device */}
                            <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-100 px-3 py-2">
                              <DeviceIcon type={s.deviceType} />
                              <div className="min-w-0">
                                <div className="text-xs font-medium text-gray-700 truncate">{s.deviceType || '—'}</div>
                                <div className="text-xs text-gray-400 truncate">{s.os || '—'}</div>
                              </div>
                            </div>

                            {/* Browser */}
                            <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-100 px-3 py-2">
                              <Monitor size={14} className="text-gray-400 flex-shrink-0" />
                              <div className="min-w-0">
                                <div className="text-xs font-medium text-gray-700 truncate">{s.browser || '—'}</div>
                                <div className="text-xs text-gray-400">Browser</div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                );
              })()}

            </TabsContent>
          )}

          {/* License Tab — visible to ALL roles */}
          <TabsContent value="license" className="space-y-6">

            {/* ── Super Admin: full license management ─────────────────── */}
            {user?.role === 'superadmin' && (() => {
              const licensed = allLicenses?.filter(l => l.isActive) ?? [];
              const allOUCount = allOUs?.length ?? 0;
              const licensedOUIds = new Set(allLicenses?.map(l => l.ouId) ?? []);
              const unlicensed = allOUs?.filter(ou => !licensedOUIds.has(ou.id)) ?? [];

              function openIssueWizard(ou?: OrganizationalUnit) {
                setEditLicenseId(null);
                setLicenseForm({ ouId: ou?.id ?? '', orgName: ou?.name ?? '', address: '', contactNumber: '', version: 'professional', notes: '', validTo: '' });
                setLicenseWizardStep(1);
                setLicenseWizardOpen(true);
              }
              function openEditWizard(lic: OULicense) {
                setEditLicenseId(lic.id);
                setLicenseForm({ ouId: lic.ouId, orgName: lic.orgName, address: lic.address, contactNumber: lic.contactNumber, version: lic.version, notes: lic.notes ?? '', validTo: lic.validTo ? new Date(lic.validTo).toISOString().split('T')[0] : '' });
                setLicenseWizardStep(1);
                setLicenseWizardOpen(true);
              }

              return (
                <div className="space-y-6">
                  {/* Summary cards */}
                  <div className="grid grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="p-4 text-center">
                        <p className="text-2xl font-bold text-regis-navy">{allOUCount}</p>
                        <p className="text-xs text-gray-500 mt-1">Total OUs</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4 text-center">
                        <p className="text-2xl font-bold text-green-600">{licensed.length}</p>
                        <p className="text-xs text-gray-500 mt-1">Licensed</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4 text-center">
                        <p className="text-2xl font-bold text-amber-600">{unlicensed.length}</p>
                        <p className="text-xs text-gray-500 mt-1">Unlicensed</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Issue New License */}
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <ShieldCheck size={18} className="text-regis-gold" />
                        Software Licenses
                      </CardTitle>
                      <Button size="sm" className="bg-regis-navy hover:bg-blue-900 text-white gap-1" onClick={() => openIssueWizard()}>
                        <Plus size={14} /> Issue License
                      </Button>
                    </CardHeader>
                    <CardContent>
                      {licensesLoading ? (
                        <div className="flex items-center gap-2 text-sm text-gray-500 py-6 justify-center">
                          <Loader2 size={16} className="animate-spin" /> Loading…
                        </div>
                      ) : (allLicenses?.length ?? 0) === 0 ? (
                        <div className="text-center py-8 text-gray-400 text-sm">
                          <ShieldCheck size={32} className="mx-auto mb-2 opacity-30" />
                          No licenses issued yet. Click "Issue License" to begin.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {allLicenses?.map(lic => {
                            const ou = allOUs?.find(o => o.id === lic.ouId);
                            return (
                              <div key={lic.id} className={`border rounded-lg overflow-hidden ${lic.isActive ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50 opacity-60'}`}>
                                {/* Certificate image thumbnail */}
                                <div className="flex justify-center border-b border-amber-100 bg-amber-50 py-2">
                                  <img src={licenseCertImg} alt="Valet-S Software License" className="w-1/2 h-auto rounded" />
                                </div>
                                <div className="p-4 space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <p className="font-semibold text-sm text-regis-navy">{lic.orgName}</p>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${lic.version === 'enterprise' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                      {lic.version === 'enterprise' ? 'Enterprise' : 'Professional'}
                                    </span>
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${lic.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                      {lic.isActive ? 'Active' : 'Revoked'}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 text-xs font-mono text-gray-600 bg-white border rounded px-2 py-1">
                                  <Key size={11} className="text-gray-400 shrink-0" />
                                  <span className="flex-1 truncate">{lic.licenseKey}</span>
                                  <button
                                    className="text-gray-400 hover:text-regis-navy"
                                    onClick={() => { navigator.clipboard.writeText(lic.licenseKey); toast({ title: "Copied!", description: "License key copied to clipboard." }); }}
                                  >
                                    <Copy size={11} />
                                  </button>
                                </div>
                                <div className="flex gap-1 pt-1">
                                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openEditWizard(lic)}>
                                    <Edit size={11} className="mr-1" /> Edit
                                  </Button>
                                  <Button
                                    size="sm" variant="outline"
                                    className={`h-7 text-xs ${lic.isActive ? 'text-red-600 border-red-200 hover:bg-red-50' : 'text-green-600 border-green-200 hover:bg-green-50'}`}
                                    onClick={() => updateLicenseMutation.mutate({ id: lic.id, data: { isActive: !lic.isActive } })}
                                    disabled={updateLicenseMutation.isPending}
                                  >
                                    {lic.isActive ? <><Ban size={11} className="mr-1" />Revoke</> : <><CheckCircle2 size={11} className="mr-1" />Reinstate</>}
                                  </Button>
                                </div>
                                </div>{/* end p-4 content */}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* License Wizard Dialog */}
                  <Dialog open={licenseWizardOpen} onOpenChange={(open) => { if (!open) { setLicenseWizardOpen(false); setLicenseWizardStep(1); setEditLicenseId(null); } }}>
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <ShieldCheck size={18} className="text-regis-gold" />
                          {editLicenseId ? 'Edit License' : 'Issue New License'}
                        </DialogTitle>
                      </DialogHeader>
                      {/* Step indicator */}
                      <div className="flex items-center gap-2 text-xs mb-2">
                        {[1, 2, 3].map(s => (
                          <div key={s} className="flex items-center gap-1">
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${licenseWizardStep >= s ? 'bg-regis-navy text-white' : 'bg-gray-200 text-gray-500'}`}>{s}</span>
                            {s < 3 && <span className="text-gray-300">—</span>}
                          </div>
                        ))}
                        <span className="text-gray-500 ml-1">{licenseWizardStep === 1 ? 'Organization' : licenseWizardStep === 2 ? 'Details' : 'Review'}</span>
                      </div>

                      {/* Step 1: OU selection */}
                      {licenseWizardStep === 1 && (
                        <div className="space-y-4">
                          <div>
                            <label className="text-sm font-medium text-gray-700">Select OU</label>
                            <Select
                              value={licenseForm.ouId}
                              onValueChange={v => {
                                const ou = allOUs?.find(o => o.id === v);
                                setLicenseForm(f => ({ ...f, ouId: v, orgName: ou?.name ?? f.orgName }));
                              }}
                            >
                              <SelectTrigger className="mt-1"><SelectValue placeholder="Choose an organization unit…" /></SelectTrigger>
                              <SelectContent>
                                {allOUs?.map(ou => (
                                  <SelectItem key={ou.id} value={ou.id}>
                                    {ou.name}
                                    {licensedOUIds.has(ou.id) && !editLicenseId ? ' (has license)' : ''}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-700">Organization Name (for license)</label>
                            <Input className="mt-1" value={licenseForm.orgName} onChange={e => setLicenseForm(f => ({ ...f, orgName: e.target.value }))} placeholder="e.g. Sony Corporation" />
                          </div>
                          <div className="flex justify-end gap-2 pt-2">
                            <Button variant="outline" onClick={() => setLicenseWizardOpen(false)}>Cancel</Button>
                            <Button className="bg-regis-navy hover:bg-blue-900 text-white" disabled={!licenseForm.ouId || !licenseForm.orgName} onClick={() => setLicenseWizardStep(2)}>
                              Next →
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Step 2: Details */}
                      {licenseWizardStep === 2 && (
                        <div className="space-y-4">
                          <div>
                            <label className="text-sm font-medium text-gray-700">Address</label>
                            <Input className="mt-1" value={licenseForm.address} onChange={e => setLicenseForm(f => ({ ...f, address: e.target.value }))} placeholder="1-1 Namba, Chuo-ku, Osaka" />
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-700">Contact Number</label>
                            <Input className="mt-1" value={licenseForm.contactNumber} onChange={e => setLicenseForm(f => ({ ...f, contactNumber: e.target.value }))} placeholder="+81-6-0000-0000" />
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-700">License Version</label>
                            <Select value={licenseForm.version} onValueChange={v => setLicenseForm(f => ({ ...f, version: v }))}>
                              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="professional">Professional (APL-PRO-…)</SelectItem>
                                <SelectItem value="enterprise">Enterprise (APL-ENT-…)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-700">Valid To <span className="text-gray-400 font-normal">(expiry date)</span></label>
                            <Input type="date" className="mt-1" value={licenseForm.validTo} onChange={e => setLicenseForm(f => ({ ...f, validTo: e.target.value }))} />
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-700">Internal Notes <span className="text-gray-400 font-normal">(optional)</span></label>
                            <textarea
                              className="w-full mt-1 border border-gray-300 rounded-md p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
                              rows={2}
                              value={licenseForm.notes}
                              onChange={e => setLicenseForm(f => ({ ...f, notes: e.target.value }))}
                              placeholder="Any internal comments…"
                            />
                          </div>
                          <div className="flex justify-between gap-2 pt-2">
                            <Button variant="outline" onClick={() => setLicenseWizardStep(1)}>← Back</Button>
                            <Button className="bg-regis-navy hover:bg-blue-900 text-white" disabled={!licenseForm.address || !licenseForm.contactNumber} onClick={() => setLicenseWizardStep(3)}>
                              Next →
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Step 3: Review & Issue */}
                      {licenseWizardStep === 3 && (
                        <div className="space-y-4">
                          <div className="flex justify-center rounded-lg border border-amber-200 shadow-sm bg-amber-50 py-3">
                            <img src={licenseCertImg} alt="Valet-S Software License Certificate" className="w-1/2 h-auto rounded" />
                          </div>
                          <div className="bg-gray-50 border rounded-lg p-4 space-y-2 text-sm">
                            <div className="flex justify-between"><span className="text-gray-500">Organization</span><span className="font-medium">{licenseForm.orgName}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">Address</span><span className="font-medium text-right max-w-[55%]">{licenseForm.address}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">Contact</span><span className="font-medium">{licenseForm.contactNumber}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">Version</span><span className={`font-medium px-2 py-0.5 rounded text-xs ${licenseForm.version === 'enterprise' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>{licenseForm.version === 'enterprise' ? 'Enterprise' : 'Professional'}</span></div>
                            {licenseForm.validTo && <div className="flex justify-between"><span className="text-gray-500">Valid To</span><span className="font-medium">{new Date(licenseForm.validTo).toLocaleDateString()}</span></div>}
                            {licenseForm.notes && <div className="flex justify-between"><span className="text-gray-500">Notes</span><span className="font-medium text-right max-w-[55%]">{licenseForm.notes}</span></div>}
                            {!editLicenseId && <div className="flex justify-between pt-1 border-t mt-2"><span className="text-gray-500">Key (auto-generated)</span><span className="font-mono text-xs text-regis-navy">{licenseForm.version === 'enterprise' ? 'APL-ENT-XXXX-XXXX-XXXX' : 'APL-PRO-XXXX-XXXX-XXXX'}</span></div>}
                          </div>
                          <div className="flex justify-between gap-2 pt-2">
                            <Button variant="outline" onClick={() => setLicenseWizardStep(2)}>← Back</Button>
                            <Button
                              className="bg-regis-gold hover:bg-amber-600 text-white"
                              disabled={issueLicenseMutation.isPending || updateLicenseMutation.isPending}
                              onClick={() => {
                                if (editLicenseId) {
                                  updateLicenseMutation.mutate({ id: editLicenseId, data: { orgName: licenseForm.orgName, address: licenseForm.address, contactNumber: licenseForm.contactNumber, version: licenseForm.version, notes: licenseForm.notes, validTo: licenseForm.validTo || null } });
                                } else {
                                  issueLicenseMutation.mutate(licenseForm);
                                }
                              }}
                            >
                              {(issueLicenseMutation.isPending || updateLicenseMutation.isPending) ? <Loader2 size={14} className="animate-spin mr-1" /> : <ShieldCheck size={14} className="mr-1" />}
                              {editLicenseId ? 'Save Changes' : 'Issue License'}
                            </Button>
                          </div>
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>
                </div>
              );
            })()}

            {/* ── Privilege Admin: OU license card + branding editor ────── */}
            {user?.role === 'privilege_admin' && (() => {
              const lic = myLicense;
              const myOU = allOUs?.find(o => o.id === user?.ouId);
              return (
                <div className="space-y-6">
                  {/* License card */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        {myOU?.logoUrl ? (
                          <img src={myOU.logoUrl} alt="Logo" className="h-8 w-8 object-contain rounded border" onError={e => (e.currentTarget.style.display = 'none')} />
                        ) : (
                          <ShieldCheck size={18} className="text-regis-gold" />
                        )}
                        Your Software License
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {myLicenseLoading ? (
                        <div className="flex items-center gap-2 text-sm text-gray-500 py-4 justify-center"><Loader2 size={16} className="animate-spin" /> Loading…</div>
                      ) : !lic ? (
                        <div className="rounded-lg border-2 border-dashed border-amber-200 bg-amber-50 p-6 text-center space-y-2">
                          <ShieldCheck size={36} className="mx-auto text-amber-400" />
                          <p className="font-semibold text-amber-800 text-sm">No license issued yet</p>
                          <p className="text-xs text-amber-700">Your organization does not have a software license assigned. Please ask your Super Admin to issue one for your organization from their License tab.</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {/* Certificate image */}
                          <div className="flex justify-center rounded-xl border border-amber-200 shadow-md bg-amber-50 py-3">
                            <img src={licenseCertImg} alt="Valet-S Software License Certificate" className="w-1/2 h-auto rounded-lg" />
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div><p className="text-gray-500 text-xs">Organization</p><p className="font-semibold">{lic.orgName}</p></div>
                            <div><p className="text-gray-500 text-xs">Version</p><p className="font-semibold capitalize">{lic.version}</p></div>
                            <div><p className="text-gray-500 text-xs">Address</p><p className="font-medium">{lic.address}</p></div>
                            <div><p className="text-gray-500 text-xs">Contact</p><p className="font-medium">{lic.contactNumber}</p></div>
                            <div><p className="text-gray-500 text-xs">Status</p>
                              <span className={`inline-flex text-xs px-2 py-0.5 rounded-full font-medium ${lic.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {lic.isActive ? 'Active' : 'Revoked'}
                              </span>
                            </div>
                            <div className="flex gap-6">
                              <div><p className="text-gray-500 text-xs">Issued</p><p className="font-medium">{lic.issuedAt ? new Date(lic.issuedAt).toLocaleDateString() : '—'}</p></div>
                              <div><p className="text-gray-500 text-xs">Valid To</p><p className="font-medium">{lic.validTo ? new Date(lic.validTo).toLocaleDateString() : '—'}</p></div>
                            </div>
                          </div>
                          <div>
                            <p className="text-gray-500 text-xs mb-1">License Key</p>
                            <div className="flex items-center gap-2 bg-gray-50 border rounded px-3 py-2 font-mono text-xs text-regis-navy">
                              <Key size={12} className="text-gray-400 shrink-0" />
                              <span className="flex-1">{lic.licenseKey}</span>
                              <button className="text-gray-400 hover:text-regis-navy" onClick={() => { navigator.clipboard.writeText(lic.licenseKey); toast({ title: "Copied!", description: "License key copied." }); }}>
                                <Copy size={12} />
                              </button>
                            </div>
                          </div>
                          <div><p className="text-gray-500 text-xs mb-1">SPDX License</p><p className="text-sm font-mono">{lic.spdxLicense ?? 'Apache-2.0'}</p></div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Branding editor — only if license active */}
                  {lic?.isActive && (
                    <div>
                      <Button
                        variant="outline"
                        className="w-full border-dashed border-amber-300 text-amber-700 hover:bg-amber-50"
                        onClick={() => setShowBranding(v => !v)}
                      >
                        <Building2 size={15} className="mr-2" />
                        {showBranding ? 'Hide Customise' : 'Customise'}
                      </Button>
                      {showBranding && (
                        <Card className="mt-3">
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                              <Building2 size={18} className="text-regis-gold" />
                              Organization Branding
                            </CardTitle>
                            <p className="text-sm text-gray-500 mt-1">Customize your organization's logo and brand colors.</p>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div>
                              <label className="text-sm font-medium text-gray-700">Logo URL</label>
                              <Input className="mt-1" placeholder="https://cdn.example.com/logo.png" value={brandingForm.logoUrl} onChange={e => setBrandingForm(f => ({ ...f, logoUrl: e.target.value }))} />
                              {brandingForm.logoUrl && (
                                <img src={brandingForm.logoUrl} alt="Logo preview" className="mt-2 h-12 rounded border object-contain" onError={e => (e.currentTarget.style.display = 'none')} />
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="text-sm font-medium text-gray-700">Primary Color</label>
                                <div className="flex items-center gap-2 mt-1">
                                  <input type="color" value={brandingForm.primaryColor} onChange={e => setBrandingForm(f => ({ ...f, primaryColor: e.target.value }))} className="h-9 w-12 rounded border cursor-pointer" />
                                  <Input className="flex-1 font-mono text-sm" value={brandingForm.primaryColor} onChange={e => setBrandingForm(f => ({ ...f, primaryColor: e.target.value }))} />
                                </div>
                              </div>
                              <div>
                                <label className="text-sm font-medium text-gray-700">Accent Color</label>
                                <div className="flex items-center gap-2 mt-1">
                                  <input type="color" value={brandingForm.accentColor} onChange={e => setBrandingForm(f => ({ ...f, accentColor: e.target.value }))} className="h-9 w-12 rounded border cursor-pointer" />
                                  <Input className="flex-1 font-mono text-sm" value={brandingForm.accentColor} onChange={e => setBrandingForm(f => ({ ...f, accentColor: e.target.value }))} />
                                </div>
                              </div>
                            </div>
                            <Button className="bg-regis-navy hover:bg-blue-900 text-white" disabled={updateBrandingMutation.isPending} onClick={() => updateBrandingMutation.mutate(brandingForm)}>
                              {updateBrandingMutation.isPending ? <Loader2 size={14} className="animate-spin mr-1" /> : <Save size={14} className="mr-1" />}
                              Save Branding
                            </Button>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Standard Admin / Standard User: read-only license card ── */}
            {(user?.role === 'standard_admin' || user?.role === 'standard_user') && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ShieldCheck size={18} className="text-regis-gold" />
                    Software License
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {myLicenseLoading ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500 py-4 justify-center"><Loader2 size={16} className="animate-spin" /> Loading…</div>
                  ) : !myLicense ? (
                    <div className="text-center py-8 text-gray-400 text-sm">
                      <ShieldCheck size={32} className="mx-auto mb-2 opacity-30" />
                      No license information available.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Certificate image */}
                      <div className="flex justify-center rounded-xl border border-amber-200 shadow-md bg-amber-50 py-3">
                        <img src={licenseCertImg} alt="Valet-S Software License Certificate" className="w-1/2 h-auto rounded-lg" />
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div><p className="text-gray-500 text-xs">Organization</p><p className="font-semibold">{myLicense.orgName}</p></div>
                        <div><p className="text-gray-500 text-xs">Version</p><p className="font-semibold capitalize">{myLicense.version}</p></div>
                        <div><p className="text-gray-500 text-xs">Address</p><p className="font-medium">{myLicense.address}</p></div>
                        <div><p className="text-gray-500 text-xs">Contact</p><p className="font-medium">{myLicense.contactNumber}</p></div>
                        <div><p className="text-gray-500 text-xs">Status</p>
                          <span className={`inline-flex text-xs px-2 py-0.5 rounded-full font-medium ${myLicense.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {myLicense.isActive ? 'Active' : 'Revoked'}
                          </span>
                        </div>
                        <div className="flex gap-6">
                          <div><p className="text-gray-500 text-xs">Issued</p><p className="font-medium">{myLicense.issuedAt ? new Date(myLicense.issuedAt).toLocaleDateString() : '—'}</p></div>
                          <div><p className="text-gray-500 text-xs">Valid To</p><p className="font-medium">{myLicense.validTo ? new Date(myLicense.validTo).toLocaleDateString() : '—'}</p></div>
                        </div>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs mb-1">License Key</p>
                        <div className="flex items-center gap-2 bg-gray-50 border rounded px-3 py-2 font-mono text-xs text-regis-navy">
                          <Key size={12} className="text-gray-400 shrink-0" />
                          <span>{myLicense.licenseKey}</span>
                        </div>
                      </div>
                      <div><p className="text-gray-500 text-xs mb-1">SPDX License</p><p className="text-sm font-mono">{myLicense.spdxLicense ?? 'Apache-2.0'}</p></div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>


        </Tabs>

        {/* Roster NOTES popup */}
        <Dialog open={!!rosterNotesPopup} onOpenChange={(open) => { if (!open) setRosterNotesPopup(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText size={16} className="text-amber-600" />
                Roster Notes
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-1">
              <p className="text-xs text-gray-500">Ticket <span className="font-mono font-bold">#{rosterNotesPopup?.ticketNumber}</span></p>
              <textarea
                className="w-full border border-gray-300 rounded-md p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
                rows={5}
                placeholder="Enter notes…"
                value={rosterNotesPopup?.notes ?? ''}
                onChange={e => setRosterNotesPopup(prev => prev ? { ...prev, notes: e.target.value } : prev)}
              />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setRosterNotesPopup(null)}>Cancel</Button>
                <Button
                  size="sm"
                  className="bg-amber-500 hover:bg-amber-600 text-white"
                  disabled={rosterNotesMutation.isPending}
                  onClick={() => {
                    if (!rosterNotesPopup) return;
                    rosterNotesMutation.mutate(
                      { ticketNumber: rosterNotesPopup.ticketNumber, staffNotes: rosterNotesPopup.notes },
                      { onSuccess: () => setRosterNotesPopup(null) }
                    );
                  }}
                >
                  {rosterNotesMutation.isPending ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add User Modal */}
        <Dialog open={showAddUser} onOpenChange={setShowAddUser}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Staff User</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800 flex gap-2">
                <Mail size={14} className="shrink-0 mt-0.5" />
                <span>A welcome email will be sent automatically. The user logs in with their email — a verification code is sent every time. No password needed.</span>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Email</label>
                <Input
                  type="email"
                  value={newUserData.email}
                  onChange={(e) => setNewUserData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="staff@stregisosaka.com"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">First Name</label>
                <Input
                  value={newUserData.firstName}
                  onChange={(e) => setNewUserData(prev => ({ ...prev, firstName: e.target.value }))}
                  placeholder="John"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Last Name</label>
                <Input
                  value={newUserData.lastName}
                  onChange={(e) => setNewUserData(prev => ({ ...prev, lastName: e.target.value }))}
                  placeholder="Smith"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Role</label>
                <Select value={newUserData.role} onValueChange={(value) => setNewUserData(prev => ({ ...prev, role: value }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard_user">Standard User (view only)</SelectItem>
                    <SelectItem value="standard_admin">Standard Admin (operational)</SelectItem>
                    <SelectItem value="privilege_admin">Privilege Admin (OU management)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex space-x-2 pt-4">
                <Button
                  onClick={() => addUserMutation.mutate(newUserData)}
                  disabled={addUserMutation.isPending}
                  className="flex-1 bg-regis-navy hover:bg-blue-900"
                >
                  {addUserMutation.isPending ? "Adding..." : "Create & Send Invite"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowAddUser(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit User Modal */}
        <Dialog open={!!editUserData} onOpenChange={() => setEditUserData(null)}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit size={20} />
                Edit User
              </DialogTitle>
            </DialogHeader>
            {editUserData && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Email</label>
                  <Input
                    type="email"
                    value={editUserData.email || ''}
                    readOnly
                    className="mt-1 bg-gray-50"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">First Name</label>
                    <Input
                      value={editUserData.firstName || ''}
                      readOnly
                      className="mt-1 bg-gray-50"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Last Name</label>
                    <Input
                      value={editUserData.lastName || ''}
                      readOnly
                      className="mt-1 bg-gray-50"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Role</label>
                  <Input
                    value={editUserData.role?.replace('_', ' ') || ''}
                    readOnly
                    className="mt-1 bg-gray-50 capitalize"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Password Status</label>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant={editUserData.hasPassword ? 'default' : 'destructive'}>
                      {editUserData.hasPassword ? 'Password Set' : 'No Password'}
                    </Badge>
                  </div>
                </div>
                {editUserData.mustChangePassword && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                    <p className="text-sm text-yellow-800">
                      This user must change their password on next login.
                    </p>
                  </div>
                )}
                
                {/* Reset Password Section - Super Admin Only */}
                {user?.role === 'superadmin' && (
                  <div className="border-t pt-4 mt-4">
                    <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <Crown size={16} className="text-regis-gold" />
                      Reset User Password
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-gray-700">New Password</label>
                        <Input
                          type="password"
                          value={resetPasswordData.newPassword}
                          onChange={(e) => setResetPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                          placeholder="Enter new password (min 6 characters)"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700">Confirm Password</label>
                        <Input
                          type="password"
                          value={resetPasswordData.confirmPassword}
                          onChange={(e) => setResetPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                          placeholder="Confirm new password"
                          className="mt-1"
                        />
                      </div>
                      {resetPasswordData.newPassword && resetPasswordData.confirmPassword && 
                       resetPasswordData.newPassword !== resetPasswordData.confirmPassword && (
                        <p className="text-sm text-red-600">Passwords do not match</p>
                      )}
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="forceChange"
                          checked={resetPasswordData.forceChange}
                          onChange={(e) => setResetPasswordData(prev => ({ ...prev, forceChange: e.target.checked }))}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <label htmlFor="forceChange" className="text-sm text-gray-700">
                          Force password change on next login
                        </label>
                      </div>
                      <Button
                        onClick={() => {
                          if (resetPasswordData.newPassword !== resetPasswordData.confirmPassword) {
                            toast({ title: "Error", description: "Passwords do not match", variant: "destructive" });
                            return;
                          }
                          if (resetPasswordData.newPassword.length < 6) {
                            toast({ title: "Error", description: "Password must be at least 6 characters", variant: "destructive" });
                            return;
                          }
                          resetPasswordMutation.mutate({
                            userId: editUserData.id,
                            newPassword: resetPasswordData.newPassword,
                            forceChange: resetPasswordData.forceChange
                          });
                        }}
                        disabled={resetPasswordMutation.isPending || !resetPasswordData.newPassword || !resetPasswordData.confirmPassword}
                        className="w-full bg-regis-navy hover:bg-blue-900"
                      >
                        {resetPasswordMutation.isPending ? "Resetting..." : "Reset Password"}
                      </Button>
                    </div>
                  </div>
                )}
                
                <div className="flex justify-end pt-4 border-t">
                  <Button variant="outline" onClick={() => {
                    setEditUserData(null);
                    setResetPasswordData({ newPassword: '', confirmPassword: '', forceChange: true });
                  }}>
                    Close
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* OU Picker Modal — shown to superadmin on first entry */}
        <Dialog open={showOUPicker} onOpenChange={() => {}}>
          <DialogContent className="max-w-sm" onPointerDownOutside={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle className="text-regis-navy">Select Organization</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <p className="text-sm text-gray-500">Which organization are you working in right now?</p>
              <div className="space-y-2">
                {(allOUs || []).map((ou: any) => (
                  <button
                    key={ou.id}
                    className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-colors hover:bg-regis-navy hover:text-white hover:border-regis-navy ${workingOUId === ou.id ? 'border-regis-navy bg-regis-navy text-white' : 'border-gray-200 bg-white text-gray-900'}`}
                    onClick={() => setWorkingOUId(ou.id)}
                  >
                    <p className="font-medium text-sm">{ou.name}</p>
                  </button>
                ))}
              </div>
              <Button
                className="w-full bg-regis-gold hover:bg-amber-600 text-white mt-2"
                disabled={!workingOUId}
                onClick={() => setShowOUPicker(false)}
              >
                Enter Dashboard
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete User Confirmation */}
        <Dialog open={!!deleteUserTarget} onOpenChange={(open) => { if (!open) setDeleteUserTarget(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-red-700">Delete Account</DialogTitle>
            </DialogHeader>
            {deleteUserTarget && (
              <div className="space-y-4 pt-1">
                <p className="text-sm text-gray-700">
                  Permanently remove <span className="font-semibold">{[deleteUserTarget.firstName, deleteUserTarget.lastName].filter(Boolean).join(' ')}</span>?
                  This cannot be undone.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    className="flex-1 gap-1"
                    onClick={() => deleteUserMutation.mutate(deleteUserTarget.id)}
                    disabled={deleteUserMutation.isPending}
                  >
                    {deleteUserMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    Yes, delete
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={() => setDeleteUserTarget(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Password Change Modal - Required for users with mustChangePassword */}
        <Dialog 
          open={showPasswordChangeModal} 
          onOpenChange={(open) => {
            if (!user?.mustChangePassword) {
              setShowPasswordChangeModal(open);
            }
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle size={20} className="text-yellow-600" />
                Password Change Required
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {user?.mustChangePassword && (
                <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                  <p className="text-sm text-yellow-800">
                    You must change your password before continuing. This is required for first-time login.
                  </p>
                </div>
              )}
              {user?.hasPassword && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Current Password</label>
                  <Input
                    type="password"
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                    placeholder="Enter current password"
                    className="mt-1"
                  />
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-gray-700">New Password</label>
                <Input
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                  placeholder="Enter new password (min 6 characters)"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Confirm New Password</label>
                <Input
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  placeholder="Confirm new password"
                  className="mt-1"
                />
              </div>
              {passwordData.newPassword && passwordData.confirmPassword && 
               passwordData.newPassword !== passwordData.confirmPassword && (
                <p className="text-sm text-red-600">Passwords do not match</p>
              )}
              <div className="flex space-x-2 pt-4">
                <Button
                  onClick={() => {
                    if (passwordData.newPassword !== passwordData.confirmPassword) {
                      toast({ title: "Error", description: "Passwords do not match", variant: "destructive" });
                      return;
                    }
                    if (passwordData.newPassword.length < 6) {
                      toast({ title: "Error", description: "Password must be at least 6 characters", variant: "destructive" });
                      return;
                    }
                    changePasswordMutation.mutate({
                      currentPassword: passwordData.currentPassword,
                      newPassword: passwordData.newPassword
                    });
                  }}
                  disabled={changePasswordMutation.isPending || !passwordData.newPassword || !passwordData.confirmPassword}
                  className="flex-1 bg-regis-navy hover:bg-blue-900"
                >
                  {changePasswordMutation.isPending ? "Changing..." : "Change Password"}
                </Button>
                {!user?.mustChangePassword && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowPasswordChangeModal(false);
                      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* V-info Import Dialog (privilege_admin only) */}
        <Dialog open={showVInfoImport} onOpenChange={(o) => { if (!o) setShowVInfoImport(false); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText size={18} className="text-blue-600" />
                V-info Import
              </DialogTitle>
            </DialogHeader>

            {/* Tabs — hidden when showing success screen */}
            {vInfoImportedCount === null && (
              <div className="flex border-b mb-2">
                <button
                  onClick={() => setVInfoTab('import')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${vInfoTab === 'import' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  Import Names
                </button>
                <button
                  onClick={() => { setVInfoTab('manage'); queryClient.invalidateQueries({ queryKey: ['/api/name-imports/list'] }); }}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${vInfoTab === 'manage' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  Manage Names
                </button>
              </div>
            )}

            {vInfoImportedCount !== null ? (
              /* Success screen */
              <div className="flex flex-col items-center py-8 gap-3 text-center">
                <CheckCircle2 size={48} className="text-green-500" />
                <p className="text-lg font-semibold text-gray-800">{vInfoImportedCount} name{vInfoImportedCount !== 1 ? 's' : ''} imported</p>
                <p className="text-sm text-gray-500">Names will be available for autocomplete for 24 hours.</p>
                <div className="flex gap-2 mt-2">
                  <Button variant="outline" onClick={() => { setVInfoImportedCount(null); setVInfoTab('manage'); queryClient.invalidateQueries({ queryKey: ['/api/name-imports/list'] }); }}>
                    View Names
                  </Button>
                  <Button className="bg-regis-navy text-white" onClick={() => setShowVInfoImport(false)}>Done</Button>
                </div>
              </div>

            ) : vInfoTab === 'import' ? (
              /* ── Import tab ── */
              vInfoStep === 1 ? (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">Select the guest category for this name list:</p>
                  <div className="grid grid-cols-1 gap-3">
                    {([
                      { key: 'hotel_guest', label: 'Hotel Staying Guest', icon: <Home size={20} /> },
                      { key: 'restaurant',  label: 'Restaurant Valet',    icon: <FileText size={20} /> },
                      { key: 'event',       label: 'Event',               icon: <CalendarDays size={20} /> },
                      { key: 'others',      label: 'Others',              icon: <Users size={20} /> },
                    ] as { key: string; label: string; icon: React.ReactNode }[]).map(({ key, label, icon }) => (
                      <button
                        key={key}
                        onClick={() => { setVInfoVisitorType(key); setVInfoStep(2); }}
                        className="flex items-center gap-3 p-4 rounded-lg border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-left"
                      >
                        <span className="text-blue-600">{icon}</span>
                        <span className="font-medium text-gray-800">{label}</span>
                        <ChevronRight size={16} className="ml-auto text-gray-400" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <button onClick={() => setVInfoStep(1)} className="flex items-center gap-1 text-sm text-blue-600 hover:underline">
                    <ChevronLeft size={14} /> Back
                  </button>

                  {!vInfoMethod ? (
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setVInfoMethod('csv')}
                        className="flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all"
                      >
                        <Download size={24} className="text-blue-600" />
                        <span className="text-sm font-medium">Import from CSV</span>
                      </button>
                      <button
                        onClick={() => setVInfoMethod('paste')}
                        className="flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all"
                      >
                        <FileText size={24} className="text-blue-600" />
                        <span className="text-sm font-medium">Paste Names</span>
                      </button>
                    </div>
                  ) : vInfoMethod === 'paste' ? (
                    <div className="space-y-3">
                      <p className="text-sm text-gray-600">Paste guest names — one name per line:</p>
                      <textarea
                        className="w-full h-48 border border-gray-300 rounded-lg p-3 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
                        placeholder={"Tanaka Hiroshi\nYamamoto Kenji\nSato Yuki"}
                        value={vInfoPasteText}
                        onChange={(e) => setVInfoPasteText(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <Button variant="outline" className="flex-1" onClick={() => setVInfoMethod(null)}>Back</Button>
                        <Button
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                          disabled={!vInfoPasteText.trim() || vInfoImportMutation.isPending}
                          onClick={() => {
                            const names = vInfoPasteText.split('\n').map(n => n.trim()).filter(Boolean);
                            vInfoImportMutation.mutate({ names, visitorType: vInfoVisitorType });
                          }}
                        >
                          {vInfoImportMutation.isPending ? 'Importing…' : `Import ${vInfoPasteText.split('\n').filter(l => l.trim()).length} Names`}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-gray-600">Select a CSV file (one name per row in the first column):</p>
                      <input
                        type="file"
                        accept=".csv,text/csv"
                        className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        onChange={(e) => setVInfoCsvFile(e.target.files?.[0] ?? null)}
                      />
                      {vInfoCsvFile && <p className="text-xs text-gray-500">{vInfoCsvFile.name} selected</p>}
                      <div className="flex gap-2">
                        <Button variant="outline" className="flex-1" onClick={() => setVInfoMethod(null)}>Back</Button>
                        <Button
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                          disabled={!vInfoCsvFile || vInfoImportMutation.isPending}
                          onClick={async () => {
                            if (!vInfoCsvFile) return;
                            const text = await vInfoCsvFile.text();
                            const names = text.split('\n').map(row => row.split(',')[0].replace(/^"|"$/g, '').trim()).filter(Boolean);
                            vInfoImportMutation.mutate({ names, visitorType: vInfoVisitorType });
                          }}
                        >
                          {vInfoImportMutation.isPending ? 'Importing…' : 'Import CSV'}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )

            ) : (
              /* ── Manage tab ── */
              <div className="space-y-3">
                {vInfoListLoading ? (
                  <p className="text-sm text-gray-500 py-4 text-center">Loading…</p>
                ) : !vInfoNameList || vInfoNameList.length === 0 ? (
                  <div className="py-8 text-center text-sm text-gray-400">No active imported names.</div>
                ) : (() => {
                  const LABELS: Record<string, string> = {
                    hotel_guest: 'Hotel Staying Guest',
                    restaurant: 'Restaurant Valet',
                    event: 'Event',
                    others: 'Others',
                  };
                  const grouped = vInfoNameList.reduce<Record<string, typeof vInfoNameList>>((acc, n) => {
                    if (!acc[n.visitorType]) acc[n.visitorType] = [];
                    acc[n.visitorType].push(n);
                    return acc;
                  }, {});
                  return (
                    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
                      {Object.entries(grouped).map(([type, entries]) => (
                        <div key={type}>
                          <div className="flex items-center justify-between mb-0.5">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                              {LABELS[type] ?? type} <span className="text-gray-400 font-normal">({entries.length})</span>
                            </p>
                            <button
                              className="text-xs text-red-500 hover:text-red-700 hover:underline"
                              onClick={() => { if (confirm(`Delete all ${entries.length} names from "${LABELS[type] ?? type}"?`)) vInfoDeleteTypeMutation.mutate(type); }}
                            >
                              Clear all
                            </button>
                          </div>
                          {(() => {
                            const oldest = entries.reduce((min, e) => new Date(e.createdAt) < new Date(min.createdAt) ? e : min, entries[0]);
                            const expiresAt = new Date(new Date(oldest.createdAt).getTime() + 24 * 60 * 60 * 1000);
                            const fmt = expiresAt.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
                            return (
                              <p className="text-[10px] text-amber-600 mb-1.5">Auto Deletion: {fmt}</p>
                            );
                          })()}
                          <div className="border rounded-lg divide-y overflow-hidden">
                            {entries.map(entry => (
                              <div key={entry.id} className="flex items-center justify-between px-3 py-2 hover:bg-gray-50">
                                <span className="text-sm text-gray-800">{entry.name}</span>
                                <button
                                  onClick={() => vInfoDeleteOneMutation.mutate(entry.id)}
                                  className="text-gray-300 hover:text-red-500 transition-colors ml-2 flex-shrink-0"
                                  title="Remove name"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Valet Ticket Wizard */}
        <ValetTicketWizard 
          isOpen={showTicketWizard}
          onClose={() => setShowTicketWizard(false)}
          user={user}
        />

        {/* View Ticket Modal */}
        <Dialog open={!!viewTicket} onOpenChange={() => setViewTicket(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 flex-wrap">
                <TicketIcon size={20} />
                Ticket #{viewTicket?.ticketNumber}
                {viewTicket && (
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-base font-extrabold tracking-wide ${
                    viewTicket.parkingLocation
                      ? 'bg-green-100 text-green-800 border-2 border-green-400'
                      : 'bg-red-100 text-red-700 border-2 border-red-300'
                  }`}>
                    <span className={`w-2.5 h-2.5 rounded-full ${viewTicket.parkingLocation ? 'bg-green-500' : 'bg-red-500'}`} />
                    PL: {viewTicket.parkingLocation || 'Unassigned'}
                  </span>
                )}
              </DialogTitle>
            </DialogHeader>
            {viewTicket && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h3 className="font-semibold text-regis-navy">Status</h3>
                    <Badge variant={
                      viewTicket.status === 'completed' ? 'default' :
                      viewTicket.status === 'ready' ? 'default' :
                      viewTicket.status === 'cancelled' ? 'destructive' :
                      viewTicket.status === 'transit' ? 'secondary' : 'outline'
                    } className="text-sm">
                      {viewTicket.status === 'cancelled' ? 'Archived' : viewTicket.status}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-semibold text-regis-navy">Created</h3>
                    <p className="text-sm text-gray-600">
                      {viewTicket.createdAt ? new Date(viewTicket.createdAt).toLocaleString() : 'Unknown'}
                    </p>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="font-semibold text-regis-navy mb-3">Guest Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500">Guest Name</p>
                      <p className="font-medium">{viewTicket.guestName ? fmtGuest(viewTicket.guestName) : 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Visitor Type</p>
                      <p className="font-medium capitalize">{viewTicket.visitorType?.replace('_', ' ') || 'N/A'}</p>
                    </div>
                    {viewTicket.visitorSubType && (
                      <div>
                        <p className="text-xs text-gray-500">Sub Type</p>
                        <p className="font-medium capitalize">{viewTicket.visitorSubType.replace('_', ' ')}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="font-semibold text-regis-navy mb-3">Vehicle Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500">Make</p>
                      <p className="font-medium">{viewTicket.carMake || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Model</p>
                      <p className="font-medium">{viewTicket.carModel || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Color</p>
                      <p className="font-medium">{viewTicket.carColor || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">License Plate</p>
                      <p className="font-medium">{viewTicket.licensePlate || 'N/A'}</p>
                    </div>
                  </div>
                  {viewTicket.platePhotoUrl && (
                    <div className="mt-4">
                      <p className="text-xs text-gray-500 mb-2 flex items-center gap-2">
                        Registration Photo
                        <span className="text-gray-400 font-normal">
                          {(() => {
                            const url = viewTicket.platePhotoUrl!;
                            const base64 = url.startsWith('data:') ? (url.split(',')[1] || '') : url;
                            const bytes = Math.round(base64.length * 3 / 4);
                            if (bytes < 1024) return `${bytes} B`;
                            if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
                            return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
                          })()}
                        </span>
                      </p>
                      <img 
                        src={viewTicket.platePhotoUrl} 
                        alt="License plate" 
                        className="w-full max-w-xs h-32 object-cover rounded border"
                      />
                    </div>
                  )}
                  {viewTicket.carPhoto && (
                    <div className="mt-4">
                      <p className="text-xs text-gray-500 mb-2 flex items-center gap-2">
                        Car Photo
                        <span className="text-gray-400 font-normal">
                          {(() => {
                            const url = viewTicket.carPhoto!;
                            const base64 = url.startsWith('data:') ? (url.split(',')[1] || '') : url;
                            const bytes = Math.round(base64.length * 3 / 4);
                            if (bytes < 1024) return `${bytes} B`;
                            if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
                            return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
                          })()}
                        </span>
                      </p>
                      <img
                        src={viewTicket.carPhoto}
                        alt="Car"
                        className="w-full max-w-xs h-40 object-cover rounded border"
                      />
                    </div>
                  )}
                </div>

                <div className="border-t pt-4">
                  <h3 className="font-semibold text-regis-navy mb-3">Parking Location</h3>
                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold ${
                    viewTicket.parkingLocation
                      ? 'bg-green-100 text-green-700 border border-green-300'
                      : 'bg-red-100 text-red-700 border border-red-300'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${viewTicket.parkingLocation ? 'bg-green-500' : 'bg-red-500'}`} />
                    {viewTicket.parkingLocation || 'Not assigned'}
                  </div>
                </div>

                {/* Scheduled Retrieval section — only for active tickets */}
                {['active', 'pending'].includes(viewTicket.status) && canEdit && (
                  <div className="border-t pt-4">
                    <h3 className="font-semibold text-regis-navy mb-3 flex items-center gap-2">
                      <CalendarDays size={16} />
                      Schedule Pickup
                    </h3>
                    {viewTicket.scheduledRetrievalAt && (
                      <div className="mb-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center justify-between">
                        <span className="text-sm text-amber-800 font-medium">
                          🚗 {new Date(viewTicket.scheduledRetrievalAt as unknown as string).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <button
                          className="text-xs text-red-500 hover:text-red-700 font-semibold ml-3"
                          onClick={async () => {
                            try {
                              const clearResp = await fetch(`/api/staff/tickets/${viewTicket.ticketNumber}/schedule-retrieval`, { method: 'DELETE' });
                              if (!clearResp.ok) {
                                const err = await clearResp.json().catch(() => ({}));
                                toast({ title: 'Failed to clear schedule', description: (err as { message?: string }).message ?? `Error ${clearResp.status}`, variant: 'destructive' });
                                return;
                              }
                              queryClient.invalidateQueries({ queryKey: ["/api/staff/tickets"] });
                              setViewTicket(prev => prev ? { ...prev, scheduledRetrievalAt: null } : prev);
                              toast({ title: 'Schedule cleared' });
                            } catch {
                              toast({ title: 'Failed to clear schedule', variant: 'destructive' });
                            }
                          }}
                        >✕ Clear</button>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <input
                        type="datetime-local"
                        className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-regis-gold"
                        value={viewTicketScheduleInput}
                        min={new Date().toISOString().slice(0, 16)}
                        onChange={e => setViewTicketScheduleInput(e.target.value)}
                      />
                      <Button
                        size="sm"
                        disabled={!viewTicketScheduleInput || viewTicketScheduleSaving}
                        onClick={async () => {
                          if (!viewTicketScheduleInput) return;
                          setViewTicketScheduleSaving(true);
                          try {
                            const schedResp = await fetch(`/api/staff/tickets/${viewTicket.ticketNumber}/schedule-retrieval`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ scheduledAt: new Date(viewTicketScheduleInput).toISOString() }),
                            });
                            if (!schedResp.ok) {
                              const err = await schedResp.json().catch(() => ({}));
                              toast({ title: 'Failed to schedule', description: (err as { message?: string }).message ?? `Error ${schedResp.status}`, variant: 'destructive' });
                              return;
                            }
                            queryClient.invalidateQueries({ queryKey: ["/api/staff/tickets"] });
                            setViewTicket(prev => prev ? { ...prev, scheduledRetrievalAt: new Date(viewTicketScheduleInput) } : prev);
                            toast({ title: 'Pickup scheduled' });
                            setViewTicketScheduleInput('');
                          } catch {
                            toast({ title: 'Failed to schedule', variant: 'destructive' });
                          } finally {
                            setViewTicketScheduleSaving(false);
                          }
                        }}
                        className="bg-regis-navy text-white hover:bg-regis-navy/90 shrink-0"
                      >
                        {viewTicketScheduleSaving ? <Loader2 size={14} className="animate-spin" /> : 'Set'}
                      </Button>
                    </div>
                  </div>
                )}

                {viewTicket.staffNotes && (
                  <div className="border-t pt-4">
                    <h3 className="font-semibold text-regis-navy mb-3">Staff Notes</h3>
                    <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded">{viewTicket.staffNotes}</p>
                  </div>
                )}

                {viewTicketTrips && viewTicketTrips.length > 0 && (
                  <TripLogSection
                    trips={viewTicketTrips}
                    ticketNumber={viewTicket.ticketNumber}
                    canEdit={canEdit}
                    onRefresh={() => queryClient.invalidateQueries({ queryKey: ["/api/staff/tickets", viewTicket.ticketNumber, "trips"] })}
                  />
                )}

                {/* Retrieval SLA block — only shown when ticket has gone through retrieval */}
                {viewTicket.retrievalStartedAt && (
                  <div className="border-t pt-4">
                    <h3 className="font-semibold text-regis-navy mb-3">Retrieval Performance (SLA)</h3>
                    {(() => {
                      const activelyRetrieving = ['retrieving','transit','preparing'].includes(viewTicket.status);
                      const hasRecord = viewTicket.retrievalDurationSeconds != null;

                      return (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-xs text-gray-500 mb-1">Retrieval Started</p>
                            <p className="text-sm font-medium">
                              {new Date(viewTicket.retrievalStartedAt!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-xs text-gray-500 mb-1">Car Ready At</p>
                            <p className="text-sm font-medium">
                              {viewTicket.retrievalReadyAt
                                ? new Date(viewTicket.retrievalReadyAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                : activelyRetrieving
                                ? <span className="text-amber-500 font-medium">In progress…</span>
                                : <span className="text-gray-400">—</span>
                              }
                            </p>
                          </div>
                          <div className={`col-span-2 rounded-lg p-3 ${
                            !hasRecord
                              ? activelyRetrieving
                                ? 'bg-amber-50 border border-amber-200'
                                : 'bg-gray-50 border border-gray-200'
                              : viewTicket.retrievalDurationSeconds! <= 660
                              ? 'bg-green-50 border border-green-200'
                              : 'bg-red-50 border border-red-200'
                          }`}>
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-xs text-gray-500 mb-0.5">Retrieval Time (this request)</p>
                                <p className="text-xl font-bold">
                                  {hasRecord
                                    ? (() => {
                                        const m = Math.floor(viewTicket.retrievalDurationSeconds! / 60);
                                        const s = viewTicket.retrievalDurationSeconds! % 60;
                                        return `${m}m ${s}s`;
                                      })()
                                    : activelyRetrieving
                                    ? (() => {
                                        const elapsed = Math.floor((Date.now() - new Date(viewTicket.retrievalStartedAt!).getTime()) / 1000);
                                        return `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`;
                                      })()
                                    : <span className="text-base text-gray-400 font-normal">Not recorded</span>
                                  }
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-gray-500 mb-0.5">SLA Target</p>
                                <p className="text-sm font-semibold text-gray-600">≤ 11 min</p>
                                {hasRecord && (
                                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                    viewTicket.retrievalDurationSeconds! <= 660
                                      ? 'bg-green-200 text-green-800'
                                      : 'bg-red-200 text-red-800'
                                  }`}>
                                    {viewTicket.retrievalDurationSeconds! <= 660 ? '✓ Met' : '✗ Exceeded'}
                                  </span>
                                )}
                                {!hasRecord && activelyRetrieving && (
                                  <span className="text-xs text-amber-600 font-medium">Live</span>
                                )}
                              </div>
                            </div>
                            {hasRecord && (
                              <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    viewTicket.retrievalDurationSeconds! <= 660 ? 'bg-green-500' : 'bg-red-500'
                                  }`}
                                  style={{ width: `${Math.min(100, (viewTicket.retrievalDurationSeconds! / 660) * 100)}%` }}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                <div className="border-t pt-4">
                  <h3 className="font-semibold text-regis-navy mb-3">Staff Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500">Created By</p>
                      <p className="font-medium">{viewTicket.createdByName || 'Unknown'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Visitor Duration Stay</p>
                      <p className="font-medium">
                        {viewTicket.totalStaySeconds 
                          ? `${Math.floor(viewTicket.totalStaySeconds / 3600)}h ${Math.floor((viewTicket.totalStaySeconds % 3600) / 60)}m`
                          : viewTicket.createdAt 
                            ? (() => {
                                const seconds = Math.floor((Date.now() - new Date(viewTicket.createdAt).getTime()) / 1000);
                                return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
                              })()
                            : 'N/A'
                        }
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => viewTicket && printFullTicket(viewTicket)}
                    className="flex items-center gap-2"
                    data-testid="button-print-ticket"
                  >
                    <Printer size={16} />
                    Print
                  </Button>
                  <Button variant="outline" onClick={() => setViewTicket(null)}>
                    Close
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Ticket Modal */}
        <Dialog open={!!editTicketData} onOpenChange={() => setEditTicketData(null)}>
          <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
            {/* Compact header */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-regis-navy text-white">
              <div className="flex items-center gap-2">
                <Edit size={14} />
                <span className="font-semibold text-sm">Edit Ticket #{editTicketData?.ticketNumber}</span>
              </div>
            </div>
            {editTicketData && (
              <div className="px-4 py-3 space-y-2.5 max-h-[80vh] overflow-y-auto">

                {/* Row: Status + Parking */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Status</label>
                    <Select
                      value={editTicketData.status}
                      onValueChange={(value) => setEditTicketData({ ...editTicketData, status: value })}
                    >
                      <SelectTrigger className="h-8 text-xs mt-0.5">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="retrieving">Retrieving</SelectItem>
                        <SelectItem value="transit">Transit</SelectItem>
                        <SelectItem value="ready">Ready</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Parking Spot</label>
                    <Input
                      value={editTicketData.parkingLocation || ''}
                      onChange={(e) => setEditTicketData({ ...editTicketData, parkingLocation: e.target.value })}
                      placeholder="e.g. A23"
                      className="h-8 text-xs mt-0.5"
                    />
                  </div>
                </div>

                {/* Row: Visitor Type (+ sub-type if restaurant) + Print button */}
                <div className="flex gap-2 items-end">
                  <div className={`grid gap-2 flex-1 ${editTicketData.visitorType === 'restaurant' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    <div>
                      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Visitor Type</label>
                      <Select
                        value={editTicketData.visitorType}
                        onValueChange={(value) => setEditTicketData({ ...editTicketData, visitorType: value, visitorSubType: value !== 'restaurant' ? null : editTicketData.visitorSubType })}
                      >
                        <SelectTrigger className="h-8 text-xs mt-0.5">
                          <SelectValue placeholder="Visitor Type" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(VISITOR_TYPES).map(([key, label]) => (
                            <SelectItem key={key} value={key}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {editTicketData.visitorType === 'restaurant' && (
                      <div>
                        <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Restaurant</label>
                        <Select
                          value={editTicketData.visitorSubType || ''}
                          onValueChange={(value) => setEditTicketData({ ...editTicketData, visitorSubType: value })}
                        >
                          <SelectTrigger className="h-8 text-xs mt-0.5">
                            <SelectValue placeholder="Select restaurant" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(RESTAURANT_SUB_TYPES).map(([key, label]) => (
                              <SelectItem key={key} value={key}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    className="h-8 text-xs px-2.5 flex-shrink-0 border-regis-navy text-regis-navy hover:bg-regis-navy hover:text-white"
                    onClick={() => printFullTicket(editTicketData)}
                    title="Print ticket label (50×80mm)"
                  >
                    <Printer size={13} className="mr-1" />
                    Print
                  </Button>
                </div>

                {/* Row: Guest Name + Room */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Guest Name</label>
                    <Input
                      value={editTicketData.guestName || ''}
                      onChange={(e) => setEditTicketData({ ...editTicketData, guestName: e.target.value })}
                      className="h-8 text-xs mt-0.5"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Room No.</label>
                    <Input
                      value={editTicketData.roomNumber || ''}
                      onChange={(e) => setEditTicketData({ ...editTicketData, roomNumber: e.target.value })}
                      placeholder="Optional"
                      className="h-8 text-xs mt-0.5"
                    />
                  </div>
                </div>

                {/* PIN — read-only, immutable */}
                {editTicketData.guestPin && (
                  <div>
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">PIN</label>
                    <div className="h-8 mt-0.5 flex items-center gap-2 px-3 rounded-md border border-dashed border-regis-gold/50 bg-regis-gold/10 w-fit min-w-[100px]">
                      <span className="font-mono font-bold text-regis-navy text-sm tracking-widest">{editTicketData.guestPin}</span>
                      <span className="text-[9px] text-gray-400 italic">locked</span>
                    </div>
                  </div>
                )}

                {/* Row: Make + Model + Color */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Make</label>
                    <Input
                      value={editTicketData.carMake || ''}
                      onChange={(e) => setEditTicketData({ ...editTicketData, carMake: e.target.value })}
                      className="h-8 text-xs mt-0.5"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Model</label>
                    <Input
                      value={editTicketData.carModel || ''}
                      onChange={(e) => setEditTicketData({ ...editTicketData, carModel: e.target.value })}
                      className="h-8 text-xs mt-0.5"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Color</label>
                    <Input
                      value={editTicketData.carColor || ''}
                      onChange={(e) => setEditTicketData({ ...editTicketData, carColor: e.target.value })}
                      className="h-8 text-xs mt-0.5"
                    />
                  </div>
                </div>

                {/* Row: License Plate + Created Time */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">License Plate</label>
                    <Input
                      value={editTicketData.licensePlate || ''}
                      onChange={(e) => setEditTicketData({ ...editTicketData, licensePlate: e.target.value })}
                      className="h-8 text-xs font-mono mt-0.5"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide flex items-center gap-1">
                      <CalendarDays size={10} /> Check-in Time
                    </label>
                    <input
                      type="datetime-local"
                      className="mt-0.5 w-full h-8 border border-amber-300 rounded-md px-2 text-xs bg-amber-50 focus:outline-none focus:ring-1 focus:ring-amber-400"
                      value={(() => {
                        const d = editTicketData.createdAt ? new Date(editTicketData.createdAt) : null;
                        if (!d || isNaN(d.getTime())) return '';
                        const pad = (n: number) => String(n).padStart(2, '0');
                        return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                      })()}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditTicketData({ ...editTicketData, createdAt: val ? new Date(val).toISOString() : editTicketData.createdAt });
                      }}
                    />
                  </div>
                </div>

                {/* Staff Notes */}
                <div>
                  <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Staff Notes</label>
                  <Textarea
                    value={editTicketData.staffNotes || ''}
                    onChange={(e) => setEditTicketData({ ...editTicketData, staffNotes: e.target.value })}
                    placeholder="Add notes..."
                    className="mt-0.5 text-xs resize-none"
                    rows={2}
                  />
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 pt-1 pb-1">
                  <Button
                    onClick={() => updateTicketMutation.mutate({
                      ticketNumber: editTicketData.ticketNumber,
                      status: editTicketData.status,
                      visitorType: editTicketData.visitorType,
                      visitorSubType: editTicketData.visitorSubType,
                      guestName: editTicketData.guestName,
                      roomNumber: editTicketData.roomNumber,
                      licensePlate: editTicketData.licensePlate,
                      carMake: editTicketData.carMake,
                      carModel: editTicketData.carModel,
                      carColor: editTicketData.carColor,
                      parkingLocation: editTicketData.parkingLocation,
                      staffNotes: editTicketData.staffNotes,
                      createdAt: editTicketData.createdAt,
                    })}
                    disabled={updateTicketMutation.isPending}
                    className="flex-1 h-8 text-xs bg-regis-navy hover:bg-blue-900"
                    data-testid="button-save-ticket"
                  >
                    <Save size={13} className="mr-1.5" />
                    {updateTicketMutation.isPending ? "Saving…" : "Save Changes"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setEditTicketData(null)}
                    className="h-8 text-xs px-4"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Modal */}
        <Dialog open={!!deleteTicket} onOpenChange={() => setDeleteTicket(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle size={20} />
                Delete Ticket
              </DialogTitle>
            </DialogHeader>
            {deleteTicket && (
              <div className="space-y-4">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-800">
                    Are you sure you want to <strong>permanently delete</strong> ticket <strong>#{deleteTicket.ticketNumber}</strong>?
                  </p>
                  <p className="text-sm text-red-600 mt-2">
                    This action cannot be undone. All ticket data will be lost.
                  </p>
                </div>
                
                <div className="text-sm text-gray-600">
                  <p><strong>Guest:</strong> {deleteTicket.guestName ? fmtGuest(deleteTicket.guestName) : 'N/A'}</p>
                  <p><strong>Vehicle:</strong> {deleteTicket.carMake} {deleteTicket.carModel}</p>
                </div>

                <div className="flex space-x-2 pt-4">
                  <Button
                    onClick={() => deleteTicketMutation.mutate(deleteTicket.ticketNumber)}
                    disabled={deleteTicketMutation.isPending}
                    variant="destructive"
                    className="flex-1"
                    data-testid="button-confirm-delete"
                  >
                    <Trash2 size={16} className="mr-2" />
                    {deleteTicketMutation.isPending ? "Deleting..." : "Delete Permanently"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setDeleteTicket(null)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Archive Confirmation Modal */}
        <Dialog open={!!archiveTicket} onOpenChange={() => setArchiveTicket(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-orange-600">
                <Archive size={20} />
                Archive Ticket
              </DialogTitle>
            </DialogHeader>
            {archiveTicket && (
              <div className="space-y-4">
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <p className="text-sm text-orange-800">
                    Are you sure you want to <strong>archive</strong> ticket <strong>#{archiveTicket.ticketNumber}</strong>?
                  </p>
                  <p className="text-sm text-orange-600 mt-2">
                    Archived tickets are kept for historical records but won't appear in active lists.
                  </p>
                </div>
                
                <div className="text-sm text-gray-600">
                  <p><strong>Guest:</strong> {archiveTicket.guestName ? fmtGuest(archiveTicket.guestName) : 'N/A'}</p>
                  <p><strong>Vehicle:</strong> {archiveTicket.carMake} {archiveTicket.carModel}</p>
                  <p><strong>Current Status:</strong> {archiveTicket.status}</p>
                </div>

                <div className="flex space-x-2 pt-4">
                  <Button
                    onClick={() => archiveTicketMutation.mutate(archiveTicket.ticketNumber)}
                    disabled={archiveTicketMutation.isPending}
                    className="flex-1 bg-orange-600 hover:bg-orange-700"
                    data-testid="button-confirm-archive"
                  >
                    <Archive size={16} className="mr-2" />
                    {archiveTicketMutation.isPending ? "Archiving..." : "Archive Ticket"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setArchiveTicket(null)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Auto Close (Scheduled Departure) Dialog */}
        <Dialog open={!!autoCloseTicket} onOpenChange={(o) => { if (!o) setAutoCloseTicket(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Timer size={18} className="text-purple-600" />
                Auto Close — #{autoCloseTicket?.ticketNumber}
              </DialogTitle>
            </DialogHeader>
            {autoCloseTicket && (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Choose the date and time to automatically close this ticket. The system will mark the guest as departed at that exact moment.
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-gray-700 block mb-1">Date</label>
                    <input
                      type="date"
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                      value={autoCloseDate}
                      min={(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })()}
                      max={(() => { const d = new Date(); d.setDate(d.getDate() + 10); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })()}
                      onChange={e => setAutoCloseDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-700 block mb-1">Time</label>
                    <input
                      type="time"
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                      value={autoCloseTime}
                      onChange={e => setAutoCloseTime(e.target.value)}
                    />
                  </div>
                </div>
                {(autoCloseTicket as any).scheduledDepartureAt && (
                  <div className="flex items-center justify-between bg-purple-50 border border-purple-200 rounded-md px-3 py-2">
                    <p className="text-xs text-purple-700">
                      Currently scheduled: {new Date((autoCloseTicket as any).scheduledDepartureAt).toLocaleString()}
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-xs text-red-500 hover:text-red-700 px-2"
                      onClick={() => { cancelSchedDepMutation.mutate(autoCloseTicket.ticketNumber); setAutoCloseTicket(null); }}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                    disabled={!autoCloseDate || !autoCloseTime || scheduleDepMutation.isPending}
                    onClick={() => {
                      const iso = new Date(`${autoCloseDate}T${autoCloseTime}:00`).toISOString();
                      scheduleDepMutation.mutate({ ticketNumber: autoCloseTicket.ticketNumber, scheduledDepartureAt: iso });
                    }}
                  >
                    <Timer size={14} className="mr-1" />
                    {scheduleDepMutation.isPending ? "Scheduling..." : "Confirm Schedule"}
                  </Button>
                  <Button variant="outline" onClick={() => setAutoCloseTicket(null)}>
                    Close
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}