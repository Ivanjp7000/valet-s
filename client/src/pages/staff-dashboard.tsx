import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Crown, Clock, Construction, Check, Timer, LogOut } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { ValetTicket } from "@shared/schema";

export default function StaffDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
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
              <div className="space-y-4">
                {activeTickets?.map((ticket: any) => (
                  <div key={ticket.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
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
                          variant="ghost"
                          size="icon"
                          onClick={() => handleStatusUpdate(ticket.ticketNumber, 'completed')}
                          className="text-green-600 hover:text-green-800"
                        >
                          <Check size={18} />
                        </Button>
                      </div>
                    </div>
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
