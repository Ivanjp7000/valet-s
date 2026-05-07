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
import { Crown, Clock, Construction, Check, Timer, LogOut, Car, Camera, MapPin, User, Edit, Save, X, Plus, Users, TicketIcon, Settings, Home, Eye, EyeOff, Trash2, Archive, AlertTriangle, Play, LayoutGrid, List, ChevronDown, Printer, GripVertical } from "lucide-react";
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { ValetTicket, User as UserType } from "@shared/schema";
import { PDFDocument, rgb, StandardFonts, type PDFFont } from "pdf-lib";

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
          <span className="font-medium text-sm">#{ticket.ticketNumber}</span>
          <span className="text-xs text-gray-500 ml-1">{ticket.carMake}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs font-mono font-bold text-blue-700">{mins}:{secs.toString().padStart(2, '0')}</span>
          <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={onView}>
            <Eye size={12} className="text-gray-500" />
          </Button>
        </div>
      </div>
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-bold ${
        ticket.parkingLocation ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-red-100 text-red-700 border border-red-300'
      }`}>
        <span className={`w-1.5 h-1.5 rounded-full ${ticket.parkingLocation ? 'bg-green-500' : 'bg-red-500'}`} />
        PL: {ticket.parkingLocation || 'Unassigned'}
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

function CompactInHouseCard({ ticket, onRetrieve, onEdit, onView, canEdit = true }: { ticket: ValetTicket; onRetrieve: () => void; onEdit: () => void; onView: () => void; canEdit?: boolean }) {
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  useEffect(() => {
    if (!ticket.createdAt) return;
    
    const createdAt = new Date(ticket.createdAt).getTime();
    const maxMs = 24 * 60 * 60 * 1000; // 24 hours
    
    const updateTimer = () => {
      const elapsed = Date.now() - createdAt;
      const remaining = Math.max(0, maxMs - elapsed);
      setRemainingSeconds(Math.floor(remaining / 1000));
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [ticket.createdAt]);

  const hours = Math.floor(remainingSeconds / 3600);
  const mins = Math.floor((remainingSeconds % 3600) / 60);
  const secs = remainingSeconds % 60;
  const timeDisplay = `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  const isUrgent = remainingSeconds < 3600; // Less than 1 hour

  return (
    <div className="bg-gray-50 rounded-lg p-2 space-y-1">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-regis-navy">#{ticket.ticketNumber}</span>
            <span className={`text-xs font-mono ${isUrgent ? 'text-red-600 font-bold' : 'text-gray-500'}`}>
              {timeDisplay}
            </span>
          </div>
          <p className="text-xs text-gray-700 truncate">{ticket.guestName}</p>
          {ticket.roomNumber && (
            <p className="text-xs text-gray-500">Room: {ticket.roomNumber}</p>
          )}
          <p className="text-xs text-gray-500 truncate">{ticket.carMake} {ticket.carModel}</p>
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-bold mt-0.5 ${
            ticket.parkingLocation
              ? 'bg-green-100 text-green-700 border border-green-300'
              : 'bg-red-100 text-red-700 border border-red-300'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${ticket.parkingLocation ? 'bg-green-500' : 'bg-red-500'}`} />
            PL: {ticket.parkingLocation || 'Unassigned'}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <Button 
            size="sm" 
            variant="ghost"
            className="h-6 w-6 p-0"
            onClick={onView}
          >
            <Eye size={14} className="text-gray-500" />
          </Button>
          {canEdit && (
            <Button 
              size="sm" 
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={onEdit}
            >
              <Edit size={14} className="text-gray-500" />
            </Button>
          )}
        </div>
      </div>
      {canEdit && (
        <Button 
          size="sm" 
          className="h-7 w-full text-xs bg-regis-gold hover:bg-yellow-600 text-regis-navy font-semibold"
          onClick={onRetrieve}
        >
          <Play size={12} className="mr-1" />Retrieve
        </Button>
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
          <p className="font-bold text-lg text-regis-navy">#{ticket.ticketNumber}</p>
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
        <p><strong>Guest:</strong> {ticket.guestName}</p>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
          ticket.parkingLocation ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-red-100 text-red-700 border border-red-300'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${ticket.parkingLocation ? 'bg-green-500' : 'bg-red-500'}`} />
          PL: {ticket.parkingLocation || 'Unassigned'}
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
const DESKTOP_PANELS_DEFAULT = ['in-house', 'retrievals', 'guest-out', 'departed-today', 'departed-history'];
const MOBILE_PANELS_DEFAULT  = ['ready', 'retrievals', 'guest-out', 'in-house', 'departed'];

function SortablePanel({
  id, title, icon, badge, borderClass, headerClass, expanded, onToggle, children, wrapCard = true,
}: {
  id: string; title?: string; icon?: React.ReactNode; badge?: React.ReactNode;
  borderClass?: string; headerClass?: string; expanded?: boolean; onToggle?: () => void;
  children: React.ReactNode; wrapCard?: boolean;
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

  if (!wrapCard) {
    return (
      <div ref={setNodeRef} style={style} className="relative">
        <div className="absolute top-4 right-14 z-10">{dragHandle}</div>
        {children}
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={style}>
      <Card className={`border-2 ${borderClass || 'border-gray-200'} shadow-sm`}>
        <CardHeader className="p-4 cursor-pointer select-none" onClick={onToggle}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              {dragHandle}
              {icon}
              <span className={`font-semibold text-sm sm:text-base truncate ${headerClass || 'text-regis-navy'}`}>{title}</span>
              {badge}
            </div>
            <ChevronDown size={18} className={`text-gray-400 flex-shrink-0 ml-2 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
          </div>
        </CardHeader>
        {expanded && <CardContent className="p-4 pt-0">{children}</CardContent>}
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
  const [showTicketWizard, setShowTicketWizard] = useState(false);
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
  
  // Ticket management modals state
  const [viewTicket, setViewTicket] = useState<ValetTicket | null>(null);
  const [editTicketData, setEditTicketData] = useState<ValetTicket | null>(null);
  const [deleteTicket, setDeleteTicket] = useState<ValetTicket | null>(null);
  const [archiveTicket, setArchiveTicket] = useState<ValetTicket | null>(null);
  
  // Compact view toggle for mobile
  const [compactView, setCompactView] = useState(true);
  
  // ── Panel order & collapse state (persisted to localStorage) ──────────────
  const [desktopPanelOrder, setDesktopPanelOrder] = useState<string[]>(() => {
    try { const s = localStorage.getItem('valet-desktop-panel-order'); return s ? JSON.parse(s) : DESKTOP_PANELS_DEFAULT; } catch { return DESKTOP_PANELS_DEFAULT; }
  });
  const [mobilePanelOrder, setMobilePanelOrder] = useState<string[]>(() => {
    try { const s = localStorage.getItem('valet-mobile-panel-order'); return s ? JSON.parse(s) : MOBILE_PANELS_DEFAULT; } catch { return MOBILE_PANELS_DEFAULT; }
  });
  const [expandedPanels, setExpandedPanels] = useState<Set<string>>(new Set()); // all start collapsed

  const togglePanel = (id: string) => setExpandedPanels(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

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
  });

  const { data: stats, isLoading: statsLoading } = useQuery<{
    pending: number;
    transit: number;
    ready: number;
    completed: number;
    avgTime: string;
  }>({
    queryKey: ["/api/staff/stats"],
  });

  const { data: allUsers, isLoading: usersLoading } = useQuery<UserType[]>({
    queryKey: ["/api/admin/users"],
    enabled: user?.role === 'superadmin',
  });

  const { data: allTickets, isLoading: allTicketsLoading } = useQuery<ValetTicket[]>({
    queryKey: ["/api/admin/tickets"],
    enabled: user?.role === 'superadmin',
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

  // Check if user must change password on mount
  useEffect(() => {
    if (user?.mustChangePassword) {
      setShowPasswordChangeModal(true);
    }
  }, [user?.mustChangePassword]);

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
      toast({ title: "Welcome Back", description: "Guest has returned, car moved to In House" });
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
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    }
  }, [lastMessage, queryClient, user]);

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

      <div className="border-b bg-white px-3 sm:px-6 py-3 sm:py-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
            <Crown className="text-regis-navy flex-shrink-0" size={20} />
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-bold text-regis-navy truncate">Staff Dashboard</h1>
              <p className="text-xs sm:text-sm text-gray-600 truncate">Hotel St. Regis Osaka</p>
              <p className="text-xs text-gray-500 truncate">
                <span className="hidden sm:inline">Role: </span>{user?.role || 'Loading...'}
                <span className="hidden sm:inline"> | User: {user?.email}</span>
              </p>
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
      </div>

      <div className="p-3 sm:p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
          <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
            <TabsList className="inline-flex w-auto min-w-full sm:grid sm:w-full sm:grid-cols-4">
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
              {user?.role === 'superadmin' && (
                <TabsTrigger value="settings" className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 text-xs sm:text-sm whitespace-nowrap">
                  <Settings size={14} className="sm:w-4 sm:h-4" />
                  <span>Settings</span>
                </TabsTrigger>
              )}
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
                          {ticket.guestName} · {ticket.carColor} {ticket.carMake} {ticket.carModel}
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

            {/* Header with Toggle and New Ticket Button */}
            <div className="flex justify-between items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCompactView(!compactView)}
                className="sm:hidden flex items-center gap-1"
                data-testid="button-toggle-view"
              >
                {compactView ? <LayoutGrid size={16} /> : <List size={16} />}
                {compactView ? "Extended View" : "Standard View"}
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
            </div>

            {/* Compact View for Mobile */}
            {compactView ? (
              <div className="space-y-3 sm:hidden">
                {/* Compact Stats Row */}
                <div className="flex gap-2">
                  <div className="flex-1 bg-blue-50 rounded-lg p-2 text-center">
                    <p className="text-lg font-bold text-blue-600">{activeTickets?.filter(t => t.status === 'active').length || 0}</p>
                    <p className="text-xs text-gray-500">In House</p>
                  </div>
                  <div className="flex-1 bg-orange-50 rounded-lg p-2 text-center">
                    <p className="text-lg font-bold text-orange-600">{activeTickets?.filter(t => ['retrieving', 'transit', 'preparing', 'ready'].includes(t.status)).length || 0}</p>
                    <p className="text-xs text-gray-500">Retrieving</p>
                  </div>
                  <div className="flex-1 bg-gray-50 rounded-lg p-2 text-center">
                    <p className="text-lg font-bold text-gray-900">{activeTickets?.filter(t => t.status === 'completed').length || 0}</p>
                    <p className="text-xs text-gray-500">Departed</p>
                  </div>
                  <div className="flex-1 bg-purple-50 rounded-lg p-2 text-center">
                    <p className="text-lg font-bold text-purple-600">{statsLoading ? '-' : stats?.avgTime || '0m'}</p>
                    <p className="text-xs text-gray-500">Avg</p>
                  </div>
                </div>

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
                            title={`Being Retrieved (${activeTickets?.filter(t => ['retrieving', 'transit'].includes(t.status)).length || 0})`}
                            icon={<Car size={14} />}
                            expanded={isExpanded} onToggle={toggle}
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
                            title={`Car in Use — Guest Will Return (${activeTickets?.filter(t => t.status === 'out_with_guest').length || 0})`}
                            icon={<Car size={14} />} borderClass="border-blue-200" headerClass="text-blue-700"
                            expanded={isExpanded} onToggle={toggle}
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

                        if (panelId === 'in-house') return (
                          <SortablePanel key="in-house" id="in-house"
                            title={`In House (${activeTickets?.filter(t => t.status === 'active').length || 0})`}
                            icon={<Clock size={14} />}
                            expanded={isExpanded} onToggle={toggle}
                          >
                            <div className="space-y-2 max-h-60 overflow-y-auto mt-2">
                              {activeTickets?.filter(t => t.status === 'active').map((ticket) => (
                                <CompactInHouseCard key={ticket.id} ticket={ticket}
                                  onRetrieve={() => updateStatusMutation.mutate({ ticketNumber: ticket.ticketNumber, status: 'retrieving' })}
                                  onEdit={() => setEditTicketData(ticket)}
                                  onView={() => setViewTicket(ticket)} canEdit={canEdit} />
                              ))}
                              {activeTickets?.filter(t => t.status === 'active').length === 0 && (
                                <p className="text-xs text-gray-400 text-center py-2">No vehicles in house</p>
                              )}
                            </div>
                          </SortablePanel>
                        );

                        if (panelId === 'departed') return (
                          <SortablePanel key="departed" id="departed"
                            title={`Checked Out — Departed (${activeTickets?.filter(t => t.status === 'completed').length || 0})`}
                            icon={<LogOut size={14} />} headerClass="text-gray-600"
                            expanded={isExpanded} onToggle={toggle}
                          >
                            <div className="space-y-2 max-h-60 overflow-y-auto mt-2">
                              {activeTickets?.filter(t => t.status === 'completed').map((ticket) => {
                                const stayHours = ticket.totalStaySeconds ? Math.floor(ticket.totalStaySeconds / 3600) : null;
                                const stayMins = ticket.totalStaySeconds ? Math.floor((ticket.totalStaySeconds % 3600) / 60) : null;
                                return (
                                  <div key={ticket.id} className="bg-gray-50 rounded p-2 flex items-center justify-between">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium text-sm text-gray-600">#{ticket.ticketNumber}</span>
                                        <span className="text-xs text-gray-500 truncate">{ticket.guestName}</span>
                                      </div>
                                      <p className="text-xs text-gray-400">{ticket.carMake} {ticket.carModel}</p>
                                      {stayHours !== null && (
                                        <p className="text-xs text-blue-600 font-medium">⏱️ Stayed: {stayHours}h {stayMins}m</p>
                                      )}
                                    </div>
                                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setViewTicket(ticket)}>
                                      <Eye size={14} className="text-gray-400" />
                                    </Button>
                                  </div>
                                );
                              })}
                              {activeTickets?.filter(t => t.status === 'completed').length === 0 && (
                                <p className="text-xs text-gray-400 text-center py-2">No departed vehicles</p>
                              )}
                            </div>
                          </SortablePanel>
                        );

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
            ) : (
              /* Full View (existing layout) */
              <>
                {/* In House - Full View (Mobile Extended Only - Desktop has its own section below) */}
                <Card className="shadow-lg border-2 border-gray-200 bg-gradient-to-br from-white to-gray-50/30 mb-4 sm:hidden">
                  <CardHeader className="p-4 sm:p-6 pb-2 cursor-pointer" onClick={() => togglePanel('in-house')}>
                    <CardTitle className="flex items-center justify-between text-base sm:text-lg">
                      <div className="flex items-center gap-2 text-regis-navy">
                        <Clock size={20} />
                        In House
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-regis-navy text-white text-lg px-4 py-1">
                          {activeTickets?.filter(t => t.status === 'active').length || 0}
                        </Badge>
                        <ChevronDown size={20} className={`transition-transform ${expandedPanels.has('in-house') ? 'rotate-180' : ''}`} />
                      </div>
                    </CardTitle>
                  </CardHeader>
                  {expandedPanels.has('in-house') && (
                    <CardContent className="p-4 sm:p-6 pt-2">
                      {ticketsLoading ? (
                        <div className="text-center py-6 sm:py-8">Loading tickets...</div>
                      ) : activeTickets?.filter(t => t.status === 'active').length === 0 ? (
                        <div className="text-center py-6 text-gray-400">
                          <Clock size={36} className="mx-auto mb-2 opacity-40" />
                          <p className="text-sm">No vehicles in house</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                          {activeTickets?.filter(t => t.status === 'active').map((ticket) => (
                            <div key={ticket.id} className={`rounded-lg p-3 sm:p-4 shadow-sm hover:shadow-md transition-shadow border-2 ${ticket.parkingLocation ? 'border-green-400 bg-green-50/40' : 'border-red-400 bg-red-50/40'}`}>
                              <div className="flex justify-between items-start mb-2 sm:mb-3">
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-bold text-base sm:text-lg text-regis-navy">#{ticket.ticketNumber}</p>
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${ticket.parkingLocation ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-red-100 text-red-700 border border-red-300'}`}>
                                      <span className={`w-1.5 h-1.5 rounded-full ${ticket.parkingLocation ? 'bg-green-500' : 'bg-red-500'}`} />
                                      PL: {ticket.parkingLocation || 'Unassigned'}
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-500">
                                    {ticket.carMake} {ticket.carModel}
                                  </p>
                                  {ticket.licensePlate && (
                                    <p className="text-xs font-semibold text-gray-700 tracking-wide">{ticket.licensePlate}</p>
                                  )}
                                </div>
                                <div className="flex items-start gap-2">
                                  <Button 
                                    size="sm" 
                                    variant="ghost"
                                    className="h-8 w-8 p-0"
                                    onClick={() => setViewTicket(ticket)}
                                  >
                                    <Eye size={16} className="text-gray-500" />
                                  </Button>
                                  {canEdit && (
                                    <Button 
                                      size="sm" 
                                      variant="ghost"
                                      className="h-8 w-8 p-0"
                                      onClick={() => setEditTicketData(ticket)}
                                    >
                                      <Edit size={16} className="text-gray-500" />
                                    </Button>
                                  )}
                                  <CircularTimer 
                                    createdAt={ticket.createdAt || new Date()} 
                                    maxHours={24}
                                    size={40}
                                    strokeWidth={3}
                                  />
                                </div>
                              </div>

                              <div className="space-y-1 text-xs sm:text-sm text-gray-600 mb-2 sm:mb-3">
                                <p><strong>Guest:</strong> {ticket.guestName}</p>
                                {ticket.roomNumber && (
                                  <p><strong>Room:</strong> {ticket.roomNumber}</p>
                                )}
                                <p><strong>Color:</strong> {ticket.carColor}</p>
                              </div>

                              {canEdit && (
                                <Button
                                  size="sm"
                                  className="w-full bg-regis-gold hover:bg-yellow-600 text-regis-navy font-semibold text-xs sm:text-sm"
                                  onClick={() => updateStatusMutation.mutate({ 
                                    ticketNumber: ticket.ticketNumber, 
                                    status: 'retrieving' 
                                  })}
                                  data-testid={`button-start-retrieval-${ticket.ticketNumber}`}
                                >
                                  <Play size={14} className="mr-1" />
                                  Retrieve
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  )}
                </Card>

                {/* Ready for Collection - Full View */}
                <Card className="shadow-lg border-2 border-green-200 bg-gradient-to-br from-white to-green-50/30 mb-4">
                  <CardHeader className="p-4 sm:p-6 pb-2">
                    <CardTitle className="flex items-center justify-between text-base sm:text-lg">
                      <div className="flex items-center gap-2 text-green-700">
                        <Check size={20} />
                        Ready for Collection
                      </div>
                      <Badge className="bg-green-600 text-white text-lg px-4 py-1">
                        {activeTickets?.filter(t => t.status === 'ready').length || 0}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6 pt-2">
                    {activeTickets?.filter(t => t.status === 'ready').length === 0 ? (
                      <div className="text-center py-6 text-gray-400">
                        <Check size={36} className="mx-auto mb-2 opacity-40" />
                        <p className="text-sm">No cars ready for collection</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {activeTickets?.filter(t => t.status === 'ready').map((ticket) => (
                          <div key={ticket.id} className="bg-green-50 border border-green-200 rounded-lg p-4 shadow-sm">
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <p className="font-bold text-lg text-regis-navy">#{ticket.ticketNumber}</p>
                                <p className="text-xs text-gray-500">{ticket.carMake} {ticket.carModel} • {ticket.carColor}</p>
                              </div>
                              <Badge className="bg-green-600 text-white">Ready</Badge>
                            </div>
                            <div className="text-sm text-gray-600 mb-3">
                              <p><strong>Guest:</strong> {ticket.guestName}</p>
                            </div>
                            {canEdit && (
                              <div className="flex gap-2">
                                <Button 
                                  size="sm" 
                                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white"
                                  onClick={() => updateStatusMutation.mutate({ ticketNumber: ticket.ticketNumber, status: 'completed' })}
                                >
                                  Departed
                                </Button>
                                <Button 
                                  size="sm" 
                                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                                  onClick={() => updateStatusMutation.mutate({ ticketNumber: ticket.ticketNumber, status: 'out_with_guest' })}
                                >
                                  Coming Back
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Guest will Return - Full View */}
                <Card className="shadow-lg border-2 border-blue-200 bg-gradient-to-br from-white to-blue-50/30 mt-4">
                  <CardHeader className="p-4 sm:p-6 pb-2">
                    <CardTitle className="flex items-center justify-between text-base sm:text-lg">
                      <div className="flex items-center gap-2 text-blue-700">
                        <Car size={20} />
                        Car in Use - Guest Will Return
                      </div>
                      <Badge className="bg-blue-600 text-white text-lg px-4 py-1">
                        {activeTickets?.filter(t => t.status === 'out_with_guest').length || 0}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6 pt-2">
                    {activeTickets?.filter(t => t.status === 'out_with_guest').length === 0 ? (
                      <div className="text-center py-6 text-gray-400">
                        <Car size={36} className="mx-auto mb-2 opacity-40" />
                        <p className="text-sm">No cars out with guests</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {activeTickets?.filter(t => t.status === 'out_with_guest').map((ticket) => (
                          <GuestOutCardFull 
                            key={ticket.id} 
                            ticket={ticket} 
                            onBack={() => guestReturnedMutation.mutate(ticket.ticketNumber)}
                            onView={() => setViewTicket(ticket)}
                            canEdit={canEdit}
                          />
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}

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
                        <p className="font-bold text-base text-gray-600">#{ticket.ticketNumber}</p>
                        <p className="text-xs text-gray-400">{ticket.carMake} {ticket.carModel} • {ticket.carColor}</p>
                        {ticket.licensePlate && <p className="text-xs font-semibold text-gray-700 tracking-wide">{ticket.licensePlate}</p>}
                      </div>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setViewTicket(ticket)}>
                        <Eye size={16} className="text-gray-400" />
                      </Button>
                    </div>
                    <div className="text-xs text-gray-500">
                      <p><strong>Guest:</strong> {ticket.guestName}</p>
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

                        if (panelId === 'in-house') return (
                          <SortablePanel key="in-house" id="in-house"
                            title="In House"
                            badge={<Badge className="bg-regis-navy text-white text-sm px-3 py-1 ml-2">{activeTickets?.filter(t => t.status === 'active').length || 0}</Badge>}
                            icon={<Clock className="text-regis-navy" size={18} />}
                            expanded={isExpanded} onToggle={toggle}
                          >
                            {ticketsLoading ? <div className="text-center py-6">Loading tickets...</div> : (
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                                {activeTickets?.filter(t => t.status === 'active').map((ticket) => (
                                  <div key={ticket.id} className={`rounded-lg p-3 sm:p-4 shadow-sm hover:shadow-md transition-shadow border-2 ${ticket.parkingLocation ? 'border-green-400 bg-green-50/40' : 'border-red-400 bg-red-50/40'}`}>
                                    <div className="flex justify-between items-start mb-2 sm:mb-3">
                                      <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <p className="font-bold text-base sm:text-lg text-regis-navy">#{ticket.ticketNumber}</p>
                                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${ticket.parkingLocation ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-red-100 text-red-700 border border-red-300'}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${ticket.parkingLocation ? 'bg-green-500' : 'bg-red-500'}`} />
                                            PL: {ticket.parkingLocation || 'Unassigned'}
                                          </span>
                                        </div>
                                        <p className="text-xs text-gray-500">{ticket.carMake} {ticket.carModel}</p>
                                        {ticket.licensePlate && <p className="text-xs font-semibold text-gray-700 tracking-wide">{ticket.licensePlate}</p>}
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
                                        <CircularTimer createdAt={ticket.createdAt || new Date()} maxHours={24} size={40} strokeWidth={3} />
                                      </div>
                                    </div>
                                    <div className="space-y-1 text-xs sm:text-sm text-gray-600 mb-2 sm:mb-3">
                                      <p><strong>Guest:</strong> {ticket.guestName}</p>
                                      {ticket.roomNumber && <p><strong>Room:</strong> {ticket.roomNumber}</p>}
                                      <p><strong>Color:</strong> {ticket.carColor}</p>
                                    </div>
                                    {canEdit && (
                                      <Button size="sm" className="w-full bg-regis-gold hover:bg-yellow-600 text-regis-navy font-semibold text-xs sm:text-sm"
                                        onClick={() => updateStatusMutation.mutate({ ticketNumber: ticket.ticketNumber, status: 'retrieving' })}
                                        data-testid={`button-start-retrieval-desktop-${ticket.ticketNumber}`}
                                      >
                                        <Play size={14} className="mr-1" /> Retrieve
                                      </Button>
                                    )}
                                  </div>
                                ))}
                                {activeTickets?.filter(t => t.status === 'active').length === 0 && (
                                  <div className="col-span-full text-center py-6 sm:py-8 text-gray-400">
                                    <Clock size={36} className="mx-auto mb-2 opacity-40" />
                                    <p className="text-sm">No vehicles in house</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </SortablePanel>
                        );

                        if (panelId === 'retrievals') return (
                          <SortablePanel key="retrievals" id="retrievals"
                            title="Active Retrievals"
                            badge={<Badge className="bg-orange-500 text-white text-sm px-3 py-1 ml-2">{activeTickets?.filter(t => ['retrieving', 'transit', 'preparing', 'ready'].includes(t.status)).length || 0}</Badge>}
                            icon={<Car className="text-orange-500" size={18} />}
                            expanded={isExpanded} onToggle={toggle}
                          >
                            <UnifiedRetrievalBox
                              tickets={activeTickets || []}
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

                        if (panelId === 'guest-out') return (
                          <SortablePanel key="guest-out" id="guest-out"
                            title="Car in Use — Guest Will Return"
                            badge={<Badge className="bg-blue-600 text-white text-sm px-3 py-1 ml-2">{activeTickets?.filter(t => t.status === 'out_with_guest').length || 0}</Badge>}
                            icon={<Car className="text-blue-700" size={18} />}
                            borderClass="border-blue-200" headerClass="text-blue-700"
                            expanded={isExpanded} onToggle={toggle}
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
                            title="Check Out Departed Today"
                            badge={<span className="ml-2 bg-gray-200 text-gray-700 text-xs font-bold px-2 py-0.5 rounded-full">{departedToday.length}</span>}
                            icon={<LogOut className="text-gray-600" size={18} />} headerClass="text-gray-600"
                            expanded={isExpanded} onToggle={toggle}
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
                            title="Check Out Departed History"
                            badge={<span className="ml-2 bg-gray-200 text-gray-600 text-xs font-bold px-2 py-0.5 rounded-full">{departedHistory.length}</span>}
                            icon={<LogOut className="text-gray-500" size={18} />} headerClass="text-gray-500"
                            expanded={isExpanded} onToggle={toggle}
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
            <div className={`grid grid-cols-2 gap-4 mt-4 ${compactView ? "hidden sm:grid" : ""}`}>
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
                  <p className="text-xl font-bold text-gray-900">{statsLoading ? '-' : stats?.avgTime || '0m'}</p>
                  <p className="text-xs text-gray-600">Avg. Time</p>
                </CardContent>
              </Card>
            </div>

          </TabsContent>

          {/* User Management Tab */}
          {user?.role === 'superadmin' && (
            <TabsContent value="users" className="space-y-6">
              <h2 className="text-xl font-semibold text-regis-navy">User Management</h2>

              <Card>
                <CardContent className="p-6">
                  {usersLoading ? (
                    <div className="text-center py-8">Loading users...</div>
                  ) : (
                    <div className="space-y-4">
                      {allUsers?.map((staffUser) => (
                        <div key={staffUser.id} className="border border-gray-200 rounded-lg p-4 flex justify-between items-center">
                          <div>
                            <p className="font-medium">{staffUser.firstName} {staffUser.lastName}</p>
                            <p className="text-sm text-gray-600">{staffUser.email}</p>
                            <p className="text-xs text-gray-500 capitalize">{staffUser.role?.replace('_', ' ')}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditUserData(staffUser);
                                setShowPassword(false);
                              }}
                              data-testid={`button-edit-user-${staffUser.id}`}
                            >
                              <Edit size={14} className="mr-1" />
                              Edit
                            </Button>
                            <Badge variant={staffUser.role === 'superadmin' ? 'default' : 'secondary'}>
                              {staffUser.role?.replace('_', ' ')}
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
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${ticket.parkingLocation ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-red-100 text-red-700 border border-red-300'}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${ticket.parkingLocation ? 'bg-green-500' : 'bg-red-500'}`} />
                                    PL: {ticket.parkingLocation || 'Unassigned'}
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
                              <p className="truncate"><strong>Guest:</strong> {ticket.guestName}</p>
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

          {/* Settings Tab */}
          {user?.role === 'superadmin' && (
            <TabsContent value="settings" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>System Settings</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">Settings management coming soon...</p>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>

        {/* Add User Modal */}
        <Dialog open={showAddUser} onOpenChange={setShowAddUser}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Staff User</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
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
                    <SelectItem value="standard">Standard Staff</SelectItem>
                    <SelectItem value="superadmin">Super Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex space-x-2 pt-4">
                <Button
                  onClick={() => addUserMutation.mutate(newUserData)}
                  disabled={addUserMutation.isPending}
                  className="flex-1 bg-regis-navy hover:bg-blue-900"
                >
                  {addUserMutation.isPending ? "Adding..." : "Add User"}
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
                    <Badge variant={editUserData.password ? 'default' : 'destructive'}>
                      {editUserData.password ? 'Password Set' : 'No Password'}
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
              {user?.password && (
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
                      <p className="font-medium">{viewTicket.guestName || 'N/A'}</p>
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
                    onClick={async () => {
                      const ticket = viewTicket;
                      try {
                        // Convert mm to points (72 points per inch, 25.4 mm per inch)
                        const mm = (value: number) => (value * 72) / 25.4;
                        
                        // Label dimensions - 50mm x 70mm
                        const labelWidthMm = 50;
                        const labelHeightMm = 70;
                        const widthPt = mm(labelWidthMm);
                        const heightPt = mm(labelHeightMm);
                        
                        const pdfDoc = await PDFDocument.create();
                        const page = pdfDoc.addPage([widthPt, heightPt]);
                        
                        // Set all page boxes to ensure correct dimensions
                        page.setMediaBox(0, 0, widthPt, heightPt);
                        page.setCropBox(0, 0, widthPt, heightPt);
                        page.setBleedBox(0, 0, widthPt, heightPt);
                        
                        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
                        const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
                        
                        // Cursor starts at top of page minus top margin
                        let cursorY = heightPt - mm(3);
                        
                        // Helper function to draw text and move cursor
                        const drawText = (options: { 
                          text: string; 
                          size: number; 
                          face?: PDFFont; 
                          align?: "left" | "center"; 
                          gapMm?: number;
                        }) => {
                          const { text, size, face = font, align = "left", gapMm = 1.5 } = options;
                          cursorY -= size; // Move cursor down by font size
                          const textWidth = face.widthOfTextAtSize(text, size);
                          const textX = align === "center" ? (widthPt - textWidth) / 2 : mm(4);
                          page.drawText(text, { 
                            x: textX, 
                            y: cursorY, 
                            size, 
                            font: face, 
                            color: rgb(0, 0, 0) 
                          });
                          cursorY -= mm(gapMm); // Add gap after text
                        };
                        
                        // Header
                        drawText({ text: "ST. REGIS OSAKA", size: 14, face: bold, align: "center" });
                        drawText({ text: "VALET PARKING", size: 10, align: "center" });
                        
                        // Divider line
                        page.drawLine({ 
                          start: { x: mm(4), y: cursorY }, 
                          end: { x: widthPt - mm(4), y: cursorY }, 
                          thickness: 1, 
                          color: rgb(0, 0, 0) 
                        });
                        cursorY -= mm(5);
                        
                        // Ticket number - large
                        drawText({ text: `#${ticket.ticketNumber}`, size: 32, face: bold, align: "center", gapMm: 4 });
                        
                        // Guest info
                        drawText({ text: ticket.guestName || "Guest", size: 14, face: bold });
                        if (ticket.roomNumber) {
                          drawText({ text: `Room: ${ticket.roomNumber}`, size: 11 });
                        }
                        
                        // Vehicle section
                        drawText({ text: "Vehicle", size: 11, face: bold, gapMm: 0.5 });
                        const carInfo = [ticket.carMake, ticket.carModel].filter(Boolean).join(' ');
                        if (carInfo) {
                          drawText({ text: carInfo, size: 11 });
                        }
                        drawText({ text: `Color: ${ticket.carColor || 'N/A'}`, size: 11 });
                        drawText({ text: `Plate: ${ticket.licensePlate || 'N/A'}`, size: 11 });
                        
                        // Location box
                        if (ticket.parkingLocation) {
                          const boxHeight = mm(10);
                          cursorY -= boxHeight;
                          page.drawRectangle({ 
                            x: mm(4), 
                            y: cursorY, 
                            width: widthPt - mm(8), 
                            height: boxHeight, 
                            color: rgb(0.9, 0.9, 0.9) 
                          });
                          const locText = `LOC: ${ticket.parkingLocation}`;
                          const locWidth = bold.widthOfTextAtSize(locText, 13);
                          page.drawText(locText, { 
                            x: (widthPt - locWidth) / 2, 
                            y: cursorY + mm(3), 
                            size: 13, 
                            font: bold,
                            color: rgb(0, 0, 0)
                          });
                          cursorY -= mm(2);
                        }
                        
                        // Footer - always at bottom
                        page.drawLine({ 
                          start: { x: mm(4), y: mm(6) }, 
                          end: { x: widthPt - mm(4), y: mm(6) }, 
                          thickness: 0.5, 
                          color: rgb(0, 0, 0) 
                        });
                        
                        if (ticket.createdAt) {
                          const dateText = new Date(ticket.createdAt).toLocaleString();
                          const dateWidth = font.widthOfTextAtSize(dateText, 8);
                          page.drawText(dateText, { 
                            x: (widthPt - dateWidth) / 2, 
                            y: mm(2), 
                            size: 8, 
                            font,
                            color: rgb(0, 0, 0)
                          });
                        }
                        
                        // Generate PDF and open for printing
                        const pdfBytes = await pdfDoc.save();
                        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
                        const url = URL.createObjectURL(blob);
                        
                        // Open PDF in new tab for printing
                        window.open(url, '_blank');
                      } catch (error) {
                        console.error('PDF generation error:', error);
                      }
                    }}
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
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit size={20} />
                Edit Ticket #{editTicketData?.ticketNumber}
              </DialogTitle>
            </DialogHeader>
            {editTicketData && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Status</label>
                  <Select
                    value={editTicketData.status}
                    onValueChange={(value) => setEditTicketData({ ...editTicketData, status: value })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select status" />
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

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Guest Name</label>
                    <Input
                      value={editTicketData.guestName || ''}
                      onChange={(e) => setEditTicketData({ ...editTicketData, guestName: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Room Number</label>
                    <Input
                      value={editTicketData.roomNumber || ''}
                      onChange={(e) => setEditTicketData({ ...editTicketData, roomNumber: e.target.value })}
                      placeholder="Optional"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">License Plate</label>
                    <Input
                      value={editTicketData.licensePlate || ''}
                      onChange={(e) => setEditTicketData({ ...editTicketData, licensePlate: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Car Make</label>
                    <Input
                      value={editTicketData.carMake || ''}
                      onChange={(e) => setEditTicketData({ ...editTicketData, carMake: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Car Model</label>
                    <Input
                      value={editTicketData.carModel || ''}
                      onChange={(e) => setEditTicketData({ ...editTicketData, carModel: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Car Color</label>
                    <Input
                      value={editTicketData.carColor || ''}
                      onChange={(e) => setEditTicketData({ ...editTicketData, carColor: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Parking Location</label>
                  <Input
                    value={editTicketData.parkingLocation || ''}
                    onChange={(e) => setEditTicketData({ ...editTicketData, parkingLocation: e.target.value })}
                    placeholder="e.g., A23"
                    className="mt-1"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Staff Notes</label>
                  <Textarea
                    value={editTicketData.staffNotes || ''}
                    onChange={(e) => setEditTicketData({ ...editTicketData, staffNotes: e.target.value })}
                    placeholder="Add notes..."
                    className="mt-1"
                    rows={3}
                  />
                </div>

                <div className="flex space-x-2 pt-4">
                  <Button
                    onClick={() => updateTicketMutation.mutate({
                      ticketNumber: editTicketData.ticketNumber,
                      status: editTicketData.status,
                      guestName: editTicketData.guestName,
                      roomNumber: editTicketData.roomNumber,
                      licensePlate: editTicketData.licensePlate,
                      carMake: editTicketData.carMake,
                      carModel: editTicketData.carModel,
                      carColor: editTicketData.carColor,
                      parkingLocation: editTicketData.parkingLocation,
                      staffNotes: editTicketData.staffNotes,
                    })}
                    disabled={updateTicketMutation.isPending}
                    className="flex-1 bg-regis-navy hover:bg-blue-900"
                    data-testid="button-save-ticket"
                  >
                    <Save size={16} className="mr-2" />
                    {updateTicketMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setEditTicketData(null)}
                    className="flex-1"
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
                  <p><strong>Guest:</strong> {deleteTicket.guestName || 'N/A'}</p>
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
                  <p><strong>Guest:</strong> {archiveTicket.guestName || 'N/A'}</p>
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
      </div>
    </div>
  );
}