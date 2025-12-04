import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Crown, LogOut, Users, Settings, Car, Building, MapPin, Shield } from "lucide-react";
import { Link } from "wouter";

export default function Home() {
  const { user } = useAuth();

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'superadmin': return 'Super Admin';
      case 'privilege_admin': return 'Privilege Admin';
      case 'standard_admin': return 'Standard Admin';
      default: return role;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'superadmin': return 'bg-purple-600';
      case 'privilege_admin': return 'bg-blue-600';
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
          <a href="/api/logout" className="flex items-center text-blue-200 hover:text-white" data-testid="link-logout">
            <LogOut className="mr-2" size={18} />
            Logout
          </a>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="shadow-lg" data-testid="card-staff-dashboard">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Car className="text-blue-600" size={32} />
              </div>
              <h2 className="text-xl font-semibold text-regis-navy mb-2">Operations Dashboard</h2>
              <p className="text-gray-600 mb-6 text-sm">Manage active valet requests, update ticket status, and view daily statistics</p>
              <Link href="/staff">
                <Button className="w-full bg-regis-navy hover:bg-blue-900" data-testid="button-staff-dashboard">
                  Access Operations
                </Button>
              </Link>
            </CardContent>
          </Card>

          {(user?.role === 'superadmin' || user?.role === 'privilege_admin') && (
            <Card className="shadow-lg" data-testid="card-admin-panel">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-regis-gold/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  {user?.role === 'superadmin' ? (
                    <Shield className="text-regis-gold" size={32} />
                  ) : (
                    <Settings className="text-regis-gold" size={32} />
                  )}
                </div>
                <h2 className="text-xl font-semibold text-regis-navy mb-2">
                  {user?.role === 'superadmin' ? 'Super Admin Panel' : 'Admin Panel'}
                </h2>
                <p className="text-gray-600 mb-6 text-sm">
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

          {user?.role === 'superadmin' && (
            <Card className="shadow-lg border-2 border-purple-200" data-testid="card-super-admin-stats">
              <CardContent className="p-6">
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
                    <span className="font-semibold text-regis-navy">—</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm text-gray-600">Locations</span>
                    <span className="font-semibold text-regis-navy">—</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-gray-600">Total Users</span>
                    <span className="font-semibold text-regis-navy">—</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h3 className="font-medium text-regis-navy mb-2">Your Access Level</h3>
          {user?.role === 'superadmin' && (
            <p className="text-sm text-gray-600">
              As a Super Admin, you have full access to manage all organizations, locations, and users across the entire system.
            </p>
          )}
          {user?.role === 'privilege_admin' && (
            <p className="text-sm text-gray-600">
              As a Privilege Admin, you can manage locations and standard admin accounts within your assigned organization.
            </p>
          )}
          {user?.role === 'standard_admin' && (
            <p className="text-sm text-gray-600">
              As a Standard Admin, you can manage daily valet operations including ticket handling and vehicle tracking.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
