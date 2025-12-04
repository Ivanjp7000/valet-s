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
import { Crown, HelpCircle, Settings, Users, LogOut, Edit, Trash2, Plus, Building, MapPin, Shield, TicketIcon, Eye, EyeOff, Home } from "lucide-react";
import { Link } from "wouter";
import { apiRequest, queryClient as qc } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { Faq, SystemSetting, OrganizationalUnit, PhysicalLocation, User } from "@shared/schema";

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
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-regis-gold rounded-lg flex items-center justify-center mr-4">
              {isSuperAdmin ? <Shield className="text-regis-navy" size={24} /> : <Crown className="text-regis-navy" size={24} />}
            </div>
            <div>
              <h1 className="text-xl font-semibold">
                {isSuperAdmin ? "Super Admin Dashboard" : "Admin Dashboard"}
              </h1>
              <p className="text-blue-200 text-sm">
                {isSuperAdmin ? "Multi-Tenant Management System" : userOUName || "Organization Management"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {isPrivilegeAdmin && userOUName && (
              <Badge className="bg-blue-600 text-white">{userOUName}</Badge>
            )}
            <Link href="/">
              <Button
                variant="outline"
                className="border-blue-300 text-blue-200 hover:bg-blue-800 hover:text-white"
                data-testid="button-back-home"
              >
                <Home className="mr-2" size={18} />
                Home
              </Button>
            </Link>
            <a href="/api/logout" className="flex items-center text-blue-200 hover:text-white" data-testid="link-logout">
              <LogOut className="mr-2" size={18} />
              Logout
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className={`grid w-full ${isSuperAdmin ? 'grid-cols-5' : 'grid-cols-3'}`}>
            {isSuperAdmin && (
              <TabsTrigger value="ous" className="flex items-center gap-2" data-testid="tab-ous">
                <Building size={16} />
                Organizations
              </TabsTrigger>
            )}
            <TabsTrigger value="locations" className="flex items-center gap-2" data-testid="tab-locations">
              <MapPin size={16} />
              Locations
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2" data-testid="tab-users">
              <Users size={16} />
              {isPrivilegeAdmin ? "Staff" : "Users"}
            </TabsTrigger>
            {isSuperAdmin && (
              <TabsTrigger value="faqs" className="flex items-center gap-2" data-testid="tab-faqs">
                <HelpCircle size={16} />
                FAQs
              </TabsTrigger>
            )}
            <TabsTrigger value="settings" className="flex items-center gap-2" data-testid="tab-settings">
              <Settings size={16} />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ous" className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-regis-navy">Organizations</h2>
                <p className="text-gray-600">Manage client companies using the valet system</p>
              </div>
              <Button onClick={() => setShowAddOU(true)} className="bg-regis-navy hover:bg-blue-900" data-testid="button-add-ou">
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

          <TabsContent value="locations" className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-regis-navy">Physical Locations</h2>
                <p className="text-gray-600">
                  {isPrivilegeAdmin 
                    ? `Manage locations for ${userOUName || 'your organization'}`
                    : "Manage buildings and sites where valet service operates"}
                </p>
              </div>
              <Button onClick={() => {
                if (isPrivilegeAdmin && user?.ouId) {
                  setNewLocation({ ...newLocation, ouId: user.ouId });
                }
                setShowAddLocation(true);
              }} className="bg-regis-navy hover:bg-blue-900" disabled={isSuperAdmin && !ous?.length} data-testid="button-add-location">
                <Plus size={16} className="mr-2" />
                Add Location
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                {locationsLoading ? (
                  <p className="p-6 text-gray-500">Loading locations...</p>
                ) : filteredLocations?.length === 0 ? (
                  <p className="p-6 text-gray-500">
                    {isPrivilegeAdmin 
                      ? "No locations found for your organization. Add one to get started."
                      : "No locations found. Create an organization first, then add locations."}
                  </p>
                ) : (
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left p-4 font-medium text-gray-600">Location</th>
                        <th className="text-left p-4 font-medium text-gray-600">Code</th>
                        {isSuperAdmin && <th className="text-left p-4 font-medium text-gray-600">Organization</th>}
                        <th className="text-left p-4 font-medium text-gray-600">Address</th>
                        <th className="text-right p-4 font-medium text-gray-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLocations?.map((loc) => (
                        <tr key={loc.id} className="border-t" data-testid={`row-location-${loc.id}`}>
                          <td className="p-4 font-medium">{loc.name}</td>
                          <td className="p-4"><Badge variant="outline">{loc.code}</Badge></td>
                          {isSuperAdmin && <td className="p-4 text-gray-600">{getOUName(loc.ouId)}</td>}
                          <td className="p-4 text-gray-600">{loc.address || "—"}</td>
                          <td className="p-4 text-right">
                            <Button variant="ghost" size="icon" onClick={() => setEditingLocation(loc)} data-testid={`button-edit-location-${loc.id}`}>
                              <Edit size={16} className="text-blue-600" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => {
                              if (confirm("Delete this location?")) {
                                deleteLocationMutation.mutate(loc.id);
                              }
                            }} data-testid={`button-delete-location-${loc.id}`}>
                              <Trash2 size={16} className="text-red-600" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-regis-navy">
                  {isPrivilegeAdmin ? "Staff Management" : "User Management"}
                </h2>
                <p className="text-gray-600">
                  {isPrivilegeAdmin 
                    ? `Manage staff accounts for ${userOUName || 'your organization'}`
                    : "Manage all admin accounts across organizations"}
                </p>
              </div>
              <Button onClick={() => {
                if (isPrivilegeAdmin && user?.ouId) {
                  setNewUser({ ...newUser, ouId: user.ouId, role: 'standard_admin' });
                }
                setShowAddUser(true);
              }} className="bg-regis-navy hover:bg-blue-900" data-testid="button-add-user">
                <Plus size={16} className="mr-2" />
                {isPrivilegeAdmin ? "Add Staff" : "Add User"}
              </Button>
            </div>

            {isSuperAdmin && (
              <div className="grid grid-cols-3 gap-4 mb-6">
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-purple-600">{users?.filter(u => u.role === 'superadmin').length || 0}</p>
                    <p className="text-sm text-gray-600">Super Admins</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-blue-600">{users?.filter(u => u.role === 'privilege_admin').length || 0}</p>
                    <p className="text-sm text-gray-600">Privilege Admins</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-gray-600">{users?.filter(u => u.role === 'standard_admin').length || 0}</p>
                    <p className="text-sm text-gray-600">Standard Admins</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {isPrivilegeAdmin && (
              <div className="grid grid-cols-2 gap-4 mb-6">
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-blue-600">{filteredUsers?.filter(u => u.role === 'privilege_admin').length || 0}</p>
                    <p className="text-sm text-gray-600">Privilege Admins</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-gray-600">{filteredUsers?.filter(u => u.role === 'standard_admin').length || 0}</p>
                    <p className="text-sm text-gray-600">Staff Members</p>
                  </CardContent>
                </Card>
              </div>
            )}

            <Card>
              <CardContent className="p-0">
                {usersLoading ? (
                  <p className="p-6 text-gray-500">Loading users...</p>
                ) : filteredUsers?.length === 0 ? (
                  <p className="p-6 text-gray-500">
                    {isPrivilegeAdmin ? "No staff members found. Add one to get started." : "No users found."}
                  </p>
                ) : (
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left p-4 font-medium text-gray-600">User</th>
                        <th className="text-left p-4 font-medium text-gray-600">Username</th>
                        <th className="text-left p-4 font-medium text-gray-600">Role</th>
                        {isSuperAdmin && <th className="text-left p-4 font-medium text-gray-600">Organization</th>}
                        <th className="text-left p-4 font-medium text-gray-600">Location</th>
                        <th className="text-right p-4 font-medium text-gray-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers?.map((u) => (
                        <tr key={u.id} className="border-t" data-testid={`row-user-${u.id}`}>
                          <td className="p-4">
                            <div>
                              <p className="font-medium">{u.firstName} {u.lastName}</p>
                              <p className="text-sm text-gray-500">{u.email}</p>
                            </div>
                          </td>
                          <td className="p-4 text-gray-600">{u.username}</td>
                          <td className="p-4">
                            <Badge className={`${getRoleBadgeColor(u.role)} text-white`}>
                              {u.role === 'superadmin' ? 'Super Admin' : u.role === 'privilege_admin' ? 'Privilege Admin' : 'Standard Admin'}
                            </Badge>
                          </td>
                          {isSuperAdmin && <td className="p-4 text-gray-600">{getOUName(u.ouId)}</td>}
                          <td className="p-4 text-gray-600">{getLocationName(u.locationId)}</td>
                          <td className="p-4 text-right">
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
                  </SelectContent>
                </Select>
              </div>
            )}
            {isPrivilegeAdmin && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Role</p>
                <p className="font-medium text-regis-navy">Standard Admin (Staff)</p>
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
                    </SelectContent>
                  </Select>
                </div>
              )}
              {isPrivilegeAdmin && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">Role</p>
                  <p className="font-medium text-regis-navy">
                    {editingUser.role === 'privilege_admin' ? 'Privilege Admin' : 'Standard Admin'}
                  </p>
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
    </div>
  );
}
