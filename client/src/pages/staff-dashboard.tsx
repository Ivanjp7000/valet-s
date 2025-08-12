import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CarPhotoUploader } from "@/components/car-photo-uploader";
import { Crown, Clock, Construction, Check, Timer, LogOut, Car, Camera, MapPin, User, Edit, Save, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { ValetTicket } from "@shared/schema";

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

  const updateStatusMutation = useMutation({
    mutationFn: async ({ ticketNumber, status }: { ticketNumber: string; status: string }) => {
      await apiRequest("PATCH", `/api/staff/tickets/${ticketNumber}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff/tickets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/staff/stats"] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to update ticket status",
        variant: "destructive",
      });
    },
  });

  const updateCarDetailsMutation = useMutation({
    mutationFn: async ({ ticketNumber, carDetails }: { 
      ticketNumber: string; 
      carDetails: {
        licensePlate: string;
        parkingLocation: string;
        parkingSector: string;
        staffNotes: string;
        carPhoto: string;
      }
    }) => {
      await apiRequest("PATCH", `/api/staff/tickets/${ticketNumber}/car-details`, carDetails);
    },
    onSuccess: () => {
      setEditingTicket(null);
      setCarFormData({
        licensePlate: "",
        parkingLocation: "",
        parkingSector: "",
        staffNotes: "",
        carPhoto: "",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/staff/tickets"] });
      toast({
        title: "Success",
        description: "Car details updated successfully",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to update car details",
        variant: "destructive",
      });
    },
  });

  // Handle WebSocket messages for real-time updates
  useEffect(() => {
    if (lastMessage) {
      const message = JSON.parse(lastMessage);
      if (message.type === 'ticket_created' || message.type === 'ticket_status_updated') {
        queryClient.invalidateQueries({ queryKey: ["/api/staff/tickets"] });
        queryClient.invalidateQueries({ queryKey: ["/api/staff/stats"] });
      }
    }
  }, [lastMessage, queryClient]);

  const handleStatusUpdate = (ticketNumber: string, status: string) => {
    updateStatusMutation.mutate({ ticketNumber, status });
  };

  const handleEditCarDetails = (ticket: ValetTicket) => {
    setEditingTicket(ticket);
    setCarFormData({
      licensePlate: ticket.licensePlate || "",
      parkingLocation: ticket.parkingLocation || "",
      parkingSector: ticket.parkingSector || "",
      staffNotes: ticket.staffNotes || "",
      carPhoto: ticket.carPhoto || "",
    });
  };

  const handleSaveCarDetails = (ticketNumber: string) => {
    updateCarDetailsMutation.mutate({
      ticketNumber,
      carDetails: carFormData,
    });
  };

  const handleCancelEdit = () => {
    setEditingTicket(null);
    setCarFormData({
      licensePlate: "",
      parkingLocation: "",
      parkingSector: "",
      staffNotes: "",
      carPhoto: "",
    });
  };

  const handleCarPhotoUpload = (photoUrl: string) => {
    setCarFormData(prev => ({ ...prev, carPhoto: photoUrl }));
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'retrieving': return <Clock className="text-yellow-600" size={20} />;
      case 'transit': return <Construction className="text-blue-600" size={20} />;
      case 'ready': return <Check className="text-green-600" size={20} />;
      default: return <Clock className="text-gray-600" size={20} />;
    }
  };

  const getTimeAgo = (dateString: string) => {
    const now = new Date();
    const created = new Date(dateString);
    const diffInMinutes = Math.floor((now.getTime() - created.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes === 1) return "1 minute ago";
    return `${diffInMinutes} minutes ago`;
  };

  return (
    <div className="min-h-screen bg-soft-gray">
      {/* Staff Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-regis-navy rounded-lg flex items-center justify-center mr-3">
              <Crown className="text-regis-gold" size={20} />
            </div>
            <div>
              <h1 className="font-semibold text-regis-navy">Valet Management</h1>
              <p className="text-sm text-gray-600">{user?.role === 'superadmin' ? 'Super Admin' : 'Standard User'}</p>
            </div>
          </div>
          <a href="/api/logout" className="text-gray-500 hover:text-gray-700">
            <LogOut className="mr-2 inline-block" size={18} />
            Logout
          </a>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Active Requests */}
        <Card className="mb-8 shadow-sm">
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold text-regis-navy mb-6 flex items-center">
              <Clock className="mr-3 text-regis-gold" size={20} />
              Active Requests
            </h2>

            {ticketsLoading ? (
              <div className="text-center py-8">Loading...</div>
            ) : activeTickets?.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No active requests</div>
            ) : (
              <div className="space-y-6">
                {activeTickets?.map((ticket: any) => (
                  <div key={ticket.id} className="border border-gray-200 rounded-lg p-6 bg-white">
                    {/* Ticket Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center">
                        <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mr-4">
                          {getStatusIcon(ticket.status)}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">Ticket #{ticket.ticketNumber}</p>
                          <p className="text-sm text-gray-600">Submitted {getTimeAgo(ticket.createdAt)}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Select 
                          value={ticket.status} 
                          onValueChange={(status) => handleStatusUpdate(ticket.ticketNumber, status)}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="retrieving">Retrieving Car</SelectItem>
                            <SelectItem value="transit">Car in Transit</SelectItem>
                            <SelectItem value="ready">Car Ready</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowCarDetails(showCarDetails === ticket.id ? null : ticket.id)}
                          className="flex items-center space-x-2"
                        >
                          <Car size={16} />
                          <span>Car Details</span>
                        </Button>
                      </div>
                    </div>

                    {/* Car Details Section */}
                    {showCarDetails === ticket.id && (
                      <div className="border-t pt-4">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Current Car Info */}
                          <div className="space-y-4">
                            <h3 className="font-medium text-gray-900 flex items-center">
                              <Car className="mr-2" size={16} />
                              Vehicle Information
                            </h3>
                            
                            {ticket.carPhoto && (
                              <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Car Photo</label>
                                <img 
                                  src={`${ticket.carPhoto}`} 
                                  alt="Car" 
                                  className="w-full h-48 object-cover rounded-lg border"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                  }}
                                />
                              </div>
                            )}
                            
                            <div className="space-y-3">
                              <div>
                                <label className="text-sm font-medium text-gray-700">License Plate</label>
                                <p className="text-gray-900 bg-gray-50 p-2 rounded border">
                                  {ticket.licensePlate || "Not provided"}
                                </p>
                              </div>
                              
                              <div>
                                <label className="text-sm font-medium text-gray-700">Parking Location</label>
                                <p className="text-gray-900 bg-gray-50 p-2 rounded border">
                                  {ticket.parkingSector && ticket.parkingLocation 
                                    ? `${ticket.parkingSector}${ticket.parkingLocation}` 
                                    : "Not assigned"}
                                </p>
                              </div>
                              
                              <div>
                                <label className="text-sm font-medium text-gray-700">Staff Notes</label>
                                <p className="text-gray-900 bg-gray-50 p-2 rounded border min-h-[60px]">
                                  {ticket.staffNotes || "No notes"}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Edit Car Details Form */}
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <h3 className="font-medium text-gray-900 flex items-center">
                                <Edit className="mr-2" size={16} />
                                Update Car Details
                              </h3>
                              {editingTicket?.id === ticket.id && (
                                <div className="flex space-x-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleCancelEdit}
                                  >
                                    <X size={16} className="mr-1" />
                                    Cancel
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => handleSaveCarDetails(ticket.ticketNumber)}
                                    disabled={updateCarDetailsMutation.isPending}
                                  >
                                    <Save size={16} className="mr-1" />
                                    Save
                                  </Button>
                                </div>
                              )}
                            </div>

                            {editingTicket?.id === ticket.id ? (
                              <div className="space-y-4">
                                {/* Car Photo Upload */}
                                <div>
                                  <label className="text-sm font-medium text-gray-700 mb-2 block">Car Photo</label>
                                  <CarPhotoUploader 
                                    onPhotoUploaded={handleCarPhotoUpload}
                                    currentPhoto={carFormData.carPhoto}
                                  />
                                  {carFormData.carPhoto && (
                                    <img 
                                      src={carFormData.carPhoto} 
                                      alt="Uploaded car" 
                                      className="mt-2 w-full h-32 object-cover rounded border"
                                    />
                                  )}
                                </div>

                                {/* License Plate */}
                                <div>
                                  <label className="text-sm font-medium text-gray-700">License Plate</label>
                                  <Input
                                    value={carFormData.licensePlate}
                                    onChange={(e) => setCarFormData(prev => ({ ...prev, licensePlate: e.target.value }))}
                                    placeholder="Enter license plate"
                                    className="mt-1"
                                  />
                                </div>

                                {/* Parking Details */}
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="text-sm font-medium text-gray-700">Parking Sector</label>
                                    <Select
                                      value={carFormData.parkingSector}
                                      onValueChange={(value) => setCarFormData(prev => ({ ...prev, parkingSector: value }))}
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
                                      value={carFormData.parkingLocation}
                                      onChange={(e) => setCarFormData(prev => ({ ...prev, parkingLocation: e.target.value }))}
                                      placeholder="Enter spot number (1-100)"
                                      className="mt-1"
                                    />
                                  </div>
                                </div>
                                
                                {/* Live Preview of Parking Location */}
                                {carFormData.parkingSector && carFormData.parkingLocation && (
                                  <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                                    <p className="text-sm text-blue-700">
                                      <strong>Parking Location:</strong> {carFormData.parkingSector}{carFormData.parkingLocation}
                                    </p>
                                  </div>
                                )}

                                {/* Staff Notes */}
                                <div>
                                  <label className="text-sm font-medium text-gray-700">Staff Notes</label>
                                  <Textarea
                                    value={carFormData.staffNotes}
                                    onChange={(e) => setCarFormData(prev => ({ ...prev, staffNotes: e.target.value }))}
                                    placeholder="Add any notes about the vehicle..."
                                    className="mt-1"
                                    rows={3}
                                  />
                                </div>
                              </div>
                            ) : (
                              <Button
                                variant="outline"
                                onClick={() => handleEditCarDetails(ticket)}
                                className="w-full"
                              >
                                <Edit size={16} className="mr-2" />
                                Edit Car Details
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="shadow-sm">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                <Clock className="text-blue-600" size={20} />
              </div>
              <p className="text-2xl font-bold text-gray-900">{statsLoading ? '-' : stats?.pending || 0}</p>
              <p className="text-sm text-gray-600">Pending</p>
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
      </div>
    </div>
  );
}
