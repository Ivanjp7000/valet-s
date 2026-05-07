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
import { Crown, Clock, Construction, Check, Timer, LogOut, Car, Camera, MapPin, User, Edit, Save, X, Plus, Users, TicketIcon, Settings, Home, Eye, EyeOff, Trash2, Archive, AlertTriangle, Play, LayoutGrid, List, ChevronDown, Printer } from "lucide-react";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { ValetTicket, User as UserType } from "@shared/schema";
import { PDFDocument, rgb, StandardFonts, type PDFFont } from "pdf-lib";

function GuestOutCard({ ticket, onBack, canEdit = true }: { ticket: ValetTicket; onBack: () => void; canEdit?: boolean }) {
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
        <span className="text-xs font-mono font-bold text-blue-700">{mins}:{secs.toString().padStart(2, '0')}</span>
      </div>
      {canEdit && (
        <Button 
          size="sm" 
          className="h-6 px-3 text-xs bg-green-600 hover:bg-green-700 text-white w-full"
          onClick={onBack}
        >
          Back
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

function GuestOutCardFull({ ticket, onBack, canEdit = true }: { ticket: ValetTicket; onBack: () => void; canEdit?: boolean }) {
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
        <div className="text-right">
          <Badge className="bg-blue-600 text-white mb-1">Out with Guest</Badge>
          <p className="text-lg font-mono font-bold text-blue-700">{timeDisplay}</p>
        </div>
      </div>
      <div className="text-sm text-gray-600 mb-3">
        <p><strong>Guest:</strong> {ticket.guestName}</p>
      </div>
      {canEdit && (
        <Button 
          size="sm" 
          className="w-full bg-green-600 hover:bg-green-700 text-white"
          onClick={onBack}
        >
          Back
        </Button>
      )}
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
  
  // Collapsible sections state
  const [inHouseExpanded, setInHouseExpanded] = useState(false);
  const [departedExpanded, setDepartedExpanded] = useState(true);
  const [departedHistoryExpanded, setDepartedHistoryExpanded] = useState(false);
  const [historyFilterYear, setHistoryFilterYear] = useState<string>('all');
  const [historyFilterMonth, setHistoryFilterMonth] = useState<string>('all');
  const [historyFilterDay, setHistoryFilterDay] = useState<string>('all');

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
                    <p className="text-lg font-bold text-orange-600">{activeTickets?.filter(t => ['retrieving', 'transit', 'ready'].includes(t.status)).length || 0}</p>
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

                {/* Ready for Collection - on top */}
                <div className="bg-white border-2 border-green-200 rounded-lg p-3">
                  <h3 className="text-sm font-semibold text-green-700 mb-2 flex items-center gap-1">
                    <Check size={14} /> Ready for Collection ({activeTickets?.filter(t => t.status === 'ready').length || 0})
                  </h3>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
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
                            <Button 
                              size="sm" 
                              className="h-6 px-2 text-xs bg-gray-600 hover:bg-gray-700 text-white flex-1"
                              onClick={() => updateStatusMutation.mutate({ ticketNumber: ticket.ticketNumber, status: 'completed' })}
                            >
                              Departed
                            </Button>
                            <Button 
                              size="sm" 
                              className="h-6 px-2 text-xs bg-blue-600 hover:bg-blue-700 text-white flex-1"
                              onClick={() => updateStatusMutation.mutate({ ticketNumber: ticket.ticketNumber, status: 'out_with_guest' })}
                            >
                              Coming Back
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                    {activeTickets?.filter(t => t.status === 'ready').length === 0 && (
                      <p className="text-xs text-gray-400 text-center py-2">No cars ready for collection</p>
                    )}
                  </div>
                </div>

                {/* Compact Being Retrieved - only retrieving and transit */}
                <div className="bg-white border rounded-lg p-3">
                  <h3 className="text-sm font-semibold text-regis-navy mb-2 flex items-center gap-1">
                    <Car size={14} /> Being Retrieved ({activeTickets?.filter(t => ['retrieving', 'transit'].includes(t.status)).length || 0})
                  </h3>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {activeTickets?.filter(t => ['retrieving', 'transit'].includes(t.status)).map((ticket) => (
                      <div key={ticket.id} className="bg-gray-50 rounded p-2 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">#{ticket.ticketNumber}</span>
                          {canEdit && (
                            <div className="flex gap-1">
                              {ticket.status === 'retrieving' && (
                                <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => updateStatusMutation.mutate({ ticketNumber: ticket.ticketNumber, status: 'transit' })}>Transit</Button>
                              )}
                              {ticket.status === 'transit' && (
                                <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => updateStatusMutation.mutate({ ticketNumber: ticket.ticketNumber, status: 'ready' })}>Ready</Button>
                              )}
                            </div>
                          )}
                        </div>
                        <CompactRetrievalProgress ticket={ticket} />
                      </div>
                    ))}
                    {activeTickets?.filter(t => ['retrieving', 'transit'].includes(t.status)).length === 0 && (
                      <p className="text-xs text-gray-400 text-center py-2">No active retrievals</p>
                    )}
                  </div>
                </div>

                {/* Car Currently in Use Guest will Return */}
                <div className="bg-white border-2 border-blue-200 rounded-lg p-3">
                  <h3 className="text-sm font-semibold text-blue-700 mb-2 flex items-center gap-1">
                    <Car size={14} /> Car in Use Guest Will Return ({activeTickets?.filter(t => t.status === 'out_with_guest').length || 0})
                  </h3>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {activeTickets?.filter(t => t.status === 'out_with_guest').map((ticket) => (
                      <GuestOutCard 
                        key={ticket.id} 
                        ticket={ticket} 
                        onBack={() => guestReturnedMutation.mutate(ticket.ticketNumber)}
                        canEdit={canEdit}
                      />
                    ))}
                    {activeTickets?.filter(t => t.status === 'out_with_guest').length === 0 && (
                      <p className="text-xs text-gray-400 text-center py-2">No cars out with guests</p>
                    )}
                  </div>
                </div>

                {/* Compact In House - Collapsible */}
                <div className="bg-white border rounded-lg p-3">
                  <button 
                    className="w-full text-sm font-semibold text-regis-navy flex items-center justify-between"
                    onClick={() => setInHouseExpanded(!inHouseExpanded)}
                  >
                    <span className="flex items-center gap-1">
                      <Clock size={14} /> In House ({activeTickets?.filter(t => t.status === 'active').length || 0})
                    </span>
                    <ChevronDown size={16} className={`transition-transform ${inHouseExpanded ? 'rotate-180' : ''}`} />
                  </button>
                  {inHouseExpanded && (
                    <div className="space-y-2 max-h-60 overflow-y-auto mt-2">
                      {activeTickets?.filter(t => t.status === 'active').map((ticket) => (
                        <CompactInHouseCard 
                          key={ticket.id} 
                          ticket={ticket} 
                          onRetrieve={() => updateStatusMutation.mutate({ ticketNumber: ticket.ticketNumber, status: 'retrieving' })}
                          onEdit={() => setEditTicketData(ticket)}
                          onView={() => setViewTicket(ticket)}
                          canEdit={canEdit}
                        />
                      ))}
                      {activeTickets?.filter(t => t.status === 'active').length === 0 && (
                        <p className="text-xs text-gray-400 text-center py-2">No vehicles in house</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Checked Out - Departed - Collapsible */}
                <div className="bg-white border border-gray-300 rounded-lg p-3">
                  <button 
                    className="w-full text-sm font-semibold text-gray-600 flex items-center justify-between"
                    onClick={() => setDepartedExpanded(!departedExpanded)}
                  >
                    <span className="flex items-center gap-1">
                      <LogOut size={14} /> Checked Out - Departed ({activeTickets?.filter(t => t.status === 'completed').length || 0})
                    </span>
                    <ChevronDown size={16} className={`transition-transform ${departedExpanded ? 'rotate-180' : ''}`} />
                  </button>
                  {departedExpanded && (
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
                                <p className="text-xs text-blue-600 font-medium">
                                  ⏱️ Stayed: {stayHours}h {stayMins}m
                                </p>
                              )}
                            </div>
                            <div className="flex gap-1">
                              <Button 
                                size="sm" 
                                variant="ghost"
                                className="h-6 w-6 p-0"
                                onClick={() => setViewTicket(ticket)}
                              >
                                <Eye size={14} className="text-gray-400" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                      {activeTickets?.filter(t => t.status === 'completed').length === 0 && (
                        <p className="text-xs text-gray-400 text-center py-2">No departed vehicles</p>
                      )}
                    </div>
                  )}
                </div>

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
                  <CardHeader className="p-4 sm:p-6 pb-2 cursor-pointer" onClick={() => setInHouseExpanded(!inHouseExpanded)}>
                    <CardTitle className="flex items-center justify-between text-base sm:text-lg">
                      <div className="flex items-center gap-2 text-regis-navy">
                        <Clock size={20} />
                        In House
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-regis-navy text-white text-lg px-4 py-1">
                          {activeTickets?.filter(t => t.status === 'active').length || 0}
                        </Badge>
                        <ChevronDown size={20} className={`transition-transform ${inHouseExpanded ? 'rotate-180' : ''}`} />
                      </div>
                    </CardTitle>
                  </CardHeader>
                  {inHouseExpanded && (
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
                            canEdit={canEdit}
                          />
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}

            {/* In House - Desktop Version (hidden on mobile, always shows on desktop) */}
            <Card className="hidden sm:block">
              <CardHeader className="p-4 sm:p-6 cursor-pointer" onClick={() => setInHouseExpanded(!inHouseExpanded)}>
                <CardTitle className="flex items-center justify-between text-base sm:text-lg">
                  <div className="flex items-center gap-2">
                    <Clock className="text-regis-navy" size={18} />
                    In House ({activeTickets?.filter(t => t.status === 'active').length || 0})
                  </div>
                  <ChevronDown size={20} className={`transition-transform ${inHouseExpanded ? 'rotate-180' : ''}`} />
                </CardTitle>
              </CardHeader>
              {inHouseExpanded && (
                <CardContent className="p-4 sm:p-6 pt-0">
                  {ticketsLoading ? (
                    <div className="text-center py-6 sm:py-8">Loading tickets...</div>
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
                              data-testid={`button-start-retrieval-desktop-${ticket.ticketNumber}`}
                            >
                              <Play size={14} className="mr-1" />
                              Retrieve
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
                </CardContent>
              )}
            </Card>

            {/* Active Retrievals - Always visible for ALL users, roles, and screen sizes */}
            <UnifiedRetrievalBox
              tickets={activeTickets || []}
              canEdit={canEdit}
              onStatusChange={(ticketNumber, status) => {
                updateStatusMutation.mutate({ ticketNumber, status });
              }}
              onStageComplete={(ticketNumber, nextStage) => {
                const statusMap: Record<number, string> = { 2: 'transit', 3: 'ready', 4: 'completed' };
                const newStatus = statusMap[nextStage];
                if (newStatus) {
                  updateStatusMutation.mutate({ ticketNumber, status: newStatus });
                }
              }}
            />

            {/* Check Out Departed Today */}
            {(() => {
              const todayStart = new Date();
              todayStart.setHours(0, 0, 0, 0);
              const departedToday = activeTickets?.filter(t =>
                t.status === 'completed' &&
                t.updatedAt &&
                new Date(t.updatedAt) >= todayStart
              ) || [];
              const departedHistory = activeTickets?.filter(t =>
                t.status === 'completed' &&
                (!t.updatedAt || new Date(t.updatedAt) < todayStart)
              ) || [];

              const DepartedCard = ({ ticket }: { ticket: typeof departedToday[0] }) => {
                const stayHours = ticket.totalStaySeconds ? Math.floor(ticket.totalStaySeconds / 3600) : null;
                const stayMins = ticket.totalStaySeconds ? Math.floor((ticket.totalStaySeconds % 3600) / 60) : null;
                return (
                  <div className="border border-gray-200 rounded-lg p-3 sm:p-4 bg-gray-50 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-bold text-base text-gray-600">#{ticket.ticketNumber}</p>
                        <p className="text-xs text-gray-400">{ticket.carMake} {ticket.carModel} • {ticket.carColor}</p>
                      </div>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setViewTicket(ticket)}>
                        <Eye size={16} className="text-gray-400" />
                      </Button>
                    </div>
                    <div className="text-xs text-gray-500">
                      <p><strong>Guest:</strong> {ticket.guestName}</p>
                      {ticket.roomNumber && <p><strong>Room:</strong> {ticket.roomNumber}</p>}
                      {stayHours !== null && (
                        <p className="text-blue-600 font-medium mt-1">⏱️ Total Stay: {stayHours}h {stayMins}m</p>
                      )}
                      {ticket.updatedAt && (
                        <p className="text-gray-400 mt-0.5">
                          Departed: {new Date(ticket.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </div>
                  </div>
                );
              };

              return (
                <>
                  {/* Today */}
                  <Card className={compactView ? "hidden sm:block" : ""}>
                    <CardHeader className="p-4 sm:p-6 cursor-pointer" onClick={() => setDepartedExpanded(!departedExpanded)}>
                      <CardTitle className="flex items-center justify-between text-base sm:text-lg text-gray-600">
                        <div className="flex items-center gap-2">
                          <LogOut size={18} />
                          Check Out Departed Today
                          <span className="ml-1 bg-gray-200 text-gray-700 text-xs font-bold px-2 py-0.5 rounded-full">
                            {departedToday.length}
                          </span>
                        </div>
                        <ChevronDown size={20} className={`transition-transform ${departedExpanded ? 'rotate-180' : ''}`} />
                      </CardTitle>
                    </CardHeader>
                    {departedExpanded && (
                      <CardContent className="p-4 sm:p-6 pt-0">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                          {departedToday.length === 0 ? (
                            <div className="col-span-full text-center py-6 text-gray-400">
                              <LogOut size={36} className="mx-auto mb-2 opacity-40" />
                              <p className="text-sm">No departures today yet</p>
                            </div>
                          ) : (
                            departedToday.map(t => <DepartedCard key={t.id} ticket={t} />)
                          )}
                        </div>
                      </CardContent>
                    )}
                  </Card>

                  {/* History */}
                  <Card className={compactView ? "hidden sm:block" : ""}>
                    <CardHeader className="p-4 sm:p-6 cursor-pointer" onClick={() => setDepartedHistoryExpanded(!departedHistoryExpanded)}>
                      <CardTitle className="flex items-center justify-between text-base sm:text-lg text-gray-500">
                        <div className="flex items-center gap-2">
                          <LogOut size={18} />
                          Check Out Departed History
                          <span className="ml-1 bg-gray-200 text-gray-600 text-xs font-bold px-2 py-0.5 rounded-full">
                            {departedHistory.length}
                          </span>
                        </div>
                        <ChevronDown size={20} className={`transition-transform ${departedHistoryExpanded ? 'rotate-180' : ''}`} />
                      </CardTitle>
                    </CardHeader>
                    {departedHistoryExpanded && (
                      <CardContent className="p-4 sm:p-6 pt-0">
                        {/* Filters */}
                        {(() => {
                          const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

                          // Derive available years/months/days from history data
                          const availableYears = Array.from(new Set(departedHistory.map(t => t.updatedAt ? new Date(t.updatedAt).getFullYear().toString() : null).filter(Boolean))).sort((a,b) => Number(b)-Number(a)) as string[];
                          const availableMonths = Array.from(new Set(departedHistory.filter(t => {
                            if (!t.updatedAt) return false;
                            const d = new Date(t.updatedAt);
                            return historyFilterYear === 'all' || d.getFullYear().toString() === historyFilterYear;
                          }).map(t => t.updatedAt ? (new Date(t.updatedAt).getMonth()+1).toString() : null).filter(Boolean))).sort((a,b) => Number(a)-Number(b)) as string[];
                          const availableDays = Array.from(new Set(departedHistory.filter(t => {
                            if (!t.updatedAt) return false;
                            const d = new Date(t.updatedAt);
                            return (historyFilterYear === 'all' || d.getFullYear().toString() === historyFilterYear) &&
                                   (historyFilterMonth === 'all' || (d.getMonth()+1).toString() === historyFilterMonth);
                          }).map(t => t.updatedAt ? new Date(t.updatedAt).getDate().toString() : null).filter(Boolean))).sort((a,b) => Number(a)-Number(b)) as string[];

                          // Apply filters
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
                              {/* Filter bar */}
                              <div className="flex flex-wrap items-center gap-2 mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Filter by:</span>
                                {/* Year */}
                                <select
                                  value={historyFilterYear}
                                  onChange={e => { setHistoryFilterYear(e.target.value); setHistoryFilterMonth('all'); setHistoryFilterDay('all'); }}
                                  className="text-sm border border-gray-300 rounded-md px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-regis-gold"
                                >
                                  <option value="all">All Years</option>
                                  {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                                {/* Month */}
                                <select
                                  value={historyFilterMonth}
                                  onChange={e => { setHistoryFilterMonth(e.target.value); setHistoryFilterDay('all'); }}
                                  className="text-sm border border-gray-300 rounded-md px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-regis-gold"
                                >
                                  <option value="all">All Months</option>
                                  {availableMonths.map(m => <option key={m} value={m}>{monthNames[Number(m)-1]}</option>)}
                                </select>
                                {/* Day */}
                                <select
                                  value={historyFilterDay}
                                  onChange={e => setHistoryFilterDay(e.target.value)}
                                  className="text-sm border border-gray-300 rounded-md px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-regis-gold"
                                >
                                  <option value="all">All Days</option>
                                  {availableDays.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                                {hasFilter && (
                                  <button
                                    onClick={() => { setHistoryFilterYear('all'); setHistoryFilterMonth('all'); setHistoryFilterDay('all'); }}
                                    className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded border border-red-200 hover:bg-red-50 transition-colors"
                                  >
                                    Clear
                                  </button>
                                )}
                                {hasFilter && (
                                  <span className="text-xs text-gray-400 ml-auto">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
                                )}
                              </div>

                              {/* Results */}
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                                {filtered.length === 0 ? (
                                  <div className="col-span-full text-center py-6 text-gray-400">
                                    <LogOut size={36} className="mx-auto mb-2 opacity-40" />
                                    <p className="text-sm">{hasFilter ? 'No departures match this filter' : 'No historical departures'}</p>
                                  </div>
                                ) : (
                                  filtered.map(t => <DepartedCard key={t.id} ticket={t} />)
                                )}
                              </div>
                            </>
                          );
                        })()}
                      </CardContent>
                    )}
                  </Card>
                </>
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
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                    viewTicket.parkingLocation
                      ? 'bg-green-100 text-green-700 border border-green-300'
                      : 'bg-red-100 text-red-700 border border-red-300'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${viewTicket.parkingLocation ? 'bg-green-500' : 'bg-red-500'}`} />
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
                      <p className="text-xs text-gray-500 mb-2">Registration Photo</p>
                      <img 
                        src={viewTicket.platePhotoUrl} 
                        alt="License plate" 
                        className="w-full max-w-xs h-32 object-cover rounded border"
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