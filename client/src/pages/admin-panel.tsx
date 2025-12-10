import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Crown, HelpCircle, Settings, Users, LogOut, Edit, Trash2, Plus, Building, MapPin, Shield, TicketIcon, Eye, EyeOff, Home, Car } from "lucide-react";
import { Link } from "wouter";
import { apiRequest, queryClient as qc } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { ValetTicketWizard } from "@/components/valet-ticket-wizard";
import type { Faq, SystemSetting, OrganizationalUnit, PhysicalLocation, User, UserLocationScope } from "@shared/schema";

export default function AdminPanel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const isSuperAdmin = user?.role === 'superadmin';
  const isPrivilegeAdmin = user?.role === 'privilege_admin';
  const defaultTab = isSuperAdmin ? "ous" : "locations";
  const [activeTab, setActiveTab] = useState(defaultTab);

  const [editingFaq, setEditingFaq] = useState<any>(null);
  const [newFaq, setNewFaq] = useState({ question: "", answer: "" });

  const [showAddOU, setShowAddOU] = useState(false);
  const [newOU, setNewOU] = useState({ name: "", code: "", contactEmail: "", contactPhone: "" });
  const [editingOU, setEditingOU] = useState<OrganizationalUnit | null>(null);

  const [showAddLocation, setShowAddLocation] = useState(false);
  const [newLocation, setNewLocation] = useState({ name: "", address: "", code: "", ouId: "" });
  const [editingLocation, setEditingLocation] = useState<PhysicalLocation | null>(null);

  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({ 
    username: "", password: "", email: "", firstName: "", lastName: "", 
    role: "standard_admin", ouId: "", locationId: "" 
  });
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUserPassword, setEditUserPassword] = useState("");
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showTicketWizard, setShowTicketWizard] = useState(false);
  const [managingUserScopes, setManagingUserScopes] = useState<User | null>(null);
  const [userLocationScopes, setUserLocationScopes] = useState<UserLocationScope[]>([]);

  const { data: faqs, isLoading: faqsLoading } = useQuery<Faq[]>({
    queryKey: ["/api/faqs"],
  });

  const { data: ous, isLoading: ousLoading } = useQuery<OrganizationalUnit[]>({
    queryKey: ["/api/ous"],
  });

  const { data: locations, isLoading: locationsLoading } = useQuery<PhysicalLocation[]>({
    queryKey: ["/api/locations"],
  });

  const { data: users, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const handleError = (error: any, defaultMsg: string) => {
    if (isUnauthorizedError(error)) {
      toast({ title: "Unauthorized", description: "Session expired. Redirecting...", variant: "destructive" });
      setTimeout(() => { window.location.href = "/api/login"; }, 500);
      return;
    }
    toast({ title: "Error", description: defaultMsg, variant: "destructive" });
  };

  const createOUMutation = useMutation({
    mutationFn: async (ou: typeof newOU) => await apiRequest("POST", "/api/ous", ou),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ous"] });
      setShowAddOU(false);
      setNewOU({ name: "", code: "", contactEmail: "", contactPhone: "" });
      toast({ title: "Success", description: "Organization created successfully" });
    },
    onError: (error) => handleError(error, "Failed to create organization"),
  });

  const updateOUMutation = useMutation({
    mutationFn: async (ou: OrganizationalUnit) => await apiRequest("PATCH", `/api/ous/${ou.id}`, ou),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ous"] });
      setEditingOU(null);
      toast({ title: "Success", description: "Organization updated successfully" });
    },
    onError: (error) => handleError(error, "Failed to update organization"),
  });

  const deleteOUMutation = useMutation({
    mutationFn: async (id: string) => await apiRequest("DELETE", `/api/ous/${id}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ous"] });
      toast({ title: "Success", description: "Organization deleted successfully" });
    },
    onError: (error) => handleError(error, "Failed to delete organization"),
  });

  const createLocationMutation = useMutation({
    mutationFn: async (loc: typeof newLocation) => await apiRequest("POST", "/api/locations", loc),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
      setShowAddLocation(false);
      setNewLocation({ name: "", address: "", code: "", ouId: "" });
      toast({ title: "Success", description: "Location created successfully" });
    },
    onError: (error) => handleError(error, "Failed to create location"),
  });

  const updateLocationMutation = useMutation({
    mutationFn: async (loc: PhysicalLocation) => await apiRequest("PATCH", `/api/locations/${loc.id}`, loc),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
      setEditingLocation(null);
      toast({ title: "Success", description: "Location updated successfully" });
    },
    onError: (error) => handleError(error, "Failed to update location"),
  });

  const deleteLocationMutation = useMutation({
    mutationFn: async (id: string) => await apiRequest("DELETE", `/api/locations/${id}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
      toast({ title: "Success", description: "Location deleted successfully" });
    },
    onError: (error) => handleError(error, "Failed to delete location"),
  });

  const createUserMutation = useMutation({
    mutationFn: async (userData: typeof newUser) => await apiRequest("POST", "/api/users", userData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setShowAddUser(false);
      setNewUser({ username: "", password: "", email: "", firstName: "", lastName: "", role: "standard_admin", ouId: "", locationId: "" });
      toast({ title: "Success", description: "User created successfully" });
    },
    onError: (error) => handleError(error, "Failed to create user"),
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ userData, password }: { userData: User; password?: string }) => {
      const updatePayload: any = {
        username: userData.username,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role,
        ouId: userData.ouId,
        locationId: userData.locationId,
      };
      if (password) {
        updatePayload.password = password;
      }
      return await apiRequest("PATCH", `/api/users/${userData.id}`, updatePayload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setEditingUser(null);
      setEditUserPassword("");
      setShowEditPassword(false);
      toast({ title: "Success", description: "User updated successfully" });
    },
    onError: (error) => handleError(error, "Failed to update user"),
  });

  const fetchUserLocationScopes = async (userId: string) => {
    try {
      const response = await fetch(`/api/users/${userId}/location-scopes`);
      if (response.ok) {
        const scopes = await response.json();
        setUserLocationScopes(scopes);
      }
    } catch (error) {
      console.error("Error fetching location scopes:", error);
    }
  };

  const addLocationScopeMutation = useMutation({
    mutationFn: async ({ userId, locationId }: { userId: string; locationId: string }) => 
      await apiRequest("POST", `/api/users/${userId}/location-scopes`, { locationId }),
    onSuccess: () => {
      if (managingUserScopes) {
        fetchUserLocationScopes(managingUserScopes.id);
      }
      toast({ title: "Success", description: "Location added to user's access" });
    },
    onError: (error) => handleError(error, "Failed to add location access"),
  });

  const removeLocationScopeMutation = useMutation({
    mutationFn: async ({ userId, locationId }: { userId: string; locationId: string }) => 
      await apiRequest("DELETE", `/api/users/${userId}/location-scopes/${locationId}`, {}),
    onSuccess: () => {
      if (managingUserScopes) {
        fetchUserLocationScopes(managingUserScopes.id);
      }
      toast({ title: "Success", description: "Location removed from user's access" });
    },
    onError: (error) => handleError(error, "Failed to remove location access"),
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => await apiRequest("DELETE", `/api/users/${id}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Success", description: "User deleted successfully" });
    },
    onError: (error) => handleError(error, "Failed to delete user"),
  });

  const createFaqMutation = useMutation({
    mutationFn: async (faq: { question: string; answer: string }) => await apiRequest("POST", "/api/admin/faqs", faq),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/faqs"] });
      setNewFaq({ question: "", answer: "" });
      toast({ title: "Success", description: "FAQ created successfully" });
    },
    onError: (error) => handleError(error, "Failed to create FAQ"),
  });

  const updateFaqMutation = useMutation({
    mutationFn: async (faq: any) => await apiRequest("PATCH", `/api/admin/faqs/${faq.id}`, { question: faq.question, answer: faq.answer }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/faqs"] });
      setEditingFaq(null);
      toast({ title: "Success", description: "FAQ updated successfully" });
    },
    onError: (error) => handleError(error, "Failed to update FAQ"),
  });

  const deleteFaqMutation = useMutation({
    mutationFn: async (id: string) => await apiRequest("DELETE", `/api/admin/faqs/${id}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/faqs"] });
      toast({ title: "Success", description: "FAQ deleted successfully" });
    },
    onError: (error) => handleError(error, "Failed to delete FAQ"),
  });

  const getOUName = (ouId: string | null | undefined) => {
    if (!ouId) return "—";
    const ou = ous?.find(o => o.id === ouId);
    return ou?.name || "Unknown";
  };

  const getLocationName = (locationId: string | null | undefined) => {
    if (!locationId) return "—";
    const loc = locations?.find(l => l.id === locationId);
    return loc?.name || "Unknown";
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'superadmin': return 'bg-purple-600';
      case 'privilege_admin': return 'bg-blue-600';
      default: return 'bg-gray-600';
    }
  };

  const userOUName = user?.ouId ? getOUName(user.ouId) : null;
  
  const filteredLocations = isPrivilegeAdmin && user?.ouId 
    ? locations?.filter(l => l.ouId === user.ouId) 
    : locations;
  
  const filteredUsers = isPrivilegeAdmin && user?.ouId
    ? users?.filter(u => u.ouId === user.ouId && u.role !== 'superadmin')
    : users;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-regis-navy text-white">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center min-w-0">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-regis-gold rounded-lg flex items-center justify-center mr-3 sm:mr-4 flex-shrink-0">
                {isSuperAdmin ? <Shield className="text-regis-navy" size={20} /> : <Crown className="text-regis-navy" size={20} />}
              </div>
              <div className="min-w-0">
                <h1 className="text-base sm:text-xl font-semibold truncate">
                  {isSuperAdmin ? "Super Admin" : "Admin Panel"}
                </h1>
                <p className="text-blue-200 text-xs sm:text-sm truncate">
                  {isSuperAdmin ? "Multi-Tenant System" : userOUName || "Management"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
              {isPrivilegeAdmin && userOUName && (
                <Badge className="bg-blue-600 text-white text-xs hidden sm:inline-flex">{userOUName}</Badge>
              )}
              <Button 
                onClick={() => setShowTicketWizard(true)}
                size="sm"
                className="bg-regis-gold hover:bg-yellow-600 text-regis-navy font-semibold px-2 sm:px-3"
                data-testid="button-new-valet-ticket"
              >
                <Car size={16} />
                <span className="hidden sm:inline ml-2">New Ticket</span>
              </Button>
              <Link href="/">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-regis-gold bg-regis-gold/10 text-regis-navy hover:bg-regis-gold hover:text-regis-navy px-2 sm:px-3"
                  data-testid="button-back-home"
                >
                  <Home size={16} className="text-regis-gold" />
                  <span className="hidden sm:inline ml-2 text-white">Home</span>
                </Button>
              </Link>
              <a href="/api/logout" className="flex items-center text-blue-200 hover:text-white p-2" data-testid="link-logout">
                <LogOut size={16} />
                <span className="hidden sm:inline ml-2">Logout</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
          <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
            <TabsList className={`inline-flex w-auto min-w-full sm:grid sm:w-full ${isSuperAdmin ? 'sm:grid-cols-5' : 'sm:grid-cols-3'}`}>
              {isSuperAdmin && (
                <TabsTrigger value="ous" className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 text-xs sm:text-sm whitespace-nowrap" data-testid="tab-ous">
                  <Building size={14} />
                  <span className="hidden sm:inline">Organizations</span>
                  <span className="sm:hidden">Orgs</span>
                </TabsTrigger>
              )}
              <TabsTrigger value="locations" className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 text-xs sm:text-sm whitespace-nowrap" data-testid="tab-locations">
                <MapPin size={14} />
                <span className="hidden sm:inline">Locations</span>
                <span className="sm:hidden">Loc</span>
              </TabsTrigger>
              <TabsTrigger value="users" className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 text-xs sm:text-sm whitespace-nowrap" data-testid="tab-users">
                <Users size={14} />
                <span className="hidden sm:inline">{isPrivilegeAdmin ? "Staff" : "Users"}</span>
                <span className="sm:hidden">Users</span>
              </TabsTrigger>
              {isSuperAdmin && (
                <TabsTrigger value="faqs" className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 text-xs sm:text-sm whitespace-nowrap" data-testid="tab-faqs">
                  <HelpCircle size={14} />
                  <span>FAQs</span>
                </TabsTrigger>
              )}
              <TabsTrigger value="settings" className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 text-xs sm:text-sm whitespace-nowrap" data-testid="tab-settings">
                <Settings size={14} />
                <span className="hidden sm:inline">Settings</span>
                <span className="sm:hidden">Set</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="ous" className="space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
              <div>
                <h2 className="text-lg sm:text-2xl font-bold text-regis-navy">Organizations</h2>
                <p className="text-xs sm:text-base text-gray-600">Manage client companies</p>
              </div>
              <Button onClick={() => setShowAddOU(true)} size="sm" className="bg-regis-navy hover:bg-blue-900 w-full sm:w-auto" data-testid="button-add-ou">
                <Plus size={16} className="mr-2" />
                Add Organization
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {ousLoading ? (
                <p className="text-gray-500">Loading organizations...</p>
              ) : ous?.length === 0 ? (
                <p className="text-gray-500">No organizations found. Create one to get started.</p>
              ) : (
                ous?.map((ou) => (
                  <Card key={ou.id} className="shadow-sm" data-testid={`card-ou-${ou.id}`}>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Building className="text-blue-600" size={20} />
                        </div>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="icon" onClick={() => setEditingOU(ou)} data-testid={`button-edit-ou-${ou.id}`}>
                            <Edit size={16} className="text-blue-600" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => {
                            if (confirm("Delete this organization? This will affect all users and locations.")) {
                              deleteOUMutation.mutate(ou.id);
                            }
                          }} data-testid={`button-delete-ou-${ou.id}`}>
                            <Trash2 size={16} className="text-red-600" />
                          </Button>
                        </div>
                      </div>
                      <h3 className="font-semibold text-lg text-regis-navy">{ou.name}</h3>
                      <Badge variant="outline" className="mt-2">{ou.code}</Badge>
                      {ou.contactEmail && <p className="text-sm text-gray-600 mt-2">{ou.contactEmail}</p>}
                      <div className="mt-4 pt-4 border-t flex justify-between text-sm text-gray-500">
                        <span>{locations?.filter(l => l.ouId === ou.id).length || 0} locations</span>
                        <span>{users?.filter(u => u.ouId === ou.id).length || 0} users</span>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="locations" className="space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
              <div>
                <h2 className="text-lg sm:text-2xl font-bold text-regis-navy">Locations</h2>
                <p className="text-xs sm:text-base text-gray-600">
                  {isPrivilegeAdmin 
                    ? `Manage locations for ${userOUName || 'your org'}`
                    : "Manage valet service locations"}
                </p>
              </div>
              <Button onClick={() => {
                if (isPrivilegeAdmin && user?.ouId) {
                  setNewLocation({ ...newLocation, ouId: user.ouId });
                }
                setShowAddLocation(true);
              }} size="sm" className="bg-regis-navy hover:bg-blue-900 w-full sm:w-auto" disabled={isSuperAdmin && !ous?.length} data-testid="button-add-location">
                <Plus size={16} className="mr-2" />
                Add Location
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                {locationsLoading ? (
                  <p className="p-4 sm:p-6 text-gray-500">Loading locations...</p>
                ) : filteredLocations?.length === 0 ? (
                  <p className="p-4 sm:p-6 text-gray-500 text-sm">
                    {isPrivilegeAdmin 
                      ? "No locations found. Add one to get started."
                      : "No locations found. Create an organization first."}
                  </p>
                ) : (
                  <div className="space-y-2 p-2 sm:hidden">
                    {/* Mobile card view */}
                    {filteredLocations?.map((loc) => (
                      <div key={loc.id} className="border rounded-lg p-3 bg-gray-50" data-testid={`card-location-${loc.id}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-xs flex-shrink-0">{loc.code}</Badge>
                              <span className="font-medium text-sm truncate">{loc.name}</span>
                            </div>
                            {isSuperAdmin && (
                              <p className="text-xs text-gray-500 truncate">Org: {getOUName(loc.ouId)}</p>
                            )}
                            {loc.address && (
                              <p className="text-xs text-gray-500 truncate mt-1">{loc.address}</p>
                            )}
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingLocation(loc)} data-testid={`button-edit-location-${loc.id}`}>
                              <Edit size={14} className="text-blue-600" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                              if (confirm("Delete this location?")) {
                                deleteLocationMutation.mutate(loc.id);
                              }
                            }} data-testid={`button-delete-location-${loc.id}`}>
                              <Trash2 size={14} className="text-red-600" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {/* Desktop table view */}
                {filteredLocations && filteredLocations.length > 0 && (
                  <div className="overflow-x-auto hidden sm:block">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          {isSuperAdmin && <th className="text-left p-4 font-medium text-gray-600 text-sm">Org</th>}
                          <th className="text-left p-4 font-medium text-gray-600 text-sm">Code</th>
                          <th className="text-left p-4 font-medium text-gray-600 text-sm">Location</th>
                          <th className="text-left p-4 font-medium text-gray-600 text-sm">Address</th>
                          <th className="text-right p-4 font-medium text-gray-600 text-sm">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredLocations?.map((loc) => (
                          <tr key={loc.id} className="border-t" data-testid={`row-location-${loc.id}`}>
                            {isSuperAdmin && <td className="p-4 text-gray-600 text-sm truncate max-w-[120px]">{getOUName(loc.ouId)}</td>}
                            <td className="p-4"><Badge variant="outline" className="text-xs">{loc.code}</Badge></td>
                            <td className="p-4 font-medium text-sm">{loc.name}</td>
                            <td className="p-4 text-gray-600 text-sm truncate max-w-[200px]">{loc.address || "—"}</td>
                            <td className="p-4 text-right">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingLocation(loc)} data-testid={`button-edit-location-${loc.id}`}>
                                <Edit size={14} className="text-blue-600" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                                if (confirm("Delete this location?")) {
                                  deleteLocationMutation.mutate(loc.id);
                                }
                              }} data-testid={`button-delete-location-${loc.id}`}>
                                <Trash2 size={14} className="text-red-600" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
              <div>
                <h2 className="text-lg sm:text-2xl font-bold text-regis-navy">
                  {isPrivilegeAdmin ? "Staff" : "Users"}
                </h2>
                <p className="text-xs sm:text-base text-gray-600">
                  {isPrivilegeAdmin 
                    ? `Manage staff for ${userOUName || 'your org'}`
                    : "Manage admin accounts"}
                </p>
              </div>
              <Button onClick={() => {
                if (isPrivilegeAdmin && user?.ouId) {
                  setNewUser({ ...newUser, ouId: user.ouId, role: 'standard_admin' });
                }
                setShowAddUser(true);
              }} size="sm" className="bg-regis-navy hover:bg-blue-900 w-full sm:w-auto" data-testid="button-add-user">
                <Plus size={16} className="mr-2" />
                {isPrivilegeAdmin ? "Add Staff" : "Add User"}
              </Button>
            </div>

            {isSuperAdmin && (
              <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-6">
                <Card>
                  <CardContent className="p-2 sm:p-4 text-center">
                    <p className="text-lg sm:text-2xl font-bold text-purple-600">{users?.filter(u => u.role === 'superadmin').length || 0}</p>
                    <p className="text-xs sm:text-sm text-gray-600">Super</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-2 sm:p-4 text-center">
                    <p className="text-lg sm:text-2xl font-bold text-blue-600">{users?.filter(u => u.role === 'privilege_admin').length || 0}</p>
                    <p className="text-xs sm:text-sm text-gray-600">Privilege</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-2 sm:p-4 text-center">
                    <p className="text-lg sm:text-2xl font-bold text-gray-600">{users?.filter(u => u.role === 'standard_admin').length || 0}</p>
                    <p className="text-xs sm:text-sm text-gray-600">Standard</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {isPrivilegeAdmin && (
              <div className="grid grid-cols-2 gap-2 sm:gap-4 mb-4 sm:mb-6">
                <Card>
                  <CardContent className="p-2 sm:p-4 text-center">
                    <p className="text-lg sm:text-2xl font-bold text-blue-600">{filteredUsers?.filter(u => u.role === 'privilege_admin').length || 0}</p>
                    <p className="text-xs sm:text-sm text-gray-600">Privilege</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-2 sm:p-4 text-center">
                    <p className="text-lg sm:text-2xl font-bold text-gray-600">{filteredUsers?.filter(u => u.role === 'standard_admin').length || 0}</p>
                    <p className="text-xs sm:text-sm text-gray-600">Staff</p>
                  </CardContent>
                </Card>
              </div>
            )}

            <Card>
              <CardContent className="p-0">
                {usersLoading ? (
                  <p className="p-4 sm:p-6 text-gray-500">Loading users...</p>
                ) : filteredUsers?.length === 0 ? (
                  <p className="p-4 sm:p-6 text-gray-500 text-sm">
                    {isPrivilegeAdmin ? "No staff found. Add one to get started." : "No users found."}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[400px]">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left p-2 sm:p-4 font-medium text-gray-600 text-xs sm:text-sm">User</th>
                          <th className="text-left p-2 sm:p-4 font-medium text-gray-600 text-xs sm:text-sm hidden sm:table-cell">Username</th>
                          <th className="text-left p-2 sm:p-4 font-medium text-gray-600 text-xs sm:text-sm">Role</th>
                          {isSuperAdmin && <th className="text-left p-2 sm:p-4 font-medium text-gray-600 text-xs sm:text-sm hidden md:table-cell">Org</th>}
                          <th className="text-left p-2 sm:p-4 font-medium text-gray-600 text-xs sm:text-sm hidden md:table-cell">Location</th>
                          <th className="text-right p-2 sm:p-4 font-medium text-gray-600 text-xs sm:text-sm">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers?.map((u) => (
                          <tr key={u.id} className="border-t" data-testid={`row-user-${u.id}`}>
                            <td className="p-2 sm:p-4">
                              <div>
                                <p className="font-medium text-xs sm:text-sm truncate max-w-[100px] sm:max-w-none">{u.firstName} {u.lastName}</p>
                                <p className="text-xs text-gray-500 truncate max-w-[100px] sm:max-w-none">{u.email}</p>
                              </div>
                            </td>
                            <td className="p-2 sm:p-4 text-gray-600 text-xs sm:text-sm hidden sm:table-cell">{u.username}</td>
                            <td className="p-2 sm:p-4">
                              <Badge className={`${getRoleBadgeColor(u.role)} text-white text-xs`}>
                                {u.role === 'superadmin' ? 'Super' : u.role === 'privilege_admin' ? 'Priv' : 'Std'}
                              </Badge>
                            </td>
                            {isSuperAdmin && <td className="p-2 sm:p-4 text-gray-600 text-xs sm:text-sm hidden md:table-cell truncate max-w-[80px]">{getOUName(u.ouId)}</td>}
                            <td className="p-2 sm:p-4 text-gray-600 text-xs sm:text-sm hidden md:table-cell truncate max-w-[80px]">{getLocationName(u.locationId)}</td>
                            <td className="p-2 sm:p-4 text-right flex justify-end gap-1">
                            {u.role === 'standard_admin' && (isPrivilegeAdmin || isSuperAdmin) && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => {
                                  setManagingUserScopes(u);
                                  fetchUserLocationScopes(u.id);
                                }}
                                title="Manage Location Access"
                                data-testid={`button-manage-scopes-${u.id}`}
                              >
                                <MapPin size={16} className="text-green-600" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" onClick={() => { setEditingUser(u); setEditUserPassword(""); setShowEditPassword(false); }} data-testid={`button-edit-user-${u.id}`}>
                              <Edit size={16} className="text-blue-600" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => {
                              if (u.id === user?.id) {
                                toast({ title: "Error", description: "Cannot delete your own account", variant: "destructive" });
                                return;
                              }
                              if (confirm("Delete this user?")) {
                                deleteUserMutation.mutate(u.id);
                              }
                            }} data-testid={`button-delete-user-${u.id}`}>
                              <Trash2 size={16} className="text-red-600" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="faqs" className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-regis-navy">FAQ Management</h2>
                <p className="text-gray-600">Manage frequently asked questions for customers</p>
              </div>
            </div>

            <Card>
              <CardContent className="p-6">
                <div className="space-y-4 mb-6">
                  {faqsLoading ? (
                    <p className="text-gray-500">Loading FAQs...</p>
                  ) : faqs?.length === 0 ? (
                    <p className="text-gray-500">No FAQs found</p>
                  ) : (
                    faqs?.map((faq: any) => (
                      <div key={faq.id} className="border border-gray-200 rounded-lg p-4" data-testid={`card-faq-${faq.id}`}>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-medium text-gray-900">{faq.question}</h3>
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="icon" onClick={() => setEditingFaq(faq)}>
                              <Edit size={16} className="text-blue-600" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => {
                              if (confirm("Delete this FAQ?")) {
                                deleteFaqMutation.mutate(faq.id);
                              }
                            }}>
                              <Trash2 size={16} className="text-red-600" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600">{faq.answer}</p>
                      </div>
                    ))
                  )}
                </div>

                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full border-2 border-dashed border-gray-300 hover:border-regis-gold" data-testid="button-add-faq">
                      <Plus className="mr-2" size={16} />
                      Add New FAQ
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New FAQ</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <Input placeholder="Question" value={newFaq.question} onChange={(e) => setNewFaq({ ...newFaq, question: e.target.value })} data-testid="input-faq-question" />
                      <Textarea placeholder="Answer" value={newFaq.answer} onChange={(e) => setNewFaq({ ...newFaq, answer: e.target.value })} data-testid="input-faq-answer" />
                      <Button onClick={() => createFaqMutation.mutate(newFaq)} className="w-full bg-regis-navy hover:bg-blue-900" disabled={createFaqMutation.isPending} data-testid="button-submit-faq">
                        Create FAQ
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>System Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Average Retrieval Time (minutes)</label>
                  <Input type="number" defaultValue="5" min="1" max="30" data-testid="input-avg-retrieval-time" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Maximum Queue Size</label>
                  <Input type="number" defaultValue="20" min="5" max="100" data-testid="input-max-queue-size" />
                </div>
                <Button className="w-full bg-regis-navy hover:bg-blue-900" data-testid="button-save-settings">
                  Save Settings
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={showAddOU} onOpenChange={setShowAddOU}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Organization</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Name</label>
              <Input value={newOU.name} onChange={(e) => setNewOU({ ...newOU, name: e.target.value })} placeholder="Sony Corporation" className="mt-1" data-testid="input-ou-name" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Code (unique identifier)</label>
              <Input value={newOU.code} onChange={(e) => setNewOU({ ...newOU, code: e.target.value.toUpperCase() })} placeholder="SONY" className="mt-1" data-testid="input-ou-code" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Contact Email</label>
              <Input type="email" value={newOU.contactEmail} onChange={(e) => setNewOU({ ...newOU, contactEmail: e.target.value })} placeholder="contact@sony.com" className="mt-1" data-testid="input-ou-email" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Contact Phone</label>
              <Input value={newOU.contactPhone} onChange={(e) => setNewOU({ ...newOU, contactPhone: e.target.value })} placeholder="+81 3 1234 5678" className="mt-1" data-testid="input-ou-phone" />
            </div>
            <Button onClick={() => createOUMutation.mutate(newOU)} className="w-full bg-regis-navy hover:bg-blue-900" disabled={createOUMutation.isPending || !newOU.name || !newOU.code} data-testid="button-submit-ou">
              {createOUMutation.isPending ? "Creating..." : "Create Organization"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {editingOU && (
        <Dialog open={!!editingOU} onOpenChange={() => setEditingOU(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Organization</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Name</label>
                <Input value={editingOU.name} onChange={(e) => setEditingOU({ ...editingOU, name: e.target.value })} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Code</label>
                <Input value={editingOU.code} onChange={(e) => setEditingOU({ ...editingOU, code: e.target.value.toUpperCase() })} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Contact Email</label>
                <Input type="email" value={editingOU.contactEmail || ""} onChange={(e) => setEditingOU({ ...editingOU, contactEmail: e.target.value })} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Contact Phone</label>
                <Input value={editingOU.contactPhone || ""} onChange={(e) => setEditingOU({ ...editingOU, contactPhone: e.target.value })} className="mt-1" />
              </div>
              <Button onClick={() => updateOUMutation.mutate(editingOU)} className="w-full bg-regis-navy hover:bg-blue-900" disabled={updateOUMutation.isPending}>
                {updateOUMutation.isPending ? "Updating..." : "Update Organization"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={showAddLocation} onOpenChange={setShowAddLocation}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Location</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {isSuperAdmin && (
              <div>
                <label className="text-sm font-medium text-gray-700">Organization</label>
                <Select value={newLocation.ouId} onValueChange={(value) => setNewLocation({ ...newLocation, ouId: value })}>
                  <SelectTrigger className="mt-1" data-testid="select-location-ou">
                    <SelectValue placeholder="Select organization" />
                  </SelectTrigger>
                  <SelectContent>
                    {ous?.map((ou) => (
                      <SelectItem key={ou.id} value={ou.id}>{ou.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {isPrivilegeAdmin && userOUName && (
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-gray-600">Organization</p>
                <p className="font-medium text-regis-navy">{userOUName}</p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-gray-700">Name</label>
              <Input value={newLocation.name} onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })} placeholder="Tokyo Headquarters" className="mt-1" data-testid="input-location-name" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Code</label>
              <Input value={newLocation.code} onChange={(e) => setNewLocation({ ...newLocation, code: e.target.value.toUpperCase() })} placeholder="TKY-HQ" className="mt-1" data-testid="input-location-code" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Address</label>
              <Textarea value={newLocation.address} onChange={(e) => setNewLocation({ ...newLocation, address: e.target.value })} placeholder="1-7-1 Konan, Minato-ku, Tokyo" className="mt-1" data-testid="input-location-address" />
            </div>
            <Button onClick={() => createLocationMutation.mutate(newLocation)} className="w-full bg-regis-navy hover:bg-blue-900" disabled={createLocationMutation.isPending || !newLocation.name || !newLocation.code || !newLocation.ouId} data-testid="button-submit-location">
              {createLocationMutation.isPending ? "Creating..." : "Create Location"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {editingLocation && (
        <Dialog open={!!editingLocation} onOpenChange={() => setEditingLocation(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Location</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {isSuperAdmin && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Organization</label>
                  <Select value={editingLocation.ouId} onValueChange={(value) => setEditingLocation({ ...editingLocation, ouId: value })}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ous?.map((ou) => (
                        <SelectItem key={ou.id} value={ou.id}>{ou.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {isPrivilegeAdmin && userOUName && (
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-600">Organization</p>
                  <p className="font-medium text-regis-navy">{userOUName}</p>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-gray-700">Name</label>
                <Input value={editingLocation.name} onChange={(e) => setEditingLocation({ ...editingLocation, name: e.target.value })} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Code</label>
                <Input value={editingLocation.code} onChange={(e) => setEditingLocation({ ...editingLocation, code: e.target.value.toUpperCase() })} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Address</label>
                <Textarea value={editingLocation.address || ""} onChange={(e) => setEditingLocation({ ...editingLocation, address: e.target.value })} className="mt-1" />
              </div>
              <Button onClick={() => updateLocationMutation.mutate(editingLocation)} className="w-full bg-regis-navy hover:bg-blue-900" disabled={updateLocationMutation.isPending}>
                {updateLocationMutation.isPending ? "Updating..." : "Update Location"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={showAddUser} onOpenChange={setShowAddUser}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">First Name</label>
                <Input value={newUser.firstName} onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })} placeholder="John" className="mt-1" data-testid="input-user-firstname" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Last Name</label>
                <Input value={newUser.lastName} onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })} placeholder="Smith" className="mt-1" data-testid="input-user-lastname" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Username</label>
              <Input value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} placeholder="jsmith" className="mt-1" data-testid="input-user-username" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Password</label>
              <div className="relative mt-1">
                <Input 
                  type={showNewPassword ? "text" : "password"} 
                  value={newUser.password} 
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} 
                  placeholder="••••••••" 
                  className="pr-10"
                  data-testid="input-user-password" 
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Email</label>
              <Input type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} placeholder="jsmith@company.com" className="mt-1" data-testid="input-user-email" />
            </div>
            {isSuperAdmin && (
              <div>
                <label className="text-sm font-medium text-gray-700">Role</label>
                <Select value={newUser.role} onValueChange={(value) => setNewUser({ ...newUser, role: value })}>
                  <SelectTrigger className="mt-1" data-testid="select-user-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="superadmin">Super Admin</SelectItem>
                    <SelectItem value="privilege_admin">Privilege Admin</SelectItem>
                    <SelectItem value="standard_admin">Standard Admin</SelectItem>
                    <SelectItem value="standard_user">Standard User (Read Only)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {isPrivilegeAdmin && (
              <div>
                <label className="text-sm font-medium text-gray-700">Role</label>
                <Select value={newUser.role} onValueChange={(value) => setNewUser({ ...newUser, role: value })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard_admin">Standard Admin (Staff)</SelectItem>
                    <SelectItem value="standard_user">Standard User (Read Only)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {isSuperAdmin && newUser.role !== 'superadmin' && (
              <div>
                <label className="text-sm font-medium text-gray-700">Organization</label>
                <Select value={newUser.ouId} onValueChange={(value) => setNewUser({ ...newUser, ouId: value, locationId: "" })}>
                  <SelectTrigger className="mt-1" data-testid="select-user-ou">
                    <SelectValue placeholder="Select organization" />
                  </SelectTrigger>
                  <SelectContent>
                    {ous?.map((ou) => (
                      <SelectItem key={ou.id} value={ou.id}>{ou.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {isPrivilegeAdmin && userOUName && (
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-gray-600">Organization</p>
                <p className="font-medium text-regis-navy">{userOUName}</p>
              </div>
            )}
            {(newUser.role !== 'superadmin' || isPrivilegeAdmin) && newUser.ouId && (
              <div>
                <label className="text-sm font-medium text-gray-700">Location (optional)</label>
                <Select value={newUser.locationId || "none"} onValueChange={(value) => setNewUser({ ...newUser, locationId: value === "none" ? "" : value })}>
                  <SelectTrigger className="mt-1" data-testid="select-user-location">
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No specific location</SelectItem>
                    {(isPrivilegeAdmin ? filteredLocations : locations?.filter(l => l.ouId === newUser.ouId))?.map((loc) => (
                      <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button onClick={() => createUserMutation.mutate(newUser)} className="w-full bg-regis-navy hover:bg-blue-900" disabled={createUserMutation.isPending || !newUser.username || !newUser.password} data-testid="button-submit-user">
              {createUserMutation.isPending ? "Creating..." : "Create User"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {editingUser && (
        <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">First Name</label>
                  <Input value={editingUser.firstName || ""} onChange={(e) => setEditingUser({ ...editingUser, firstName: e.target.value })} className="mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Last Name</label>
                  <Input value={editingUser.lastName || ""} onChange={(e) => setEditingUser({ ...editingUser, lastName: e.target.value })} className="mt-1" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Username</label>
                <Input value={editingUser.username || ""} onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value })} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Email</label>
                <Input type="email" value={editingUser.email || ""} onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">New Password (leave blank to keep current)</label>
                <div className="relative mt-1">
                  <Input 
                    type={showEditPassword ? "text" : "password"} 
                    value={editUserPassword} 
                    onChange={(e) => setEditUserPassword(e.target.value)} 
                    placeholder="Enter new password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showEditPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              {isSuperAdmin && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Role</label>
                  <Select value={editingUser.role} onValueChange={(value: any) => setEditingUser({ ...editingUser, role: value })}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="superadmin">Super Admin</SelectItem>
                      <SelectItem value="privilege_admin">Privilege Admin</SelectItem>
                      <SelectItem value="standard_admin">Standard Admin</SelectItem>
                      <SelectItem value="standard_user">Standard User (Read Only)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {isPrivilegeAdmin && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Role</label>
                  <Select value={editingUser.role} onValueChange={(value: any) => setEditingUser({ ...editingUser, role: value })}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard_admin">Standard Admin (Staff)</SelectItem>
                      <SelectItem value="standard_user">Standard User (Read Only)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {isSuperAdmin && editingUser.role !== 'superadmin' && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Organization</label>
                  <Select value={editingUser.ouId || ""} onValueChange={(value) => setEditingUser({ ...editingUser, ouId: value, locationId: null })}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select organization" />
                    </SelectTrigger>
                    <SelectContent>
                      {ous?.map((ou) => (
                        <SelectItem key={ou.id} value={ou.id}>{ou.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {isPrivilegeAdmin && userOUName && (
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-600">Organization</p>
                  <p className="font-medium text-regis-navy">{userOUName}</p>
                </div>
              )}
              {(editingUser.role !== 'superadmin' || isPrivilegeAdmin) && editingUser.ouId && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Location (optional)</label>
                  <Select value={editingUser.locationId || "none"} onValueChange={(value) => setEditingUser({ ...editingUser, locationId: value === "none" ? null : value })}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No specific location</SelectItem>
                      {(isPrivilegeAdmin ? filteredLocations : locations?.filter(l => l.ouId === editingUser.ouId))?.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button onClick={() => updateUserMutation.mutate({ userData: editingUser, password: editUserPassword || undefined })} className="w-full bg-regis-navy hover:bg-blue-900" disabled={updateUserMutation.isPending}>
                {updateUserMutation.isPending ? "Updating..." : "Update User"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {editingFaq && (
        <Dialog open={!!editingFaq} onOpenChange={() => setEditingFaq(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit FAQ</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input placeholder="Question" value={editingFaq.question} onChange={(e) => setEditingFaq({ ...editingFaq, question: e.target.value })} />
              <Textarea placeholder="Answer" value={editingFaq.answer} onChange={(e) => setEditingFaq({ ...editingFaq, answer: e.target.value })} />
              <Button onClick={() => updateFaqMutation.mutate(editingFaq)} className="w-full bg-regis-navy hover:bg-blue-900" disabled={updateFaqMutation.isPending}>
                Update FAQ
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Location Scope Management Dialog */}
      {managingUserScopes && (
        <Dialog open={!!managingUserScopes} onOpenChange={() => setManagingUserScopes(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Manage Location Access</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-gray-600">Staff Member</p>
                <p className="font-medium text-regis-navy">
                  {managingUserScopes.firstName} {managingUserScopes.lastName}
                </p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Current Location Access</label>
                {userLocationScopes.length === 0 ? (
                  <p className="text-sm text-gray-500 italic p-3 bg-gray-50 rounded-lg">
                    No specific locations assigned - user has access to all locations in their organization
                  </p>
                ) : (
                  <div className="space-y-2">
                    {userLocationScopes.map((scope) => {
                      const location = locations?.find(l => l.id === scope.locationId);
                      return (
                        <div key={scope.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <MapPin size={16} className="text-green-600" />
                            <span className="font-medium">{location?.name || 'Unknown Location'}</span>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => removeLocationScopeMutation.mutate({ 
                              userId: managingUserScopes.id, 
                              locationId: scope.locationId 
                            })}
                            disabled={removeLocationScopeMutation.isPending}
                            data-testid={`button-remove-scope-${scope.locationId}`}
                          >
                            <Trash2 size={16} className="text-red-600" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Add Location Access</label>
                <Select 
                  value="" 
                  onValueChange={(locationId) => {
                    if (locationId) {
                      addLocationScopeMutation.mutate({ 
                        userId: managingUserScopes.id, 
                        locationId 
                      });
                    }
                  }}
                >
                  <SelectTrigger data-testid="select-add-location-scope">
                    <SelectValue placeholder="Select a location to add..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(isPrivilegeAdmin ? filteredLocations : locations?.filter(l => l.ouId === managingUserScopes.ouId))
                      ?.filter(loc => !userLocationScopes.some(s => s.locationId === loc.id))
                      .map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="p-3 bg-yellow-50 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> If no specific locations are assigned, the staff member will have access to all locations in their organization. 
                  Assigning specific locations will restrict their access to only those locations.
                </p>
              </div>
              
              <Button 
                onClick={() => setManagingUserScopes(null)} 
                className="w-full bg-regis-navy hover:bg-blue-900"
                data-testid="button-close-scope-dialog"
              >
                Done
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Valet Ticket Wizard */}
      <ValetTicketWizard 
        isOpen={showTicketWizard}
        onClose={() => setShowTicketWizard(false)}
        user={user}
      />
    </div>
  );
}
