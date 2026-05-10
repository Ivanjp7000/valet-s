import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Crown, LogOut, Users, Settings, Car, Building, MapPin, Shield, Minimize2, Maximize2, FileText } from "lucide-react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { OrganizationalUnit, PhysicalLocation, User } from "@shared/schema";

export default function Home() {
  const { user } = useAuth();
  const [compactView, setCompactView] = useState(false);

  const { data: ous } = useQuery<OrganizationalUnit[]>({
    queryKey: ["/api/ous"],
    enabled: user?.role === 'superadmin',
  });

  const { data: locations } = useQuery<PhysicalLocation[]>({
    queryKey: ["/api/locations"],
    enabled: user?.role === 'superadmin',
  });

  const { data: users } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: user?.role === 'superadmin',
  });

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'superadmin': return 'Super Admin';
      case 'privilege_admin': return 'Privilege Admin';
      case 'standard_admin': return 'Standard Admin';
      case 'standard_user': return 'Standard User';
      default: return role;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'superadmin': return 'bg-purple-600';
      case 'privilege_admin': return 'bg-blue-600';
      case 'standard_user': return 'bg-green-600';
      default: return 'bg-gray-600';
    }
  };

  return (
    <div className="min-h-screen bg-soft-gray">
      <div className="bg-regis-navy text-white">
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-regis-gold rounded-lg flex items-center justify-center mr-4">
              <Crown className="text-regis-navy" size={24} />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Valet Management System</h1>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-blue-200 text-sm">Welcome, {user?.firstName || user?.username}</p>
                <Badge className={`${getRoleColor(user?.role || '')} text-white text-xs`}>
                  {getRoleLabel(user?.role || '')}
                </Badge>
              </div>
            </div>
          </div>
          <a 
            href="/api/logout"
            className="flex items-center text-blue-200 hover:text-white" 
            data-testid="link-logout"
          >
            <LogOut className="mr-2" size={18} />
            Logout
          </a>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        {/* Compact View Toggle - visible on mobile only */}
        <div className="sm:hidden flex justify-end mb-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCompactView(!compactView)}
            className="text-xs"
            data-testid="button-toggle-compact-view"
          >
            {compactView ? <Maximize2 size={14} className="mr-1" /> : <Minimize2 size={14} className="mr-1" />}
            {compactView ? "Extended View" : "Standard View"}
          </Button>
        </div>

        {/* Compact View for Mobile */}
        {compactView && (
          <div className="sm:hidden space-y-2">
            {/* Compact Operations Dashboard */}
            <Link href="/staff">
              <div className="bg-white border rounded-lg p-3 flex items-center gap-3 shadow-sm active:bg-gray-50">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Car className="text-blue-600" size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-regis-navy text-sm">Operations Dashboard</h3>
                  <p className="text-xs text-gray-500 truncate">Manage valet requests & tickets</p>
                </div>
                <Button size="sm" className="bg-regis-navy hover:bg-blue-900 text-xs px-3" data-testid="button-staff-dashboard-compact">
                  Open
                </Button>
              </div>
            </Link>

            {/* Compact Admin Panel */}
            {(user?.role === 'superadmin' || user?.role === 'privilege_admin') && (
              <Link href="/admin">
                <div className="bg-white border rounded-lg p-3 flex items-center gap-3 shadow-sm active:bg-gray-50">
                  <div className="w-10 h-10 bg-regis-gold/20 rounded-full flex items-center justify-center flex-shrink-0">
                    {user?.role === 'superadmin' ? (
                      <Shield className="text-regis-gold" size={20} />
                    ) : (
                      <Settings className="text-regis-gold" size={20} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-regis-navy text-sm">
                      {user?.role === 'superadmin' ? 'Super Admin' : 'Admin Panel'}
                    </h3>
                    <p className="text-xs text-gray-500 truncate">Manage settings & users</p>
                  </div>
                  <Button size="sm" className="bg-regis-gold hover:bg-yellow-600 text-regis-navy text-xs px-3" data-testid="button-admin-panel-compact">
                    Open
                  </Button>
                </div>
              </Link>
            )}

            {/* Compact Documentation */}
            <Link href="/docs">
              <div className="bg-white border rounded-lg p-3 flex items-center gap-3 shadow-sm active:bg-gray-50">
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <FileText className="text-gray-500" size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-regis-navy text-sm">Documentation</h3>
                  <p className="text-xs text-gray-500 truncate">System guides & references</p>
                </div>
                <Button size="sm" variant="outline" className="text-xs px-3">
                  Open
                </Button>
              </div>
            </Link>

            {/* Compact System Overview */}
            {user?.role === 'superadmin' && (
              <div className="bg-white border-2 border-purple-200 rounded-lg p-3 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Building className="text-purple-600" size={16} />
                  <h3 className="font-semibold text-regis-navy text-sm">System Overview</h3>
                </div>
                <div className="flex justify-around text-center">
                  <div>
                    <p className="text-lg font-bold text-purple-600">{ous?.length ?? 0}</p>
                    <p className="text-xs text-gray-500">Orgs</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-purple-600">{locations?.length ?? 0}</p>
                    <p className="text-xs text-gray-500">Locations</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-purple-600">{users?.length ?? 0}</p>
                    <p className="text-xs text-gray-500">Users</p>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}

        {/* Standard View - hidden on mobile when compact is active */}
        <div className={compactView ? "hidden sm:block" : ""}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <Card className="shadow-lg" data-testid="card-staff-dashboard">
              <CardContent className="p-6 sm:p-8 text-center">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                  <Car className="text-blue-600" size={24} />
                </div>
                <h2 className="text-lg sm:text-xl font-semibold text-regis-navy mb-2">Operations Dashboard</h2>
                <p className="text-gray-600 mb-4 sm:mb-6 text-xs sm:text-sm">Manage active valet requests, update ticket status, and view daily statistics</p>
                <Link href="/staff">
                  <Button className="w-full bg-regis-navy hover:bg-blue-900" data-testid="button-staff-dashboard">
                    Access Operations
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {(user?.role === 'superadmin' || user?.role === 'privilege_admin') && (
              <Card className="shadow-lg" data-testid="card-admin-panel">
                <CardContent className="p-6 sm:p-8 text-center">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 bg-regis-gold/20 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                    {user?.role === 'superadmin' ? (
                      <Shield className="text-regis-gold" size={24} />
                    ) : (
                      <Settings className="text-regis-gold" size={24} />
                    )}
                  </div>
                  <h2 className="text-lg sm:text-xl font-semibold text-regis-navy mb-2">
                    {user?.role === 'superadmin' ? 'Super Admin Panel' : 'Admin Panel'}
                  </h2>
                  <p className="text-gray-600 mb-4 sm:mb-6 text-xs sm:text-sm">
                    {user?.role === 'superadmin' 
                      ? 'Manage organizations, locations, all users, and system settings'
                      : 'Manage locations and staff within your organization'}
                  </p>
                  <Link href="/admin">
                    <Button className="w-full bg-regis-gold hover:bg-yellow-600 text-regis-navy font-medium" data-testid="button-admin-panel">
                      Access Admin Panel
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}

            <Card className="shadow-lg" data-testid="card-documentation">
              <CardContent className="p-6 sm:p-8 text-center">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                  <FileText className="text-gray-500" size={24} />
                </div>
                <h2 className="text-lg sm:text-xl font-semibold text-regis-navy mb-2">Documentation</h2>
                <p className="text-gray-600 mb-4 sm:mb-6 text-xs sm:text-sm">System guides, feature references, and operational instructions</p>
                <Link href="/docs">
                  <Button variant="outline" className="w-full border-regis-navy text-regis-navy hover:bg-regis-navy/5 font-medium">
                    Open Documentation
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {user?.role === 'superadmin' && (
              <Card className="shadow-lg border-2 border-purple-200" data-testid="card-super-admin-stats">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Building className="text-purple-600" size={20} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-regis-navy">System Overview</h3>
                      <p className="text-xs text-gray-500">Multi-tenant statistics</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b">
                      <span className="text-sm text-gray-600">Organizations</span>
                      <span className="font-semibold text-regis-navy">{ous?.length ?? 0}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b">
                      <span className="text-sm text-gray-600">Locations</span>
                      <span className="font-semibold text-regis-navy">{locations?.length ?? 0}</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-sm text-gray-600">Total Users</span>
                      <span className="font-semibold text-regis-navy">{users?.length ?? 0}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
