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
import { Crown, Clock, Construction, Check, Timer, LogOut, Car, Camera, MapPin, User, Edit, Save, X, Plus, Users, TicketIcon, Settings, Home, Eye, Trash2, Archive, AlertTriangle } from "lucide-react";
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
    parkingSector: "",
    staffNotes: "",
    carPhoto: "",
  });
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showAddUser, setShowAddUser] = useState(false);
  const [showAddTicket, setShowAddTicket] = useState(false);
  const [showTicketWizard, setShowTicketWizard] = useState(false);
  const [newUserData, setNewUserData] = useState({
    email: "",
    firstName: "",
    lastName: "",
    role: "standard",
  });
  const [newTicketData, setNewTicketData] = useState({
    ticketNumber: "",
    licensePlate: "",
    parkingSector: "",
    parkingLocation: "",
    staffNotes: "",
    carPhoto: "",
  });
  
  // Ticket management modals state
  const [viewTicket, setViewTicket] = useState<ValetTicket | null>(null);
  const [editTicketData, setEditTicketData] = useState<ValetTicket | null>(null);
  const [deleteTicket, setDeleteTicket] = useState<ValetTicket | null>(null);
  const [archiveTicket, setArchiveTicket] = useState<ValetTicket | null>(null);
  
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

  const addTicketMutation = useMutation({
    mutationFn: async (ticketData: typeof newTicketData) => {
      // Combine sector and spot number for final parking location
      const finalData = {
        ...ticketData,
        parkingLocation: ticketData.parkingSector && ticketData.parkingLocation 
          ? `${ticketData.parkingSector}${ticketData.parkingLocation.replace(/[A-Z]/g, '')}` 
          : ticketData.parkingLocation
      };
      await apiRequest("POST", "/api/admin/tickets", finalData);
    },
    onSuccess: () => {
      setShowAddTicket(false);
      setNewTicketData({
        ticketNumber: "", licensePlate: "", parkingSector: "", 
        parkingLocation: "", staffNotes: "", carPhoto: ""
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tickets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/staff/tickets"] });
      toast({ 
        title: "Success", 
        description: "New ticket with car details added successfully",
        duration: 3000
      });
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
      toast({ title: "Error", description: "Failed to add ticket", variant: "destructive" });
    },
  });

  const handleNewTicketPhotoUpload = (photoUrl: string) => {
    setNewTicketData(prev => ({ ...prev, carPhoto: photoUrl }));
  };

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
      <div className="border-b bg-white px-6 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <Crown className="text-regis-navy" size={24} />
            <div>
              <h1 className="text-xl font-bold text-regis-navy">Staff Dashboard</h1>
              <p className="text-sm text-gray-600">Hotel St. Regis Osaka</p>
              <p className="text-xs text-gray-500">Role: {user?.role || 'Loading...'} | User: {user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button
                variant="outline"
                className="text-regis-navy border-regis-navy hover:bg-regis-navy hover:text-white"
                data-testid="button-back-home"
              >
                <Home size={16} className="mr-2" />
                Home
              </Button>
            </Link>
            <Button
              onClick={() => window.location.href = '/api/logout'}
              variant="outline"
              className="text-regis-navy border-regis-navy hover:bg-regis-navy hover:text-white"
            >
              <LogOut size={16} className="mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="dashboard" className="flex items-center space-x-2">
              <Car size={16} />
              <span>Dashboard</span>
            </TabsTrigger>
            {user?.role === 'superadmin' && (
              <TabsTrigger value="users" className="flex items-center space-x-2">
                <Users size={16} />
                <span>User Management</span>
              </TabsTrigger>
            )}
            {user?.role === 'superadmin' && (
              <TabsTrigger value="tickets" className="flex items-center space-x-2">
                <TicketIcon size={16} />
                <span>Ticket Management</span>
              </TabsTrigger>
            )}
            {user?.role === 'superadmin' && (
              <TabsTrigger value="settings" className="flex items-center space-x-2">
                <Settings size={16} />
                <span>Settings</span>
              </TabsTrigger>
            )}
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            {/* New Valet Ticket Button */}
            <div className="flex justify-end">
              <Button 
                onClick={() => setShowTicketWizard(true)}
                className="bg-regis-gold hover:bg-yellow-600 text-regis-navy font-semibold"
                data-testid="button-new-valet-ticket"
              >
                <Plus size={18} className="mr-2" />
                New Valet Ticket
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <Card className="shadow-sm">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <Car className="text-blue-600" size={20} />
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{statsLoading ? '-' : stats?.pending || 0}</p>
                  <p className="text-sm text-gray-600">Retrieving</p>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <Construction className="text-yellow-600" size={20} />
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{statsLoading ? '-' : stats?.transit || 0}</p>
                  <p className="text-sm text-gray-600">In Transit</p>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <Check className="text-green-600" size={20} />
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{statsLoading ? '-' : stats?.ready || 0}</p>
                  <p className="text-sm text-gray-600">Ready</p>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <Check className="text-gray-600" size={20} />
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{statsLoading ? '-' : stats?.completed || 0}</p>
                  <p className="text-sm text-gray-600">Completed Today</p>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <Timer className="text-purple-600" size={20} />
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{statsLoading ? '-' : stats?.avgTime || '0m'}</p>
                  <p className="text-sm text-gray-600">Avg. Time</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Active Tickets</CardTitle>
              </CardHeader>
              <CardContent>
                {ticketsLoading ? (
                  <div className="text-center py-8">Loading tickets...</div>
                ) : (
                  <div className="space-y-4">
                    {activeTickets?.map((ticket) => (
                      <div key={ticket.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center space-x-3">
                            {getStatusIcon(ticket.status)}
                            <div>
                              <p className="font-medium">Ticket #{ticket.ticketNumber}</p>
                              <p className="text-sm text-gray-600">
                                Created {ticket.createdAt ? new Date(ticket.createdAt).toLocaleTimeString() : 'Unknown'}
                              </p>
                            </div>
                          </div>
                          <Badge variant={
                            ticket.status === 'ready' ? 'default' :
                            ticket.status === 'transit' ? 'secondary' : 'outline'
                          }>
                            {ticket.status}
                          </Badge>
                        </div>

                        {ticket.licensePlate && (
                          <p className="text-sm text-gray-600 mb-2">
                            <strong>License:</strong> {ticket.licensePlate}
                          </p>
                        )}

                        {ticket.parkingLocation && (
                          <p className="text-sm text-gray-600 mb-2">
                            <strong>Parking:</strong> {ticket.parkingLocation}
                          </p>
                        )}

                        <div className="flex space-x-2 mt-3">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateStatusMutation.mutate({ 
                              ticketNumber: ticket.ticketNumber, 
                              status: 'transit' 
                            })}
                            disabled={ticket.status !== 'retrieving'}
                          >
                            Mark Transit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateStatusMutation.mutate({ 
                              ticketNumber: ticket.ticketNumber, 
                              status: 'ready' 
                            })}
                            disabled={ticket.status !== 'transit'}
                          >
                            Mark Ready
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => updateStatusMutation.mutate({ 
                              ticketNumber: ticket.ticketNumber, 
                              status: 'completed' 
                            })}
                            disabled={ticket.status !== 'ready'}
                            className="bg-green-600 hover:bg-green-700"
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
                <Button
                  onClick={() => setShowAddTicket(true)}
                  className="bg-regis-navy hover:bg-blue-900 text-white"
                >
                  <Plus size={16} className="mr-2" />
                  Add New Ticket
                </Button>
              </div>

              <Card>
                <CardContent className="p-6">
                  {allTicketsLoading ? (
                    <div className="text-center py-8">Loading tickets...</div>
                  ) : (
                    <div className="space-y-4">
                      {allTickets?.map((ticket) => (
                        <div key={ticket.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <p className="font-medium">Ticket #{ticket.ticketNumber}</p>
                              <Badge variant={
                                ticket.status === 'completed' ? 'default' :
                                ticket.status === 'ready' ? 'default' :
                                ticket.status === 'cancelled' ? 'destructive' :
                                ticket.status === 'transit' ? 'secondary' : 'outline'
                              }>
                                {ticket.status === 'cancelled' ? 'Archived' : ticket.status}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm text-gray-500 mr-2">
                                {ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString() : 'Unknown'}
                              </p>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setViewTicket(ticket)}
                                className="h-8 px-2"
                                data-testid={`button-view-ticket-${ticket.ticketNumber}`}
                              >
                                <Eye size={14} className="mr-1" />
                                View
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditTicketData(ticket)}
                                className="h-8 px-2"
                                data-testid={`button-edit-ticket-${ticket.ticketNumber}`}
                              >
                                <Edit size={14} className="mr-1" />
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setArchiveTicket(ticket)}
                                className="h-8 px-2 text-orange-600 border-orange-300 hover:bg-orange-50"
                                disabled={ticket.status === 'cancelled'}
                                data-testid={`button-archive-ticket-${ticket.ticketNumber}`}
                              >
                                <Archive size={14} className="mr-1" />
                                Archive
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setDeleteTicket(ticket)}
                                className="h-8 px-2 text-red-600 border-red-300 hover:bg-red-50"
                                data-testid={`button-delete-ticket-${ticket.ticketNumber}`}
                              >
                                <Trash2 size={14} className="mr-1" />
                                Delete
                              </Button>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-gray-600">
                            {ticket.guestName && (
                              <p><strong>Guest:</strong> {ticket.guestName}</p>
                            )}
                            {ticket.carMake && ticket.carModel && (
                              <p><strong>Vehicle:</strong> {ticket.carMake} {ticket.carModel}</p>
                            )}
                            {ticket.licensePlate && (
                              <p><strong>Plate:</strong> {ticket.licensePlate}</p>
                            )}
                            {ticket.parkingLocation && (
                              <p><strong>Parking:</strong> {ticket.parkingLocation}</p>
                            )}
                          </div>
                          
                          {ticket.staffNotes && (
                            <p className="text-sm text-gray-600 mt-2">
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

        {/* Add Ticket Modal */}
        <Dialog open={showAddTicket} onOpenChange={setShowAddTicket}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Ticket</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Ticket Number</label>
                <Input
                  value={newTicketData.ticketNumber}
                  onChange={(e) => setNewTicketData(prev => ({ ...prev, ticketNumber: e.target.value }))}
                  placeholder="Enter ticket number"
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Car Photo</label>
                <CarPhotoUploader 
                  onPhotoUploaded={handleNewTicketPhotoUpload}
                  currentPhoto={newTicketData.carPhoto}
                />
                {newTicketData.carPhoto && (
                  <img 
                    src={newTicketData.carPhoto} 
                    alt="Uploaded car" 
                    className="mt-2 w-full h-32 object-cover rounded border"
                  />
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">License Plate</label>
                <Input
                  value={newTicketData.licensePlate}
                  onChange={(e) => setNewTicketData(prev => ({ ...prev, licensePlate: e.target.value }))}
                  placeholder="Enter license plate"
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">Parking Sector</label>
                  <Select
                    value={newTicketData.parkingSector}
                    onValueChange={(value) => setNewTicketData(prev => ({ ...prev, parkingSector: value }))}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select sector" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A">Sector A</SelectItem>
                      <SelectItem value="B">Sector B</SelectItem>
                      <SelectItem value="C">Sector C</SelectItem>
                      <SelectItem value="T">Sector T</SelectItem>
                      <SelectItem value="E">Sector E</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Spot Number (1-100)</label>
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    value={newTicketData.parkingLocation}
                    onChange={(e) => setNewTicketData(prev => ({ ...prev, parkingLocation: e.target.value }))}
                    placeholder="e.g., 23"
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Staff Notes</label>
                <Textarea
                  value={newTicketData.staffNotes}
                  onChange={(e) => setNewTicketData(prev => ({ ...prev, staffNotes: e.target.value }))}
                  placeholder="Add any notes about the vehicle..."
                  className="mt-1"
                  rows={3}
                />
              </div>

              <div className="flex space-x-2 pt-4">
                <Button
                  onClick={() => addTicketMutation.mutate(newTicketData)}
                  disabled={addTicketMutation.isPending}
                  className="flex-1 bg-regis-navy hover:bg-blue-900"
                >
                  {addTicketMutation.isPending ? "Adding..." : "Add Ticket"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowAddTicket(false)}
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
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500">Parking Location</p>
                      <p className="font-medium">{viewTicket.parkingLocation || 'Not assigned'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Sector</p>
                      <p className="font-medium">{viewTicket.parkingSector || 'N/A'}</p>
                    </div>
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

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Parking Sector</label>
                    <Select
                      value={editTicketData.parkingSector || ''}
                      onValueChange={(value) => setEditTicketData({ ...editTicketData, parkingSector: value })}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select sector" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A">Sector A</SelectItem>
                        <SelectItem value="B">Sector B</SelectItem>
                        <SelectItem value="C">Sector C</SelectItem>
                        <SelectItem value="T">Sector T</SelectItem>
                        <SelectItem value="E">Sector E</SelectItem>
                      </SelectContent>
                    </Select>
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
                      parkingSector: editTicketData.parkingSector,
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