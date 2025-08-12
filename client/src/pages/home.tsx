import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Crown, LogOut, Users, Settings } from "lucide-react";
import { Link } from "wouter";

export default function Home() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-soft-gray">
      {/* Header */}
      <div className="bg-regis-navy text-white">
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-regis-gold rounded-lg flex items-center justify-center mr-4">
              <Crown className="text-regis-navy" size={24} />
            </div>
            <div>
              <h1 className="text-xl font-semibold">St. Regis Osaka Valet</h1>
              <p className="text-blue-200 text-sm">Welcome back, {user?.firstName || user?.email}</p>
            </div>
          </div>
          <a href="/api/logout" className="text-blue-200 hover:text-white">
            <LogOut className="mr-2 inline-block" size={18} />
            Logout
          </a>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Staff Dashboard Access */}
          <Card className="shadow-lg">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="text-blue-600" size={32} />
              </div>
              <h2 className="text-xl font-semibold text-regis-navy mb-4">Staff Dashboard</h2>
              <p className="text-gray-600 mb-6">Manage active valet requests and view statistics</p>
              <Link href="/staff">
                <Button className="w-full bg-regis-navy hover:bg-blue-900">
                  Access Dashboard
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Admin Panel Access (Super Admin Only) */}
          {user?.role === 'superadmin' && (
            <Card className="shadow-lg">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-regis-gold/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Settings className="text-regis-gold" size={32} />
                </div>
                <h2 className="text-xl font-semibold text-regis-navy mb-4">Admin Panel</h2>
                <p className="text-gray-600 mb-6">Manage FAQs, system settings, and user accounts</p>
                <Link href="/admin">
                  <Button className="w-full bg-regis-gold hover:bg-yellow-600">
                    Access Admin Panel
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
