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
import { UnifiedRetrievalBox } from "@/components/active-retrieval-progress";
import { CircularTimer } from "@/components/circular-timer";
import { Crown, Clock, Construction, Check, Timer, LogOut, Car, Camera, MapPin, User, Edit, Save, X, Plus, Users, TicketIcon, Settings, Home, Eye, Trash2, Archive, AlertTriangle, Play, LayoutGrid, List } from "lucide-react";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { ValetTicket, User as UserType } from "@shared/schema";

export default function StaffDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
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
  
  // Ticket management modals state
  const [viewTicket, setViewTicket] = useState<ValetTicket | null>(null);
  const [editTicketData, setEditTicketData] = useState<ValetTicket | null>(null);
  const [deleteTicket, setDeleteTicket] = useState<ValetTicket | null>(null);
  const [archiveTicket, setArchiveTicket] = useState<ValetTicket | null>(null);
  
  // Compact view toggle for mobile
  const [compactView, setCompactView] = useState(false);
  
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

  // Update ticket details mutation
  const updateTicketMutation = useMutation({
    mutationFn: async (ticketData: Partial<ValetTicket> & { ticketNumber: string }) => {
      await apiRequest("PATCH", `/api/admin/tickets/${ticketData.ticketNumber}`, ticketData);
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
        if (data.type === 'ticket_created' || data.type === 'status_updated') {
          queryClient.invalidateQueries({ queryKey: ["/api/staff/tickets"] });
          queryClient.invalidateQueries({ queryKey: ["/api/staff/stats"] });
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    }
  }, [lastMessage, queryClient]);

  return (
    <div className="min-h-screen bg-gray-50">
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
            <Button
              onClick={() => window.location.href = '/api/logout'}
              variant="outline"
              size="sm"
              className="text-regis-navy border-regis-navy hover:bg-regis-navy hover:text-white px-2 sm:px-3"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline ml-2">Logout</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="p-3 sm:p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
          <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
            <TabsList className="inline-flex w-auto min-w-full sm:grid sm:w-full sm:grid-cols-4">
              <TabsTrigger value="dashboard" className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 text-xs sm:text-sm whitespace-nowrap">
                <Car size={14} className="sm:w-4 sm:h-4" />
                <span className="hidden xs:inline sm:inline">Dashboard</span>
              </TabsTrigger>
              {user?.role === 'superadmin' && (
                <TabsTrigger value="users" className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 text-xs sm:text-sm whitespace-nowrap">
                  <Users size={14} className="sm:w-4 sm:h-4" />
                  <span className="hidden xs:inline sm:inline">Users</span>
                </TabsTrigger>
              )}
              {user?.role === 'superadmin' && (
                <TabsTrigger value="tickets" className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 text-xs sm:text-sm whitespace-nowrap">
                  <TicketIcon size={14} className="sm:w-4 sm:h-4" />
                  <span className="hidden xs:inline sm:inline">Tickets</span>
                </TabsTrigger>
              )}
              {user?.role === 'superadmin' && (
                <TabsTrigger value="settings" className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 text-xs sm:text-sm whitespace-nowrap">
                  <Settings size={14} className="sm:w-4 sm:h-4" />
                  <span className="hidden xs:inline sm:inline">Settings</span>
                </TabsTrigger>
              )}
            </TabsList>
          </div>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-4 sm:space-y-6">
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
                {compactView ? "Full" : "Compact"}
              </Button>
              <Button 
                onClick={() => setShowTicketWizard(true)}
                size="sm"
                className="bg-regis-gold hover:bg-yellow-600 text-regis-navy font-semibold"
                data-testid="button-new-valet-ticket"
              >
                <Plus size={16} className="mr-1 sm:mr-2" />
                New Valet Ticket
              </Button>
            </div>

            {/* Compact View for Mobile */}
            {compactView ? (
              <div className="space-y-3 sm:hidden">
                {/* Compact Stats Row */}
                <div className="flex gap-2">
                  <div className="flex-1 bg-gray-50 rounded-lg p-2 text-center">
                    <p className="text-lg font-bold text-gray-900">{statsLoading ? '-' : stats?.completed || 0}</p>
                    <p className="text-xs text-gray-500">Done</p>
                  </div>
                  <div className="flex-1 bg-purple-50 rounded-lg p-2 text-center">
                    <p className="text-lg font-bold text-purple-600">{statsLoading ? '-' : stats?.avgTime || '0m'}</p>
                    <p className="text-xs text-gray-500">Avg</p>
                  </div>
                  <div className="flex-1 bg-blue-50 rounded-lg p-2 text-center">
                    <p className="text-lg font-bold text-blue-600">{activeTickets?.filter(t => t.status === 'active').length || 0}</p>
                    <p className="text-xs text-gray-500">In House</p>
                  </div>
                  <div className="flex-1 bg-orange-50 rounded-lg p-2 text-center">
                    <p className="text-lg font-bold text-orange-600">{activeTickets?.filter(t => ['retrieving', 'transit', 'ready'].includes(t.status)).length || 0}</p>
                    <p className="text-xs text-gray-500">Retrieving</p>
                  </div>
                </div>

                {/* Compact Being Retrieved */}
                <div className="bg-white border rounded-lg p-3">
                  <h3 className="text-sm font-semibold text-regis-navy mb-2 flex items-center gap-1">
                    <Car size={14} /> Being Retrieved ({activeTickets?.filter(t => ['retrieving', 'transit', 'ready'].includes(t.status)).length || 0})
                  </h3>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {activeTickets?.filter(t => ['retrieving', 'transit', 'ready'].includes(t.status)).map((ticket) => (
                      <div key={ticket.id} className="flex items-center justify-between bg-gray-50 rounded p-2">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(ticket.status)}
                          <span className="font-medium text-sm">#{ticket.ticketNumber}</span>
                        </div>
                        <div className="flex gap-1">
                          {ticket.status === 'retrieving' && (
                            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => updateStatusMutation.mutate({ ticketNumber: ticket.ticketNumber, status: 'transit' })}>Transit</Button>
                          )}
                          {ticket.status === 'transit' && (
                            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => updateStatusMutation.mutate({ ticketNumber: ticket.ticketNumber, status: 'ready' })}>Ready</Button>
                          )}
                          {ticket.status === 'ready' && (
                            <Button size="sm" className="h-7 px-2 text-xs bg-green-600" onClick={() => updateStatusMutation.mutate({ ticketNumber: ticket.ticketNumber, status: 'completed' })}>Done</Button>
                          )}
                        </div>
                      </div>
                    ))}
                    {activeTickets?.filter(t => ['retrieving', 'transit', 'ready'].includes(t.status)).length === 0 && (
                      <p className="text-xs text-gray-400 text-center py-2">No active retrievals</p>
                    )}
                  </div>
                </div>

                {/* Compact In House - Valet Care */}
                <div className="bg-white border rounded-lg p-3">
                  <h3 className="text-sm font-semibold text-regis-navy mb-2 flex items-center gap-1">
                    <Clock size={14} /> In House - Valet Care ({activeTickets?.filter(t => t.status === 'active').length || 0})
                  </h3>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {activeTickets?.filter(t => t.status === 'active').map((ticket) => (
                      <div key={ticket.id} className="flex items-center justify-between bg-gray-50 rounded p-2">
                        <div>
                          <span className="font-medium text-sm">#{ticket.ticketNumber}</span>
                          <span className="text-xs text-gray-500 ml-1">{ticket.carMake}</span>
                        </div>
                        <Button 
                          size="sm" 
                          className="h-7 px-2 text-xs bg-regis-gold text-regis-navy"
                          onClick={() => updateStatusMutation.mutate({ ticketNumber: ticket.ticketNumber, status: 'retrieving' })}
                        >
                          <Play size={12} className="mr-1" />Start
                        </Button>
                      </div>
                    ))}
                    {activeTickets?.filter(t => t.status === 'active').length === 0 && (
                      <p className="text-xs text-gray-400 text-center py-2">No vehicles in house</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Full View (existing layout) */
              <>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                  {/* Unified Active Retrieval Box */}
                  <div className="lg:col-span-2">
                    <UnifiedRetrievalBox 
                      tickets={activeTickets || []} 
                      onStageComplete={(ticketNumber, nextStage) => {
                        const statusMap: Record<number, string> = { 2: 'transit', 3: 'ready', 4: 'completed' };
                        const newStatus = statusMap[nextStage];
                        if (newStatus) {
                          updateStatusMutation.mutate({ ticketNumber, status: newStatus });
                        }
                      }}
                    />
                  </div>

                  {/* Stats Summary */}
                  <div className="space-y-4">
                    <Card className="shadow-sm">
                      <CardContent className="p-4 sm:p-6 text-center">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-2 sm:mb-3">
                          <Check className="text-gray-600" size={18} />
                        </div>
                        <p className="text-xl sm:text-2xl font-bold text-gray-900">{statsLoading ? '-' : stats?.completed || 0}</p>
                        <p className="text-xs sm:text-sm text-gray-600">Completed Today</p>
                      </CardContent>
                    </Card>

                    <Card className="shadow-sm">
                      <CardContent className="p-4 sm:p-6 text-center">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-2 sm:mb-3">
                          <Timer className="text-purple-600" size={18} />
                        </div>
                        <p className="text-xl sm:text-2xl font-bold text-gray-900">{statsLoading ? '-' : stats?.avgTime || '0m'}</p>
                        <p className="text-xs sm:text-sm text-gray-600">Avg. Time</p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </>
            )}

            {/* In House - Valet Care - hidden on mobile compact view */}
            <Card className={compactView ? "hidden sm:block" : ""}>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Clock className="text-regis-navy" size={18} />
                  In House - Valet Care
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0">
                {ticketsLoading ? (
                  <div className="text-center py-6 sm:py-8">Loading tickets...</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    {activeTickets?.filter(t => t.status === 'active').map((ticket) => (
                      <div key={ticket.id} className="border border-gray-200 rounded-lg p-3 sm:p-4 bg-white shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-2 sm:mb-3">
                          <div>
                            <p className="font-bold text-base sm:text-lg text-regis-navy">#{ticket.ticketNumber}</p>
                            <p className="text-xs text-gray-500">
                              {ticket.carMake} {ticket.carModel}
                            </p>
                          </div>
                          <CircularTimer 
                            createdAt={ticket.createdAt || new Date()} 
                            maxHours={24}
                            size={40}
                            strokeWidth={3}
                          />
                        </div>

                        <div className="space-y-1 text-xs sm:text-sm text-gray-600 mb-2 sm:mb-3">
                          <p><strong>Guest:</strong> {ticket.guestName}</p>
                          <p><strong>Color:</strong> {ticket.carColor}</p>
                          {ticket.parkingLocation && (
                            <p><strong>Parking:</strong> {ticket.parkingLocation}</p>
                          )}
                        </div>

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
                          Start Retrieval
                        </Button>
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
            </Card>

            {/* Quick Actions - hidden on mobile compact view */}
            <Card className={compactView ? "hidden sm:block" : ""}>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-base sm:text-lg">Quick Status Updates</CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0">
                {ticketsLoading ? (
                  <div className="text-center py-6 sm:py-8">Loading tickets...</div>
                ) : (
                  <div className="space-y-2 sm:space-y-3">
                    {activeTickets?.filter(t => t.status === 'retrieving' || t.status === 'transit' || t.status === 'ready').map((ticket) => (
                      <div key={ticket.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-2 sm:p-3 bg-gray-50 rounded-lg gap-2">
                        <div className="flex items-center space-x-2 sm:space-x-3">
                          {getStatusIcon(ticket.status)}
                          <div>
                            <p className="font-medium text-sm">#{ticket.ticketNumber}</p>
                            <p className="text-xs text-gray-500">{ticket.carMake} {ticket.carModel} • {ticket.carColor}</p>
                          </div>
                        </div>
                        <div className="flex space-x-1 sm:space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 sm:flex-none text-xs h-8"
                            onClick={() => updateStatusMutation.mutate({ 
                              ticketNumber: ticket.ticketNumber, 
                              status: 'transit' 
                            })}
                            disabled={ticket.status !== 'retrieving'}
                          >
                            Transit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 sm:flex-none text-xs h-8"
                            onClick={() => updateStatusMutation.mutate({ 
                              ticketNumber: ticket.ticketNumber, 
                              status: 'ready' 
                            })}
                            disabled={ticket.status !== 'transit'}
                          >
                            Ready
                          </Button>
                          <Button
                            size="sm"
                            className="flex-1 sm:flex-none text-xs h-8 bg-green-600 hover:bg-green-700"
                            onClick={() => updateStatusMutation.mutate({ 
                              ticketNumber: ticket.ticketNumber, 
                              status: 'completed' 
                            })}
                            disabled={ticket.status !== 'ready'}
                          >
                            Complete
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* User Management Tab */}
          {user?.role === 'superadmin' && (
            <TabsContent value="users" className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-regis-navy">User Management</h2>
                <Button
                  onClick={() => setShowAddUser(true)}
                  className="bg-regis-navy hover:bg-blue-900 text-white"
                >
                  <Plus size={16} className="mr-2" />
                  Add Staff User
                </Button>
              </div>

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
                            <p className="text-xs text-gray-500 capitalize">{staffUser.role}</p>
                          </div>
                          <Badge variant={staffUser.role === 'superadmin' ? 'default' : 'secondary'}>
                            {staffUser.role}
                          </Badge>
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
                        <div key={ticket.id} className="border border-gray-200 rounded-lg p-3 sm:p-4">
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 sm:gap-0 mb-3">
                            <div className="flex items-center justify-between sm:block">
                              <div>
                                <p className="font-medium text-sm sm:text-base">Ticket #{ticket.ticketNumber}</p>
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
              <DialogTitle className="flex items-center gap-2">
                <TicketIcon size={20} />
                Ticket #{viewTicket?.ticketNumber}
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
                  <h3 className="font-semibold text-regis-navy mb-3">Parking Information</h3>
                  <div>
                    <p className="text-xs text-gray-500">Parking Location</p>
                    <p className="font-medium">{viewTicket.parkingLocation || 'Not assigned'}</p>
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
                      <p className="text-xs text-gray-500">Assigned Staff</p>
                      <p className="font-medium">{viewTicket.assignedStaff || 'Unassigned'}</p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t">
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

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Guest Name</label>
                    <Input
                      value={editTicketData.guestName || ''}
                      onChange={(e) => setEditTicketData({ ...editTicketData, guestName: e.target.value })}
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